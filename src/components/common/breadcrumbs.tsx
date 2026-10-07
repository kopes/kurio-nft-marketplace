import { Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn('hidden text-[15px] font-bold md:block', className)}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <Fragment key={item.label}>
            {index > 0 && (
              <li aria-hidden="true" className="text-foreground">
                /
              </li>
            )}
            <li>
              {item.to && index < items.length - 1 ? (
                <Link to={item.to} className="hover:text-highlight">
                  {item.label}
                </Link>
              ) : (
                <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  )
}
