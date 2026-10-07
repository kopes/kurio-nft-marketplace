import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuantityStepperProps {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** Seletor de quantidade inteira com limites; botões têm rótulos acessíveis e o valor é anunciado. */
export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'md', className }: QuantityStepperProps) {
  const button = cn(
    'flex items-center justify-center rounded-full bg-primary text-ink transition-[color,background-color,opacity,scale] duration-300 ease-spring hover:bg-highlight motion-safe:active:scale-85 disabled:cursor-not-allowed',
    // sm: botões 20×30 com contorno tinta e sombra; no limite continuam cobre (como no Figma), apenas esmaecidos.
    size === 'md'
      ? 'h-10 w-7 disabled:bg-raised disabled:text-khaki'
      : 'h-[30px] w-5 border border-ink text-black shadow-[0_4px_12px_-2px_rgb(20_13_10/0.15)] disabled:opacity-45 disabled:hover:bg-primary',
  )
  const stroke = size === 'md' ? 3 : 2.5
  return (
    <div role="group" aria-label={label} className={cn('inline-flex items-center gap-3', className)}>
      <button type="button" className={button} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir quantidade de ${label}`}>
        <Minus className="size-4" strokeWidth={stroke} aria-hidden="true" />
      </button>
      <output aria-live="polite" className={cn('min-w-5 text-center tabular-nums', size === 'md' ? 'text-lg' : 'text-lg leading-[25px] font-medium')}>
        {/* O número "salta" a cada mudança; a região viva continua a mesma, então a leitura do valor não é afetada. */}
        <span key={value} className="inline-block animate-pop">
          {value}
        </span>
      </output>
      <button type="button" className={button} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar quantidade de ${label}`}>
        <Plus className="size-4" strokeWidth={stroke} aria-hidden="true" />
      </button>
    </div>
  )
}
