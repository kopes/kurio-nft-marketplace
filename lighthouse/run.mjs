/**
 * Auditoria Lighthouse versionada.
 *
 * - Usa o build otimizado (`pnpm build`) servido por `vite preview`, com o cenário padrão dos mocks.
 * - Audita Início e Detalhe do NFT nos perfis mobile e desktop, 3 execuções cada.
 * - Salva relatórios HTML/JSON por execução e um resumo com a mediana de cada categoria,
 *   LCP, CLS e TBT, versões das ferramentas e condições de execução.
 *
 * Uso: pnpm build && pnpm lighthouse   (CHROME_PATH opcional; padrão: Chromium do Playwright)
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'
import { config as audit } from './config.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'lighthouse', 'reports')
const baseUrl = `http://localhost:${audit.port}`

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // aguardando o servidor
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(audit.port), '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' })
  const results = []
  const chromePath = process.env.CHROME_PATH || chromium.executablePath()
  let browserVersion = 'desconhecida'

  /** Cada medição usa um Chrome novo (perfil limpo, sem cache/Service Worker); repete uma vez em caso de falha. */
  async function measure(url, config) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] })
      try {
        browserVersion = (await (await fetch(`http://127.0.0.1:${chrome.port}/json/version`)).json()).Browser
        return await lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: audit.categories }, config)
      } catch (error) {
        if (attempt === 2) throw error
        console.warn(`Falha na medição (${error.message}); repetindo…`)
      } finally {
        await chrome.kill()
      }
    }
  }

  try {
    await waitForServer(baseUrl)

    for (const page of audit.pages) {
      for (const profile of audit.profiles) {
        for (let run = 1; run <= audit.runs; run++) {
          const config = profile === 'desktop' ? desktopConfig : undefined
          const runner = await measure(`${baseUrl}${page.path}`, config)
          const lhr = runner.lhr
          const name = `${page.id}-${profile}-${run}`
          await writeFile(path.join(outDir, `${name}.report.html`), runner.report[0])
          await writeFile(path.join(outDir, `${name}.report.json`), runner.report[1])
          const entry = {
            page: page.id,
            path: page.path,
            profile,
            run,
            scores: Object.fromEntries(audit.categories.map((category) => [category, Math.round(lhr.categories[category].score * 100)])),
            metrics: {
              LCP: lhr.audits['largest-contentful-paint'].numericValue,
              CLS: lhr.audits['cumulative-layout-shift'].numericValue,
              TBT: lhr.audits['total-blocking-time'].numericValue,
            },
          }
          results.push(entry)
          console.log(name, JSON.stringify(entry.scores), `LCP ${Math.round(entry.metrics.LCP)}ms CLS ${entry.metrics.CLS.toFixed(3)} TBT ${Math.round(entry.metrics.TBT)}ms`)
        }
      }
    }

    const summary = []
    for (const page of audit.pages) {
      for (const profile of audit.profiles) {
        const runs = results.filter((item) => item.page === page.id && item.profile === profile)
        summary.push({
          page: page.id,
          profile,
          median: Object.fromEntries(audit.categories.map((category) => [category, median(runs.map((item) => item.scores[category]))])),
          metrics: {
            LCP: Math.round(median(runs.map((item) => item.metrics.LCP))),
            CLS: Number(median(runs.map((item) => item.metrics.CLS)).toFixed(3)),
            TBT: Math.round(median(runs.map((item) => item.metrics.TBT))),
          },
        })
      }
    }

    const { default: lighthousePkg } = await import('lighthouse/package.json', { with: { type: 'json' } })
    const environment = {
      date: new Date().toISOString(),
      lighthouse: lighthousePkg.version,
      browser: browserVersion,
      node: process.version,
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpu: os.cpus()[0]?.model,
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      conditions: {
        build: 'vite build (produção) servido por vite preview',
        mocks: 'MSW ativo, cenário padrão',
        mobile: 'preset padrão do Lighthouse (Moto G Power, throttling simulado 4G lento, CPU 4x)',
        desktop: 'preset desktop do Lighthouse (throttling simulado de banda larga, CPU 1x)',
        runs: audit.runs,
      },
    }

    await writeFile(path.join(outDir, 'summary.json'), JSON.stringify({ environment, summary, results }, null, 2))
    const header = '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |\n|---|---|---:|---:|---:|---:|---:|---:|---:|'
    const rows = summary.map(
      (item) =>
        `| ${item.page} | ${item.profile} | ${item.median.performance} | ${item.median.accessibility} | ${item.median['best-practices']} | ${item.median.seo} | ${item.metrics.LCP} ms | ${item.metrics.CLS} | ${item.metrics.TBT} ms |`,
    )
    const markdown = `# Lighthouse — medianas de ${audit.runs} execuções\n\n${header}\n${rows.join('\n')}\n\n## Ambiente\n\n\`\`\`json\n${JSON.stringify(environment, null, 2)}\n\`\`\`\n`
    await writeFile(path.join(outDir, 'summary.md'), markdown)
    console.log(`\n${header}\n${rows.join('\n')}`)
  } finally {
    server.kill()
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' })
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
