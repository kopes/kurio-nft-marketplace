import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Field } from '@/components/common/field'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { networkIds, networkLabels, walletProviderLabels, walletProviders, WalletInput, type Wallet, type WalletRole } from '@/shared/contracts'
import { applyServerErrors } from '@/features/session/auth-dialog'
import { useProfile, useSaveWallet, useWallets } from './queries'

type WalletValues = Required<WalletInput>

function toValues(role: WalletRole, wallet: Partial<Wallet> | undefined, fallback: Partial<WalletValues>): WalletValues {
  return {
    role,
    displayName: wallet?.displayName ?? fallback.displayName ?? '',
    nickname: wallet?.nickname ?? '',
    network: wallet?.network ?? 'ethereum',
    profileName: wallet?.profileName ?? fallback.profileName ?? '',
    address: wallet?.address ?? '',
    secondaryAddress: wallet?.secondaryAddress ?? '',
    provider: wallet?.provider ?? 'metamask',
    referralCode: wallet?.referralCode ?? '',
    email: wallet?.email ?? fallback.email ?? '',
    ensName: wallet?.ensName ?? fallback.ensName ?? '',
  }
}

function WalletForm({ role, wallet, initial, resetKey, onSaved }: { role: WalletRole; wallet: Wallet | undefined; initial: WalletValues; resetKey: string; onSaved?: () => void }) {
  const save = useSaveWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<WalletValues>({ resolver: zodResolver(WalletInput) as never, defaultValues: initial })
  const errors = form.formState.errors
  const prefix = role === 'primary' ? 'principal' : 'secundaria'

  // Recarrega os valores apenas quando a carteira (id/versão) ou a origem dos dados muda.
  useEffect(() => {
    form.reset(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, form])

  const submit = form.handleSubmit((values) => {
    setFormError(null)
    save.mutate(
      { walletId: wallet?.id ?? null, input: values },
      {
        onSuccess: () => {
          toast.success(role === 'primary' ? 'Carteira principal salva.' : 'Carteira secundária salva.')
          onSaved?.()
        },
        onError: (error) => setFormError(applyServerErrors(error, form.setError, Object.keys(initial) as Array<keyof WalletValues>)),
      },
    )
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-label={role === 'primary' ? 'Dados da carteira principal' : 'Dados da carteira secundária'} data-testid={`wallet-form-${prefix}`}>
      {formError && (
        <p role="alert" className="rounded-sm border border-coral/60 bg-coral/10 px-3 py-2 text-sm text-coral">
          ⚠ {formError}
        </p>
      )}
      <div className="grid gap-x-7 gap-y-5 md:grid-cols-2">
        <Field label="Nome de exibição" required error={errors.displayName?.message}>
          {(props) => <Input {...props} {...form.register('displayName')} />}
        </Field>
        <Field label="Apelido da carteira" required error={errors.nickname?.message}>
          {(props) => <Input {...props} {...form.register('nickname')} />}
        </Field>
        <Field label="Rede" required error={errors.network?.message}>
          {(props) => (
            <Controller
              control={form.control}
              name="network"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full" onBlur={field.onBlur}>
                    <SelectValue placeholder="Selecione uma rede" />
                  </SelectTrigger>
                  <SelectContent className="border-line bg-card">
                    {networkIds.map((id) => (
                      <SelectItem key={id} value={id}>
                        {networkLabels[id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        <Field label="Nome do perfil" required error={errors.profileName?.message}>
          {(props) => <Input {...props} {...form.register('profileName')} />}
        </Field>
        <Field label="Endereço da carteira" required error={errors.address?.message}>
          {(props) => <Input {...props} {...form.register('address')} placeholder="Endereço 0x da carteira" spellCheck={false} autoComplete="off" />}
        </Field>
        <div className="flex flex-col">
          <div aria-hidden="true" className="hidden h-[39px] md:block" />
          <Field label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message} hideLabel>
            {(props) => <Input {...props} {...form.register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" autoComplete="off" />}
          </Field>
        </div>
        <Field label="Tipo de carteira" required error={errors.provider?.message}>
          {(props) => (
            <Controller
              control={form.control}
              name="provider"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...props} className="w-full" onBlur={field.onBlur}>
                    <SelectValue placeholder="Selecione uma carteira" />
                  </SelectTrigger>
                  <SelectContent className="border-line bg-card">
                    {walletProviders.map((id) => (
                      <SelectItem key={id} value={id}>
                        {walletProviderLabels[id]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </Field>
        <Field label="Código de indicação" required error={errors.referralCode?.message}>
          {(props) => <Input {...props} {...form.register('referralCode')} autoComplete="off" />}
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
      </div>
      <Button type="submit" disabled={save.isPending} className="h-10 w-fit rounded-sm px-1">
        {save.isPending ? 'Salvando…' : 'Salvar carteira'}
      </Button>
    </form>
  )
}

export function WalletsPage() {
  const wallets = useWallets()
  const profile = useProfile()
  const primary = wallets.data?.items.find((wallet) => wallet.role === 'primary')
  const secondary = wallets.data?.items.find((wallet) => wallet.role === 'secondary')
  const [showPrimary, setShowPrimary] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)

  if (wallets.isError) return <ErrorState error={wallets.error} title="Não foi possível carregar suas carteiras" onRetry={() => void wallets.refetch()} />

  const fallback = profile.data ? { displayName: profile.data.displayName, email: profile.data.email, ensName: profile.data.ensName, profileName: profile.data.displayName } : {}
  const primaryValues = toValues('primary', primary, fallback)
  const secondaryValues = sameAsPrimary && primary ? { ...toValues('secondary', { ...primary, nickname: '' }, fallback), role: 'secondary' as const } : toValues('secondary', secondary, fallback)

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="primary-title" className="flex flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 id="primary-title" className="text-lg leading-4 font-bold">
              Carteira principal
            </h1>
            <p className="mt-2 text-sm text-sand">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
          </div>
          {!primary && !showPrimary && wallets.data && (
            <button type="button" onClick={() => setShowPrimary(true)} className="text-base font-bold text-highlight hover:underline">
              Adicionar
            </button>
          )}
        </header>
        {wallets.isPending ? (
          <Skeleton className="h-[420px] w-full" />
        ) : primary || showPrimary ? (
          <WalletForm role="primary" wallet={primary} initial={primaryValues} resetKey={`${primary?.id}:${primary?.version}:${profile.data?.version}`} />
        ) : (
          <p className="text-sm text-sand">Você ainda não adicionou uma carteira principal.</p>
        )}
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-4">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="secondary-title" className="text-lg leading-4 font-bold">
              Carteira secundária
            </h2>
            {!secondary && !showSecondary && <p className="mt-3 text-sm text-sand">Você ainda não adicionou uma carteira secundária.</p>}
          </div>
          {!wallets.isPending && (
            <div className="flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sameAsPrimary}
                  disabled={!primary}
                  onChange={(event) => {
                    setSameAsPrimary(event.target.checked)
                    if (event.target.checked) setShowSecondary(true)
                  }}
                  className="peer sr-only"
                />
                <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border border-primary peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-ring peer-disabled:opacity-50" />
                Igual à carteira principal
              </label>
              {!secondary && !showSecondary && (
                <button type="button" onClick={() => setShowSecondary(true)} className="text-base font-bold text-highlight hover:underline">
                  Adicionar
                </button>
              )}
            </div>
          )}
        </header>
        {(secondary || showSecondary) && <WalletForm
            role="secondary"
            wallet={secondary}
            initial={secondaryValues}
            resetKey={`${secondary?.id}:${secondary?.version}:${sameAsPrimary}:${profile.data?.version}`}
            onSaved={() => setSameAsPrimary(false)}
          />}
      </section>
    </div>
  )
}
