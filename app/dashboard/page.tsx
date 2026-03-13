import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GrimoireApp from '@/components/GrimoireApp'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [{ data: rituals }, { data: tarotLogs }, { data: sigils }] = await Promise.all([
    supabase.from('rituals').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('tarot_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('sigils').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <GrimoireApp
      user={{ id: user.id, email: user.email! }}
      initialRituals={rituals || []}
      initialTarotLogs={tarotLogs || []}
      initialSigils={sigils || []}
    />
  )
}
