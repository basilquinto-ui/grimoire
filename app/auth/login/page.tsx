'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#09080f', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Crimson Pro', Georgia, serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Cinzel:wght@400;600&family=Crimson+Pro:ital,wght@0,400;1,400&display=swap');`}</style>
      <div style={{ background:'#130f1e', border:'1px solid #1c1830', borderRadius:16, padding:'40px 36px', maxWidth:400, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:16 }}>☽</div>
        {sent ? (
          <>
            <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:20, color:'#c8a84a', marginBottom:12 }}>Check your email</div>
            <p style={{ color:'#8a85a8', fontSize:14, fontStyle:'italic', lineHeight:1.7 }}>
              A magic link was sent to <strong style={{ color:'#c8a84a' }}>{email}</strong>.<br/>Click it to enter your grimoire.
            </p>
            <p style={{ marginTop:16, fontSize:12, color:'#3e3960', fontStyle:'italic' }}>No password. Ever.</p>
          </>
        ) : (
          <>
            <div style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:20, color:'#c8a84a', marginBottom:8 }}>Enter the Grimoire</div>
            <p style={{ color:'#8a85a8', fontSize:14, fontStyle:'italic', marginBottom:28, lineHeight:1.7 }}>We'll send a magic link — no password required.</p>
            <form onSubmit={login}>
              <input
                style={{ background:'#09080f', border:'1px solid #1c1830', color:'#e2ddf2', fontFamily:"'Crimson Pro',serif", fontSize:15, borderRadius:8, padding:'11px 14px', outline:'none', width:'100%', marginBottom:12, boxSizing:'border-box' }}
                type="email" placeholder="your@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus
              />
              <button
                style={{ background:'linear-gradient(135deg,#c8a84a,#b08030)', color:'#09080f', border:'none', borderRadius:8, fontFamily:"'Cinzel',serif", fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', padding:'12px', width:'100%', cursor:'pointer', opacity:loading?0.6:1 }}
                type="submit" disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Magic Link ✦'}
              </button>
            </form>
          </>
        )}
        <a href="/" style={{ display:'inline-block', marginTop:20, color:'#524d6e', fontSize:13, textDecoration:'none', fontStyle:'italic' }}>← Back</a>
      </div>
    </div>
  )
}
