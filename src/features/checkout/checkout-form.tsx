import { Controller, type UseFormReturn } from 'react-hook-form'
import { Field } from '@/components/common/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { networkIds, networkLabels, walletProviderLabels, walletProviders, type CollectorInput, type Wallet } from '@/shared/contracts'
import { cn } from '@/lib/utils'

export type CheckoutValues = Required<CollectorInput>

export function shortAddress(address: string) {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

interface WalletChooserProps {
  wallets: Wallet[] | undefined
  loading: boolean
  selectedId: string | null
  useOther: boolean
  onSelect: (wallet: Wallet) => void
  onUseOther: (value: boolean) => void
}

/** Carteiras cadastradas (frame mobile "Carteira conectada"): selecionar preenche os dados da carteira. */
export function WalletChooser({ wallets, loading, selectedId, useOther, onSelect, onUseOther }: WalletChooserProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-base font-bold">Carteira cadastrada</legend>
      {loading ? (
        <div className="skeleton h-[72px] rounded-xl" aria-label="Carregando carteiras" />
      ) : wallets && wallets.length > 0 ? (
        <div role="radiogroup" aria-label="Carteira de destino" className="grid gap-3 sm:grid-cols-2">
          {wallets.map((wallet) => {
            const checked = !useOther && wallet.id === selectedId
            return (
              <button
                key={wallet.id}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => onSelect(wallet)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors',
                  checked ? 'border-primary' : 'border-transparent hover:border-primary/50',
                )}
              >
                <span aria-hidden="true" className={cn('mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-primary', checked && 'after:size-2 after:rounded-full after:bg-primary')} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold">
                    {wallet.nickname} <span className="text-xs font-normal text-khaki">({wallet.role === 'primary' ? 'principal' : 'secundária'})</span>
                  </span>
                  <span className="truncate text-sm text-sand">{wallet.secondaryAddress || shortAddress(wallet.address)}</span>
                  <span className="text-sm text-sand">Rede {networkLabels[wallet.network]}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-sand">Você ainda não cadastrou carteiras. Preencha os dados abaixo ou cadastre em “Carteiras” no seu perfil.</p>
      )}
      <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 text-[15px]">
        <input type="checkbox" checked={useOther} onChange={(event) => onUseOther(event.target.checked)} className="peer sr-only" />
        <span aria-hidden="true" className="flex size-4 items-center justify-center rounded-full border border-primary peer-checked:after:size-2 peer-checked:after:rounded-full peer-checked:after:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-solid peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
        Usar outra carteira?
      </label>
    </fieldset>
  )
}

export function CheckoutForm({ form, readOnlyWallet }: { form: UseFormReturn<CheckoutValues>; readOnlyWallet: boolean }) {
  const { register, control, formState } = form
  const errors = formState.errors

  return (
    <div className="grid gap-x-6 gap-y-4 md:grid-cols-2 lg:gap-x-6">
      <Field label="Nome de exibição" required error={errors.displayName?.message}>
        {(props) => <Input {...props} {...register('displayName')} autoComplete="name" />}
      </Field>
      <Field label="Nome de usuário" required error={errors.username?.message}>
        {(props) => <Input {...props} {...register('username')} autoComplete="username" />}
      </Field>
      <Field label="Rede" required error={errors.network?.message}>
        {(props) => (
          <Controller
            control={control}
            name="network"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={readOnlyWallet}>
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
        {(props) => <Input {...props} {...register('profileName')} />}
      </Field>
      <Field label="Endereço da carteira" required error={errors.walletAddress?.message}>
        {(props) => <Input {...props} {...register('walletAddress')} placeholder="Endereço 0x da carteira" readOnly={readOnlyWallet} spellCheck={false} autoComplete="off" />}
      </Field>
      <div className="flex flex-col">
        {/* No Figma o campo não tem rótulo visível; o rótulo existe para leitores de tela e o espaço é preservado. */}
        <div aria-hidden="true" className="hidden h-[39px] md:block" />
        <Field label="ENS ou carteira secundária (opcional)" error={errors.secondaryAddress?.message} hideLabel>
          {(props) => <Input {...props} {...register('secondaryAddress')} placeholder="ENS ou carteira secundária (opcional)" readOnly={readOnlyWallet} autoComplete="off" />}
        </Field>
      </div>
      <Field label="Tipo de carteira" required error={errors.walletProvider?.message}>
        {(props) => (
          <Controller
            control={control}
            name="walletProvider"
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
        {(props) => <Input {...props} {...register('referralCode')} autoComplete="off" />}
      </Field>
      <Field label="E-mail" required error={errors.email?.message}>
        {(props) => <Input {...props} {...register('email')} type="email" autoComplete="email" />}
      </Field>
      <Field label="Nome ENS" required error={errors.ensName?.message}>
        {(props) => (
          <div className="flex gap-2.5">
            <span className="flex h-10 w-[78px] shrink-0 items-center justify-center rounded-sm border border-input text-[15px]" aria-hidden="true">
              .eth
            </span>
            <Input {...props} {...register('ensName')} autoComplete="off" aria-label="Nome ENS (sufixo .eth)" />
          </div>
        )}
      </Field>
      <Field label="Observação do colecionador (opcional)" error={errors.note?.message} className="md:col-span-2 md:max-w-[350px]">
        {(props) => <Textarea {...props} {...register('note')} rows={5} className="min-h-[150px] rounded-sm border-input" />}
      </Field>
    </div>
  )
}
