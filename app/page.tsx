import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div style={{ minHeight:'100vh', background:'#09080f', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontFamily:"'Crimson Pro', Georgia, serif", color:'#e2ddf2', textAlign:'center', padding:'40px 24px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,400;1,400&display=swap');`}</style>
      <div style={{ fontSize:52, marginBottom:20, filter:'drop-shadow(0 0 20px #c8a84a44)' }}>☽</div>
      <h1 style={{ fontFamily:"'Cinzel Decorative', serif", fontSize:'clamp(28px,6vw,52px)', color:'#c8a84a', marginBottom:16, letterSpacing:-0.5 }}>Grimoire</h1>
      <p style={{ fontSize:18, color:'#8a85a8', fontStyle:'italic', maxWidth:480, lineHeight:1.8, marginBottom:12 }}>
        The occult practice operating system.
      </p>
      <p style={{ fontSize:14, color:'#3e3960', fontStyle:'italic', maxWidth:400, lineHeight:1.8, marginBottom:48 }}>
        Pattern intelligence derived from your personal magical record — moon phases, ingredient correlations, manifestation timing.
      </p>
      <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
        <a href="/auth/login" style={{ background:'linear-gradient(135deg,#c8a84a,#b08030)', color:'#09080f', padding:'13px 36px', borderRadius:8, textDecoration:'none', fontFamily:"'Cinzel', serif", fontSize:11, letterSpacing:1.5, textTransform:'uppercase', fontWeight:700 }}>Enter the Grimoire →</a>
      </div>
      <div style={{ marginTop:64, display:'flex', gap:28, flexWrap:'wrap', justifyContent:'center' }}>
        {[['📖','Ritual records'],['📊','Pattern analytics'],['🌒','Manifestation timeline'],['✦','AI counsel']].map(([icon,label]) => (
          <div key={label as string} style={{ textAlign:'center' }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
            <div style={{ fontSize:12, color:'#524d6e', fontStyle:'italic' }}>{label}</div>
          </div>
        ))}
      </div>
      <p style={{ marginTop:48, fontSize:12, color:'#2a2445', fontStyle:'italic' }}>Free during early access</p>
    </div>
  )
}
