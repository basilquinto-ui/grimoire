'use client'
import { useGrimoireData } from '@/hooks/useGrimoireData'
import GrimoireUI from './GrimoireUI'
import type { Ritual, TarotLog, Sigil } from '@/hooks/useGrimoireData'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Props = {
  user: { id: string; email: string }
  initialRituals: Ritual[]
  initialTarotLogs: TarotLog[]
  initialSigils: Sigil[]
}

export default function GrimoireApp({ user, initialRituals, initialTarotLogs, initialSigils }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const data = useGrimoireData(user.id, { rituals: initialRituals, tarotLogs: initialTarotLogs, sigils: initialSigils })

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // Everyone is Pro during free early access
  return <GrimoireUI user={user} isPro={true} {...data} onSignOut={signOut} />
}
