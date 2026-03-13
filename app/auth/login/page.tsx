'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = canvas.width = window.innerWidth
    let H = canvas.height = window.innerHeight
    let animId: number

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight }
    window.addEventListener('resize', resize)

    // Stars
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.2 + 0.2,
      speed: Math.random() * 0.15 + 0.03,
      phase: Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.5 + 0.2,
    }))

    // Particles
    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 2.5 + 1,
      opacity: Math.random() * 0.35 + 0.05,
      hue: Math.random() * 60 + 260, // purples to pinks
    }))

    // Sigil lines (sacred geometry, slow rotation)
    const sigil = { angle: 0, x: W * 0.5, y: H * 0.5 }

    let t = 0

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Deep gradient background
      const bg = ctx.createLinearGradient(0, 0, W * 0.6, H)
      bg.addColorStop(0, '#0a0614')
      bg.addColorStop(0.5, '#0f0820')
      bg.addColorStop(1, '#130a24')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Ambient orbs
      const orbs = [
        { x: W * 0.15, y: H * 0.2, r: 320, c1: 'rgba(120,60,200,0.10)', c2: 'rgba(120,60,200,0)' },
        { x: W * 0.85, y: H * 0.75, r: 280, c1: 'rgba(180,80,220,0.08)', c2: 'rgba(180,80,220,0)' },
        { x: W * 0.5, y: H * 0.5, r: 200, c1: 'rgba(90,40,160,0.06)', c2: 'rgba(90,40,160,0)' },
      ]
      orbs.forEach(o => {
        const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r)
        g.addColorStop(0, o.c1); g.addColorStop(1, o.c2)
        ctx.fillStyle = g; ctx.beginPath()
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill()
      })

      // Stars twinkle
      stars.forEach(s => {
        const tw = Math.sin(t * s.speed + s.phase) * 0.4 + 0.6
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(220,210,255,${s.opacity * tw})`
        ctx.fill()
      })

      // Floating particles
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3)
        g.addColorStop(0, `hsla(${p.hue},70%,75%,${p.opacity})`)
        g.addColorStop(1, `hsla(${p.hue},70%,75%,0)`)
        ctx.fillStyle = g; ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2); ctx.fill()
      })

      // Sacred geometry - slow rotating sigil at center-left
      sigil.angle += 0.003
      sigil.x = W * 0.18; sigil.y = H * 0.5
      const pts = 7, R = 90
      ctx.save()
      ctx.translate(sigil.x, sigil.y)
      ctx.rotate(sigil.angle)
      ctx.globalAlpha = 0.07
      ctx.strokeStyle = '#c8a8f8'
      ctx.lineWidth = 0.8
      // Heptagram
      for (let i = 0; i < pts; i++) {
        const a1 = (i / pts) * Math.PI * 2 - Math.PI / 2
        const a2 = ((i + 3) / pts) * Math.PI * 2 - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a1) * R, Math.sin(a1) * R)
        ctx.lineTo(Math.cos(a2) * R, Math.sin(a2) * R)
        ctx.stroke()
      }
      // Outer circle
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // Second sigil top-right, different speed
      ctx.save()
      ctx.translate(W * 0.85, H * 0.2)
      ctx.rotate(-sigil.angle * 0.7)
      ctx.globalAlpha = 0.05
      ctx.strokeStyle = '#e0b8ff'
      ctx.lineWidth = 0.7
      const pts2 = 5, R2 = 60
      for (let i = 0; i < pts2; i++) {
        const a1 = (i / pts2) * Math.PI * 2 - Math.PI / 2
        const a2 = ((i + 2) / pts2) * Math.PI * 2 - Math.PI / 2
        ctx.beginPath()
        ctx.moveTo(Math.cos(a1) * R2, Math.sin(a1) * R2)
        ctx.lineTo(Math.cos(a2) * R2, Math.sin(a2) * R2)
        ctx.stroke()
      }
      ctx.beginPath(); ctx.arc(0, 0, R2, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      t++
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (error) setError(error.message)
      else setSuccess('Account created. Check your email to confirm, then sign in.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', overflow: 'hidden', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600&display=swap');
        * { box-sizing: border-box; }
        @keyframes cardIn { from { opacity:0; transform: translateY(24px) scale(0.97); } to { opacity:1; transform: none; } }
        @keyframes glowPulse { 0%,100% { box-shadow: 0 0 40px rgba(160,100,220,0.15), 0 20px 60px rgba(100,60,180,0.2); } 50% { box-shadow: 0 0 60px rgba(180,120,240,0.25), 0 20px 70px rgba(120,80,200,0.3); } }
        @keyframes shimmerLine { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
        .login-card {
          animation: cardIn 0.8s cubic-bezier(0.16,1,0.3,1) both, glowPulse 4s ease-in-out 0.8s infinite;
          background: rgba(15,8,32,0.75);
          border: 1px solid rgba(180,140,255,0.18);
          border-radius: 24px;
          padding: 48px 44px;
          max-width: 400px;
          width: 100%;
          text-align: center;
          backdrop-filter: blur(24px);
          position: relative;
          overflow: hidden;
        }
        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(200,160,255,0.6), transparent);
          animation: shimmerLine 3s ease-in-out 1s infinite;
        }
        .inp-dark {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(180,140,255,0.2);
          color: #e8e0ff;
          font-family: 'Cormorant Garamond', serif;
          font-size: 16px;
          border-radius: 10px;
          padding: 13px 16px;
          outline: none;
          width: 100%;
          transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
        }
        .inp-dark::placeholder { color: rgba(180,150,220,0.5); font-style: italic; }
        .inp-dark:focus { border-color: rgba(180,140,255,0.5); background: rgba(255,255,255,0.08); box-shadow: 0 0 0 3px rgba(160,100,220,0.12); }
        .btn-enter {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #9d6fe8, #7040c8, #5828a8);
          color: #fff;
          font-family: 'Cinzel', serif;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 24px rgba(120,60,220,0.4);
          margin-top: 4px;
        }
        .btn-enter::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transition: left 0.4s;
        }
        .btn-enter:hover::after { left: 150%; }
        .btn-enter:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.92; }
        .btn-enter:disabled { opacity: 0.4; cursor: not-allowed; }
        .toggle-link { color: rgba(180,140,255,0.8); cursor: pointer; text-decoration: underline; text-decoration-color: rgba(180,140,255,0.3); font-style: italic; transition: color 0.2s; }
        .toggle-link:hover { color: #c8a8ff; }
        .moon-glyph {
          font-size: 44px;
          display: block;
          margin-bottom: 16px;
          filter: drop-shadow(0 0 20px rgba(180,120,255,0.5)) drop-shadow(0 0 40px rgba(140,80,220,0.3));
          animation: glowPulse 4s ease-in-out infinite;
        }
      `}</style>

      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0 }} />

      <div className="login-card" style={{ position: 'relative', zIndex: 1 }}>
        <span className="moon-glyph">☽</span>

        <div style={{ fontFamily: "'Cinzel', serif", fontSize: 24, color: '#d4b8ff', marginBottom: 6, letterSpacing: 1.5, fontWeight: 400 }}>
          Grimoire
        </div>
        <p style={{ color: 'rgba(180,150,220,0.7)', fontSize: 14, fontStyle: 'italic', marginBottom: 36, lineHeight: 1.6 }}>
          {mode === 'login' ? 'Welcome back to your practice.' : 'Begin your magical record.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="inp-dark" type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
          <input className="inp-dark" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />

          {error && <div style={{ color: '#e08090', fontSize: 13, background: 'rgba(220,80,100,0.1)', borderRadius: 8, padding: '10px 14px', fontStyle: 'italic', border: '1px solid rgba(220,80,100,0.2)' }}>{error}</div>}
          {success && <div style={{ color: '#80e0a8', fontSize: 13, background: 'rgba(80,200,120,0.1)', borderRadius: 8, padding: '10px 14px', fontStyle: 'italic', border: '1px solid rgba(80,200,120,0.2)' }}>{success}</div>}

          <button className="btn-enter" type="submit" disabled={loading}>
            {loading ? '✦  . . .' : mode === 'login' ? 'Enter the Grimoire' : 'Create Account'}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 14, color: 'rgba(160,130,200,0.6)', fontStyle: 'italic' }}>
          {mode === 'login'
            ? <><span>No account? </span><span className="toggle-link" onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}>Create one</span></>
            : <><span>Have an account? </span><span className="toggle-link" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Sign in</span></>
          }
        </p>
        <a href="/" style={{ display: 'inline-block', marginTop: 14, color: 'rgba(140,110,180,0.4)', fontSize: 12, textDecoration: 'none', fontStyle: 'italic', transition: 'color 0.2s' }}>
          Back
        </a>
      </div>
    </div>
  )
}
