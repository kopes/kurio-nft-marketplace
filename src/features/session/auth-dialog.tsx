import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm, type FieldValues, type Path, type UseFormSetError } from 'react-hook-form'
import { FacebookColorIcon, GoogleIcon } from '@/components/icons'
import { Field, PasswordInput } from '@/components/common/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DEMO_LOGIN } from '@/shared/config'
import { LoginInput, RegisterInput } from '@/shared/contracts'
import { toApiError } from '@/api/errors'
import { safeRedirect } from '@/lib/redirect'
import { cn } from '@/lib/utils'
import { useLogin, useRegister } from './use-auth'

export function applyServerErrors<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: Array<Path<T>>) {
  const apiError = toApiError(error)
  let mapped = false
  for (const [key, message] of Object.entries(apiError.fieldErrors)) {
    if ((fields as string[]).includes(key)) {
      setError(key as Path<T>, { type: 'server', message }, { shouldFocus: !mapped })
      mapped = true
    }
  }
  return mapped ? null : apiError.message
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-sm border border-coral/60 bg-coral/10 px-3 py-2 text-sm text-coral">
      ⚠ {message}
    </p>
  )
}

/** Ajustes do frame "Mobile / Login": campos de 48 px, raio de 8 px e texto de 14 px. */
const mobileInput = 'max-md:h-12 max-md:rounded-[8px] max-md:pl-[13px] max-md:text-sm'
const socialButton =
  'flex h-10 items-center justify-center gap-2 rounded-sm border border-line text-[13px] font-medium hover:border-primary max-md:h-[38px] max-md:gap-2.5 max-md:rounded-[4px] max-md:text-xs max-md:text-sand'

function SocialLogin({ onUnavailable }: { onUnavailable: () => void }) {
  return (
    <div className="flex flex-col gap-3 max-md:mt-[34px] max-md:gap-[10px]">
      <div className="relative flex items-center justify-center max-md:h-5">
        <span aria-hidden="true" className="absolute inset-x-[-40px] top-1/2 h-px bg-primary/30 max-md:inset-x-0 max-md:bg-line" />
        <span className="relative bg-card px-3 text-[13px] font-medium max-md:bg-ink max-md:text-xs max-md:font-normal">Ou continue com</span>
      </div>
      <button type="button" onClick={onUnavailable} className={socialButton}>
        <GoogleIcon className="size-5" /> Continuar com Google
      </button>
      <button type="button" onClick={onUnavailable} className={cn(socialButton, 'max-md:mt-[5px]')}>
        <FacebookColorIcon className="size-5" /> Continuar com Facebook
      </button>
    </div>
  )
}

function LoginForm({ redirect, onDone }: { redirect: string | undefined; onDone: () => void }) {
  const login = useLogin()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginInput), defaultValues: DEMO_LOGIN ?? { email: '', password: '' } })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    login.mutate(values, {
      onSuccess: onDone,
      onError: (error) => setFormError(applyServerErrors(error, form.setError, ['email', 'password'])),
    })
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 max-md:mt-[32px] max-md:gap-[10px]" aria-describedby="login-description">
      <FormAlert message={formError} />
      <Field label="E-mail" error={errors.email?.message} hideLabel>
        {(props) => <Input {...props} {...form.register('email')} type="email" autoComplete="email" placeholder="contato@email.com" className={mobileInput} />}
      </Field>
      <Field label="Senha" error={errors.password?.message} hideLabel>
        {(props) => <PasswordInput {...props} {...form.register('password')} autoComplete="current-password" placeholder="Senha" className={mobileInput} toggleClassName="max-md:text-input" />}
      </Field>
      <p className="self-end text-[13px] text-highlight max-md:-mt-px">
        <span className="sr-only">Recuperação de senha: </span>
        <ForgotPassword />
      </p>
      <Button type="submit" disabled={login.isPending} className="mt-2 h-11 text-base max-md:mt-[25px] max-md:h-14 max-md:rounded-[8px]">
        {login.isPending ? 'Entrando…' : 'Entrar'}
      </Button>
      <input type="hidden" value={redirect ?? ''} readOnly />
    </form>
  )
}

function ForgotPassword() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="hover:underline">
        Esqueceu a senha?
      </button>
      {open && (
        <span role="status" className="mt-1 block text-xs text-sand">
          Recuperação de senha não está disponível nesta demonstração. Use as credenciais do README.
        </span>
      )}
    </>
  )
}

function RegisterForm({ onDone }: { onDone: () => void }) {
  const register = useRegister()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<RegisterInput>({ resolver: zodResolver(RegisterInput), defaultValues: { username: '', email: '', password: '', confirmPassword: '' } })
  const { errors } = form.formState

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    register.mutate(values, {
      onSuccess: onDone,
      onError: (error) => setFormError(applyServerErrors(error, form.setError, ['username', 'email', 'password', 'confirmPassword'])),
    })
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3 max-md:mt-[32px] max-md:gap-[10px]">
      <FormAlert message={formError} />
      <Field label="Nome de usuário" error={errors.username?.message} hideLabel>
        {(props) => <Input {...props} {...form.register('username')} autoComplete="username" placeholder="Nome de usuário" className={mobileInput} />}
      </Field>
      <Field label="E-mail" error={errors.email?.message} hideLabel>
        {(props) => <Input {...props} {...form.register('email')} type="email" autoComplete="email" placeholder="Digite seu e-mail" className={mobileInput} />}
      </Field>
      <Field label="Senha" error={errors.password?.message} hint="Mínimo de 8 caracteres, com letras e números." hideLabel>
        {(props) => <PasswordInput {...props} {...form.register('password')} autoComplete="new-password" placeholder="Senha" className={mobileInput} toggleClassName="max-md:text-input" />}
      </Field>
      <Field label="Confirmar senha" error={errors.confirmPassword?.message} hideLabel>
        {(props) => <PasswordInput {...props} {...form.register('confirmPassword')} autoComplete="new-password" placeholder="Confirmar senha" className={mobileInput} toggleClassName="max-md:text-input" />}
      </Field>
      <Button type="submit" disabled={register.isPending} className="mt-2 h-11 text-base max-md:mt-[25px] max-md:h-14 max-md:rounded-[8px]">
        {register.isPending ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </form>
  )
}

export function AuthDialog({ mode, redirect, reason }: { mode: 'login' | 'register'; redirect?: string; reason?: string }) {
  const navigate = useNavigate()
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const [socialMessage, setSocialMessage] = useState(false)
  const target = safeRedirect(redirect)

  const done = () => void navigate({ to: target, replace: true })
  const close = () => {
    if (canGoBack) router.history.back()
    else void navigate({ to: '/' })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        aria-describedby="auth-description"
        className={cn(
          'gap-5 border-b-[10px] border-b-primary px-6 pt-12 pb-10 sm:max-w-[500px] md:px-[80px]',
          // Mobile: tela cheia em coluna (o grid esticaria as linhas até 100dvh), com o espaçamento do frame "Mobile / Login".
          'max-md:top-0 max-md:left-0 max-md:flex max-md:h-dvh max-md:max-h-dvh max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:flex-col max-md:gap-0 max-md:rounded-none max-md:border-b-0 max-md:bg-ink max-md:px-[26px] max-md:pt-[123px]',
        )}
      >
        <p className="text-center text-[32px] leading-none font-bold tracking-[0.06em] md:hidden" aria-hidden="true">
          KURIO
        </p>
        <DialogTitle asChild>
          <h1 className="flex items-center justify-center gap-2 text-center text-xl font-medium max-md:mt-[82px]">
            <span className="md:sr-only">{mode === 'login' ? 'Entrar' : 'Criar conta'}</span>
            <span aria-hidden="true" className="contents max-md:hidden">
              <Link to="/entrar" search={{ redirect }} replace className={cn(mode === 'login' ? 'text-highlight' : 'text-foreground hover:text-highlight')} tabIndex={-1}>
                Entrar
              </Link>
              <span className="h-6 w-px bg-primary" />
              <Link to="/cadastro" search={{ redirect }} replace className={cn(mode === 'register' ? 'text-highlight' : 'text-foreground hover:text-highlight')} tabIndex={-1}>
                Criar conta
              </Link>
            </span>
          </h1>
        </DialogTitle>
        {/* O frame mobile não tem subtítulo: fica só para leitores de tela (aria-describedby). */}
        <DialogDescription id="auth-description" className="text-center text-[13px] text-foreground max-md:sr-only">
          {mode === 'login' ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.' : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
        </DialogDescription>
        {reason === 'expirada' && (
          <p role="status" className="rounded-sm border border-amber/60 bg-amber/10 px-3 py-2 text-center text-sm text-amber max-md:mt-6">
            Sua sessão expirou. Entre novamente para continuar de onde parou.
          </p>
        )}
        {mode === 'login' ? <LoginForm redirect={redirect} onDone={done} /> : <RegisterForm onDone={done} />}
        <SocialLogin onUnavailable={() => setSocialMessage(true)} />
        {socialMessage && (
          <p role="status" className="text-center text-xs text-sand max-md:mt-4">
            Login social não está disponível nesta demonstração. Use e-mail e senha.
          </p>
        )}
        {/* A frase inteira é o link: no mobile ela tem uma cor só (sand), sem destaque para a parte clicável. */}
        <p className="text-center text-[13px] max-md:mt-[37px] max-md:text-sm max-md:leading-5">
          <Link to={mode === 'login' ? '/cadastro' : '/entrar'} search={{ redirect }} replace className="group max-md:text-sand">
            {mode === 'login' ? 'Novo na Kurio?' : 'Já tem uma conta?'}{' '}
            <span className="text-highlight group-hover:underline max-md:text-sand">{mode === 'login' ? 'Crie uma conta' : 'Entre'}</span>
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  )
}
