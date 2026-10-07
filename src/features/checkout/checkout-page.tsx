import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { walletsApi } from '@/api/endpoints'
import { toApiError } from '@/api/errors'
import { queryKeys } from '@/api/query-keys'
import { WalletIcon } from '@/components/icons'
import { Breadcrumbs } from '@/components/common/breadcrumbs'
import { EmptyState, ErrorState } from '@/components/common/states'
import { MobileTopBar } from '@/components/layout/mobile-top-bar'
import { WalletBrandsBadge } from '@/components/layout/site-footer'
import { NftImage } from '@/components/nft/nft-image'
import { EthPrice } from '@/components/nft/price'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CollectorSchema, walletProviderLabels, networkLabels, type Quote, type Wallet, type WalletConnection, type WalletProvider } from '@/shared/contracts'
import { useIsMobile } from '@/hooks/use-media-query'
import { announce } from '@/lib/announcer'
import { cn } from '@/lib/utils'
import { useProfile, useWallets } from '@/features/account/queries'
import { CartNoticesList } from '@/features/cart/cart-notices-list'
import { CouponForm, QuoteLines } from '@/features/cart/cart-summary'
import { useCart, useCartScope, useQuote } from '@/features/cart/queries'
import { usePendingOrders } from '@/features/orders/queries'
import { realtimeClient } from '@/features/realtime/realtime-client'
import { useSession } from '@/features/session/use-session'
import { loadCheckoutDraft, saveCheckoutDraft } from './checkout-storage'
import { CheckoutForm, UseOtherWalletToggle, WalletChooser, checkoutFieldOrder, shortAddress, type CheckoutValues } from './checkout-form'
import { CheckoutDetailsSheet, MobileWalletCard, ProviderOption, WalletMenu, walletNetworkLine } from './mobile-checkout'
import { ReviewDialog, type ReviewState } from './review-dialog'
import { usePlaceOrder } from './use-place-order'

const emptyValues: CheckoutValues = {
  displayName: '',
  username: '',
  network: 'ethereum',
  profileName: '',
  walletAddress: '',
  secondaryAddress: '',
  walletProvider: 'metamask',
  referralCode: '',
  email: '',
  ensName: '',
  note: '',
}

function walletValues(wallet: Wallet): Partial<CheckoutValues> {
  return {
    network: wallet.network,
    profileName: wallet.profileName,
    walletAddress: wallet.address,
    secondaryAddress: wallet.secondaryAddress,
    walletProvider: wallet.provider,
    referralCode: wallet.referralCode,
  }
}

const providerOptions: Array<{ id: WalletProvider; label: string }> = [
  { id: 'walletconnect', label: 'WalletConnect' },
  { id: 'metamask', label: 'MetaMask' },
  { id: 'coinbase', label: 'Coinbase Wallet' },
]

function ProviderMark({ id }: { id: WalletProvider }) {
  if (id === 'coinbase') return <WalletIcon className="size-6 text-primary" />
  return (
    <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-raised text-sm font-bold text-highlight">
      {id === 'metamask' ? 'M' : 'W'}
    </span>
  )
}

export function CheckoutPage() {
  const session = useSession()
  const userId = session!.user.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const scope = useCartScope()
  const cart = useCart()
  const profile = useProfile()
  const wallets = useWallets()
  const pending = usePendingOrders()
  const placeOrder = usePlaceOrder()
  const isMobile = useIsMobile()

  const draft = useMemo(() => loadCheckoutDraft(userId), [userId])
  const [walletId, setWalletId] = useState<string | null>(draft?.walletId ?? null)
  const [useOther, setUseOther] = useState(Boolean(draft?.useOtherWallet))
  const [rawConnection, setConnection] = useState<WalletConnection | null>(null)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [review, setReview] = useState<ReviewState>({ open: false, reviewed: null })
  const [orderError, setOrderError] = useState<string | null>(null)
  // No mobile os dados (pré-preenchidos) ficam numa folha fora do frame "Mobile / Pagamento"; ela abre se houver erro.
  const [detailsOpen, setDetailsOpen] = useState(false)

  const form = useForm<CheckoutValues>({
    resolver: zodResolver(CollectorSchema) as never,
    defaultValues: { ...emptyValues, ...draft },
    mode: 'onTouched',
  })
  const values = useWatch({ control: form.control }) as CheckoutValues
  const quote = useQuote(values.network ?? 'ethereum', 'checkout', Boolean(cart.data?.items.length))
  // A conexão só vale para a mesma carteira/rede/endereço; qualquer mudança exige reconectar.
  const connection =
    rawConnection && rawConnection.provider === values.walletProvider && rawConnection.network === values.network && rawConnection.address === values.walletAddress
      ? rawConnection
      : null

  // Pré-preenchimento: rascunho salvo > perfil + carteira principal cadastrada (calculado uma única vez).
  const [prefill, setPrefill] = useState<CheckoutValues | null>(null)
  const ready = Boolean(draft) || prefill !== null
  if (!ready && profile.data && wallets.data) {
    const primary = wallets.data.items.find((wallet) => wallet.role === 'primary') ?? wallets.data.items[0]
    setPrefill({
      ...emptyValues,
      displayName: profile.data.displayName,
      username: profile.data.username,
      email: profile.data.email,
      ensName: profile.data.ensName,
      ...(primary ? walletValues(primary) : {}),
    })
    setWalletId(primary?.id ?? null)
    setUseOther(!primary)
  }

  useEffect(() => {
    if (prefill) form.reset(prefill)
  }, [prefill, form])

  // Rascunho por usuário: permite retomar o checkout após expiração de sessão.
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => saveCheckoutDraft(userId, { ...values, walletId: walletId ?? undefined, useOtherWallet: useOther }), 300)
    return () => clearTimeout(timer)
  }, [values, walletId, useOther, userId, ready])

  // Assina os NFTs do carrinho: mudanças de preço/estoque invalidam a cotação.
  const cartIds = cart.data?.items.map((item) => item.nftId).sort().join(',') ?? ''
  useEffect(() => {
    if (!cartIds) return
    const releases = cartIds.split(',').map((id) => realtimeClient.subscribe(`nft:${id}`))
    return () => releases.forEach((release) => release())
  }, [cartIds])


  const connect = useMutation({
    mutationFn: () => walletsApi.connect({ provider: values.walletProvider, network: values.network, address: values.walletAddress }),
    onMutate: () => setConnectError(null),
    onSuccess: (result) => {
      setConnection(result)
      announce(`${walletProviderLabels[result.provider]} conectada.`)
    },
    onError: (error) => {
      const apiError = toApiError(error)
      const message = apiError.code === 'WALLET_REJECTED' ? 'A conexão foi recusada na carteira. Aprove a solicitação e tente novamente.' : apiError.message
      setConnectError(message)
      if (apiError.fieldErrors.walletAddress) form.setError('walletAddress', { message: apiError.fieldErrors.walletAddress })
      announce(message, 'assertive')
    },
  })

  const disconnect = useMutation({
    mutationFn: (id: string) => walletsApi.disconnect(id),
    onSettled: () => {
      setConnection(null)
      announce('Carteira desconectada.')
    },
  })

  const selectWallet = (wallet: Wallet) => {
    setWalletId(wallet.id)
    setUseOther(false)
    for (const [key, value] of Object.entries(walletValues(wallet))) form.setValue(key as keyof CheckoutValues, value as never, { shouldValidate: form.formState.isSubmitted })
  }

  const toggleOther = (value: boolean) => {
    setUseOther(value)
    if (value) {
      for (const key of ['walletAddress', 'secondaryAddress', 'profileName', 'referralCode'] as const) form.setValue(key, '')
    } else {
      const wallet = wallets.data?.items.find((item) => item.id === walletId) ?? wallets.data?.items[0]
      if (wallet) selectWallet(wallet)
    }
  }

  /** Conexão simulada sob demanda: valida antes endereço e rede (no mobile, abre os dados se faltar algo). */
  const connectWallet = () =>
    void form.trigger(['walletAddress', 'network']).then((ok) => {
      if (ok) connect.mutate()
      else setDetailsOpen(true)
    })

  /** A folha de dados do mobile abre no primeiro campo com erro (os campos só montam com ela aberta). */
  const focusFirstError = (event: Event) => {
    const first = checkoutFieldOrder.find((name) => form.formState.errors[name])
    if (!first) return
    event.preventDefault()
    form.setFocus(first)
    const content = event.currentTarget as HTMLElement
    if (!content.contains(document.activeElement)) content.focus()
  }

  const finishDetails = () =>
    void form.trigger(undefined, { shouldFocus: true }).then((ok) => {
      if (ok) setDetailsOpen(false)
      else announce('Revise os campos destacados no formulário.', 'assertive')
    })

  /** Valida o formulário, garante conexão e abre a revisão com a cotação mais recente da API. */
  const startReview = form.handleSubmit(
    async () => {
      setOrderError(null)
      let active = connection
      if (!active) {
        try {
          active = await connect.mutateAsync()
        } catch {
          return
        }
      }
      const fresh = await quote.refetch()
      if (!fresh.data) {
        toast.error('Não foi possível atualizar a cotação. Tente novamente.')
        return
      }
      setReview({ open: true, reviewed: fresh.data })
    },
    () => {
      setDetailsOpen(true)
      announce('Revise os campos destacados no formulário.', 'assertive')
    },
  )

  const confirm = () => {
    if (!review.reviewed || !connection) return
    setOrderError(null)
    placeOrder.mutate(
      { quoteId: review.reviewed.id, walletConnectionId: connection.id, collector: form.getValues() },
      {
        onSuccess: (order) => {
          setReview({ open: false, reviewed: null })
          void navigate({ to: '/pedido/$orderId', params: { orderId: order.id }, replace: true })
        },
        onError: (error) => {
          const apiError = toApiError(error)
          if (apiError.code === 'QUOTE_CHANGED' || apiError.code === 'OUT_OF_STOCK') {
            const latest = (apiError.details as { quote?: Quote } | undefined)?.quote
            if (latest) queryClient.setQueryData(queryKeys.cart.quote(scope, latest.network, cart.data?.version ?? 0, 'checkout'), latest)
            void queryClient.invalidateQueries({ queryKey: queryKeys.cart.scope(scope) })
            setOrderError(apiError.message)
            announce('Os valores do pedido mudaram. Revise e confirme novamente.', 'assertive')
            return
          }
          if (apiError.code === 'WALLET_DISCONNECTED') {
            setConnection(null)
            setOrderError('A carteira foi desconectada. Feche a revisão e conecte novamente.')
            return
          }
          setOrderError(apiError.kind === 'timeout' || apiError.kind === 'network' ? 'Não conseguimos confirmar o envio. Tente novamente: seu pedido não será duplicado.' : apiError.message)
        },
      },
    )
  }

  const items = cart.data?.items ?? []
  const pendingOrder = pending.data?.items[0]
  const blocked = items.some((item) => item.issue && item.issue !== 'PRICE_CHANGED')
  const [showCoupon, setShowCoupon] = useState(false)

  if (cart.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState error={cart.error} title="Não foi possível carregar o checkout" onRetry={() => void cart.refetch()} />
      </div>
    )
  }

  if (cart.data && items.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="Não há itens para pagar"
          description="Seu carrinho está vazio. Adicione NFTs para finalizar uma compra."
          action={
            <Link to="/mercado" className={buttonVariants()}>
              Explorar o mercado
            </Link>
          }
        />
      </div>
    )
  }

  const pendingNotice = pendingOrder && (
    <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-amber/60 bg-amber/10 px-4 py-3 text-sm">
      <span>Você tem um pedido aguardando confirmação na rede ({pendingOrder.id}). Aguarde antes de iniciar outra compra.</span>
      <Link to="/pedido/$orderId" params={{ orderId: pendingOrder.id }} className="font-bold text-highlight hover:underline">
        Acompanhar pedido
      </Link>
    </div>
  )
  const blockedNotice = blocked && (
    <p className="text-sm text-coral">
      Há itens indisponíveis. <Link to="/carrinho" className="underline">Ajuste o carrinho</Link> para continuar.
    </p>
  )
  const submitDisabled = connect.isPending || !quote.data || blocked || Boolean(pendingOrder)
  const submitLabel = connect.isPending ? 'Conectando carteira…' : 'Confirmar compra'

  const reviewDialog = (
    <ReviewDialog
      state={review}
      latest={quote.data}
      values={form.getValues()}
      connection={connection}
      submitting={placeOrder.isPending}
      retryCount={placeOrder.retryCount}
      error={orderError}
      onAcceptLatest={() => {
        setOrderError(null)
        setReview((state) => ({ ...state, reviewed: quote.data ?? state.reviewed }))
        announce('Novos valores aceitos. Confirme para enviar o pedido.')
      }}
      onConfirm={confirm}
      onClose={() => setReview({ open: false, reviewed: null })}
    />
  )

  // Frame "Mobile / Pagamento": carteiras cadastradas, aplicativo, total e confirmar; o restante fica na folha de dados.
  if (isMobile) {
    const walletItems = wallets.data?.items ?? []
    const walletMenu = (name: string, selected: boolean, onSelect?: () => void) => (
      <WalletMenu
        name={name}
        selected={selected}
        connected={Boolean(connection)}
        busy={connect.isPending || disconnect.isPending}
        onSelect={onSelect}
        onConnect={connectWallet}
        onDisconnect={() => connection && disconnect.mutate(connection.id)}
        onEditDetails={() => setDetailsOpen(true)}
      />
    )
    return (
      <div className="flex min-h-dvh flex-col px-7 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {/* Título de 20 px como no frame (414 px); em telas mais estreitas que ~380 px ele encolhe para caber em uma linha. */}
        <MobileTopBar
          title="Pagamento com carteira"
          fallback="/carrinho"
          align="start"
          className="gap-[23px] pt-[31px] pb-0"
          titleClassName="text-[min(20px,calc((100vw-114px)/13.3))] leading-6"
          backClassName="text-khaki"
        />
        {pendingNotice}

        <div className="mt-[23px] flex animate-fade-up flex-col">
          <div className="mb-5 empty:hidden">
            <CartNoticesList />
          </div>

          <section aria-labelledby="wallets-title">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="wallets-title" className="text-base leading-5 font-bold whitespace-nowrap">
                Carteira conectada
              </h2>
              <button type="button" onClick={() => setDetailsOpen(true)} className="mr-px ml-auto text-sm leading-5 font-bold whitespace-nowrap text-highlight hover:underline">
                Trocar carteira
              </button>
            </div>
            <div role="radiogroup" aria-labelledby="wallets-title" className="mt-[13px] flex flex-col gap-5">
              {wallets.isPending ? (
                Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[93px] w-full rounded-[14px]" />)
              ) : (
                <>
                  {walletItems.map((wallet) => {
                    const checked = !useOther && wallet.id === walletId
                    return (
                      <MobileWalletCard
                        key={wallet.id}
                        title={wallet.nickname}
                        address={wallet.secondaryAddress || shortAddress(wallet.address)}
                        network={walletNetworkLine(wallet.network)}
                        checked={checked}
                        onSelect={() => selectWallet(wallet)}
                        menu={walletMenu(wallet.nickname, checked, () => selectWallet(wallet))}
                      />
                    )
                  })}
                  {useOther && (
                    <MobileWalletCard
                      title="Outra carteira"
                      address={values.walletAddress ? shortAddress(values.walletAddress) : 'Endereço não informado'}
                      network={walletNetworkLine(values.network)}
                      checked
                      onSelect={() => setDetailsOpen(true)}
                      menu={walletMenu('Outra carteira', true)}
                    />
                  )}
                </>
              )}
            </div>
            {wallets.data && walletItems.length === 0 && (
              <p className="mt-3 text-sm text-sand">
                Você ainda não cadastrou carteiras.{' '}
                <Link to="/perfil/carteiras" className="font-bold text-highlight hover:underline">
                  Cadastrar carteira
                </Link>
              </p>
            )}
          </section>

          <section aria-labelledby="provider-title" className="mt-[14px]">
            <h2 id="provider-title" className="text-base leading-5 font-bold">
              Carteira e rede
            </h2>
            <div role="radiogroup" aria-labelledby="provider-title" className="mt-[14px] flex flex-col gap-4">
              {providerOptions.map((option) => (
                <ProviderOption
                  key={option.id}
                  id={option.id}
                  label={option.label}
                  checked={values.walletProvider === option.id}
                  onSelect={() => form.setValue('walletProvider', option.id, { shouldDirty: true })}
                />
              ))}
            </div>
          </section>

          {quote.isError && !quote.data ? (
            <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-card px-4 py-3 text-sm">
              <span className="text-coral">Não foi possível calcular o total.</span>
              <button type="button" onClick={() => void quote.refetch()} disabled={quote.isFetching} className="shrink-0 font-bold text-highlight hover:underline">
                Tentar novamente
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-end gap-[30px]">
              <span className="text-base leading-6 font-bold">Total:</span>
              {quote.data ? <EthPrice value={quote.data.total} className="text-lg leading-6 font-bold text-highlight" /> : <Skeleton className="h-6 w-28" />}
            </div>
          )}
          {connectError && (
            <p role="alert" className="mt-4 rounded-sm border border-coral/60 bg-coral/10 px-3 py-2 text-sm text-coral">
              ⚠ {connectError}
            </p>
          )}
          {blockedNotice && <div className="mt-4">{blockedNotice}</div>}
        </div>

        <div className="mt-auto pt-8">
          <Button
            type="button"
            onClick={() => void startReview()}
            disabled={submitDisabled}
            className="h-[60px] w-full rounded-full bg-[linear-gradient(100deg,#d28a4c,#b57742)] text-[15px] hover:brightness-110"
          >
            {submitLabel}
          </Button>
        </div>

        <CheckoutDetailsSheet open={detailsOpen} onOpenChange={setDetailsOpen} onOpenAutoFocus={focusFirstError} onDone={finishDetails}>
          <UseOtherWalletToggle checked={useOther} onChange={toggleOther} />
          {profile.isPending ? <Skeleton className="h-[420px] w-full" /> : <CheckoutForm form={form} readOnlyWallet={!useOther && Boolean(walletId)} />}
        </CheckoutDetailsSheet>
        {reviewDialog}
      </div>
    )
  }

  return (
    <div className="container-page pb-10">
      <Breadcrumbs items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Pagamento' }]} className="pt-10" />
      <h1 className="sr-only">Pagamento</h1>

      {pendingNotice}

      <div className="mt-6 flex animate-fade-up flex-col gap-10 lg:flex-row lg:gap-8">
        <form onSubmit={startReview} noValidate className="flex min-w-0 flex-1 flex-col gap-6" aria-labelledby="collector-title" id="checkout-form">
          <h2 id="collector-title" className="text-lg leading-4 font-bold">
            Perfil do colecionador
          </h2>
          <WalletChooser wallets={wallets.data?.items} loading={wallets.isPending} selectedId={walletId} useOther={useOther} onSelect={selectWallet} onUseOther={toggleOther} />
          {profile.isPending ? <Skeleton className="h-[420px] w-full" /> : <CheckoutForm form={form} readOnlyWallet={!useOther && Boolean(walletId)} />}
        </form>

        <aside aria-labelledby="your-nfts" className="flex w-full flex-col gap-4 lg:w-[405px]">
          <h2 id="your-nfts" className="text-lg leading-4 font-bold">
            Seus NFTs
          </h2>
          <CartNoticesList />
          <div className="flex justify-between text-base font-bold" aria-hidden="true">
            <span>NFTs</span>
            <span>Subtotal</span>
          </div>
          <ul className="flex flex-col gap-3">
            {cart.isPending
              ? Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-[70px] w-full rounded-none" />)
              : items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 bg-card pr-4">
                    <NftImage artwork={item.artwork} alt="" sizes="70px" className="size-[70px] rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{item.name}</p>
                      <p className="text-sm text-khaki">ID do token: {item.tokenId}</p>
                      {item.issue && <p className="text-xs text-coral">⚠ {item.issue === 'PRICE_CHANGED' ? 'Preço atualizado' : 'Indisponível na quantidade escolhida'}</p>}
                    </div>
                    <span className="text-sm text-sand">(x {item.quantity})</span>
                    <EthPrice value={item.lineTotal} className="font-bold text-highlight" />
                  </li>
                ))}
          </ul>
          {cart.data && (
            <div>
              {showCoupon || cart.data.couponCode ? (
                <CouponForm cart={cart.data} />
              ) : (
                <button type="button" onClick={() => setShowCoupon(true)} className="w-full text-center text-[15px] hover:text-highlight">
                  Tem um código promocional? <span className="text-highlight">Aplique aqui</span>
                </button>
              )}
            </div>
          )}
          {quote.isError && !quote.data ? (
            <ErrorState error={quote.error} title="Não foi possível calcular o total" onRetry={() => void quote.refetch()} className="py-6" />
          ) : (
            <QuoteLines quote={quote.data} loading={quote.isFetching} cart={cart.data} />
          )}

          <fieldset className="mt-2 flex flex-col gap-3">
            <legend className="mb-3 w-full text-center text-[17px] font-bold">Carteira e rede</legend>
            <div role="radiogroup" aria-label="Aplicativo de carteira" className="flex flex-col gap-3">
              {providerOptions.map((option) => {
                const checked = values.walletProvider === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    onClick={() => form.setValue('walletProvider', option.id, { shouldDirty: true })}
                    className={cn('flex h-[45px] items-center gap-3 border px-3 text-left text-[15px] transition-colors', checked ? 'border-foreground' : 'border-line hover:border-primary/60')}
                  >
                    <span aria-hidden="true" className={cn('flex size-4 items-center justify-center rounded-full border border-primary', checked && 'after:size-2 after:rounded-full after:bg-primary')} />
                    <ProviderMark id={option.id} />
                    {option.id === 'walletconnect' ? (
                      <>
                        <span className="sr-only">WalletConnect (MetaMask, WalletConnect e Coinbase)</span>
                        <WalletBrandsBadge className="max-sm:hidden" />
                        <span className="sm:hidden">WalletConnect</span>
                      </>
                    ) : (
                      option.label
                    )}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 rounded-sm bg-card p-3 text-sm" aria-live="polite">
            {connection ? (
              <div className="flex items-center justify-between gap-3">
                <span>
                  <span className="text-success-text">● Conectada:</span> {walletProviderLabels[connection.provider]} · {shortAddress(connection.address)} ({networkLabels[connection.network]})
                </span>
                <button type="button" onClick={() => disconnect.mutate(connection.id)} disabled={disconnect.isPending} className="text-xs text-khaki hover:text-coral">
                  Desconectar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sand">{connect.isPending ? `Aguardando aprovação na ${walletProviderLabels[values.walletProvider]}…` : 'Carteira não conectada'}</span>
                <button type="button" onClick={connectWallet} disabled={connect.isPending} className="text-xs font-bold text-highlight hover:underline">
                  Conectar carteira
                </button>
              </div>
            )}
            {connectError && (
              <p role="alert" className="text-coral">
                ⚠ {connectError}
              </p>
            )}
          </div>

          <Button type="submit" form="checkout-form" disabled={submitDisabled} className="h-12 text-[15px]">
            {submitLabel}
          </Button>
          {blockedNotice}
        </aside>
      </div>


      {reviewDialog}
    </div>
  )
}
