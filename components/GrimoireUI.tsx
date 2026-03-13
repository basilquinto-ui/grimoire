'use client'

import { useState, useEffect, useRef } from 'react'

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

/* Moon + planet helpers */
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
const PLANET_COLORS:Record<string,string>={Sun:"#b08a30",Moon:"#7a70a0",Mars:"#c04060",Mercury:"#38a060",Jupiter:"#6050d0",Venus:"#c060a0",Saturn:"#706880"}
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

/* Analytics */
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

/* CSS - light ethereal theme */
const injectCSS=()=>{
  if(typeof document==="undefined"||document.getElementById("gi-css"))return
  const s=document.createElement("style");s.id="gi-css"
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Cinzel:wght@400;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#f7f4ff;
      --surface:#faf8ff;
      --card:#ffffff;
      --border:#e0d8f0;
      --border2:#c8b8e8;
      --gold:#8050b0;
      --gd:#8050b010;
      --gs:#8050b030;
      --text:#2a1f4a;
      --dim:#6a5888;
      --muted:#a898c0;
      --pro:#7c6af7;
      --pd:#7c6af710;
      --ps:#7c6af740;
      --red:#c04060;
      --green:#3a8a60;
      --amber:#a07020;
      --shadow:0 2px 16px rgba(120,80,180,0.08);
    }
    body{background:var(--bg);color:var(--text);font-family:'Cormorant Garamond',Georgia,serif;overflow-x:hidden}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:4px}
    label.lbl{display:block;font-family:'Cinzel',serif;font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-bottom:5px}
    .inp{background:#fff;border:1.5px solid var(--border);color:var(--text);font-family:'Cormorant Garamond',serif;font-size:15px;border-radius:9px;padding:10px 13px;outline:none;width:100%;transition:border-color .2s,box-shadow .2s}
    .inp:focus{border-color:var(--border2);box-shadow:0 0 0 3px var(--gd)}
    .inp::placeholder{color:var(--muted);font-style:italic}
    textarea.inp{resize:vertical;min-height:90px;line-height:1.8}
    select.inp option{background:#fff;color:var(--text)}
    .btn{cursor:pointer;border:none;border-radius:8px;font-family:'Cinzel',serif;font-size:10px;font-weight:600;padding:9px 16px;transition:all .2s;letter-spacing:1px;text-transform:uppercase}
    .bg{background:linear-gradient(135deg,#c4a8e8,#9066c0);color:#fff;box-shadow:0 3px 14px rgba(144,102,192,0.25)}
    .bg:hover{opacity:.9;transform:translateY(-1px)}
    .bgh{background:#fff;color:var(--dim);border:1.5px solid var(--border)}
    .bgh:hover{border-color:var(--border2);color:var(--gold)}
    .bp{background:var(--pro);color:#fff;box-shadow:0 3px 14px rgba(124,106,247,0.25)}
    .bp:hover{opacity:.9}
    .bsm{padding:6px 11px;font-size:9px}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .fade{animation:fadeUp .3s ease both}
    @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    .card{background:var(--card);border:1.5px solid var(--border);border-radius:14px;box-shadow:var(--shadow)}
    .ch{transition:border-color .2s,box-shadow .2s}
    .ch:hover{border-color:var(--border2);box-shadow:0 4px 20px rgba(120,80,180,0.1)}
    .tag{display:inline-flex;align-items:center;background:var(--gd);color:var(--gold);font-size:12px;padding:3px 10px;border-radius:20px;font-family:'Cinzel',serif;letter-spacing:.3px;border:1px solid var(--gs)}
    .sec{font-family:'Cinzel',serif;font-size:10px;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase;margin-bottom:8px}
    .bar-track{background:var(--border);border-radius:4px;height:6px;overflow:hidden}
    .bar-fill{height:100%;border-radius:4px;transition:width .7s ease}
    .pro-tag{display:inline-flex;align-items:center;gap:3px;background:var(--pd);color:var(--pro);font-size:9px;font-weight:700;letter-spacing:1px;padding:2px 8px;border-radius:20px;text-transform:uppercase;font-family:'Cinzel',serif;border:1px solid var(--ps)}
    .orb{position:fixed;border-radius:50%;filter:blur(90px);opacity:0.25;pointer-events:none;z-index:0}
  `
  document.head.appendChild(s)
}

/* Atoms */
function Stars({value,onChange,size=18}:{value:number;onChange?:(n:number)=>void;size?:number}){
  const [hover,setHover]=useState(0)
  return <div style={{display:"flex",gap:3}}>{[1,2,3,4,5].map(n=><span key={n} style={{fontSize:size,color:n<=(hover||value)?"var(--gold)":"var(--border)",cursor:onChange?"pointer":"default",transition:"color .1s"}} onClick={()=>onChange?.(n)} onMouseEnter={()=>onChange&&setHover(n)} onMouseLeave={()=>setHover(0)}>★</span>)}</div>
}
function ConfPill({level}:{level:string}){
  const labels:Record<string,string>={none:"no data",weak:"weak signal",building:"building",approaching:"almost there",strong:"strong"}
  const cls:Record<string,string>={none:"#a898c0",weak:"#a07020",building:"#7c6af7",approaching:"#a07020",strong:"#3a8a60"}
  return <span style={{fontFamily:"'Cinzel',serif",fontSize:9,letterSpacing:.8,padding:"2px 9px",borderRadius:20,textTransform:"uppercase",background:`${cls[level]||"#a898c0"}18`,color:cls[level]||"#a898c0",border:`1px solid ${cls[level]||"#a898c0"}40`}}>{labels[level]||level}</span>
}
function PBar({current,total,color="var(--gold)"}:{current:number;total:number;color?:string}){
  return <div><div className="bar-track"><div className="bar-fill" style={{width:`${Math.min((current/total)*100,100)}%`,background:color}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"var(--muted)",fontFamily:"'JetBrains Mono',monospace"}}><span>{current} logged</span><span>need {total}</span></div></div>
}
function Field({label,children}:{label:string;children:React.ReactNode}){
  return <div><label className="lbl">{label}</label>{children}</div>
}

/* Constants */
const OUTCOME_FLAGS=[{value:"manifested",label:"Manifested",color:"var(--green)"},{value:"partial",label:"Partial",color:"var(--amber)"},{value:"none",label:"No Effect",color:"var(--muted)"},{value:"ongoing",label:"Ongoing",color:"var(--pro)"}]
const INTENT_TYPES=["Protection","Abundance","Love","Healing","Banishing","Wisdom","Divination","Binding","Uncrossing","Other"]
const MOON_PHASES=["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"]
const SYMBOLS=["⊕","◈","⋆","⍟","⎔","◉","✦","⊗","⟁","△","▽","◇","☽","☿","⚶","⚸","ψ","Ω"]

/* Dashboard */
function Dashboard({rituals,tarotLogs,isPro,onUpgrade}:{rituals:Ritual[];tarotLogs:TarotLog[];isPro:boolean;onUpgrade:()=>void}){
  const moon=getMoonPhase(),pH=getPlanetaryHour(),a=buildAnalytics(rituals),tA=buildTarotAnalytics(tarotLogs)
  const HeaderBar=()=>(
    <div className="card" style={{padding:"14px 20px",marginBottom:16,display:"flex",gap:16,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:28}}>{moon.symbol}</span>
        <div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:"var(--gold)"}}>{moon.name}</div>
          <div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
        {[["Planetary Hour",pH.planet,PLANET_COLORS[pH.planet]],["Day Ruler",getPlanetDay(),PLANET_COLORS[getPlanetDay()]],["Rituals",rituals.length,"var(--gold)"]].map(([l,v,c])=>(
          <div key={l as string} style={{textAlign:"center"}}>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)",letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{l}</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:15,color:c as string}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  )
  if(!isPro)return(
    <div className="fade">
      <HeaderBar/>
      <div style={{position:"relative"}}>
        <div style={{filter:"blur(6px)",pointerEvents:"none",opacity:.5}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:12}}>
            {["Moon Phase","Ingredient Lift","Manifestation","Predictive Window"].map(l=>(
              <div key={l} className="card" style={{padding:"16px 18px",height:90}}><div className="sec">{l}</div><div style={{height:16,width:"70%",background:"var(--border)",borderRadius:4,marginBottom:8}}/><div style={{height:6,width:"100%",background:"var(--border)",borderRadius:3}}/></div>
            ))}
          </div>
        </div>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse 80% 80% at 50% 50%,rgba(247,244,255,.96),rgba(247,244,255,.7))"}}>
          <div style={{textAlign:"center",maxWidth:360,padding:"0 20px"}}>
            <div style={{fontSize:28,marginBottom:10}}>✦</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:16,color:"var(--pro)",marginBottom:10}}>Practice Intelligence</div>
            {a.insight&&<div style={{marginBottom:14,padding:"10px 14px",background:"var(--gd)",border:"1px solid var(--gs)",borderRadius:10,fontSize:13,color:"var(--gold)",fontStyle:"italic"}}>{a.insight}</div>}
            <p style={{color:"var(--dim)",fontSize:14,fontStyle:"italic",lineHeight:1.8,marginBottom:18}}>{rituals.length>=5?`${a.total} rated rituals ready for analysis. Unlock to see your patterns.`:"Log rituals with ratings to build your dataset."}</p>
            <button className="btn bp" style={{fontSize:11,padding:"10px 24px"}} onClick={onUpgrade}>Unlock Intelligence</button>
          </div>
        </div>
      </div>
    </div>
  )
  return(
    <div className="fade">
      <HeaderBar/>
      {a.insight&&<div style={{background:"var(--gd)",border:"1.5px solid var(--gs)",borderRadius:12,padding:"14px 18px",marginBottom:14}}><div className="sec" style={{marginBottom:6}}>Pattern Insight</div><p style={{fontSize:16,color:"var(--text)",fontStyle:"italic",lineHeight:1.8}}>{a.insight}</p></div>}
      {a.predictiveWindow&&<div style={{background:"var(--pd)",border:"1.5px solid var(--ps)",borderRadius:12,padding:"14px 18px",marginBottom:14}}><div className="sec" style={{color:"var(--pro)",marginBottom:8}}>Your Optimal Ritual Window</div><div style={{display:"flex",gap:20,flexWrap:"wrap"}}><div><div className="sec" style={{marginBottom:3}}>Best Phase</div><div style={{color:"var(--pro)",fontFamily:"'Cinzel',serif",fontSize:14}}>{a.predictiveWindow.bestPhase}</div><div style={{fontSize:12,color:"var(--muted)",marginTop:1}}>in ~{a.predictiveWindow.daysAway} days</div></div><div><div className="sec" style={{marginBottom:3}}>Best Day</div><div style={{color:"var(--pro)",fontFamily:"'Cinzel',serif",fontSize:14}}>{a.predictiveWindow.bestDay}</div></div>{a.predictiveWindow.bestIngredient&&<div><div className="sec" style={{marginBottom:3}}>Top Ingredient</div><div style={{color:"var(--pro)",fontFamily:"'Cinzel',serif",fontSize:14,textTransform:"capitalize"}}>{a.predictiveWindow.bestIngredient}</div></div>}</div></div>}
      <div className="card" style={{padding:"14px 18px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div className="sec" style={{marginBottom:0}}>Dataset Confidence</div><ConfPill level={a.confidence}/></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>{[["Phase Correlations",MIN_CORR],["Ingredient Lift",MIN_ING],["Predictive Windows",MIN_PRED]].map(([label,req])=><div key={label as string}><div className="sec" style={{marginBottom:6}}>{label}</div><PBar current={a.total} total={req as number} color={a.total>=(req as number)?"var(--green)":"var(--gold)"}/></div>)}</div></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Moon Phase Effectiveness</div>{a.moonStats.length?a.moonStats.slice(0,6).map(({phase,avg,count})=><div key={phase} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:"var(--dim)"}}>{phase}</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:avg>=4?"var(--green)":avg>=3?"var(--amber)":"var(--muted)"}}>{avg} ({count})</span></div><div className="bar-track"><div className="bar-fill" style={{width:`${(avg/5)*100}%`,background:avg>=4?"var(--green)":avg>=3?"var(--amber)":"var(--muted)"}}/></div></div>):<div style={{fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>Log rated rituals to unlock.</div>}</div>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Ingredient Lift {a.total<MIN_ING&&<ConfPill level="building"/>}</div>{a.total<MIN_ING?<div style={{fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>Unlocks after {MIN_ING} rated rituals ({a.total} so far).</div>:a.ingLifts.length?a.ingLifts.map((x:any)=><div key={x.ingredient} style={{marginBottom:9}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:13,color:"var(--dim)",textTransform:"capitalize"}}>{x.ingredient}</span><div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:"var(--muted)"}}>w:{x.avgWith} w/o:{x.avgWithout??'n/a'}</span>{x.lift!==null&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:x.lift>0?"var(--green)":"var(--red)"}}>{x.lift>0?"+":""}{x.lift}</span>}</div></div><div className="bar-track"><div className="bar-fill" style={{width:`${(x.avgWith/5)*100}%`,background:x.lift&&x.lift>0?"var(--green)":x.lift&&x.lift<0?"var(--red)":"var(--pro)"}}/></div></div>):<div style={{fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>Reuse ingredients across rituals to generate lift data.</div>}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Day of Week</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{a.dayStats.map(({day,avg,count})=><div key={day} style={{flex:"1 0 36px",textAlign:"center",padding:"9px 4px",borderRadius:8,background:avg>=4?"#3a8a6014":avg>=3?"var(--gd)":"var(--bg)",border:`1.5px solid ${avg>=4?"#3a8a6030":avg>=3?"var(--gs)":"var(--border)"}`}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--muted)"}}>{day}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:avg>=4?"var(--green)":avg>=3?"var(--amber)":"var(--muted)",marginTop:3}}>{avg||"n/a"}</div><div style={{fontSize:9,color:"var(--muted)",marginTop:1}}>{count}r</div></div>)}</div></div>
        <div className="card" style={{padding:"16px 18px"}}><div className="sec">Intent Breakdown</div>{a.typeStats.length?a.typeStats.map(({type,avg,count})=><div key={type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid var(--border)"}}><span style={{fontSize:14,color:"var(--dim)"}}>{type}</span><div style={{display:"flex",gap:10,alignItems:"center"}}><span style={{color:"var(--muted)",fontSize:11}}>{count}x</span><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:avg>=4?"var(--green)":avg>=3?"var(--amber)":"var(--dim)"}}>{avg}/5</span></div></div>):<div style={{fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>No rated rituals yet.</div>}</div>
      </div>
      {a.mTimes.length>0&&<div className="card" style={{padding:"16px 18px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div className="sec" style={{marginBottom:0}}>Manifestation Timeline</div>{a.avgManifestDays!==null&&<div style={{fontFamily:"'Cinzel',serif",fontSize:12,color:"var(--gold)"}}>{a.avgManifestDays} avg days</div>}</div>{a.mPhaseStats.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>{a.mPhaseStats.map(({phase,avgDays,count})=><div key={phase} style={{background:"var(--gd)",border:"1.5px solid var(--gs)",borderRadius:9,padding:"8px 12px",textAlign:"center"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--gold)",marginBottom:3}}>{phase}</div><div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,color:"var(--green)"}}>{avgDays}d</div><div style={{fontSize:10,color:"var(--muted)"}}>{count} rituals</div></div>)}</div>}</div>}
      {tA&&tA.topCards.length>0&&<div className="card" style={{padding:"16px 18px"}}><div className="sec">Tarot Patterns · {tA.count} readings · {tA.reversedPct}% reversed</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{tA.topCards.map(({card,count})=><div key={card} style={{background:"var(--gd)",border:"1.5px solid var(--gs)",borderRadius:8,padding:"8px 12px"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"var(--gold)"}}>{card}</div><div style={{fontSize:10,color:"var(--muted)",marginTop:2}}>{count}x drawn</div></div>)}</div></div>}
    </div>
  )
}

/* Ritual Tab */
function RitualTab({rituals,addRitual,deleteRitual}:{rituals:Ritual[];addRitual:(r:any)=>Promise<any>;deleteRitual:(id:string)=>Promise<any>}){
  const moon=getMoonPhase()
  const blank={title:"",intent_type:"Protection",date:todayStr(),moon_phase:moon.name,planet_day:getPlanetDay(),ingredients:[],tools:[],duration:30,success_rating:0,outcome_flag:"ongoing",manifestation_date:"",outcome:"",energy_conditions:"",version:1,parent_id:null}
  const [active,setActive]=useState<string|null>(rituals[0]?.id||null)
  const [composing,setComposing]=useState(false)
  const [draft,setDraft]=useState<any>(blank)
  const [iI,setII]=useState("");const [tI,setTI]=useState("")
  const [saving,setSaving]=useState(false)
  const cur=rituals.find(r=>r.id===active)
  const addIng=()=>{if(iI.trim()){setDraft((d:any)=>({...d,ingredients:[...d.ingredients,iI.trim()]}));setII("")}}
  const addTool=()=>{if(tI.trim()){setDraft((d:any)=>({...d,tools:[...d.tools,tI.trim()]}));setTI("")}}
  const save=async()=>{if(!draft.title.trim())return;setSaving(true);const{data}=await addRitual({...draft,manifestation_date:draft.manifestation_date||null});if(data)setActive(data.id);setComposing(false);setDraft(blank);setII("");setTI("");setSaving(false)}
  const iterate=(r:Ritual)=>{setDraft({...r,id:undefined,version:r.version+1,parent_id:r.id,success_rating:0,outcome_flag:"ongoing",manifestation_date:"",outcome:"",date:todayStr(),moon_phase:moon.name,planet_day:getPlanetDay()});setComposing(true)}
  return(
    <div className="fade" style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,minHeight:480}}>
      {/* Sidebar list */}
      <div>
        <button className="btn bg" style={{width:"100%",marginBottom:12}} onClick={()=>{setDraft(blank);setComposing(true)}}>+ New Ritual</button>
        {rituals.length===0&&<div style={{fontSize:13,color:"var(--muted)",fontStyle:"italic",textAlign:"center",marginTop:24}}>No rituals yet. Create your first one.</div>}
        {rituals.map(r=>(
          <div key={r.id} className="ch" onClick={()=>{setActive(r.id);setComposing(false)}} style={{padding:"11px 13px",borderRadius:10,cursor:"pointer",marginBottom:6,background:active===r.id&&!composing?"var(--gd)":"transparent",border:`1.5px solid ${active===r.id&&!composing?"var(--gs)":"var(--border)"}`,transition:"all .15s"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--gold)"}}>{r.intent_type}</span>
              {r.version>1&&<span style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--pro)",background:"var(--pd)",padding:"1px 6px",borderRadius:8}}>v{r.version}</span>}
            </div>
            <div style={{fontSize:14,color:"var(--text)",lineHeight:1.3,marginBottom:4}}>{r.title}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,color:"var(--muted)",fontStyle:"italic"}}>{r.date}</span>
              {r.success_rating>0&&<Stars value={r.success_rating} size={12}/>}
            </div>
            {r.outcome_flag&&r.outcome_flag!=="ongoing"&&<div style={{fontSize:10,color:OUTCOME_FLAGS.find(f=>f.value===r.outcome_flag)?.color||"var(--muted)",fontFamily:"'Cinzel',serif",letterSpacing:.4,marginTop:3}}>{r.outcome_flag}</div>}
          </div>
        ))}
      </div>

      {/* Main panel */}
      {composing?(
        <div className="fade card" style={{padding:"24px",display:"flex",flexDirection:"column",gap:16}}>
          {draft.version>1&&<div style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"var(--pro)",background:"var(--pd)",padding:"6px 12px",borderRadius:8,border:"1px solid var(--ps)",display:"inline-block",alignSelf:"flex-start"}}>Iteration v{draft.version}</div>}

          <Field label="Ritual Title">
            <input className="inp" placeholder="Name this working..." value={draft.title} onChange={(e:any)=>setDraft((d:any)=>({...d,title:e.target.value}))} style={{fontSize:17}}/>
          </Field>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Field label="Intent Type">
              <select className="inp" value={draft.intent_type} onChange={(e:any)=>setDraft((d:any)=>({...d,intent_type:e.target.value}))}>{INTENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            </Field>
            <Field label="Date">
              <input className="inp" type="date" value={draft.date} onChange={(e:any)=>setDraft((d:any)=>({...d,date:e.target.value}))}/>
            </Field>
            <Field label="Moon Phase">
              <select className="inp" value={draft.moon_phase} onChange={(e:any)=>setDraft((d:any)=>({...d,moon_phase:e.target.value}))}>{MOON_PHASES.map(p=><option key={p}>{p}</option>)}</select>
            </Field>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Ingredients (press Enter to add)">
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input className="inp" placeholder="e.g. rosemary, black salt..." value={iI} onChange={(e:any)=>setII(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&(e.preventDefault(),addIng())}/>
                <button className="btn bgh bsm" onClick={addIng} type="button">Add</button>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",minHeight:28}}>
                {draft.ingredients.map((i:string)=><span key={i} className="tag" style={{cursor:"pointer",fontSize:11}} onClick={()=>setDraft((d:any)=>({...d,ingredients:d.ingredients.filter((x:string)=>x!==i)}))}>{i} x</span>)}
              </div>
            </Field>
            <Field label="Tools (press Enter to add)">
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input className="inp" placeholder="e.g. candle, athame..." value={tI} onChange={(e:any)=>setTI(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&(e.preventDefault(),addTool())}/>
                <button className="btn bgh bsm" onClick={addTool} type="button">Add</button>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",minHeight:28}}>
                {draft.tools.map((t:string)=><span key={t} className="tag" style={{cursor:"pointer",background:"var(--pd)",color:"var(--pro)",fontSize:11}} onClick={()=>setDraft((d:any)=>({...d,tools:d.tools.filter((x:string)=>x!==t)}))}>{t} x</span>)}
              </div>
            </Field>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 120px",gap:12}}>
            <Field label="Energy Conditions">
              <input className="inp" placeholder="Weather, mood, surroundings..." value={draft.energy_conditions} onChange={(e:any)=>setDraft((d:any)=>({...d,energy_conditions:e.target.value}))}/>
            </Field>
            <Field label="Duration (min)">
              <input className="inp" type="number" min="5" max="360" value={draft.duration} onChange={(e:any)=>setDraft((d:any)=>({...d,duration:+e.target.value}))}/>
            </Field>
          </div>

          <Field label="Outcome and Observations">
            <textarea className="inp" placeholder="What happened, what you noticed..." value={draft.outcome} onChange={(e:any)=>setDraft((d:any)=>({...d,outcome:e.target.value}))}/>
          </Field>

          <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:16,alignItems:"flex-start"}}>
            <Field label="Success Rating">
              <Stars value={draft.success_rating} onChange={(v:number)=>setDraft((d:any)=>({...d,success_rating:v}))} size={24}/>
            </Field>
            <Field label="Outcome Status">
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {OUTCOME_FLAGS.map(f=><button key={f.value} className="btn" onClick={()=>setDraft((d:any)=>({...d,outcome_flag:f.value}))} style={{fontSize:10,padding:"6px 12px",background:draft.outcome_flag===f.value?`${f.color}18`:"transparent",color:draft.outcome_flag===f.value?f.color:"var(--muted)",border:`1.5px solid ${draft.outcome_flag===f.value?f.color+"55":"var(--border)"}`}}>{f.label}</button>)}
              </div>
            </Field>
            <Field label="Manifestation Date">
              <input className="inp" type="date" value={draft.manifestation_date||""} onChange={(e:any)=>setDraft((d:any)=>({...d,manifestation_date:e.target.value}))} style={{fontSize:13}}/>
            </Field>
          </div>

          <div style={{display:"flex",gap:10,paddingTop:4}}>
            <button className="btn bg" onClick={save} disabled={saving}>{saving?"Saving...":"Seal Record"}</button>
            <button className="btn bgh" onClick={()=>setComposing(false)}>Cancel</button>
          </div>
        </div>
      ):cur?(
        <div className="fade card" style={{padding:"26px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-20,right:-20,fontSize:110,opacity:.03,fontFamily:"'Cinzel',serif",color:"var(--gold)"}}>☽</div>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:16}}>
            <div>
              <div style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--gold)",letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>{cur.intent_type}{cur.version>1&&` · v${cur.version}`}</div>
              <h3 style={{fontFamily:"'Cinzel',serif",fontSize:20,color:"var(--text)",lineHeight:1.2,fontWeight:400}}>{cur.title}</h3>
              <div style={{fontSize:12,color:"var(--muted)",marginTop:6,fontStyle:"italic"}}>{cur.date} · {cur.moon_phase} · {cur.planet_day} · {cur.duration}min{cur.manifestation_date&&<span style={{color:"var(--green)"}}> · manifested {cur.manifestation_date}</span>}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
              <button className="btn bgh bsm" onClick={()=>iterate(cur)}>Iterate</button>
              <button onClick={()=>deleteRitual(cur.id)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--muted)",fontSize:20,lineHeight:1,padding:"4px"}}>x</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <Stars value={cur.success_rating} size={20}/>
            {cur.outcome_flag&&<span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:OUTCOME_FLAGS.find(f=>f.value===cur.outcome_flag)?.color||"var(--muted)",letterSpacing:.8,textTransform:"uppercase"}}>{cur.outcome_flag}</span>}
            {cur.manifestation_date&&cur.date&&<span style={{fontSize:12,color:"var(--green)",fontStyle:"italic"}}>{Math.round((new Date(cur.manifestation_date).getTime()-new Date(cur.date).getTime())/86400000)} days to manifest</span>}
          </div>
          {(cur.ingredients.length>0||cur.tools.length>0)&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {cur.ingredients.map(i=><span key={i} className="tag" style={{fontSize:12}}>{i}</span>)}
            {cur.tools.map(t=><span key={t} className="tag" style={{background:"var(--pd)",color:"var(--pro)",border:"1px solid var(--ps)",fontSize:12}}>{t}</span>)}
          </div>}
          {cur.energy_conditions&&<div style={{marginBottom:12}}><div className="sec">Energy</div><p style={{fontSize:14,color:"var(--dim)",fontStyle:"italic"}}>{cur.energy_conditions}</p></div>}
          {cur.outcome&&<div><div className="sec">Outcome</div><p style={{fontSize:15,color:"var(--text)",fontStyle:"italic",lineHeight:1.9}}>{cur.outcome}</p></div>}
        </div>
      ):<div style={{display:"flex",alignItems:"center",justifyContent:"center",color:"var(--muted)",fontStyle:"italic",fontSize:14}}>Select a ritual or create a new one</div>}
    </div>
  )
}

/* Tarot Tab */
function TarotTab({logs,addTarotLog,updateTarotLog,isPro,callAI}:{logs:TarotLog[];addTarotLog:(l:any)=>Promise<any>;updateTarotLog:(id:string,u:any)=>Promise<any>;isPro:boolean;callAI:(m:any[],s:string)=>Promise<string>}){
  const [spread,setSpread]=useState("Three Card")
  const [question,setQuestion]=useState("")
  const [cardInput,setCardInput]=useState("")
  const [cards,setCards]=useState<string[]>([])
  const [notes,setNotes]=useState("")
  const [loadingId,setLoadingId]=useState<string|null>(null)

  const addCard=()=>{const c=cardInput.trim();if(c){setCards(cs=>[...cs,c]);setCardInput("")}}
  const save=async()=>{if(!cards.length)return;await addTarotLog({spread,question,notes,date:todayStr(),moon_phase:getMoonPhase().name,cards});setSpread("Three Card");setQuestion("");setCards([]);setNotes("")}
  const interpret=async(log:TarotLog)=>{
    if(!isPro)return;setLoadingId(log.id)
    const freq:Record<string,number>={};logs.flatMap(l=>l.cards||[]).forEach(c=>{freq[c]=(freq[c]||0)+1})
    const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`${c} (x${n})`).join(", ")||"none"
    const text=await callAI([{role:"user",content:`Spread: ${log.spread}\nQuestion: "${log.question||"General"}"\nCards: ${(log.cards||[]).join(", ")}\n\nPractitioner's recurring cards: ${top}\n\nGive a reading.`}],"Wise tarot reader. Poetic, practical. Reference recurring cards. Under 160 words.")
    await updateTarotLog(log.id,{ai_reading:text});setLoadingId(null)
  }
  return(
    <div className="fade">
      <div className="card" style={{padding:"20px 22px",marginBottom:16}}>
        <div className="sec">Record a Reading</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          <Field label="Spread">
            <select className="inp" value={spread} onChange={(e:any)=>setSpread(e.target.value)}>{["Single Card","Three Card","Past-Present-Future","Celtic Cross","Yes / No","Horseshoe"].map(s=><option key={s}>{s}</option>)}</select>
          </Field>
          <Field label="Question (optional)">
            <input className="inp" placeholder="What were you asking?" value={question} onChange={(e:any)=>setQuestion(e.target.value)}/>
          </Field>
        </div>

        <Field label="Cards Drawn (add one at a time, add R for reversed)">
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <input className="inp" placeholder='e.g. The Moon, Ace of Cups R' value={cardInput} onChange={(e:any)=>setCardInput(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&(e.preventDefault(),addCard())}/>
            <button className="btn bgh bsm" onClick={addCard} type="button">Add</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",minHeight:28,marginBottom:8}}>
            {cards.map((c,i)=><span key={i} className="tag" style={{cursor:"pointer",fontSize:12}} onClick={()=>setCards(cs=>cs.filter((_,j)=>j!==i))}>{c} x</span>)}
            {cards.length===0&&<span style={{fontSize:12,color:"var(--muted)",fontStyle:"italic"}}>No cards added yet</span>}
          </div>
        </Field>

        <Field label="Your Impressions">
          <textarea className="inp" placeholder="What came through for you?" value={notes} onChange={(e:any)=>setNotes(e.target.value)} style={{marginBottom:12}}/>
        </Field>
        <button className="btn bg" onClick={save} disabled={cards.length===0}>Save Reading</button>
      </div>

      {logs.map(l=>(
        <div key={l.id} className="card ch" style={{padding:"16px 18px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
            <div>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:10,color:"var(--gold)",letterSpacing:.8}}>{l.spread} · {l.date} · {l.moon_phase}</span>
              {l.question&&<div style={{fontSize:15,color:"var(--text)",fontStyle:"italic",marginTop:3}}>"{l.question}"</div>}
            </div>
            {isPro?<button className="btn bgh bsm" onClick={()=>interpret(l)} disabled={loadingId===l.id} style={{opacity:loadingId===l.id?.5:1}}>{loadingId===l.id?"Reading...":"Interpret"}</button>:<span className="pro-tag">Pro</span>}
          </div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
            {(l.cards||[]).map((c,i)=><span key={i} className="tag" style={{fontSize:12}}>{c}</span>)}
          </div>
          {l.notes&&<p style={{fontSize:13,color:"var(--dim)",fontStyle:"italic",marginBottom:l.ai_reading?10:0}}>{l.notes}</p>}
          {l.ai_reading&&<div style={{background:"var(--gd)",border:"1.5px solid var(--gs)",borderRadius:9,padding:"12px 16px"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--gold)",letterSpacing:1.2,marginBottom:6}}>Reading</div><p style={{fontSize:14,color:"var(--text)",fontStyle:"italic",lineHeight:1.9}}>{l.ai_reading}</p></div>}
        </div>
      ))}
    </div>
  )
}

/* Sigil Tab */
function SigilTab({sigils,addSigil,updateSigil,deleteSigil}:{sigils:Sigil[];addSigil:(s:any)=>Promise<any>;updateSigil:(id:string,u:any)=>Promise<any>;deleteSigil:(id:string)=>Promise<any>}){
  const [composing,setComposing]=useState(false)
  const [form,setForm]=useState({name:"",intent:"",symbol:"✦",color:"#8050b0",activation_date:todayStr(),status:"active",notes:"",recharge_date:"",manifestation_date:""})
  const save=async()=>{if(!form.name||!form.intent)return;await addSigil({...form,recharge_date:form.recharge_date||null,manifestation_date:form.manifestation_date||null});setForm({name:"",intent:"",symbol:"✦",color:"#8050b0",activation_date:todayStr(),status:"active",notes:"",recharge_date:"",manifestation_date:""});setComposing(false)}
  const overdue=sigils.filter(s=>s.recharge_date&&s.status!=="archived"&&new Date(s.recharge_date)<new Date())
  const S_STATUS_COLORS:Record<string,string>={active:"var(--green)",dormant:"var(--muted)",manifested:"var(--gold)",archived:"var(--muted)","needs recharge":"var(--red)"}
  return(
    <div className="fade">
      {overdue.length>0&&<div style={{background:"#c0406014",border:"1.5px solid #c0406040",borderRadius:10,padding:"11px 16px",marginBottom:14,display:"flex",gap:10,alignItems:"center"}}><span style={{color:"var(--red)"}}>!</span><span style={{color:"var(--red)",fontSize:13}}>Recharge needed: {overdue.map(s=>s.name).join(", ")}</span></div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:13,color:"var(--muted)",fontStyle:"italic"}}>{sigils.filter(s=>s.status==="active").length} active · {sigils.filter(s=>s.status==="manifested").length} manifested</span>
        <button className="btn bg" onClick={()=>setComposing(v=>!v)}>+ Seal Sigil</button>
      </div>
      {composing&&(
        <div className="fade card" style={{padding:"22px 24px",marginBottom:16,border:"1.5px solid var(--gs)"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <Field label="Name"><input className="inp" placeholder="Name this sigil..." value={form.name} onChange={(e:any)=>setForm(f=>({...f,name:e.target.value}))}/></Field>
            <Field label="Intent"><input className="inp" placeholder="What is it working for?" value={form.intent} onChange={(e:any)=>setForm(f=>({...f,intent:e.target.value}))}/></Field>
          </div>
          <Field label="Symbol">
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {SYMBOLS.map(s=><button key={s} onClick={()=>setForm(f=>({...f,symbol:s}))} style={{width:36,height:36,borderRadius:8,background:form.symbol===s?"var(--gd)":"var(--bg)",border:`1.5px solid ${form.symbol===s?"var(--gs)":"var(--border)"}`,cursor:"pointer",fontSize:17,color:form.symbol===s?"var(--gold)":"var(--dim)",display:"flex",alignItems:"center",justifyContent:"center"}}>{s}</button>)}
            </div>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr 1fr",gap:12,alignItems:"flex-end",marginBottom:12}}>
            <Field label="Color">
              <input type="color" value={form.color} onChange={(e:any)=>setForm(f=>({...f,color:e.target.value}))} style={{width:40,height:38,border:"1.5px solid var(--border)",borderRadius:8,background:"transparent",cursor:"pointer",padding:3}}/>
            </Field>
            <Field label="Activation Date"><input className="inp" type="date" value={form.activation_date} onChange={(e:any)=>setForm(f=>({...f,activation_date:e.target.value}))}/></Field>
            <Field label="Recharge Date"><input className="inp" type="date" value={form.recharge_date} onChange={(e:any)=>setForm(f=>({...f,recharge_date:e.target.value}))}/></Field>
            <Field label="Manifestation Date"><input className="inp" type="date" value={form.manifestation_date} onChange={(e:any)=>setForm(f=>({...f,manifestation_date:e.target.value}))}/></Field>
          </div>
          <Field label="Notes">
            <textarea className="inp" placeholder="Activation method, conditions..." value={form.notes} onChange={(e:any)=>setForm(f=>({...f,notes:e.target.value}))} style={{marginBottom:12}}/>
          </Field>
          <div style={{display:"flex",gap:8}}><button className="btn bg" onClick={save}>Seal</button><button className="btn bgh" onClick={()=>setComposing(false)}>Cancel</button></div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:12}}>
        {sigils.map(s=>(
          <div key={s.id} className="card ch" style={{padding:"18px 16px",position:"relative",overflow:"hidden",border:`1.5px solid ${s.status==="active"?"#3a8a6020":s.status==="manifested"?"var(--gs)":"var(--border)"}`}}>
            <div style={{position:"absolute",top:-15,right:-15,fontSize:70,opacity:.05,color:s.color}}>{s.symbol}</div>
            <div style={{width:40,height:40,borderRadius:10,background:`${s.color}18`,border:`1.5px solid ${s.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,color:s.color,marginBottom:10}}>{s.symbol}</div>
            <div style={{fontFamily:"'Cinzel',serif",fontSize:13,color:"var(--text)",marginBottom:3}}>{s.name}</div>
            <div style={{fontSize:12,color:"var(--muted)",fontStyle:"italic",lineHeight:1.6,marginBottom:10}}>{s.intent}</div>
            <select value={s.status} onChange={(e:any)=>updateSigil(s.id,{status:e.target.value})} style={{background:"transparent",border:"none",color:S_STATUS_COLORS[s.status]||"var(--muted)",fontSize:11,fontFamily:"'Cinzel',serif",cursor:"pointer",letterSpacing:.4,outline:"none"}}>{Object.keys(S_STATUS_COLORS).map(st=><option key={st} value={st} style={{background:"#fff",color:"var(--text)"}}>{st}</option>)}</select>
            {s.recharge_date&&<div style={{fontSize:10,color:"var(--muted)",marginTop:5,fontStyle:"italic"}}>Recharge: {s.recharge_date}</div>}
            {s.manifestation_date&&<div style={{fontSize:10,color:"var(--gold)",marginTop:3}}>Manifested: {s.manifestation_date}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* AI Tab */
function AITab({rituals,tarotLogs,sigils,isPro,callAI,onUpgrade}:{rituals:Ritual[];tarotLogs:TarotLog[];sigils:Sigil[];isPro:boolean;callAI:(m:any[],s:string)=>Promise<string>;onUpgrade:()=>void}){
  const [messages,setMessages]=useState([{role:"assistant",content:"I have studied your complete practice record. I know your patterns from your own data. Ask me what works for you."}])
  const [input,setInput]=useState("");const [loading,setLoading]=useState(false)
  const bottomRef=useRef<HTMLDivElement>(null)
  const moon=getMoonPhase();const pH=getPlanetaryHour()
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[messages,loading])
  const buildCtx=()=>{
    const a=buildAnalytics(rituals),recent=rituals.slice(0,6).map(r=>`${r.title} (${r.intent_type},${r.moon_phase},${r.date},${r.success_rating} stars,${r.outcome_flag},ingredients:${r.ingredients.join(",")})`).join("\n")
    const ingSummary=a.ingLifts.slice(0,5).map((x:any)=>`${x.ingredient}:${x.avgWith}${x.lift!==null?` (lift ${x.lift>0?"+":""}${x.lift})`:""}` ).join(";")
    const tA=buildTarotAnalytics(tarotLogs);const topCards=tA?.topCards.slice(0,3).map(({card,count})=>`${card}(x${count})`).join(",")||"none"
    return `Personal magical practice advisor. Reference actual data, not generic occult knowledge.\n\nPRACTICE DATA:\nRituals:${rituals.length} (${a.total} rated), Avg:${a.overallAvg}/5\nBest phase:${a.moonStats[0]?.phase||"unknown"}(${a.moonStats[0]?.avg||0}/5,${a.moonStats[0]?.count||0}r)\nBest day:${[...a.dayStats].sort((a,b)=>b.avg-a.avg)[0]?.day||"unknown"}\nAvg manifest:${a.avgManifestDays??"no data"} days\nIngredient lift:${ingSummary||"insufficient"}\nTarot recurring:${topCards}\nActive sigils:${sigils.filter(s=>s.status==="active").map(s=>s.name).join(",")||"none"}\nConfidence:${a.confidence}\n\nRECENT:\n${recent||"none"}\n\nNOW:Moon ${moon.name}${moon.symbol}, Planet hour:${pH.planet}\n\nAnswer from data. State confidence level. Under 220 words.`
  }
  const send=async()=>{if(!input.trim()||!isPro||loading)return;const um={role:"user",content:input.trim()};setMessages(m=>[...m,um]);setInput("");setLoading(true);try{const text=await callAI([...messages,um].map(m=>({role:m.role,content:m.content})),buildCtx());setMessages(m=>[...m,{role:"assistant",content:text}])}catch{setMessages(m=>[...m,{role:"assistant",content:"Connection interrupted."}])};setLoading(false)}
  if(!isPro)return(<div className="fade" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:380,textAlign:"center"}}><div style={{fontSize:32,marginBottom:12}}>✦</div><div style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"var(--pro)",marginBottom:12}}>Practice Counsel</div><p style={{color:"var(--dim)",fontSize:15,fontStyle:"italic",maxWidth:360,lineHeight:1.8,marginBottom:20}}>AI advisor trained on your personal record, not a generic oracle.</p><button className="btn bp" style={{fontSize:11,padding:"10px 24px"}} onClick={onUpgrade}>Unlock Pro</button></div>)
  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:460}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,paddingRight:4,paddingBottom:8}}>
        {messages.map((m,i)=>(
          <div key={i} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
            {m.role==="assistant"&&<div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--gold)",letterSpacing:1.5,marginBottom:3}}>Counsel</div>}
            <div style={{maxWidth:"82%",padding:"13px 17px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"var(--gd)":"var(--card)",border:`1.5px solid ${m.role==="user"?"var(--gs)":"var(--border)"}`,fontSize:15,lineHeight:1.9,color:"var(--text)",fontStyle:"italic",whiteSpace:"pre-wrap"}}>{m.content}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",flexDirection:"column",alignItems:"flex-start"}}><div style={{fontFamily:"'Cinzel',serif",fontSize:9,color:"var(--gold)",letterSpacing:1.5,marginBottom:3}}>Counsel</div><div style={{padding:"13px 17px",borderRadius:"14px 14px 14px 4px",background:"var(--card)",border:"1.5px solid var(--border)"}}><div style={{display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"var(--border)",animation:"pulse 1.2s ease infinite",animationDelay:`${i*.2}s`}}/>)}</div></div></div>}
        {messages.length===1&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8,marginTop:6}}>
          {["What patterns do you see in my most successful rituals?","Plan a ritual based on what has worked for me","Which ingredients show genuine lift in my records?","What does my tarot pattern suggest?"].map(s=><button key={s} onClick={()=>setInput(s)} style={{background:"var(--card)",border:"1.5px solid var(--border)",borderRadius:10,padding:"11px 14px",cursor:"pointer",color:"var(--dim)",fontSize:13,fontStyle:"italic",textAlign:"left",transition:"all .2s",fontFamily:"'Cormorant Garamond',serif",lineHeight:1.6}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border2)";(e.currentTarget as HTMLElement).style.color="var(--gold)"}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.color="var(--dim)"}}>{s}</button>)}
        </div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{display:"flex",gap:10,paddingTop:12,borderTop:"1.5px solid var(--border)"}}>
        <input className="inp" style={{flex:1}} placeholder="Ask from your practice history..." value={input} onChange={(e:any)=>setInput(e.target.value)} onKeyDown={(e:any)=>e.key==="Enter"&&!e.shiftKey&&send()}/>
        <button className="btn bg" onClick={send} disabled={loading||!input.trim()}>Ask</button>
      </div>
      <div style={{fontSize:11,color:"var(--muted)",textAlign:"center",marginTop:8,fontStyle:"italic"}}>Reading from {rituals.length} rituals · confidence: {buildAnalytics(rituals).confidence} · {moon.name} {moon.symbol}</div>
    </div>
  )
}

/* Pro Modal */
function ProModal({onClose,onUpgrade}:{onClose:()=>void;onUpgrade:()=>void}){
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(42,31,74,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(8px)"}}>
      <div onClick={(e:any)=>e.stopPropagation()} style={{background:"var(--card)",border:"1.5px solid var(--ps)",borderRadius:18,padding:"32px 28px",maxWidth:420,width:"100%",boxShadow:"0 8px 48px rgba(124,106,247,0.15)"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:28,marginBottom:10}}>✦</div>
          <h3 style={{fontFamily:"'Cinzel',serif",fontSize:19,color:"var(--pro)",marginBottom:8,fontWeight:400}}>Practice Intelligence</h3>
          <p style={{color:"var(--dim)",fontSize:14,fontStyle:"italic",lineHeight:1.7}}>Your grimoire becomes a pattern-recognition system.</p>
        </div>
        <div style={{background:"var(--gd)",border:"1.5px solid var(--gs)",borderRadius:10,padding:"12px 16px",marginBottom:20,textAlign:"center"}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:11,color:"var(--gold)",letterSpacing:1}}>Free during early access</span>
        </div>
        {["Moon phase and ingredient correlation analytics","Manifestation timeline showing how fast your workings deliver","Predictive optimal windows from your personal history","AI counsel that reads your record, not a textbook","Tarot pattern analysis"].map(f=><div key={f} style={{display:"flex",gap:10,marginBottom:10,fontSize:14,color:"var(--dim)",alignItems:"flex-start"}}><span style={{color:"var(--gold)",flexShrink:0}}>✦</span>{f}</div>)}
        <div style={{display:"flex",gap:10,marginTop:24}}>
          <button className="btn bgh" style={{flex:1}} onClick={onClose}>Close</button>
          <button className="btn bp" style={{flex:2,fontSize:11,padding:"11px"}} onClick={onUpgrade}>Enter the Grimoire</button>
        </div>
      </div>
    </div>
  )
}

/* Root */
export default function GrimoireUI({user,isPro,rituals,tarotLogs,sigils,addRitual,deleteRitual,addTarotLog,updateTarotLog,addSigil,updateSigil,deleteSigil,callAI,onSignOut}:Props){
  useEffect(()=>{injectCSS()},[])
  const [tab,setTab]=useState("dashboard")
  const [showModal,setShowModal]=useState(false)
  const moon=getMoonPhase();const pH=getPlanetaryHour()
  const TABS=[{id:"dashboard",icon:"📊",label:"Intelligence",pro:true},{id:"rituals",icon:"📖",label:"Rituals"},{id:"tarot",icon:"🃏",label:"Tarot"},{id:"sigils",icon:"⊕",label:"Sigils"},{id:"ai",icon:"✦",label:"Counsel",pro:true}]
  const onUpgrade=async()=>{setShowModal(false);alert("Payments coming soon. Everything is free during early access.")}
  return(
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <div className="orb" style={{width:500,height:500,background:"#d4b8f0",top:"-150px",left:"-150px"}}/>
      <div className="orb" style={{width:350,height:350,background:"#f0d4f8",bottom:"-100px",right:"-80px"}}/>
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(250,248,255,0.92)",borderBottom:"1.5px solid var(--border)",backdropFilter:"blur(16px)"}}>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:54}}>
          <span style={{fontFamily:"'Cinzel',serif",fontSize:17,color:"var(--gold)",letterSpacing:.3}}>Grimoire</span>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:14}}>{moon.symbol}</span>
            <span style={{fontSize:11,color:"var(--muted)",fontFamily:"'Cinzel',serif",letterSpacing:.4}}>{moon.name}</span>
            <span style={{width:1,height:16,background:"var(--border)",display:"inline-block"}}/>
            <span style={{fontSize:11,color:PLANET_COLORS[pH.planet],fontFamily:"'Cinzel',serif"}}>{pH.planet} hr</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {!isPro?<button className="btn bp" style={{fontSize:9,padding:"5px 12px"}} onClick={()=>setShowModal(true)}>Intelligence</button>:<span className="pro-tag">Intelligence</span>}
            <button className="btn bgh" style={{fontSize:9,padding:"5px 10px"}} onClick={onSignOut}>Sign out</button>
          </div>
        </div>
        <div style={{maxWidth:960,margin:"0 auto",padding:"0 16px",display:"flex",overflowX:"auto"}}>
          {TABS.map(t=><button key={t.id} onClick={()=>{if(t.pro&&!isPro){setShowModal(true);return}setTab(t.id)}} style={{background:"none",border:"none",cursor:"pointer",padding:"10px 16px",fontFamily:"'Cinzel',serif",fontSize:11,letterSpacing:.8,textTransform:"uppercase",color:tab===t.id?"var(--gold)":"var(--muted)",borderBottom:`2px solid ${tab===t.id?"var(--gold)":"transparent"}`,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5,transition:"color .2s"}}>{t.icon} {t.label}</button>)}
        </div>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"24px 20px",position:"relative",zIndex:1}}>
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
