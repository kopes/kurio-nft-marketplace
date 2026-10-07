import { useEffect, useState } from 'react'
import { onAnnounce } from '@/lib/announcer'

/** Regiões aria-live globais para feedback de mutations e eventos em tempo real. */
export function LiveRegion() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  useEffect(
    () =>
      onAnnounce((message, politeness) => {
        const set = politeness === 'assertive' ? setAssertive : setPolite
        set('')
        // Reatribuir em outro frame garante que mensagens repetidas sejam lidas novamente.
        requestAnimationFrame(() => set(message))
      }),
    [],
  )

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="live-polite">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true" data-testid="live-assertive">
        {assertive}
      </div>
    </>
  )
}
