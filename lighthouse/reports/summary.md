# Lighthouse — medianas de 3 execuções

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| inicio | mobile | 79 | 100 | 100 | 100 | 4120 ms | 0.021 | 198 ms |
| inicio | desktop | 99 | 100 | 100 | 100 | 758 ms | 0 | 0 ms |
| detalhe | mobile | 83 | 100 | 100 | 100 | 3684 ms | 0 | 119 ms |
| detalhe | desktop | 99 | 100 | 100 | 100 | 813 ms | 0.022 | 0 ms |

## Ambiente

```json
{
  "date": "2026-10-07T01:59:04.285Z",
  "lighthouse": "13.5.0",
  "browser": "Chrome/153.0.8010.12",
  "node": "v20.19.6",
  "os": "Windows_NT 10.0.26200 (x64)",
  "cpu": "Intel(R) Core(TM) Ultra 9 285",
  "memoryGb": 32,
  "conditions": {
    "build": "vite build (produção) servido por vite preview",
    "mocks": "MSW ativo, cenário padrão",
    "mobile": "preset padrão do Lighthouse (Moto G Power, throttling simulado 4G lento, CPU 4x)",
    "desktop": "preset desktop do Lighthouse (throttling simulado de banda larga, CPU 1x)",
    "runs": 3
  }
}
```
