import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Cinzel:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #080512; color: #e0d8f8; font-family: 'Cormorant Garamond', Georgia, serif; overflow-x: hidden; }

        /* Animated bg canvas */
        #bg-canvas { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }

        @keyframes fadeUp { from { opacity:0; transform: translateY(30px); } to { opacity:1; transform: none; } }
        @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes rotateSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
        @keyframes glowPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

        .hero-section { position: relative; z-index: 1; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 24px 60px; text-align: center; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(160,100,255,0.1); border: 1px solid rgba(160,100,255,0.25); border-radius: 40px; padding: 6px 18px; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 2px; color: rgba(200,160,255,0.8); text-transform: uppercase; margin-bottom: 32px; animation: fadeIn 1s ease both; }
        .hero-badge .dot { width: 6px; height: 6px; border-radius: 50%; background: #a060ff; animation: glowPulse 2s ease infinite; }
        .hero-moon { font-size: 72px; display: block; margin-bottom: 20px; animation: float 6s ease-in-out infinite, fadeUp 1s ease 0.2s both; filter: drop-shadow(0 0 30px rgba(180,120,255,0.5)); }
        .hero-title { font-family: 'Cinzel', serif; font-size: clamp(52px, 8vw, 96px); font-weight: 400; color: #d4b8ff; letter-spacing: 4px; line-height: 1; margin-bottom: 8px; animation: fadeUp 1s ease 0.3s both; }
        .hero-sub { font-size: clamp(16px, 2vw, 22px); color: rgba(180,150,220,0.7); font-style: italic; max-width: 560px; line-height: 1.9; margin: 16px auto 48px; animation: fadeUp 1s ease 0.5s both; }
        .cta-group { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; animation: fadeUp 1s ease 0.7s both; margin-bottom: 80px; }
        .btn-primary-hero {
          display: inline-block; padding: 16px 48px;
          background: linear-gradient(135deg, #9d6fe8, #6828c8);
          color: #fff; text-decoration: none;
          font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600;
          letter-spacing: 2px; text-transform: uppercase;
          border-radius: 12px; position: relative; overflow: hidden;
          box-shadow: 0 4px 32px rgba(120,60,220,0.5);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn-primary-hero::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); transition:left 0.5s; }
        .btn-primary-hero:hover::after { left: 150%; }
        .btn-primary-hero:hover { transform: translateY(-2px); box-shadow: 0 8px 40px rgba(140,80,240,0.6); }
        .btn-ghost-hero { display: inline-block; padding: 16px 36px; border: 1px solid rgba(180,140,255,0.3); color: rgba(180,150,220,0.7); text-decoration: none; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; border-radius: 12px; transition: border-color 0.2s, color 0.2s; }
        .btn-ghost-hero:hover { border-color: rgba(180,140,255,0.6); color: #c8a8ff; }

        /* Scrolling stats bar */
        .stats-bar { position: relative; z-index: 1; border-top: 1px solid rgba(180,140,255,0.1); border-bottom: 1px solid rgba(180,140,255,0.1); background: rgba(15,8,32,0.6); backdrop-filter: blur(12px); padding: 20px 0; display: flex; justify-content: center; gap: 60px; flex-wrap: wrap; }
        .stat-item { text-align: center; }
        .stat-num { font-family: 'Cinzel', serif; font-size: 28px; color: #c8a8ff; display: block; }
        .stat-label { font-size: 11px; color: rgba(160,130,200,0.5); letter-spacing: 1.5px; text-transform: uppercase; font-family: 'Cinzel', serif; }

        /* Feature sections */
        .section { position: relative; z-index: 1; max-width: 1000px; margin: 0 auto; padding: 100px 24px; }
        .section-eyebrow { font-family: 'Cinzel', serif; font-size: 10px; color: rgba(160,100,255,0.7); letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px; }
        .section-title { font-family: 'Cinzel', serif; font-size: clamp(28px, 4vw, 44px); font-weight: 400; color: #d4b8ff; line-height: 1.2; margin-bottom: 20px; }
        .section-body { font-size: 18px; color: rgba(180,150,220,0.65); line-height: 1.9; font-style: italic; max-width: 540px; }

        /* Feature grid */
        .feat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 60px; }
        .feat-card {
          background: rgba(20,10,40,0.7);
          border: 1px solid rgba(160,100,255,0.12);
          border-radius: 18px; padding: 28px 26px;
          backdrop-filter: blur(12px);
          transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
          position: relative; overflow: hidden;
        }
        .feat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(180,120,255,0.4),transparent); }
        .feat-card:hover { border-color: rgba(160,100,255,0.3); transform: translateY(-4px); box-shadow: 0 12px 40px rgba(100,50,200,0.2); }
        .feat-icon { font-size: 28px; margin-bottom: 14px; display: block; }
        .feat-title { font-family: 'Cinzel', serif; font-size: 14px; color: #c8a8ff; margin-bottom: 10px; letter-spacing: 0.5px; }
        .feat-body { font-size: 14px; color: rgba(160,130,200,0.65); line-height: 1.8; font-style: italic; }

        /* Preview mockup */
        .mockup-wrap { position: relative; z-index: 1; max-width: 860px; margin: 0 auto; padding: 0 24px 100px; }
        .mockup-frame {
          background: rgba(12,6,28,0.9);
          border: 1px solid rgba(160,100,255,0.2);
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.04), 0 40px 100px rgba(80,30,180,0.4);
        }
        .mockup-bar { background: rgba(20,10,40,0.9); padding: 12px 20px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(160,100,255,0.1); }
        .mockup-dot { width: 10px; height: 10px; border-radius: 50%; }
        .mockup-body { padding: 24px; }
        .insight-pill { display: inline-flex; align-items: center; gap: 8px; background: rgba(160,100,255,0.1); border: 1px solid rgba(160,100,255,0.2); border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; width: 100%; }
        .insight-icon { font-size: 16px; }
        .insight-text { font-size: 13px; color: rgba(180,150,220,0.85); font-style: italic; line-height: 1.5; }
        .mini-bar-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .mini-label { font-family: 'Cinzel', serif; font-size: 10px; color: rgba(160,130,200,0.6); width: 100px; }
        .mini-track { flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; }
        .mini-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, #9d6fe8, #c090ff); }
        .mini-val { font-family: 'Cinzel', serif; font-size: 11px; color: #c8a8ff; width: 30px; text-align: right; }

        /* Testimonials / social proof */
        .proof-section { position: relative; z-index: 1; max-width: 900px; margin: 0 auto; padding: 0 24px 100px; }
        .proof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
        .proof-card { background: rgba(20,10,40,0.6); border: 1px solid rgba(160,100,255,0.1); border-radius: 14px; padding: 22px 20px; }
        .proof-stars { color: #c8a84a; font-size: 14px; margin-bottom: 10px; }
        .proof-text { font-size: 14px; color: rgba(180,150,220,0.75); font-style: italic; line-height: 1.8; margin-bottom: 14px; }
        .proof-author { font-family: 'Cinzel', serif; font-size: 10px; color: rgba(140,110,180,0.5); letter-spacing: 1px; }

        /* Pricing */
        .pricing-section { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; padding: 0 24px 120px; text-align: center; }
        .price-card {
          background: rgba(20,10,40,0.8);
          border: 1px solid rgba(160,100,255,0.25);
          border-radius: 24px; padding: 48px 40px;
          position: relative; overflow: hidden;
          box-shadow: 0 0 60px rgba(100,50,200,0.2);
        }
        .price-card::before { content:''; position:absolute; top:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,rgba(200,160,255,0.6),transparent); animation: shimmer 3s ease-in-out infinite; }
        .price-amount { font-family: 'Cinzel', serif; font-size: 64px; color: #d4b8ff; line-height: 1; }
        .price-per { font-size: 16px; color: rgba(160,130,200,0.5); font-style: italic; }
        .price-list { list-style: none; margin: 32px 0; text-align: left; display: flex; flex-direction: column; gap: 12px; }
        .price-list li { display: flex; gap: 12px; align-items: flex-start; font-size: 15px; color: rgba(180,150,220,0.8); font-style: italic; line-height: 1.6; }
        .price-list li::before { content: '✦'; color: #9d6fe8; flex-shrink: 0; margin-top: 2px; }
        .price-note { font-size: 12px; color: rgba(140,110,180,0.4); font-style: italic; margin-top: 20px; }

        /* Footer */
        .footer { position: relative; z-index: 1; text-align: center; padding: 40px 24px 60px; border-top: 1px solid rgba(180,140,255,0.08); }
        .footer-mark { font-family: 'Cinzel', serif; font-size: 18px; color: rgba(160,120,220,0.3); margin-bottom: 12px; }
        .footer-links { display: flex; gap: 28px; justify-content: center; flex-wrap: wrap; }
        .footer-links a { font-size: 12px; color: rgba(140,110,180,0.35); text-decoration: none; font-style: italic; transition: color 0.2s; letter-spacing: 0.5px; }
        .footer-links a:hover { color: rgba(180,150,220,0.6); }

        @media (max-width: 600px) {
          .stats-bar { gap: 30px; padding: 20px 16px; }
          .feat-grid { grid-template-columns: 1fr; }
          .price-card { padding: 36px 24px; }
          .price-amount { font-size: 52px; }
        }
      `}</style>

      <canvas id="bg-canvas" />
      <script dangerouslySetInnerHTML={{ __html: `
        (function() {
          var canvas = document.getElementById('bg-canvas');
          if (!canvas) return;
          var ctx = canvas.getContext('2d');
          var W, H, stars, particles, t = 0, animId;
          function init() {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
            stars = Array.from({length: 150}, function() { return { x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.3+0.2, speed: Math.random()*0.12+0.02, phase: Math.random()*Math.PI*2, op: Math.random()*0.4+0.15 }; });
            particles = Array.from({length: 20}, function() { return { x: Math.random()*W, y: Math.random()*H, vx: (Math.random()-0.5)*0.2, vy: (Math.random()-0.5)*0.2, r: Math.random()*3+1.5, op: Math.random()*0.2+0.05, hue: Math.random()*60+260 }; });
          }
          function draw() {
            ctx.clearRect(0,0,W,H);
            var bg = ctx.createLinearGradient(0,0,W*0.5,H);
            bg.addColorStop(0,'#08050f'); bg.addColorStop(0.5,'#0c071a'); bg.addColorStop(1,'#100928');
            ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
            var orbs=[{x:W*.1,y:H*.15,r:350,c:'rgba(100,40,200,0.09)'},{x:W*.9,y:H*.8,r:300,c:'rgba(160,60,220,0.07)'},{x:W*.5,y:H*.4,r:250,c:'rgba(80,20,160,0.06)'}];
            orbs.forEach(function(o){var g=ctx.createRadialGradient(o.x,o.y,0,o.x,o.y,o.r);g.addColorStop(0,o.c);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,Math.PI*2);ctx.fill();});
            stars.forEach(function(s){var tw=Math.sin(t*s.speed+s.phase)*0.4+0.6;ctx.beginPath();ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fillStyle='rgba(210,195,255,'+s.op*tw+')';ctx.fill();});
            particles.forEach(function(p){p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;var g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*4);g.addColorStop(0,'hsla('+p.hue+',65%,70%,'+p.op+')');g.addColorStop(1,'hsla('+p.hue+',65%,70%,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,p.r*4,0,Math.PI*2);ctx.fill();});
            // Sigil
            ctx.save();ctx.translate(W*0.08,H*0.5);ctx.rotate(t*0.002);ctx.globalAlpha=0.06;ctx.strokeStyle='#c0a0ff';ctx.lineWidth=0.8;
            var pts=7,R=110;for(var i=0;i<pts;i++){var a1=(i/pts)*Math.PI*2-Math.PI/2,a2=((i+3)/pts)*Math.PI*2-Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(a1)*R,Math.sin(a1)*R);ctx.lineTo(Math.cos(a2)*R,Math.sin(a2)*R);ctx.stroke();}
            ctx.beginPath();ctx.arc(0,0,R,0,Math.PI*2);ctx.stroke();ctx.restore();
            ctx.save();ctx.translate(W*0.92,H*0.25);ctx.rotate(-t*0.0015);ctx.globalAlpha=0.05;ctx.strokeStyle='#d8b0ff';ctx.lineWidth=0.7;
            var R2=70;for(var j=0;j<5;j++){var b1=(j/5)*Math.PI*2-Math.PI/2,b2=((j+2)/5)*Math.PI*2-Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(b1)*R2,Math.sin(b1)*R2);ctx.lineTo(Math.cos(b2)*R2,Math.sin(b2)*R2);ctx.stroke();}
            ctx.beginPath();ctx.arc(0,0,R2,0,Math.PI*2);ctx.stroke();ctx.restore();
            t++; animId=requestAnimationFrame(draw);
          }
          init(); draw();
          window.addEventListener('resize',function(){cancelAnimationFrame(animId);init();draw();});
        })();
      `}} />

      {/* Hero */}
      <section className="hero-section">
        <div className="hero-badge"><span className="dot"/><span>Practice Intelligence System</span></div>
        <span className="hero-moon">☽</span>
        <h1 className="hero-title">Grimoire</h1>
        <p className="hero-sub">
          The only app that learns your magic. Pattern analysis, AI counsel, and ritual intelligence built from your personal record.
        </p>
        <div className="cta-group">
          <a href="/auth/login" className="btn-primary-hero">Begin Your Practice</a>
          <a href="#features" className="btn-ghost-hero">See What's Inside</a>
        </div>
      </section>

      {/* Stats bar */}
      <div className="stats-bar">
        {[['8','Data Points Per Ritual'],['29.5','Moon Cycle Days Tracked'],['7','Planetary Hour Rulers'],['5','Insight Categories']].map(([n,l]) => (
          <div key={l} className="stat-item">
            <span className="stat-num">{n}</span>
            <span className="stat-label">{l}</span>
          </div>
        ))}
      </div>

      {/* App preview mockup */}
      <div className="mockup-wrap" style={{ marginTop: 80 }}>
        <p style={{ textAlign: 'center', fontFamily: "'Cinzel', serif", fontSize: 10, color: 'rgba(160,100,255,0.5)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 32 }}>Live Intelligence Dashboard</p>
        <div className="mockup-frame">
          <div className="mockup-bar">
            <div className="mockup-dot" style={{ background: '#ff5f57' }} />
            <div className="mockup-dot" style={{ background: '#ffbd2e' }} />
            <div className="mockup-dot" style={{ background: '#28ca41' }} />
            <span style={{ marginLeft: 12, fontFamily: "'Cinzel', serif", fontSize: 11, color: 'rgba(160,120,220,0.5)', letterSpacing: 1 }}>Grimoire Intelligence</span>
          </div>
          <div className="mockup-body">
            <div className="insight-pill">
              <span className="insight-icon">✦</span>
              <span className="insight-text">Full Moon produces your highest results (avg 4.6/5). Rosemary lifts success by +1.2 vs workings without it. Workings manifest in 11.3 days on average.</span>
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: 'rgba(160,120,200,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>Moon Phase Effectiveness</p>
                {[['Full Moon','4.6',92],['Waxing Gibbous','4.1',82],['New Moon','3.8',76],['First Quarter','3.2',64]].map(([p,v,w]) => (
                  <div key={p as string} className="mini-bar-row">
                    <span className="mini-label">{p}</span>
                    <div className="mini-track"><div className="mini-fill" style={{ width: `${w}%` }} /></div>
                    <span className="mini-val">{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <p style={{ fontFamily: "'Cinzel', serif", fontSize: 10, color: 'rgba(160,120,200,0.5)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 14 }}>Ingredient Lift</p>
                {[['Rosemary','+1.2'],['Black Salt','+0.8'],['Frankincense','+0.6'],['Bay Leaf','+0.3']].map(([i,l]) => (
                  <div key={i as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(160,100,255,0.08)' }}>
                    <span style={{ fontSize: 13, color: 'rgba(180,150,220,0.65)', fontStyle: 'italic' }}>{i}</span>
                    <span style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: '#90d4a0' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="section" id="features">
        <p className="section-eyebrow">What You Get</p>
        <h2 className="section-title">Built for serious practitioners</h2>
        <p className="section-body">Not a journal. Not a moon phase widget. A full intelligence system that gets smarter the more you use it.</p>
        <div className="feat-grid">
          {[
            ['📖','Ritual Log','Record every working with full detail: moon phase, planetary hour, ingredients, tools, duration, and outcome. Your complete magical record.'],
            ['📊','Pattern Analytics','Discover which moon phases, days, and ingredients actually correlate with your successes. Built from your data, not astrology textbooks.'],
            ['🌒','Moon Intelligence','Real-time moon phase and planetary hour tracking. Know the cosmic conditions of every ritual you perform.'],
            ['✦','AI Counsel','An advisor trained on your entire practice history. Asks what works for you, not what works in general.'],
            ['⊕','Sigil Tracker','Seal, track, and recharge active sigils. Get alerts when workings need attention. Mark manifestations.'],
            ['🃏','Tarot Logs','Record readings and spot recurring cards across your practice. AI interpretation with context from your history.'],
            ['🔮','Predictive Windows','After enough data, the system predicts your optimal timing for specific intent types based on past results.'],
            ['📈','Manifestation Timeline','Track how long workings take to deliver. See which moon phases produce the fastest results.'],
          ].map(([icon,title,body]) => (
            <div key={title as string} className="feat-card">
              <span className="feat-icon">{icon}</span>
              <div className="feat-title">{title}</div>
              <div className="feat-body">{body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="proof-section">
        <p style={{ textAlign: 'center', fontFamily: "'Cinzel', serif", fontSize: 10, color: 'rgba(160,100,255,0.5)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>Early Practitioners</p>
        <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(22px,3vw,32px)', color: '#d4b8ff', textAlign: 'center', marginBottom: 48, fontWeight: 400 }}>Patterns you cannot see any other way</h2>
        <div className="proof-grid">
          {[
            ["I never realized Full Moons were so much more effective for me. Three months of data made it undeniable.", "S.W., Hedge Witch"],
            ["The ingredient lift feature alone changed how I stock my altar. I cut half the things I thought were essential.", "M.K., Ritual Magician"],
            ["Having all my tarot readings in one place with the AI reading context from my history is genuinely different.", "R.A., Diviner"],
          ].map(([text, author]) => (
            <div key={author as string} className="proof-card">
              <div className="proof-stars">★★★★★</div>
              <p className="proof-text">"{text}"</p>
              <p className="proof-author">{author}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="pricing-section">
        <p className="section-eyebrow" style={{ marginBottom: 16 }}>Simple Pricing</p>
        <h2 style={{ fontFamily: "'Cinzel', serif", fontSize: 'clamp(24px,3vw,36px)', color: '#d4b8ff', marginBottom: 48, fontWeight: 400 }}>One price. Everything included.</h2>
        <div className="price-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            <span className="price-amount">$7</span>
          </div>
          <p className="price-per">per month. Cancel any time.</p>
          <ul className="price-list">
            <li>Unlimited ritual records with full analytics</li>
            <li>Moon phase and ingredient correlation intelligence</li>
            <li>AI counsel trained on your personal practice history</li>
            <li>Predictive optimal windows from your own data</li>
            <li>Tarot log with AI interpretation</li>
            <li>Sigil tracker with recharge alerts</li>
            <li>Manifestation timeline and phase analysis</li>
            <li>New features added regularly</li>
          </ul>
          <a href="/auth/login" className="btn-primary-hero" style={{ display: 'block', textAlign: 'center', marginTop: 8 }}>Start Free During Early Access</a>
          <p className="price-note">Everything is free right now while we are in early access. Lock in founding pricing by signing up today.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-mark">☽ Grimoire</div>
        <div className="footer-links">
          <a href="/auth/login">Sign In</a>
          <a href="/auth/login">Create Account</a>
          <a href="mailto:hello@grimoire.app">Contact</a>
        </div>
        <p style={{ marginTop: 24, fontSize: 11, color: 'rgba(120,90,160,0.25)', fontStyle: 'italic' }}>The intelligence is in your record.</p>
      </footer>
    </>
  )
}
