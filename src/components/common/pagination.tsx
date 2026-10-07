import { ArrowRight2Icon } from '@/components/icons'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}

function pageWindow(page: number, total: number) {
  const pages = new Set([1, total, page - 1, page, page + 1])
  return [...pages].filter((value) => value >= 1 && value <= total).sort((a, b) => a - b)
}

export function Pagination({ page, totalPages, onChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages = totalPages <= 5 ? Array.from({ length: totalPages }, (_, index) => index + 1) : pageWindow(page, totalPages)
  const base = 'flex size-[35px] items-center justify-center rounded-sm border text-lg transition-[color,background-color,border-color,scale] duration-300 ease-spring motion-safe:active:scale-90'
  return (
    <nav aria-label="Paginação do catálogo" className={cn('flex justify-end', className)}>
      <ul className="flex items-center gap-2">
        {page > 1 && (
          <li>
            <button type="button" className={cn(base, 'border-line hover:border-primary')} onClick={() => onChange(page - 1)} aria-label="Página anterior">
              <ArrowRight2Icon className="size-[18px] rotate-180" />
            </button>
          </li>
        )}
        {pages.map((value, index) => (
          <li key={value} className="flex items-center gap-2">
            {index > 0 && value - pages[index - 1] > 1 && (
              <span aria-hidden="true" className="text-khaki">
                …
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(value)}
              aria-current={value === page ? 'page' : undefined}
              aria-label={`Página ${value}`}
              className={cn(base, value === page ? 'border-primary bg-primary font-bold text-ink' : 'border-line hover:border-primary')}
            >
              {value}
            </button>
          </li>
        ))}
        {page < totalPages && (
          <li>
            <button type="button" className={cn(base, 'border-line hover:border-primary')} onClick={() => onChange(page + 1)} aria-label="Próxima página">
              <ArrowRight2Icon className="size-[18px]" />
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}
