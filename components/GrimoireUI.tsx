'use client'
// components/GrimoireUI.tsx
// Production version of Grimoire v3 — all data ops go through props/hooks

import { useState, useEffect, useRef } from 'react'

/* ── Types ─────────────────────────────────── */
type Ritual = { id:string; title:string; intent_type:string; date:string; moon_phase:string; planet_day:string; ingredients:string[]; tools:string[]; duration:number; success_rating:number; outcome_flag:string; manifestation_date:string|null; outcome:string; energy_conditions:string; version:number; parent_id:string|null }
type TarotLog = { id:string; date:string; spread:string; moon_phase:string; question:string; cards:string[]; notes:string; ai_reading?:string }
type Sigil = { id:string; name:string; intent:string; symbol:string; color:string; activation_date:string; recharge_date:string|null; manifestation_date:string|null; status:string; notes:string }
type User = { id:string; email:string }

type Props = {
  user: User; isPro: boolean;
  rituals: Ritual[]; tarotLogs: TarotLog[]; sigils: Sigil[];
  addRitual: (r:any)=>Promise<any>; updateRitual: (id:string,u:any)=>Promise<any>; deleteRitual: (id:string)=>Promise<any>;
  addTarotLog: (l:any)=>Promise<any>; updateTarotLog: (id:string,u:any)=>Promise<any>;
  addSigil: (s:any)=>Promise<any>; updateSigil: (id:string,u:any)=>Promise<any>; deleteSigil: (id:string)=>Promise<any>;
  callAI: (messages:any[], system:string)=>Promise<string>;
  
  onSignOut: ()=>void;
}

/* ── Moon & planet engines ─────────────────── */
function getMoonPhase(date = new Date()) {
  const y=date.getFullYear(),mo=date.getMonth()+1,d=date.getDate()
  let yr=y,mn=mo; if(mn<3){yr--;mn+=12}
  const a=Math.floor(yr/100),b=2-a+Math.floor(a/4)
  const jd=Math.floor(365.25*(yr+4716))+Math.floor(30.6001*(mn+1))+d+b-1524.5
  const raw=((jd-2451550.1)/29.53058867)%1; const p=raw<0?raw+1:raw
  const phases=[[0.0625,"New Moon","🌑"],[0.1875,"Waxing Crescent","🌒"],[0.3125,"First Quarter","🌓"],[0.4375,"Waxing Gibbous","🌔"],[0.5625,"Full Moon","🌕"],[0.6875,"Waning Gibbous","🌖"],[0.8125,"Last Quarter","🌗"],[1.0,"Waning Crescent","🌘"]] as const
  const [,name,symbol]=phases.find(([t])=>p<t)||phases[7]
  return { name, symbol, raw:p }
}
const CHALDEAN=["Saturn","Sun","Moon","Mars","Mercury","Jupiter","Venus"]
const PLANET_COLORS:Record<string,string>={Sun:"#f0b429",Moon:"#a09cbf",Mars:"#e05070",Mercury:"#4ade80",Jupiter:"#7c6af7",Venus:"#f472b6",Saturn:"#8a85a8"}
const DAY_RULERS=["Sun","Moon","Mars","Mercury","Jupiter","Venus","Saturn"]
function getPlanetaryHour(){
  const now=new Date(),dow=now.getDay(),dayRulerIdx=CHALDEAN.indexOf(DAY_RULERS[dow])
  const sunrise=new Date(now);sunrise.setHours(6,0,0,0)
  const sunset=new Date(now);sunset.setHours(18,0,0,0)
  let hourIdx:number
  if(now>=sunrise&&now<sunset){const dl=sunset.getTime()-sunrise.getTime();hourIdx=Math.floor(((now.getTime()-sunrise.getTime())/dl)*12)}
  else{const ns=now>=sunset?sunset.getTime():new Date(now).setHours(18,0,0,0);const nl=12*3600*1000;hourIdx=Math.floor(((now.getTime()-ns)/nl)*12)+12}
  return {planet:CHALDEAN[(dayRulerIdx+hourIdx)%7],hour:hourIdx%12+1}
}
function getPlanetDay(){return DAY_RULERS[new Date().getDay()]}
function todayStr(){return new Date().toISOString().slice(0,10)}
function daysToNextPhase(targetName:string){
  const angles:Record<string,number>={"New Moon":0,"Waxing Crescent":0.125,"First Quarter":0.25,"Waxing Gibbous":0.375,"Full Moon":0.5,"Waning Gibbous":0.625,"Last Quarter":0.75,"Waning Crescent":0.875}
  const target=angles[targetName]??0,current=getMoonPhase().raw
  let diff=target-current; if(diff<=0)diff+=1
  return Math.round(diff*29.53)
}

/* ── Analytics engine ──────────────────────── */
const MIN_CORR=15,MIN_ING=10,MIN_PRED=20
function mean(a:number[]){return a.length?a.reduce((x,y)=>x+y,0)/a.length:0}
function confLevel(n:number,t:number){if(!n)return"none";if(n<t*.33)return"weak";if(n<t*.66)return"building";if(n<t)return"approaching";return"strong"}

function ingLift(rituals:Ritual[],ingredient:string){
  const rated=rituals.filter(r=>r.success_rating>0),k=ingredient.toLowerCase().trim()
  if(!rated.length)return null
  const w=rated.filter(r=>(r.ingredients||[]).map((i:string)=>i.toLowerCase()).includes(k))
  const wo=rated.filter(r=>!(r.ingredients||[]).map((i:string)=>i.toLowerCase()).includes(k))
  if(w.length<2)return null
  const aw=+mean(w.map(r=>r.success_rating)).toFixed(2)
  const awo=wo.length?+mean(wo.map(r=>r.success_rating)).toFixed(2):null
  return {ingredient,avgWith:aw,avgWithout:awo,lift:awo!==null?+(aw-awo).toFixed(2):null,n:w.length}
}

function buildAnalytics(rituals:Ritual[]){
  const rated=rituals.filter(r=>r.success_rating>0),total=rated.length
  const confidence=confLevel(total,MIN_CORR)
  const moonMap:Record<string,number[]>={};rated.forEach(r=>{if(!moonMap[r.moon_phase])moonMap[r.moon_phase]=[];moonMap[r.moon_phase].push(r.success_rating)})
  const moonStats=Object.entries(moonMap).map(([phase,scores])=>({phase,avg:+mean(scores).toFixed(2),count:scores.length})).sort((a,b)=>b.avg-a.avg)
  const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
  const dayMap:Record<string,number[]>={};rated.forEach(r=>{const day=DAYS[new Date(r.date).getDay()];if(!dayMap[day])dayMap[day]=[];dayMap[day].push(r.success_rating)})
  const dayStats=DAYS.map(d=>({day:d,avg:dayMap[d]?+mean(dayMap[d]).toFixed(2):0,count:dayMap[d]?.length||0}))
  const typeMap:Record<string,number[]>={};rated.forEach(r=>{const t=r.intent_type||"Other";if(!typeMap[t])typeMap[t]=[];typeMap[t].push(r.success_rating)})
  const typeStats=Object.entries(typeMap).map(([type,scores])=>({type,avg:+mean(scores).toFixed(2),count:scores.length})).sort((a,b)=>b.avg-a.avg)
  const allIngs=[...new Set(rated.flatMap(r=>(r.ingredients||[]).map((i:string)=>i.toLowerCase().trim())).filter(Boolean))]
  const ingLifts=allIngs.map(ing=>ingLift(rituals,ing)).filter(Boolean).sort((a:any,b:any)=>(b.lift??b.avgWith)-(a.lift??a.avgWith)).slice(0,10) as any[]
  const withM=rituals.filter(r=>r.manifestation_date&&r.date)
  const mTimes=withM.map(r=>({...r,daysToManifest:Math.round((new Date(r.manifestation_date!).getTime()-new Date(r.date).getTime())/86400000)})).filter(r=>r.daysToManifest>=0)
  const avgM=mTimes.length?+mean(mTimes.map(r=>r.daysToManifest)).toFixed(1):null
  const mByPhase:Record<string,number[]>={};mTimes.forEach(r=>{if(!mByPhase[r.moon_phase])mByPhase[r.moon_phase]=[];mByPhase[r.moon_phase].push(r.daysToManifest)})
  const mPhaseStats=Object.entries(mByPhase).map(([phase,days])=>({phase,avgDays:+mean(days).toFixed(1),count:days.length})).sort((a,b)=>a.avgDays-b.avgDays)
  const overallAvg=+mean(rated.map(r=>r.success_rating)).toFixed(2)
  const manifestedCount=rituals.filter(r=>r.outcome_flag==="manifested"||r.manifestation_date).length
  let predictiveWindow=null
  if(total>=MIN_PRED&&moonStats.length){const bp=moonStats[0],bd=[...dayStats].sort((a,b)=>b.avg-a.avg)[0],bi=ingLifts[0];predictiveWindow={bestPhase:bp.phase,daysAway:daysToNextPhase(bp.phase),bestDay:bd.day,bestIngredient:bi?.ingredient||null}}
  const parts:string[]=[]
  if(total>=5){if(moonStats[0])parts.push(`${moonStats[0].phase} produces your highest results (avg ${moonStats[0].avg}/5)`);if(ingLifts[0]?.lift&&ingLifts[0].lift>0)parts.push(`${ingLifts[0].ingredient} lifts success by +${ingLifts[0].lift} vs workings without it`);if(avgM!==null)parts.push(`workings manifest in ${avgM} days on average`)}
  return {moonStats,dayStats,typeStats,ingLifts,mTimes,avgManifestDays:avgM,mPhaseStats,overallAvg,total,confidence,predictiveWindow,manifestedCount,insight:parts.length?parts.join(". ")+".":null}
}
function buildTarotAnalytics(logs:TarotLog[]){
  if(!logs.length)return null
  const m:Record<string,number>={};logs.forEach(l=>(l.cards||[]).forEach(c=>{m[c]=(m[c]||0)+1}))
  const topCards=Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([card,count])=>({card,count}))
  const rev=logs.reduce((a,l)=>(l.cards||[]).filter((c:string)=>c.includes("(R)")).length+a,0)
  const tot=logs.reduce((a,l)=>(l.cards||[]).length+a,0)
  return {topCards,reversed:rev,total:tot,count:logs.length,reversedPct:tot?Math.round((rev/tot)*100):0}
}

/* ── CSS injection ─────────────────────────── */
const injectCSS=()=>{
  if(typeof document==="undefined"||document.getElementById("gi3-css"))return
  const s=document.createElement("style");s.id="gi3-css"
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#09080f;--surface:#0f0d18;--card:#130f1e;--border:#1c1830;--glow:#2a2445;--gold:#c8a84a;--gd:#c8a84a14;--gs:#c8a84a40;--text:#e2ddf2;--dim:#8a85a8;--muted:#3e3960;--pro:#7c6af7;--pd:#7c6af710;--ps:#7c6af740;--red:#e05070;--green:#4ade80;--amber:#f0b429}
    body{background:var(--bg);color:var(--text);font-family:'Crimson Pro',Georgia,serif;overflow-x:hidden}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
    .inp{background:var(--card);border:1px solid var(--border);color:var(--text);font-family:'Crimson Pro',serif;font-size:14px;border-radius:8px;padding:9px 12px;outline:none;width:100%;transition:border-color .2s,box-shadow .2s}
    .inp:focus{border-color:var(--gs);box-shadow:0 0 10px var(--gd)}
    .inp::placeholder{color:var(--muted);font-style:italic}
    textarea.inp{resize:vertical;min-height:80px;line-height:1.8}
    select.inp option{background:var(--card)}
    .btn{cursor:pointer;border:none;border-radius:7px;font-family:'Cinzel',serif;font-size:10px;font-weight:600;padding:7px 14px;transition:all .2s;letter-spacing:1px;text-transform:uppercase}
    .bg{background:linear-gradient(135deg,#c8a84a,#b08030);color:#09080f}
    .bg:hover{background:linear-gradient(135deg,#ddb84a,#c8a84a);box-shadow:0 0 16px var(--gs);transform:translateY(-1px)}
    .bgh{background:transparent;color:var(--dim);border:1px solid var(--border)}
    .bgh:hover{border-color:var(--gs);color:var(--gold);background:var(--gd)}
    .bp{background:var(--pro);color:#fff}
    .bp:hover{background:#9585ff;box-shadow:0 0 16px var(--ps)}
    .bsm{padding:5px 10px;font-size:9px}
    .fade{animation:fadeUp .35s ease both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    .card{background:var(--card);border:1px solid var(--border);border-radius:12px}
    .ch{transition:border-color .2s,box-shadow .2s}
    .ch:hover{border-color:var(--gs)!important;box-shadow:0 4px 20px var(--gd)}
    .pro-tag{display:inline-flex;align-items:center;gap:3px;background:var(--pd);color:var(--pro);font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 7px;border-radius:20px;text-transform:uppercase;font-family:'Cinzel',serif;border:1px solid var(--ps)}
    .bar-track{background:var(--border);border-radius:3px;height:5px;overflow:hidden}
    .bar-fill{height:100%;border-radius:3px;transition:width .7s ease}
    .tag{display:inline-flex;align-items:center;background:var(--gd);color:var(--gold);font-size:11px;padding:2px 9px;border-radius:20px;font-family:'Cinzel',serif;letter-spacing:.4px;border:1px solid var(--gd)}
    .sec{font-family:'Cinzel',serif;font-size:9px;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
    .shimmer{background:linear-gradient(90deg,var(--card) 25%,var(--border) 50%,var(--card) 75%);background-size:200% 100%;animation:shimmer 1.6s infinite}
    @keyframes shimmer{to{background-position:-200% 0}}
    .grain{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.022;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
  `
  document.head.appendChild(s)
}

/* ── Atoms ─────────────────────────────────── */
function Stars({value,onChange,size=18}:{value:number;onChange?:(n:number)=>void;size?:number}){
  const [hover,setHover]=useState(0)
  return <div style={{display:"flex",gap:2}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:size,color:n<=(hover||value)?"var(--gold)":"var(--border)",cursor:onChange?"pointer":"default",transition:"color .1s"}} onClick={()=>onChange?.(n)} onMouseEnter={()=>onChange&&setHover(n)} onMouseLeave={()=>setHover(0)}>★</span>)}</div>
}
function ConfPill({level}:{level:string}){
  const labels:Record<string,string>={none:"no data",weak:"weak signal",building:"building",approaching:"almost there",strong:"strong"}
  const cls:Record<string,string>={none:"#524d6e",weak:"#f0b429",building:"#7c6af7",approaching:"#f0b429",strong:"#4ade80"}
  return <span style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:.8,padding:"2px 8px",borderRadius:20,textTransform:"uppercase",background:`${cls[level]||"#524d6e"}18`,color:cls[level]||"#524d6e",border:`1px solid ${cls[level]||"#524d6e"}30`}}>{labels[level]||level}</span>
}
function PBar({current,total,color="var(--gold)"}:{current:number;total:number;color?:string}){
  return <div><div className="bar-track"><div className="bar-fill" style={{width:`${Math.min((current/total)*100,100)}%`,background:color}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:10,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace"}}><span>{current} logged</span><span>{total} for {current<total?"unlock":"✓"}</span></div></div>
}

/* ── TABS ───────────────────────────────────── */
const OUTCOME_FLAGS=[{value:"manifested",label:"Manifested",color:"var(--green)"},{value:"partial",label:"Partial",color:"var(--amber)"},{value:"none",label:"No Effect",color:"var(--muted)"},{value:"ongoing",label:"Ongoing",color:"var(--pro)"}]
const INTENT_TYPES=["Protection","Abundance","Love","Healing","Banishing","Wisdom","Divination","Binding","Uncrossing","Other"]
const MOON_PHASES=["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"]
const SYMBOLS=["⊕","◈","⋆","⍟","⎔","◉","✦","⊗","⟁","△","▽","◇","☽","☿","⚶","⚸","ψ","Ω"]

function Dashboard({rituals,tarotLogs,isPro,onUpgrade}:{rituals:Ritual[];tarotLogs:TarotLog[];isPro:boolean;onUpgrade:()=>void}){
  const moon=getMoonPhase(),pH=getPlanetaryHour(),a=buildAnalytics(rituals),tA=buildTarotAnalytics(tarotLogs)
  if(!isPro)return(
    <div className="fade">
      <div className="card" style={{padding:"14px 18px",marginBottom:16,display:"flex",gap:16,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:24}}>{moon.symbol}</span><div><div style={{fontFamily:"'Cinzel',serif",fontSize:12,color:"var(--gold)"}}>{moon.name}</div><div style={{fontSize:11,color:"var(--muted)",fontStyle:"italic"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div></div></div>
        <div style={{display:"flex",gap:12}}><div style={{textAlign:"center"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>Planetary Hour</div><div style={{color:PLANET_COLORS[pH.planet],fontFamily:"'Cinzel',serif",fontSize:12,marginTop:2}}>{pH.planet}</div></div><div style={{textAlign:"center"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>Rituals</div><div style={{color:"var(--gold)",fontFamily:"'Cinzel Decorative',serif",fontSize:18,marginTop:2}}>{rituals.length}</div></div></div>
      </div>
      <div style={{position:"relative"}}>
        <div style={{filter:"blur(7px)",pointerEvents:"none",opacity:.4}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>{["Moon Phase","Ingredient Lift","Manifestation","Predictive Window"].map(l=><div key={l} className="card" style={{padding:"16px 18px"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:8}}>{l}</div><div style={{height:20,width:"80%"}} className="shimmer"/><div style={{height:6,width:"100%",marginTop:8}} className="shimmer"/></div>)}</div>
          <div style={{height:80,borderRadius:12}} className="shimmer"/>
        </div>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse 80% 80% at 50% 50%,var(--bg)e0,var(--bg)70)"}}>
          <div style={{textAlign:"center",maxWidth:360}}>
            <div style={{fontSize:32,marginBottom:10}}>✦</div>
            <div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,color:"var(--pro)",marginBottom:10}}>Practice Intelligence</div>
            {a.insight&&<div style={{marginBottom:14,padding:"10px 14px",background:"var(--gd)",border:"1px solid var(--gs)",borderRadius:10,fontSize:12,color:"var(--gold)",fontStyle:"italic"}}>"{a.insight}"</div>}
            <p style={{color:"var(--dim)",fontSize:13,fontStyle:"italic",lineHeight:1.8,marginBottom:18}}>{rituals.length>=5?`${a.total} rated rituals ready for analysis — unlock to see your patterns.`:"Log rituals with ratings to build your pattern dataset."}</p>
            <button className="btn bp" style={{fontSize:11,padding:"10px 24px"}} onClick={onUpgrade}>Unlock Intelligence — $7/mo</button>
          </div>
        </div>
      </div>
    </div>
  )
  return(
    <div className="fade">
      <div className="card" style={{padding:"14px 18px",marginBottom:16,display:"flex",gap:16,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
        <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:24}}>{moon.symbol}</span><div><div style={{fontFamily:"'Cinzel',serif",fontSize:12,color:"var(--gold)"}}>{moon.name}</div><div style={{fontSize:11,color:"var(--muted)",fontStyle:"italic"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div></div></div>
          <div style={{width:1,height:28,background:"var(--border)"}}/>
          <div><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:3}}>Planetary Hour</div><div style={{color:PLANET_COLORS[pH.planet],fontFamily:"'Cinzel',serif",fontSize:13}}>{pH.planet} · Hour {pH.hour}</div></div>
          <div style={{width:1,height:28,background:"var(--border)"}}/>
          <div><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:3}}>Day Ruler</div><div style={{color:PLANET_COLORS[getPlanetDay()],fontFamily:"'Cinzel',serif",fontSize:13}}>{getPlanetDay()}</div></div>
        </div>
        <div style={{display:"flex",gap:12}}>{[["Rituals",rituals.length,"var(--gold)"],["Manifested",a.manifestedCount,"var(--green)"],["Avg",`${a.overallAvg}/5`,"var(--pro)"]].map(([l,v,c])=><div key={l as string} style={{textAlign:"center"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase"}}>{l}</div><div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,color:c as string,marginTop:2}}>{v}</div></div>)}</div>
      </div>
      {a.insight&&<div style={{background:"var(--gd)",border:"1px solid var(--gs)",borderRadius:12,padding:"14px 18px",marginBottom:14}}><div className="sec" style={{marginBottom:6}}>✦ Pattern Insight</div><p style={{fontSize:15,color:"var(--text)",fontStyle:"italic",lineHeight:1.8}}>{a.insight}</p></div>}
      {a.predictiveWindow&&<div style={{background:"var(--pd)",border:"1px solid var(--ps)",borderRadius:12,padding:"14px 18px",marginBottom:14}}><div className="sec" style={{color:"var(--pro)",marginBottom:8}}>✦ Your Optimal Ritual Window</div><div style={{display:"flex",gap:16,flexWrap:"wrap"}}><div><div className="sec" style={{marginBottom:3}}>Best Phase</div><div style={{color:"var(--pro)",fontFamily:"'Cinzel',serif",fontSize:13}}>{a.predictiveWindow.bestPhase}</div><div style={{fontSize:11,color:"var(--muted)",marginTop:1}}>in ~{a.predictiveWindow.daysAway} days</div></div><div><div className="sec" style={{marginBottom:3}}>Best Day</div><div style={{color:"var(--pro)",fontFamily:"'Cinzel',serif",fontSize:13}}>{a.predictiveWindow.bestDay}</div></div>{a.predictiveWindow.bestIngredient&&<div><div className="sec" style={{marginBottom:3}}>Priority Ingredient</div><div style={{color:"var(--pro)",fontFamily:"'Cinzel',serif",fontSize:13,textTransform:"capitalize"}}>{a.predictiveWindow.bestIngredient}</div></div>}</div></div>}
      <div className="card" style={{padding:"14px 18px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div className="sec" style={{marginBottom:0}}>Dataset Confidence</div><ConfPill level={a.confidence}/></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>{[["Phase Correlations",MIN_CORR],["Ingredient Lift",MIN_ING],["Predictive Windows",MIN_PRED]].map(([label,req])=><div key={label as string}><div className="sec" style={{marginBottom:6}}>{label}</div><PBar current={a.total} total={req as number} color={a.total>=(req as number)?"var(--green)":"var(--gold)"}/></div>)}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Moon Phase Effectiveness</div>{a.moonStats.length?a.moonStats.slice(0,6).map(({phase,avg,count})=><div key={phase} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,color:"var(--dim)"}}>{phase}</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:avg>=4?"var(--green)":avg>=3?"var(--gold)":"var(--dim)"}}>{avg} <span style={{color:"var(--muted)"}}>({count})</span></span></div><div className="bar-track"><div className="bar-fill" style={{width:`${(avg/5)*100}%`,background:avg>=4?"var(--green)":avg>=3?"var(--gold)":"var(--dim)"}}/></div></div>):<div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>Log rated rituals to unlock.</div>}</div>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Ingredient Lift vs Baseline {a.total<MIN_ING&&<ConfPill level="building"/>}</div>{a.total<MIN_ING?<div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>Unlocks after {MIN_ING} rated rituals ({a.total} now).</div>:a.ingLifts.length?a.ingLifts.map((x:any)=><div key={x.ingredient} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}><span style={{fontSize:12,color:"var(--dim)",textTransform:"capitalize"}}>{x.ingredient}</span><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"var(--muted)"}}>w:{x.avgWith} w/o:{x.avgWithout??'—'}</span>{x.lift!==null&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:x.lift>0?"var(--green)":"var(--red)"}}>{x.lift>0?"+":""}{x.lift}</span>}</div></div><div className="bar-track"><div className="bar-fill" style={{width:`${(x.avgWith/5)*100}%`,background:x.lift&&x.lift>0?"var(--green)":x.lift&&x.lift<0?"var(--red)":"var(--pro)"}}/></div></div>):<div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>Reuse ingredients across rituals to generate lift data.</div>}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Day of Week</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{a.dayStats.map(({day,avg,count})=><div key={day} style={{flex:"1 0 36px",textAlign:"center",padding:"9px 4px",borderRadius:8,background:avg>=4?"#4ade8014":avg>=3?"var(--gd)":"var(--border)",border:`1px solid ${avg>=4?"#4ade8030":avg>=3?"var(--gs)":"transparent"}`}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)"}}>{day}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:avg>=4?"var(--green)":avg>=3?"var(--gold)":"var(--muted)",marginTop:3}}>{avg||"—"}</div><div style={{fontSize:9,color:"var(--muted)",marginTop:1}}>{count}r</div></div>)}</div></div>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Intent Breakdown</div>{a.typeStats.map(({type,avg,count})=><div key={type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid var(--border)"}}><span style={{fontSize:13,color:"var(--dim)"}}>{type}</span><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{color:"var(--muted)",fontSize:11}}>{count}×</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:avg>=4?"var(--green)":avg>=3?"var(--gold)":"var(--dim)"}}>{avg}/5</span></div></div>)}</div>
      </div>
      {a.mTimes.length>0&&<div className="card" style={{padding:"16px 18px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div className="sec" style={{marginBottom:0}}>Manifestation Timeline</div>{a.avgManifestDays!==null&&<div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"var(--gold)"}}>{a.avgManifestDays} avg days</div>}</div>{a.mPhaseStats.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{a.mPhaseStats.map(({phase,avgDays,count})=><div key={phase} style={{background:"var(--gd)",border:"1px solid var(--gs)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--gold)",marginBottom:3}}>{phase}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:"var(--green)"}}>{avgDays}d</div><div style={{fontSize:10,color:"var(--muted)"}}>{count} rituals</div></div>)}</div>}<div style={{display:"flex",gap:4}}>{a.mTimes.slice(0,12).map((r:any)=><div key={r.id} title={`${r.title}: ${r.daysToManifest}d`} style={{flex:"1 0 28px",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{width:"100%",maxWidth:34,height:Math.min(r.daysToManifest*3+8,60),background:`${PLANET_COLORS[r.planet_day]||"var(--gold)"}44`,border:`1px solid ${PLANET_COLORS[r.planet_day]||"var(--gold)"}66`,borderRadius:4}}/><div style={{fontSize:9,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace"}}>{r.daysToManifest}d</div></div>)}</div></div>}
      {tA&&tA.topCards.length>0&&<div className="card" style={{padding:"16px 18px"}}><div className="sec">Tarot Patterns · {tA.count} readings · {tA.reversedPct}% reversed</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{tA.topCards.map(({card,count})=><div key={card} style={{background:"var(--gd)",border:"1px solid var(--gs)",borderRadius:8,padding:"8px 12px"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"var(--gold)"}}>{card}</div><div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{count}× drawn</div></div>)}</div></div>}
    </div>
  )
}

function RitualTab({rituals,addRitual,deleteRitual}:{rituals:Ritual[];addRitual:(r:any)=>Promise<any>;deleteRitual:(id:string)=>Promise<any>}){
  const moon=getMoonPhase()
  const blank={title:"",intent_type:"Protection",date:todayStr(),moon_phase:moon.name,planet_day:getPlanetDay(),ingredients:[],tools:[],duration:30,success_rating:0,outcome_flag:"ongoing",manifestation_date:"",outcome:"",energy_conditions:"",version:1,parent_id:null}
  const [active,setActive]=useState<string|null>(rituals[0]?.id||null)
  const [composing,setComposing]=useState(false)
  const [draft,setDraft]=useState<any>(blank)
  const [iI,setII]=useState("") ;const [tI,setTI]=useState("")
  const [saving,setSaving]=useState(false)
  const cur=rituals.find(r=>r.id===active)
  const addIng=()=>{if(iI.trim()){setDraft((d:any)=>({...d,ingredients:[...d.ingredients,iI.trim()]}));setII("")}}
  const addTool=()=>{if(tI.trim()){setDraft((d:any)=>({...d,tools:[...d.tools,tI.trim()]}));setTI("")}}
  const save=async()=>{if(!draft.title.trim())return;setSaving(true);const{data}=await addRitual({...draft,manifestation_date:draft.manifestation_date||null});if(data)setActive(data.id);setComposing(false);setDraft(blank);setII("");setTI("");setSaving(false)}
  const iterate=(r:Ritual)=>{setDraft({...r,id:undefined,version:r.version+1,parent_id:r.id,success_rating:0,outcome_flag:"ongoing",manifestation_date:"",outcome:"",date:todayStr(),moon_phase:moon.name,planet_day:getPlanetDay()});setComposing(true)}
  return(
    <div className="fade" style={{display:"grid",gridTemplateColumns:"220px 1fr",gap:14,minHeight:480}}>
      <div>
        <button className="btn bg" style={{width:"100%",marginBottom:10}} onClick={()=>{setDraft(blank);setComposing(true)}}>+ New Ritual</button>
        {rituals.map(r=><div key={r.id} className="ch" onClick={()=>{setActive(r.id);setComposing(false)}} style={{padding:"9px 11px",borderRadius:8,cursor:"pointer",marginBottom:4,background:active===r.id&&!composing?"var(--gd)":"transparent",border:`1px solid ${active===r.id&&!composing?"var(--gs)":"transparent"}`,transition:"all .15s"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--gold)"}}>{r.intent_type}</span>{r.version>1&&<span style={{fontFamily:"'Cinzel',serif",fontSize:8,color:"var(--pro)",background:"var(--pd)",padding:"1px 5px",borderRadius:8}}>v{r.version}</span>}</div>
          <div style={{fontSize:12,fontWeight:600,color:"var(--text)",lineHeight:1.3,marginBottom:2}}>{r.title}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:10,color:"var(--muted)",fontStyle:"italic"}}>{r.date}</span>{r.success_rating>0&&<Stars value={r.success_rating} size={11}/>}</div>
          {r.outcome_flag&&r.outcome_flag!=="ongoing"&&<div style={{fontSize:9,color:OUTCOME_FLAGS.find(f=>f.value===r.outcome_flag)?.color||"var(--muted)",fontFamily:"'Cinzel',serif",letterSpacing:.5,marginTop:3}}>{r.outcome_flag}</div>}
        </div>)}
      </div>
      {composing?(
        <div className="fade" style={{display:"flex",flexDirection:"column",gap:9}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}><input className="inp" placeholder="Ritual title..." value={draft.title} onChange={(e:any)=>setDraft((d:any)=>({...d,title:e.target.value}))} style={{flex:1}}/>{draft.version>1&&<span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--pro)",background:"var(--pd)",padding:"4px 10px",borderRadius:7,border:"1px solid var(--ps)",whiteSpace:"nowrap"}}>v{draft.version}</span>}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <select className="inp" value={draft.intent_type} onChange={(e:any)=>setDraft((d:any)=>({...d,intent_type:e.target.value}))}>{INTENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            <input className="inp" type="date" value={draft.date} onChange={(e:any)=>setDraft((d:any)=>({...d,date:e.target.value}))}/>
            <select className="inp" value={draft.moon_phase} onChange={(e:any)=>setDraft((d:any)=>({...d,moon_phase:e.target.value}))}>{MOON_PHASES.map(p=><option key={p}>{p}</option>)}</select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div><div className="sec">Ingredients</div><div style={{display:"flex",gap:5,marginBottom:6}}><input className="inp" placeholder="Add..." value={iI} onChange={(e:any)=>setII(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&addIng()} style={{fontSize:13}}/><button className="btn bgh bsm" onClick={addIng}>+</button></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{draft.ingredients.map((i:string)=><span key={i} className="tag" style={{cursor:"pointer",fontSize:10}} onClick={()=>setDraft((d:any)=>({...d,ingredients:d.ingredients.filter((x:string)=>x!==i)}))}>{i} ×</span>)}</div></div>
            <div><div className="sec">Tools</div><div style={{display:"flex",gap:5,marginBottom:6}}><input className="inp" placeholder="Add..." value={tI} onChange={(e:any)=>setTI(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&addTool()} style={{fontSize:13}}/><button className="btn bgh bsm" onClick={addTool}>+</button></div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{draft.tools.map((t:string)=><span key={t} className="tag" style={{cursor:"pointer",background:"var(--pd)",color:"var(--pro)",fontSize:10}} onClick={()=>setDraft((d:any)=>({...d,tools:d.tools.filter((x:string)=>x!==t)}))}>{t} ×</span>)}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 80px",gap:8}}><input className="inp" placeholder="Energy conditions..." value={draft.energy_conditions} onChange={(e:any)=>setDraft((d:any)=>({...d,energy_conditions:e.target.value}))}/><input className="inp" type="number" min="5" max="360" value={draft.duration} onChange={(e:any)=>setDraft((d:any)=>({...d,duration:+e.target.value}))}/></div>
          <textarea className="inp" placeholder="Outcome and observations..." value={draft.outcome} onChange={(e:any)=>setDraft((d:any)=>({...d,outcome:e.target.value}))} style={{minHeight:80}}/>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:12,alignItems:"center"}}>
            <div><div className="sec">Success Rating</div><Stars value={draft.success_rating} onChange={(v:number)=>setDraft((d:any)=>({...d,success_rating:v}))} size={22}/></div>
            <div><div className="sec">Outcome</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{OUTCOME_FLAGS.map(f=><button key={f.value} className="btn" onClick={()=>setDraft((d:any)=>({...d,outcome_flag:f.value}))} style={{fontSize:9,padding:"4px 10px",background:draft.outcome_flag===f.value?`${f.color}22`:"transparent",color:draft.outcome_flag===f.value?f.color:"var(--muted)",border:`1px solid ${draft.outcome_flag===f.value?f.color+"55":"var(--border)"}`}}>{f.label}</button>)}</div></div>
            <div><div className="sec">Manifestation Date</div><input className="inp" type="date" value={draft.manifestation_date||""} onChange={(e:any)=>setDraft((d:any)=>({...d,manifestation_date:e.target.value}))} style={{fontSize:12}}/></div>
          </div>
          <div style={{display:"flex",gap:8}}><button className="btn bg" onClick={save} disabled={saving}>{saving?"Saving...":"Seal Record ✦"}</button><button className="btn bgh" onClick={()=>setComposing(false)}>Cancel</button></div>
        </div>
      ):cur?(
        <div className="fade card" style={{padding:"22px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-10,right:-10,fontSize:90,opacity:.04,fontFamily:"'Cinzel',serif"}}>☽</div>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:14}}>
            <div><div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--gold)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:3}}>{cur.intent_type}{cur.version>1&&` · v${cur.version}`}</div><h3 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:19,color:"var(--text)",lineHeight:1.2}}>{cur.title}</h3><div style={{fontSize:11,color:"var(--muted)",marginTop:5,fontStyle:"italic"}}>{cur.date} · {cur.moon_phase} · {cur.planet_day} · {cur.duration}min{cur.manifestation_date&&<span style={{color:"var(--green)"}}> · manifested {cur.manifestation_date}</span>}</div></div>
            <div style={{display:"flex",gap:6,alignItems:"flex-start"}}><button className="btn bgh bsm" onClick={()=>iterate(cur)}>↻ Iterate</button><button onClick={()=>deleteRitual(cur.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:18,lineHeight:1}}>×</button></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><Stars value={cur.success_rating} size={20}/>{cur.outcome_flag&&<span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:OUTCOME_FLAGS.find(f=>f.value===cur.outcome_flag)?.color||"var(--muted)",letterSpacing:.8,textTransform:"uppercase"}}>{cur.outcome_flag}</span>}{cur.manifestation_date&&cur.date&&<span style={{fontSize:11,color:"var(--green)",fontStyle:"italic"}}>→ {Math.round((new Date(cur.manifestation_date).getTime()-new Date(cur.date).getTime())/86400000)} days</span>}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{cur.ingredients.map(i=><span key={i} className="tag" style={{fontSize:11}}>{i}</span>)}{cur.tools.map(t=><span key={t} className="tag" style={{background:"var(--pd)",color:"var(--pro)",border:"1px solid var(--pd)",fontSize:11}}>{t}</span>)}</div>
          {cur.energy_conditions&&<div style={{marginBottom:10}}><div className="sec">Energy</div><p style={{fontSize:13,color:"var(--dim)",fontStyle:"italic"}}>{cur.energy_conditions}</p></div>}
          {cur.outcome&&<div><div className="sec">Outcome</div><p style={{fontSize:14,color:"var(--text)",fontStyle:"italic",lineHeight:1.8}}>{cur.outcome}</p></div>}
        </div>
      ):<div style={{display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",fontStyle:"italic"}}>Select or create a ritual record</div>}
    </div>
  )
}

function TarotTab({logs,addTarotLog,updateTarotLog,isPro,callAI}:{logs:TarotLog[];addTarotLog:(l:any)=>Promise<any>;updateTarotLog:(id:string,u:any)=>Promise<any>;isPro:boolean;callAI:(m:any[],s:string)=>Promise<string>}){
  const [form,setForm]=useState({spread:"Three Card",question:"",cards:"",notes:""})
  const [loadingId,setLoadingId]=useState<string|null>(null)
  const save=async()=>{if(!form.cards.trim())return;await addTarotLog({...form,date:todayStr(),moon_phase:getMoonPhase().name,cards:form.cards.split("·").map(c=>c.trim()).filter(Boolean)});setForm({spread:"Three Card",question:"",cards:"",notes:""})}
  const interpret=async(log:TarotLog)=>{
    if(!isPro)return;setLoadingId(log.id)
    const freq:Record<string,number>={};logs.flatMap(l=>l.cards||[]).forEach(c=>{freq[c]=(freq[c]||0)+1})
    const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`${c} (×${n})`).join(", ")||"none"
    const text=await callAI([{role:"user",content:`Spread: ${log.spread}\nQuestion: "${log.question||"General"}"\nCards: ${(log.cards||[]).join(" · ")}\n\nPractitioner's recurring cards: ${top}\n\nGive a reading.`}],"Wise tarot reader. Poetic, practical. Reference recurring cards. Under 160 words.")
    await updateTarotLog(log.id,{ai_reading:text});setLoadingId(null)
  }
  return(
    <div className="fade">
      <div className="card" style={{padding:"18px 20px",marginBottom:16}}>
        <div className="sec">Record Reading</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><select className="inp" value={form.spread} onChange={(e:any)=>setForm(f=>({...f,spread:e.target.value}))}>{["Single Card","Three Card","Past-Present-Future","Celtic Cross","Yes / No","Horseshoe"].map(s=><option key={s}>{s}</option>)}</select><input className="inp" placeholder="Question..." value={form.question} onChange={(e:any)=>setForm(f=>({...f,question:e.target.value}))}/></div>
        <input className="inp" placeholder="Cards drawn, separated by · (e.g. The Moon · Ace of Cups (R))" value={form.cards} onChange={(e:any)=>setForm(f=>({...f,cards:e.target.value}))} style={{marginBottom:8}}/>
        <textarea className="inp" placeholder="Your impressions..." value={form.notes} onChange={(e:any)=>setForm(f=>({...f,notes:e.target.value}))} style={{minHeight:70,marginBottom:10}}/>
        <button className="btn bg" onClick={save}>Record</button>
      </div>
      {logs.map(l=>(
        <div key={l.id} className="card ch" style={{padding:"14px 16px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:8}}>
            <div><span style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--gold)",letterSpacing:.8}}>{l.spread} · {l.date} · {l.moon_phase}</span>{l.question&&<div style={{fontSize:14,color:"var(--text)",fontStyle:"italic",marginTop:2}}>"{l.question}"</div>}</div>
            {isPro?<button className="btn bgh bsm" onClick={()=>interpret(l)} disabled={loadingId===l.id} style={{opacity:loadingId===l.id?.5:1}}>{loadingId===l.id?"Reading...":"✦ Interpret"}</button>:<span className="pro-tag">Pro</span>}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>{(l.cards||[]).map((c,i)=><span key={i} className="tag" style={{fontSize:11}}>{c}</span>)}</div>
          {l.notes&&<p style={{fontSize:12,color:"var(--dim)",fontStyle:"italic",marginBottom:l.ai_reading?8:0}}>{l.notes}</p>}
          {l.ai_reading&&<div style={{background:"var(--gd)",border:"1px solid var(--gs)",borderRadius:8,padding:"10px 14px"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:8,color:"var(--gold)",letterSpacing:1.2,marginBottom:5}}>✦ READING</div><p style={{fontSize:14,color:"var(--text)",fontStyle:"italic",lineHeight:1.8}}>{l.ai_reading}</p></div>}
        </div>
      ))}
    </div>
  )
}

function SigilTab({sigils,addSigil,updateSigil,deleteSigil}:{sigils:Sigil[];addSigil:(s:any)=>Promise<any>;updateSigil:(id:string,u:any)=>Promise<any>;deleteSigil:(id:string)=>Promise<any>}){
  const [composing,setComposing]=useState(false)
  const [form,setForm]=useState({name:"",intent:"",symbol:"✦",color:"#c8a84a",activation_date:todayStr(),status:"active",notes:"",recharge_date:"",manifestation_date:""})
  const save=async()=>{if(!form.name||!form.intent)return;await addSigil({...form,recharge_date:form.recharge_date||null,manifestation_date:form.manifestation_date||null});setForm({name:"",intent:"",symbol:"✦",color:"#c8a84a",activation_date:todayStr(),status:"active",notes:"",recharge_date:"",manifestation_date:""});setComposing(false)}
  const overdue=sigils.filter(s=>s.recharge_date&&s.status!=="archived"&&new Date(s.recharge_date)<new Date())
  const S_STATUS_COLORS:Record<string,string>={active:"var(--green)",dormant:"var(--muted)",manifested:"var(--gold)",archived:"var(--muted)","needs recharge":"var(--red)"}
  return(
    <div className="fade">
      {overdue.length>0&&<div style={{background:"#e0507014",border:"1px solid #e0507040",borderRadius:9,padding:"10px 14px",marginBottom:14,display:"flex",gap:8,alignItems:"center"}}><span style={{color:"var(--red)"}}>⚠</span><span style={{color:"var(--red)",fontSize:12}}>Recharge needed: {overdue.map(s=>s.name).join(", ")}</span></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><span style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>{sigils.filter(s=>s.status==="active").length} active · {sigils.filter(s=>s.status==="manifested").length} manifested</span><button className="btn bg" style={{fontSize:9}} onClick={()=>setComposing(v=>!v)}>+ Seal Sigil</button></div>
      {composing&&<div className="fade card" style={{padding:"18px 20px",marginBottom:14,border:"1px solid var(--gs)"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><input className="inp" placeholder="Name..." value={form.name} onChange={(e:any)=>setForm(f=>({...f,name:e.target.value}))}/><input className="inp" placeholder="Intent..." value={form.intent} onChange={(e:any)=>setForm(f=>({...f,intent:e.target.value}))}/></div>
        <div className="sec">Symbol</div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{SYMBOLS.map(s=><button key={s} onClick={()=>setForm(f=>({...f,symbol:s}))} style={{width:32,height:32,borderRadius:6,background:form.symbol===s?"var(--gd)":"var(--card)",border:`1px solid ${form.symbol===s?"var(--gs)":"var(--border)"}`,cursor:"pointer",fontSize:16,color:form.symbol===s?"var(--gold)":"var(--dim)",display:"flex",alignItems:"center",justifyContent:"center"}}>{s}</button>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",gap:8,alignItems:"center",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:6}}><label style={{fontSize:10,color:"var(--muted)",fontFamily:"'Cinzel',serif",letterSpacing:.8}}>Color</label><input type="color" value={form.color} onChange={(e:any)=>setForm(f=>({...f,color:e.target.value}))} style={{width:34,height:28,border:"1px solid var(--border)",borderRadius:5,background:"transparent",cursor:"pointer",padding:2}}/></div><input className="inp" type="date" value={form.activation_date} onChange={(e:any)=>setForm(f=>({...f,activation_date:e.target.value}))} style={{fontSize:12}} title="Activation"/><input className="inp" type="date" value={form.recharge_date} onChange={(e:any)=>setForm(f=>({...f,recharge_date:e.target.value}))} style={{fontSize:12}} title="Recharge"/><input className="inp" type="date" value={form.manifestation_date} onChange={(e:any)=>setForm(f=>({...f,manifestation_date:e.target.value}))} style={{fontSize:12}} title="Manifestation"/></div>
        <textarea className="inp" placeholder="Activation method, conditions..." value={form.notes} onChange={(e:any)=>setForm(f=>({...f,notes:e.target.value}))} style={{marginBottom:10}}/>
        <div style={{display:"flex",gap:8}}><button className="btn bg" onClick={save}>Seal ✦</button><button className="btn bgh" onClick={()=>setComposing(false)}>Cancel</button></div>
      </div>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
        {sigils.map(s=><div key={s.id} className="card ch" style={{padding:"16px 14px",position:"relative",overflow:"hidden",border:`1px solid ${s.status==="active"?"#4ade8018":s.status==="manifested"?"var(--gs)":"var(--border)"}`}}>
          <div style={{position:"absolute",top:-10,right:-10,fontSize:65,opacity:.06,color:s.color}}>{s.symbol}</div>
          <div style={{width:38,height:38,borderRadius:9,background:`${s.color}18`,border:`1px solid ${s.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:s.color,marginBottom:9}}>{s.symbol}</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:12,fontWeight:600,color:"var(--gold)",marginBottom:2}}>{s.name}</div>
          <div style={{fontSize:11,color:"var(--muted)",fontStyle:"italic",lineHeight:1.5,marginBottom:9}}>{s.intent}</div>
          <select value={s.status} onChange={(e:any)=>updateSigil(s.id,{status:e.target.value})} style={{background:"transparent",border:"none",color:S_STATUS_COLORS[s.status]||"var(--muted)",fontSize:10,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:.5,outline:"none"}}>{Object.keys(S_STATUS_COLORS).map(st=><option key={st} value={st} style={{background:"var(--card)",color:"var(--text)"}}>{st}</option>)}</select>
          {s.recharge_date&&<div style={{fontSize:9,color:"var(--muted)",marginTop:4,fontStyle:"italic"}}>Recharge: {s.recharge_date}</div>}
          {s.manifestation_date&&<div style={{fontSize:9,color:"var(--gold)",marginTop:2}}>✦ {s.manifestation_date}</div>}
        </div>)}
      </div>
    </div>
  )
}

function AITab({rituals,tarotLogs,sigils,isPro,callAI,onUpgrade}:{rituals:Ritual[];tarotLogs:TarotLog[];sigils:Sigil[];isPro:boolean;callAI:(m:any[],s:string)=>Promise<string>;onUpgrade:()=>void}){
  const [messages,setMessages]=useState([{role:"assistant",content:"I have studied your complete practice record. I know your patterns — not from general occult knowledge, but from your own data. Ask me what works for you."}])
  const [input,setInput]=useState("") ;const [loading,setLoading]=useState(false)
  const bottomRef=useRef<HTMLDivElement>(null)
  const moon=getMoonPhase() ;const pH=getPlanetaryHour()
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages,loading])
  const buildCtx=()=>{
    const a=buildAnalytics(rituals),recent=rituals.slice(0,6).map(r=>`${r.title} (${r.intent_type},${r.moon_phase},${r.date},${r.success_rating}★,${r.outcome_flag},ings:${r.ingredients.join(",")}`).join("\n")
    const ingSummary=a.ingLifts.slice(0,5).map((x:any)=>`${x.ingredient}:${x.avgWith}${x.lift!==null?` (lift ${x.lift>0?"+":""}${x.lift})`:""}`) .join(";")
    const tA=buildTarotAnalytics(tarotLogs);const topCards=tA?.topCards.slice(0,3).map(({card,count})=>`${card}(×${count})`).join(",")||"none"
    return `Personal magical practice advisor. Reference actual data, not generic occult knowledge.\n\nPRACTICE DATA:\nRituals:${rituals.length} (${a.total} rated), Avg:${a.overallAvg}/5\nBest phase:${a.moonStats[0]?.phase||"unknown"}(${a.moonStats[0]?.avg||0}/5,${a.moonStats[0]?.count||0}r)\nBest day:${[...a.dayStats].sort((a,b)=>b.avg-a.avg)[0]?.day||"unknown"}\nAvg manifest:${a.avgManifestDays??"no data"} days\nIngredient lift:${ingSummary||"insufficient"}\nTarot recurring:${topCards}\nActive sigils:${sigils.filter(s=>s.status==="active").map(s=>s.name).join(",")||"none"}\nConfidence:${a.confidence}\n\nRECENT:\n${recent||"none"}\n\nNOW:Moon ${moon.name}${moon.symbol}, Planet hour:${pH.planet}\n\nAnswer from data. State confidence level. Under 220 words.`
  }
  const send=async()=>{if(!input.trim()||!isPro||loading)return;const um={role:"user",content:input.trim()};setMessages(m=>[...m,um]);setInput("") ;setLoading(true);try{const text=await callAI([...messages,um].map(m=>({role:m.role,content:m.content})),buildCtx());setMessages(m=>[...m,{role:"assistant",content:text}])}catch{setMessages(m=>[...m,{role:"assistant",content:"Connection interrupted."}])};setLoading(false)}
  if(!isPro)return(<div className="fade" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:380,textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>✦</div><div style={{fontFamily:"'Cinzel Decorative',serif",fontSize:18,color:"var(--pro)",marginBottom:12}}>Practice Counsel</div><p style={{color:"var(--dim)",fontSize:14,fontStyle:"italic",maxWidth:360,lineHeight:1.8,marginBottom:20}}>AI advisor trained on your personal record — not a generic oracle.</p><button className="btn bp" style={{fontSize:11,padding:"10px 24px"}} onClick={onUpgrade}>Unlock Pro ✦</button></div>)
  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:460}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,paddingRight:4,paddingBottom:8}}>
        {messages.map((m,i)=><div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>{m.role==="assistant"&&<div style={{fontFamily:"'Cinzel',serif",fontSize:8,color:"var(--gold)",letterSpacing:1.5,marginBottom:3}}>✦ COUNSEL</div>}<div style={{maxWidth:"82%",padding:"12px 16px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"var(--gd)":"var(--card)",border:`1px solid ${m.role==="user"?"var(--gs)":"var(--border)"}`,fontSize:14,lineHeight:1.85,color:"var(--text)",fontStyle:"italic",whiteSpace:"pre-wrap"}}>{m.content}</div></div>)}
        {loading&&<div style={{display:"flex",flexDirection:"column",alignItems:"flex-start"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:8,color:"var(--gold)",letterSpacing:1.5,marginBottom:3}}>✦ COUNSEL</div><div style={{padding:"12px 16px",borderRadius:"14px 14px 14px 4px",background:"var(--card)",border:"1px solid var(--border)"}}><div style={{display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} className="shimmer" style={{width:6,height:6,borderRadius:"50%",animationDelay:`${i*.2}s`}}/>)}</div></div></div>}
        {messages.length===1&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8,marginTop:6}}>{["What patterns do you see in my most successful rituals?","Plan a ritual based on what has worked for me","Which ingredients show genuine lift in my records?","What does my tarot pattern suggest?"].map(s=><button key={s} onClick={()=>setInput(s)} style={{background:"var(--card)",border:"1px solid var(--border)",borderRadius:8,padding:"9px 12px",cursor:"pointer",color:"var(--dim)",fontSize:12,fontStyle:"italic",textAlign:"left",transition:"all .2s",fontFamily:"'Crimson Pro',serif",lineHeight:1.5}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--gs)";(e.currentTarget as HTMLElement).style.color="var(--gold)"}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--dim)"}}>{s}</button>)}</div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:8,paddingTop:10,borderTop:"1px solid var(--border)"}}><input className="inp" style={{flex:1}} placeholder="Ask from your practice history..." value={input} onChange={(e:any)=>setInput(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&!e.shiftKey&&send()}/><button className="btn bg" onClick={send} disabled={loading||!input.trim()} style={{opacity:loading?.5:1}}>Ask</button></div>
      <div style={{fontSize:10,color:"var(--muted)",textAlign:"center",marginTop:7,fontStyle:"italic"}}>Reading from {rituals.length} rituals · confidence: {buildAnalytics(rituals).confidence} · {moon.name} {moon.symbol}</div>
    </div>
  )
}

function ProModal({onClose,onUpgrade}:{onClose:()=>void;onUpgrade:()=>void}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#00000099",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:"var(--surface)",border:"1.5px solid var(--ps)",borderRadius:18,padding:"32px 28px",maxWidth:400,width:"100%",boxShadow:"0 0 60px var(--pd)"}}>
        <div style={{textAlign:"center",marginBottom:22}}><div style={{fontSize:32,marginBottom:8}}>✦</div><h3 style={{fontFamily:"'Cinzel Decorative',serif",fontSize:20,color:"var(--pro)",marginBottom:8}}>Practice Intelligence</h3><p style={{color:"var(--dim)",fontSize:13,fontStyle:"italic",lineHeight:1.7}}>Your grimoire becomes a pattern-recognition system.</p></div>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"center",gap:3,marginBottom:22}}><span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:38,color:"var(--text)"}}></div>
        {["Moon phase & ingredient correlation analytics (proper lift math)","Manifestation timeline — how fast your workings deliver","Predictive optimal windows from your personal history","AI counsel that reads your record, not a textbook","Tarot pattern analysis"].map(f=><div key={f} style={{display:"flex",gap:8,marginBottom:9,fontSize:13,color:"var(--dim)",alignItems:"flex-start"}}><span style={{color:"var(--gold)",flexShrink:0}}>✦</span>{f}</div>)}
        <div style={{display:"flex",gap:8,marginTop:24}}><button className="btn bgh" style={{flex:1}} onClick={onClose}>Not yet</button><button className="btn bp" style={{flex:2,fontSize:12,padding:"11px"}} onClick={onUpgrade}>Everything is free during early access ✦</button></div>
        <p style={{textAlign:"center",fontSize:10,color:"var(--muted)",marginTop:10,fontStyle:"italic"}}>Cancel any time</p>
      </div>
    </div>
  )
}

/* ── ROOT ───────────────────────────────────── */
export default function GrimoireUI({ user,isPro,rituals,tarotLogs,sigils,addRitual,deleteRitual,addTarotLog,updateTarotLog,addSigil,updateSigil,deleteSigil,callAI,onSignOut }:Props){
  useEffect(()=>{injectCSS()},[])
  const [tab,setTab]=useState("dashboard")
  const [showModal,setShowModal]=useState(false)
  const moon=getMoonPhase() ;const pH=getPlanetaryHour()
  const TABS=[{id:"dashboard",icon:"📊",label:"Intelligence",pro:true},{id:"rituals",icon:"📖",label:"Ritual Log"},{id:"tarot",icon:"🃏",label:"Tarot"},{id:"sigils",icon:"⊕",label:"Sigils"},{id:"ai",icon:"✦",label:"Counsel",pro:true}]
  const onUpgrade=async()=>{setShowModal(false);alert("Payments coming soon! Everything is free during early access.")}
  return(
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <div className="grain"/>
      <div style={{position:"fixed",inset:0,background:"radial-gradient(ellipse 60% 30% at 50% -5%,#c8a84a07,transparent 60%)",pointerEvents:"none",zIndex:0}}/>
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(9,8,15,.94)",borderBottom:"1px solid var(--border)",backdropFilter:"blur(14px)"}}>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 18px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <span style={{fontFamily:"'Cinzel Decorative',serif",fontSize:16,color:"var(--gold)",letterSpacing:.3}}>Grimoire</span>
          <div style={{display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:13}}>{moon.symbol}</span><span style={{fontSize:10,color:"var(--muted)",fontFamily:"'Cinzel',serif",letterSpacing:.5}}>{moon.name}</span><span style={{width:1,height:16,background:"var(--border)",display:"inline-block"}}/><span style={{fontSize:10,color:PLANET_COLORS[pH.planet],fontFamily:"'Cinzel',serif",letterSpacing:.3}}>{pH.planet} hr</span></div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isPro?<button className="btn bp" style={{fontSize:9,padding:"5px 12px"}} onClick={()=>setShowModal(true)}>✦ Intelligence</button>:<span className="pro-tag">Intelligence ✦</span>}
            <button className="btn bgh" style={{fontSize:9,padding:"5px 10px"}} onClick={onSignOut}>Sign out</button>
          </div>
        </div>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 14px",display:"flex",overflowX:"auto"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>{if(t.pro&&!isPro){setShowModal(true);return}setTab(t.id)}} style={{background:"none",border:"none",cursor:"pointer",padding:"9px 14px",fontFamily:"'Cinzel',serif",fontSize:10,letterSpacing:.8,textTransform:"uppercase",color:tab===t.id?"var(--gold)":"var(--muted)",borderBottom:`2px solid ${tab===t.id?"var(--gold)":"transparent"}`,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,transition:"color .2s"}}>{t.icon} {t.label}{t.pro&&!isPro&&<span style={{width:3,height:3,borderRadius:"50%",background:"var(--pro)",display:"inline-block",marginLeft:2}}/>}</button>)}
        </div>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"24px 18px",position:"relative",zIndex:1}}>
        {tab==="dashboard"&&<Dashboard rituals={rituals} tarotLogs={tarotLogs} isPro={isPro} onUpgrade={()=>setShowModal(true)}/>}
        {tab==="rituals"&&<RitualTab rituals={rituals} addRitual={addRitual} deleteRitual={deleteRitual}/>}
        {tab==="tarot"&&<TarotTab logs={tarotLogs} addTarotLog={addTarotLog} updateTarotLog={updateTarotLog} isPro={isPro} callAI={callAI}/>}
        {tab==="sigils"&&<SigilTab sigils={sigils} addSigil={addSigil} updateSigil={updateSigil} deleteSigil={deleteSigil}/>}
        {tab==="ai"&&<AITab rituals={rituals} tarotLogs={tarotLogs} sigils={sigils} isPro={isPro} callAI={callAI} onUpgrade={()=>setShowModal(true)}/>}
      </div>
      {showModal&&<ProModal onClose={()=>setShowModal(false)} onUpgrade={onUpgrade}/>}
    </div>
  )
}
