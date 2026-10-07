import { useId, useState, type ReactNode } from 'react'
import { Eye } from 'lucide-react'
import { HideIcon } from '@/components/icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FieldControlProps {
  id: string
  'aria-invalid': boolean | undefined
  'aria-describedby': string | undefined
  'aria-required': boolean | undefined
}

interface FieldProps {
  label: ReactNode
  required?: boolean
  error?: string
  hint?: string
  className?: string
  labelClassName?: string
  /** Oculta visualmente o rótulo (mantido para leitores de tela). */
  hideLabel?: boolean
  children: (props: FieldControlProps) => ReactNode
}

/** Campo com rótulo associado, marcador de obrigatório e erro vinculado via aria-describedby. */
export function Field({ label, required, error, hint, className, labelClassName, hideLabel, children }: FieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <label htmlFor={id} className={cn('flex items-center text-[15px] leading-[29px]', hideLabel && 'sr-only', labelClassName)}>
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-[22px] leading-none text-coral">
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-khaki">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-[13px] text-coral" role="alert">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  )
}

export function PasswordInput({ className, toggleClassName, ...props }: React.ComponentProps<typeof Input> & { toggleClassName?: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className={cn('absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-sm text-khaki hover:text-highlight', toggleClassName)}
      >
        {visible ? <Eye className="size-5" aria-hidden="true" /> : <HideIcon className="h-5 w-[22px]" />}
      </button>
    </div>
  )
}
