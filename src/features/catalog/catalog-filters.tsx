import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import type { FacetOption, NftListResponse } from '@/shared/contracts'
import { cn } from '@/lib/utils'
import type { CatalogSearch } from './search'
import { joinList, selectedCollections, selectedNetworks } from './search'

interface FiltersProps {
  search: CatalogSearch
  facets: NftListResponse['facets'] | undefined
  onChange: (patch: Partial<CatalogSearch>) => void
  className?: string
}

const toCents = (value: string) => Math.round(Number(value) * 100)
const fromCents = (value: number) => (value / 100).toFixed(2)
const brl = (value: number) => (value / 100).toFixed(2).replace('.', ',')

function FacetList({
  title,
  options,
  selected,
  onToggle,
  accentCount,
}: {
  title: string
  options: FacetOption[] | undefined
  selected: string[]
  onToggle: (id: string) => void
  accentCount?: boolean
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg leading-4 font-bold">{title}</legend>
      <ul className="flex flex-col px-3">
        {options
          ? options.map((option) => {
              const active = selected.includes(option.id)
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggle(option.id)}
                    disabled={option.count === 0 && !active}
                    className={cn(
                      'flex h-10 w-full items-center justify-between gap-3 rounded-sm text-left text-[15px] transition-colors hover:text-highlight disabled:cursor-not-allowed disabled:opacity-45',
                      active ? 'text-highlight' : 'text-sand',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn('size-2 rounded-full border border-current transition-colors', active ? 'bg-current' : 'bg-transparent')}
                      />
                      {option.label}
                    </span>
                    <span className={cn('tabular-nums', accentCount && 'font-bold')}>({option.count})</span>
                  </button>
                </li>
              )
            })
          : Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="flex h-10 items-center justify-between">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-8" />
              </li>
            ))}
      </ul>
    </fieldset>
  )
}

function PriceFilter(props: FiltersProps) {
  const { search, facets } = props
  const bounds = facets ? { min: toCents(facets.price.min), max: Math.max(toCents(facets.price.max), toCents(facets.price.min) + 1) } : null
  const current: [number, number] | null = bounds
    ? [
        search.precoMin ? Math.max(bounds.min, toCents(search.precoMin)) : bounds.min,
        search.precoMax ? Math.min(bounds.max, toCents(search.precoMax)) : bounds.max,
      ]
    : null
  // A chave reinicia o rascunho do slider quando a URL ou os limites mudam.
  return <PriceFilterControl key={`${bounds?.min}-${bounds?.max}-${current?.join('-')}`} {...props} bounds={bounds} current={current} />
}

function PriceFilterControl({
  search,
  onChange,
  bounds,
  current,
}: FiltersProps & { bounds: { min: number; max: number } | null; current: [number, number] | null }) {
  const [draft, setDraft] = useState<[number, number] | null>(current)

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-4 text-lg leading-4 font-bold">Faixa de preço</legend>
      {bounds && draft ? (
        <>
          <Slider
            min={bounds.min}
            max={bounds.max}
            step={1}
            minStepsBetweenThumbs={1}
            value={draft}
            onValueChange={(value) => setDraft([value[0], value[1]])}
            thumbLabels={['Preço mínimo em ETH', 'Preço máximo em ETH']}
            thumbValueText={(value) => `${fromCents(value)} ETH`}
            className="px-3"
          />
          <p className="px-3 text-[15px]" aria-live="polite">
            Preço: {brl(draft[0])} - {brl(draft[1])} ETH
          </p>
          <div className="flex gap-3 px-3">
            <Button
              size="sm"
              className="h-9 px-3 text-base"
              onClick={() =>
                onChange({
                  precoMin: draft[0] > bounds.min ? fromCents(draft[0]) : undefined,
                  precoMax: draft[1] < bounds.max ? fromCents(draft[1]) : undefined,
                })
              }
            >
              Aplicar
            </Button>
            {(search.precoMin || search.precoMax) && (
              <Button size="sm" variant="ghost" className="h-9" onClick={() => onChange({ precoMin: undefined, precoMax: undefined })}>
                Limpar
              </Button>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4 px-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      )}
    </fieldset>
  )
}

/** Filtros combináveis; qualquer alteração reinicia a paginação (feito em `onChange`). */
export function CatalogFilters({ search, facets, onChange, className }: FiltersProps) {
  const collections = selectedCollections(search)
  const networks = selectedNetworks(search)
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id])

  return (
    <div className={cn('flex flex-col gap-10 bg-card p-5', className)}>
      <FacetList
        title="Coleções"
        options={facets?.collections}
        selected={collections}
        accentCount
        onToggle={(id) => onChange({ colecoes: joinList(toggle(collections, id)) })}
      />
      <PriceFilter search={search} facets={facets} onChange={onChange} />
      <FacetList title="Rede" options={facets?.networks} selected={networks} onToggle={(id) => onChange({ redes: joinList(toggle(networks, id)) })} />
    </div>
  )
}
