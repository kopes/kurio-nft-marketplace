import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ImageIcon } from '@/components/icons'
import { Field, PasswordInput } from '@/components/common/field'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AVATAR_MAX_BYTES, AVATAR_TYPES, PasswordChangeInput, ProfileUpdateInput } from '@/shared/contracts'
import { toApiError } from '@/api/errors'
import { announce } from '@/lib/announcer'
import { applyServerErrors } from '@/features/session/auth-dialog'
import { useAvatarMutations, useChangePassword, useProfile, useUpdateProfile } from './queries'

function AvatarField({ avatarUrl }: { avatarUrl: string | null }) {
  const input = useRef<HTMLInputElement>(null)
  const { upload, remove } = useAvatarMutations()
  const [error, setError] = useState<string | null>(null)

  const onFile = (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return setError('Use uma imagem PNG, JPG ou WebP.')
    if (file.size > AVATAR_MAX_BYTES) return setError('A imagem deve ter no máximo 1 MB.')
    upload.mutate(file, {
      onSuccess: () => {
        toast.success('Avatar atualizado.')
        announce('Avatar atualizado.')
      },
      onError: (failure) => setError(toApiError(failure).fieldErrors.avatar ?? toApiError(failure).message),
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <span id="avatar-label" className="text-[15px] leading-[15px]">
        Avatar
      </span>
      <div className="flex items-center gap-6" role="group" aria-labelledby="avatar-label">
        <span className="flex size-[50px] items-center justify-center overflow-hidden rounded-full border border-line bg-raised">
          {avatarUrl ? <img src={avatarUrl} alt="Avatar atual" className="size-full object-cover" /> : <ImageIcon className="size-6 text-primary" />}
        </span>
        <input ref={input} type="file" accept={AVATAR_TYPES.join(',')} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(event) => onFile(event.target.files?.[0])} />
        <Button type="button" onClick={() => input.current?.click()} disabled={upload.isPending} className="h-10 w-[98px] rounded-sm">
          {upload.isPending ? 'Enviando…' : 'Alterar'}
        </Button>
        <button
          type="button"
          onClick={() => remove.mutate(undefined, { onSuccess: () => announce('Avatar removido.') })}
          disabled={!avatarUrl || remove.isPending}
          className="text-sm hover:text-highlight disabled:opacity-50"
        >
          Remover
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-coral">
          ⚠ {error}
        </p>
      )}
    </div>
  )
}

type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string }

export function ProfilePage() {
  const profile = useProfile()
  const update = useUpdateProfile()
  const changePassword = useChangePassword()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<ProfileUpdateInput>({ resolver: zodResolver(ProfileUpdateInput), defaultValues: { displayName: '', username: '', email: '', ensName: '', walletNickname: '' } })
  const passwordForm = useForm<PasswordValues>({ resolver: zodResolver(PasswordChangeInput) as never, defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } })

  useEffect(() => {
    if (profile.data) {
      const { displayName, username, email, ensName, walletNickname } = profile.data
      form.reset({ displayName, username, email, ensName, walletNickname })
    }
  }, [profile.data, form])

  const submit = form.handleSubmit(async (values) => {
    setFormError(null)
    const passwordValues = passwordForm.getValues()
    const wantsPassword = Object.values(passwordValues).some(Boolean)
    if (wantsPassword && !(await passwordForm.trigger())) {
      announce('Revise os campos de senha.', 'assertive')
      return
    }
    try {
      await update.mutateAsync(values)
    } catch (error) {
      setFormError(applyServerErrors(error, form.setError, ['displayName', 'username', 'email', 'ensName', 'walletNickname']))
      return
    }
    if (wantsPassword) {
      try {
        await changePassword.mutateAsync(passwordValues)
        passwordForm.reset()
      } catch (error) {
        setFormError(applyServerErrors(error, passwordForm.setError, ['currentPassword', 'newPassword', 'confirmPassword']))
        return
      }
    }
    toast.success(wantsPassword ? 'Perfil e senha atualizados.' : 'Perfil atualizado.')
  })

  if (profile.isError) return <ErrorState error={profile.error} title="Não foi possível carregar o perfil" onRetry={() => void profile.refetch()} />

  const errors = form.formState.errors
  const pwErrors = passwordForm.formState.errors
  const saving = update.isPending || changePassword.isPending

  return (
    <form onSubmit={submit} noValidate aria-labelledby="profile-title" className="flex flex-col gap-8">
      <h1 id="profile-title" className="text-base leading-4 font-bold">
        Perfil do colecionador
      </h1>
      {formError && (
        <p role="alert" className="rounded-sm border border-coral/60 bg-coral/10 px-3 py-2 text-sm text-coral">
          ⚠ {formError}
        </p>
      )}
      {profile.isPending ? (
        <div className="grid gap-6 md:grid-cols-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-[79px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
          <Field label="Nome de exibição" required error={errors.displayName?.message}>
            {(props) => <Input {...props} {...form.register('displayName')} autoComplete="name" />}
          </Field>
          <Field label="Nome de usuário" required error={errors.username?.message}>
            {(props) => <Input {...props} {...form.register('username')} autoComplete="username" />}
          </Field>
          <Field label="E-mail" required error={errors.email?.message}>
            {(props) => <Input {...props} {...form.register('email')} type="email" autoComplete="email" />}
          </Field>
          <Field label="Nome ENS" required error={errors.ensName?.message}>
            {(props) => (
              <div className="flex gap-2.5">
                <span aria-hidden="true" className="flex h-10 w-[78px] shrink-0 items-center justify-center rounded-sm border border-input">
                  .eth
                </span>
                <Input {...props} {...form.register('ensName')} />
              </div>
            )}
          </Field>
          <Field label="Apelido da carteira" required error={errors.walletNickname?.message}>
            {(props) => <Input {...props} {...form.register('walletNickname')} />}
          </Field>
          <AvatarField avatarUrl={profile.data.avatarUrl} />
        </div>
      )}

      <fieldset className="flex flex-col gap-6 md:max-w-[417px]">
        <legend className="mb-6 text-base leading-4 font-medium">Alterar senha</legend>
        <Field label="Senha atual" error={pwErrors.currentPassword?.message}>
          {(props) => <PasswordInput {...props} {...passwordForm.register('currentPassword')} autoComplete="current-password" />}
        </Field>
        <Field label="Nova senha" error={pwErrors.newPassword?.message} hint="Mínimo de 8 caracteres, com letras e números.">
          {(props) => <PasswordInput {...props} {...passwordForm.register('newPassword')} autoComplete="new-password" />}
        </Field>
        <Field label="Confirmar nova senha" error={pwErrors.confirmPassword?.message}>
          {(props) => <PasswordInput {...props} {...passwordForm.register('confirmPassword')} autoComplete="new-password" />}
        </Field>
      </fieldset>

      <Button type="submit" disabled={saving || profile.isPending} className="h-10 w-[131px] rounded-sm">
        {saving ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}
