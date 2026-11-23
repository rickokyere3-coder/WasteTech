/* WasteTech app: map, pickup assistant, pickup history, collector registration, collector mode and admin.
   Data goes through window.backend.use('db'|'user'), which js/firebase.js provides on top of Firebase. */
(function(){
const $ = s => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const S = 100; /* svg units per km */

/* Schematic positions in km from Central Market (x east, y north). Approximate, not surveyed.
   Sites (site:true): the Disposal Site is at the Baakoniaba Old Cemetery; the Recycling Point is the Nwawasua IRECOP plant, north toward Odumase (distance estimated). */
const PLACES = {
  central:{name:'Central Market',x:0,y:0,lab:'t',al:['central market','market','town','sunyani central','cbd']},
  lorry:{name:'Main Lorry Station',x:0.5,y:-0.3,lab:'r',al:['main lorry station','lorry station','lorry park','main station','station']},
  coronation:{name:'Coronation Park',x:-0.8,y:0.3,lab:'l',al:['coronation park','coronation']},
  hospital:{name:'Regional Hospital',x:-1.3,y:0.9,lab:'l',al:['regional hospital','hospital']},
  penkwase:{name:'Penkwase',x:-1.9,y:-0.4,lab:'b',al:['penkwase']},
  berlin:{name:'Berlin Top',x:-0.5,y:1.4,lab:'r',al:['berlin top','berlin']},
  kotokrom:{name:'Kotokrom',x:-0.9,y:2.7,lab:'r',al:['kotokrom']},
  newdormaa:{name:'New Dormaa',x:1.0,y:0.8,lab:'r',al:['new dormaa','dormaa']},
  baakoniaba:{name:'Baakoniaba',x:1.9,y:1.7,lab:'r',al:['baakoniaba','bakoniaba']},
  airport:{name:'Sunyani Airport',x:2.4,y:2.8,lab:'r',al:['sunyani airport','airport','airstrip']},
  odumase:{name:'Odumase',x:0.6,y:5.4,lab:'r',al:['odumase']},
  ridge:{name:'Ridge',x:0.6,y:-1.2,lab:'r',al:['ridge']},
  estate:{name:'Estate',x:1.5,y:-0.9,lab:'t',al:['estate']},
  stu:{name:'Sunyani Technical University',x:2.7,y:-1.5,lab:'b',al:['sunyani technical university','technical university','stu','poly','polytechnic']},
  nkwabeng:{name:'Nkwabeng',x:-0.4,y:-1.7,lab:'l',al:['nkwabeng']},
  abesim:{name:'Abesim',x:0.9,y:-5.0,lab:'r',al:['abesim']},
  uenr:{name:'UENR',x:-3.0,y:0.9,lab:'b',al:['uenr','university of energy and natural resources','university of energy','energy university']},
  fiapre:{name:'Fiapre',x:-4.1,y:1.6,lab:'b',al:['fiapre']},
  cug:{name:'Catholic University',x:-4.8,y:2.3,lab:'t',al:['catholic university','cug','catholic']},
  atronie:{name:'Atronie',x:-3.6,y:-3.4,lab:'r',al:['atronie']},
  dump:{name:'Disposal Site',loc:'Baakoniaba Old Cemetery',x:2.7,y:1.2,lab:'b',site:true,al:['baakoniaba old cemetery','old cemetery','cemetery','disposal site','dump site','dumpsite','dump','landfill']},
  recycle:{name:'Recycling Point',loc:'Nwawasua IRECOP',x:-1.7,y:4.3,lab:'l',site:true,al:['nwawasua','nwawansua','irecop','recop','recycling point','recycling centre','recycling center','recycle point']}
};
const EDGES = [
  ['central','coronation',1],['coronation','hospital',1],['hospital','uenr',1],['uenr','fiapre',1],['fiapre','cug',1],
  ['central','berlin',1],['berlin','kotokrom',1],['kotokrom','odumase',1],
  ['central','ridge',1],['ridge','abesim',1],
  ['central','lorry'],['central','newdormaa'],['hospital','berlin'],['coronation','penkwase'],
  ['newdormaa','baakoniaba'],['baakoniaba','airport'],['airport','odumase'],['ridge','estate'],['estate','stu'],
  ['lorry','estate'],['ridge','nkwabeng'],['nkwabeng','abesim'],['penkwase','uenr'],['penkwase','atronie'],
  ['nkwabeng','atronie'],['lorry','newdormaa'],['penkwase','nkwabeng'],
  ['baakoniaba','dump'],['kotokrom','recycle']
];
const STUBS = [['cug',-5.7,2.9,'to Berekum'],['odumase',0.8,6.3,'to Techiman'],['abesim',1.1,-5.9,'to Kumasi']];
const COLLECTORS = [
  {n:'Yaw Mensah',r:4.9,p:'M-22-BA 1471',ph:'024 555 0182',trips:980},
  {n:'Akosua Boateng',r:4.8,p:'M-23-BA 3390',ph:'054 555 0436',trips:640},
  {n:'Kojo Ampofo',r:4.7,p:'M-24-BA 0712',ph:'020 555 0957',trips:315},
  {n:'Kwasi Frimpong',r:4.9,p:'M-21-BA 5208',ph:'055 555 0623',trips:1720},
  {n:'Adwoa Owusu',r:5.0,p:'M-24-BA 8846',ph:'024 555 0398',trips:455}
];
const DEMO_NODES = ['berlin','lorry','penkwase','estate','uenr','newdormaa'];
const demoFleet = COLLECTORS.map((d,i)=>Object.assign({}, d, {id:'demo'+i, node:DEMO_NODES[i%DEMO_NODES.length], busy:false, serves:['general','recycle'], demo:true}));
let regFleet = [];
let fleet = demoFleet;

const IDS = Object.keys(PLACES);
const PICK_IDS = IDS.filter(id=>!PLACES[id].site);
const adj = {}; IDS.forEach(i => adj[i] = []);
EDGES.forEach(([a,b]) => {
  const d = Math.hypot(PLACES[a].x-PLACES[b].x, PLACES[a].y-PLACES[b].y) * 1.2;
  adj[a].push([b,d]); adj[b].push([a,d]);
});
function route(a,b){
  const dist={}, prev={}, q=new Set(IDS);
  IDS.forEach(i => dist[i]=Infinity); dist[a]=0;
  while(q.size){
    let u=null; q.forEach(i => { if(u===null || dist[i]<dist[u]) u=i; });
    q.delete(u); if(u===b) break;
    adj[u].forEach(([v,w]) => { if(dist[u]+w < dist[v]){ dist[v]=dist[u]+w; prev[v]=u; } });
  }
  const path=[b]; while(path[0]!==a) path.unshift(prev[path[0]]);
  return {path, km:dist[b]};
}
const r05 = v => Math.round(v*2)/2;
const ghs = v => 'GH₵ ' + v.toFixed(2);
const mins = km => Math.max(2, Math.round(km*3));
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- Prices ----------
   Price = base for the amount + a per-km charge for hauling it from the pickup to the site.
   Bags:      2 + 2 per bag + 0.40/km, at least GH₵ 4
   One bin:   8 + 0.50/km, at least GH₵ 10   (a dustbin up to 240 L)
   Full load: 35 + 1.50/km, at least GH₵ 40  (a full aboboyaa: bulky or construction waste)
   Homes and hostels pay 90% (HOME_RATE); sorted recyclables pay 75% (RECYCLE_RATE). */
let cust='home'; /* home | business */
const HOME_RATE=0.9, RECYCLE_RATE=0.75, MAX_BAGS=10;
const MIN={bag:4,bin:10,load:40}, MIN_DISC={bag:3,bin:8,load:30};
function prices(km){
  const raw={bag:Math.max(MIN.bag,r05(2+2*draft.qty+0.4*km)), bin:Math.max(MIN.bin,r05(8+0.5*km)), load:Math.max(MIN.load,r05(35+1.5*km))};
  let m=1; if(cust==='home') m*=HOME_RATE; if(draft.kind==='recycle') m*=RECYCLE_RATE;
  if(m===1) return raw;
  const out={full:raw}; Object.keys(raw).forEach(k=>{ out[k]=Math.max(MIN_DISC[k],r05(raw[k]*m)); });
  return out;
}
const SIZE_NAME={bag:'Bags',bin:'One bin',load:'Full load'};
const KIND_NAME={general:'General waste',recycle:'Sorted recyclables'};
function amountText(size,qty){ return size==='bag' ? qty+(qty===1?' bag':' bags') : size==='bin' ? 'one bin' : 'a full aboboyaa load'; }
const siteFor = kind => kind==='recycle' ? 'recycle' : 'dump';
const siteName = id => PLACES[id].name + (PLACES[id].loc ? ' ('+PLACES[id].loc+')' : '');

/* ---------- Map ---------- */
const svg = $('#map');
function el(tag, attrs, parent){ const e=document.createElementNS(NS,tag); for(const k in attrs) e.setAttribute(k,attrs[k]); if(parent) parent.appendChild(e); return e; }
const PX = id => PLACES[id].x*S, PY = id => -PLACES[id].y*S;
let gRoute, gApproach, gPins, gIdle, gDriver;
let VIEWBOX='';
function drawBase(target, interactive){
  if(!VIEWBOX){
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    const grow=(a,b,c,d)=>{x0=Math.min(x0,a);x1=Math.max(x1,b);y0=Math.min(y0,c);y1=Math.max(y1,d);};
    IDS.forEach(id=>{
      const p=PLACES[id], w=p.name.length*8.2, x=PX(id), y=PY(id);
      if(p.lab==='r') grow(x,x+16+w,y-12,y+12);
      else if(p.lab==='l') grow(x-16-w,x,y-12,y+12);
      else grow(x-w/2,x+w/2,y-30,y+30);
    });
    STUBS.forEach(s=>grow(s[1]*S-60,s[1]*S+60,-s[2]*S-20,-s[2]*S+20));
    const pad=24;
    VIEWBOX=`${x0-pad} ${y0-pad} ${x1-x0+pad*2} ${y1-y0+pad*2}`;
  }
  target.setAttribute('viewBox', VIEWBOX);
  const gR=el('g',{},target);
  STUBS.forEach(([id,x,y,t])=>{
    el('line',{x1:PX(id),y1:PY(id),x2:x*S,y2:-y*S,class:'stub'},gR);
    const tx=el('text',{x:x*S,y:-y*S+(y<0?18:-8),'text-anchor':'middle',class:'stub-label'},gR); tx.textContent=t;
  });
  EDGES.filter(e=>!e[2]).forEach(([a,b])=>el('line',{x1:PX(a),y1:PY(a),x2:PX(b),y2:PY(b),class:'road'},gR));
  EDGES.filter(e=>e[2]).forEach(([a,b])=>el('line',{x1:PX(a),y1:PY(a),x2:PX(b),y2:PY(b),class:'road main'},gR));
  const layers={approach:el('g',{},target), route:el('g',{},target)};
  const gN=el('g',{},target);
  IDS.forEach(id=>{
    const p=PLACES[id], x=PX(id), y=PY(id);
    const cls='node'+(p.site?' site':'')+(interactive?'':' fixed');
    const g=el('g',interactive?{class:cls,tabindex:'0',role:'button','aria-label':p.name}:{class:cls},gN);
    if(p.site) el('rect',{x:x-8,y:y-8,width:16,height:16,rx:3},g); else el('circle',{cx:x,cy:y,r:7},g);
    const o={r:[x+14,y+5,'start'],l:[x-14,y+5,'end'],t:[x,y-13,'middle'],b:[x,y+24,'middle']}[p.lab];
    const t=el('text',{x:o[0],y:o[1],'text-anchor':o[2]},g); t.textContent=p.name;
    if(interactive){
      g.addEventListener('click',()=>placeClick(id));
      g.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); placeClick(id); } });
    }
  });
  return layers;
}
function drawMap(){
  const L=drawBase(svg,true); gApproach=L.approach; gRoute=L.route;
  gIdle=el('g',{},svg); gPins=el('g',{},svg);
  gDriver=el('g',{visibility:'hidden'},svg);
  el('circle',{r:17,class:'drv-bg'},gDriver);
  el('rect',{x:-2,y:-8,width:12,height:10,rx:1.5,class:'drv-ink'},gDriver);
  el('rect',{x:-10,y:-5,width:7,height:7,rx:1.5,class:'drv-ink'},gDriver);
  el('circle',{cx:-6,cy:5,r:2.6,class:'drv-ink'},gDriver);
  el('circle',{cx:7,cy:5,r:2.6,class:'drv-ink'},gDriver);
  drawIdle();
}
function fleetLabel(){
  const n=fleet.filter(f=>!f.busy).length;
  return n+(n===1?' collector':' collectors')+' nearby'+(fleet===demoFleet?' (demo)':'');
}
function drawIdle(){
  if(!gIdle) return;
  gIdle.innerHTML='';
  fleet.filter(f=>!f.busy).forEach((f,i)=>{ if(!PLACES[f.node]) return; const g=el('g',{class:'idle'},gIdle); el('circle',{cx:PX(f.node)+(i%2?14:-14),cy:PY(f.node)-12,r:6},g); });
  if(!isActive()) setPill(fleetLabel(),false);
}
function polyPts(path){ return path.map(id=>`${PX(id)},${PY(id)}`).join(' '); }
function drawPins(){
  gPins.innerHTML=''; gRoute.innerHTML='';
  if(!draft.pickup) return;
  el('polyline',{points:polyPts(route(draft.pickup,siteFor(draft.kind)).path),class:'route'},gRoute);
  const g=el('g',{},gPins); el('circle',{cx:PX(draft.pickup),cy:PY(draft.pickup),r:13,class:'pin-pick'},g);
  const t=el('text',{x:PX(draft.pickup),y:PY(draft.pickup)+4.5,'text-anchor':'middle',class:'pin-label'},g); t.textContent='A';
}
function setDriver(x,y){ gDriver.setAttribute('transform',`translate(${x},${y})`); gDriver.setAttribute('visibility','visible'); }

let animId=0;
function animate(path, msPerKm, onProgress, onDone){
  cancelAnimationFrame(animId);
  const pts=path.map(id=>[PX(id),PY(id)]); const seg=[]; let total=0;
  for(let i=1;i<pts.length;i++){ const d=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); seg.push(d); total+=d; }
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur=Math.max(1500,(total/S)*msPerKm)*(reduce?0.3:1), t0=performance.now();
  function step(now){
    const f=Math.min(1,(now-t0)/dur); let d=f*total, i=0;
    while(i<seg.length && d>seg[i]){ d-=seg[i]; i++; }
    if(i>=seg.length){ setDriver(...pts[pts.length-1]); }
    else { const k=seg[i]?d/seg[i]:0; setDriver(pts[i][0]+(pts[i+1][0]-pts[i][0])*k, pts[i][1]+(pts[i+1][1]-pts[i][1])*k); }
    onProgress(f);
    if(f<1) animId=requestAnimationFrame(step); else onDone();
  }
  animId=requestAnimationFrame(step);
}

/* ---------- State ---------- */
let state='idle'; /* idle | searching | enroute | arrived | hauling | done */
let draft={pickup:null,size:'bag',qty:2,kind:'general',pay:'cash'};
let col=null, colFrom=null, legKm=0, progress=0, timers=[], qid=0, lastFare=0, job=null;
const ACTIVE=['searching','enroute','arrived','hauling'];
const isActive=()=>ACTIVE.includes(state);
const first = n => String(n).split(' ')[0];

/* ---------- Chat UI ---------- */
const log=$('#log');
let queue=Promise.resolve();
function addMsg(who, html){
  const d=document.createElement('div'); d.className='msg '+who; d.innerHTML=html; log.appendChild(d);
  log.scrollTop=log.scrollHeight; return d;
}
function bot(html, delay){
  queue=queue.then(()=>new Promise(res=>{
    const t=addMsg('bot','<div class="typing"><i></i><i></i><i></i></div>'); t.style.padding='0';
    setTimeout(()=>{ t.remove(); addMsg('bot',html); renderChips(); res(); }, delay==null?450:delay);
  }));
  return queue;
}
function send(text){ if(!text.trim()) return; addMsg('me',esc(text)); handle(text); }
function renderChips(){
  const c=$('#chips'); c.innerHTML='';
  chipsFor().forEach(t=>{ const b=document.createElement('button'); b.type='button'; b.className='chip'; b.textContent=t; b.onclick=()=>send(t); c.appendChild(b); });
}
function chipsFor(){
  if(state==='searching'||state==='enroute') return ['Where is my collector?','Call collector','Cancel pickup'];
  if(state==='arrived') return ['Waste handed over','Call collector','Cancel pickup'];
  if(state==='hauling') return ['Where is my waste?','Call collector'];
  if(state==='done') return ['Request another pickup','Thank you'];
  if(draft.pickup) return ['Confirm pickup', draft.size==='bag'?'Add a bag':'Make it 2 bags', draft.kind==='recycle'?'General waste':'Sorted recyclables', draft.pay==='cash'?'Pay with MoMo':'Pay with cash','Cancel'];
  const swap = cust==='home' ? 'Business rate' : 'Home rate';
  return cust==='home'
    ? ['Collect 2 bags from Penkwase','Bin pickup at Fiapre','Price for a full load at UENR','What do you collect?',swap,'Help']
    : ['Bin pickup at Central Market','Full load from Main Lorry Station','Recyclables at Ridge','What do you collect?',swap,'Help'];
}

/* ---------- Understanding messages ---------- */
const norm = t => t.toLowerCase().replace(/ɛ/g,'e').replace(/ɔ/g,'o').replace(/[’`]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
const ALIASES=[]; IDS.forEach(id=>PLACES[id].al.forEach(a=>ALIASES.push([a,id]))); ALIASES.sort((a,b)=>b[0].length-a[0].length);
function findPlaces(t){
  const taken=[], out=[];
  for(const [a,id] of ALIASES){
    const re=new RegExp('\\b'+a+'\\b','g'); let m;
    while((m=re.exec(t))){ const s=m.index, e=s+a.length; if(taken.some(([x,y])=>s<y&&e>x)) continue; taken.push([s,e]); out.push({id,s,e}); }
  }
  return out.sort((a,b)=>a.s-b.s);
}
const NUMW={a:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};

function handle(raw){
  const t=norm(raw); if(!t) return;
  if(/\b(emergency|accident|fire|burning|police|unsafe|danger|sos)\b/.test(t)) return safety();
  if(/\b(cancel|abort)\b/.test(t)) return cancel();
  if(/\b(what (can|do) you (take|collect|accept|pick)|what is allowed|sorting|how (do i|to) sort|hazardous|chemicals?|batteries|medical waste|what goes)\b/.test(t)) return wasteRules();
  if(/\b(help|what can you do|how does this work)\b/.test(t)) return help();
  if(col && isActive() && /\b(call|phone|number|contact)\b/.test(t)) return callCollector();
  if(/\b(handed|hand over|hand it|took it|taken it|loaded|it's out|its out)\b/.test(t)) return handover();
  if(isActive() && /\b(where is|status|how long|eta|how far|arrive|coming|where are you|my waste)\b/.test(t)) return status();
  if(/\b(another pickup|new pickup|request another|request again)\b/.test(t)){ resetDraft(); return bot('Sure. Where is the waste?'); }
  if(/\b(thank|thanks|medaase|meda wo ase)\b/.test(t)) return bot('Mepa wo kyɛw, you are welcome. Thank you for keeping Sunyani clean!');
  if(/\b(become a collector|register as a collector|be a collector|join as a collector|sign up as a collector|collect for you|work for wastetech)\b/.test(t)){
    showView('register'); return bot('I have opened the <b>Become a collector</b> form. Fill it in and we will call you to arrange verification.');
  }
  if(/\b(where do you go|where can you go|places|areas|locations|which towns|do you cover|list)\b/.test(t)) return listPlaces();

  const changed=[];
  if(/\b(home rate|household|hostel rate|switch to home|for my home|for my house|for my hostel|i live)\b/.test(t)){ if(cust!=='home'){ setCust('home'); changed.push('home and hostel rate (10% off)'); } }
  else if(/\b(business rate|switch to business|for my shop|for my office|for my business|i have a shop|my company|restaurant|chop bar)\b/.test(t)){ if(cust!=='business'){ setCust('business'); changed.push('business rate'); } }
  if(/\b(momo|mobile money|telecel cash|at money)\b/.test(t)){ draft.pay='momo'; changed.push('payment set to MoMo'); }
  else if(/\bcash\b/.test(t)){ draft.pay='cash'; changed.push('payment set to cash'); }
  if(/\b(recycl\w*|plastics?|bottles?|cans|paper|cardboard|sorted)\b/.test(t)){ draft.kind='recycle'; changed.push('sorted recyclables (25% off)'); }
  else if(/\b(general|mixed|food|unsorted|kitchen)\b/.test(t)){ draft.kind='general'; changed.push('general waste'); }
  const qm=t.match(/\b(\d{1,2}|a|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:big |small |black |full )?(?:bags?|sacks?|rubbers?)\b/);
  if(/\b(add a bag|one more bag|another bag|extra bag)\b/.test(t)){ draft.size='bag'; draft.qty=Math.min(MAX_BAGS,draft.qty+1); changed.push(amountText('bag',draft.qty)); }
  else if(/\b(full load|whole load|big load|bulky|heap|pile|rubble|construction|furniture|lot of)\b/.test(t)){ draft.size='load'; changed.push('a full aboboyaa load'); }
  else if(/\b(bin|bins|dustbin|dust bin|container|wheelie)\b/.test(t)){ draft.size='bin'; changed.push('one bin'); }
  else if(qm || /\b(bags?|sacks?|rubbers?)\b/.test(t)){
    draft.size='bag';
    if(qm){ const n=/^\d+$/.test(qm[1])?parseInt(qm[1],10):NUMW[qm[1]]; draft.qty=Math.max(1,Math.min(MAX_BAGS,n||1)); }
    changed.push(amountText('bag',draft.qty)+(qm&&parseInt(qm[1],10)>MAX_BAGS?' (the most for one pickup; ask for a full load for more)':''));
  }

  const ms=findPlaces(t);
  if(ms.length){
    if(isActive()) return bot('You have a pickup in progress. Say <b>cancel pickup</b> first if you want to change it.');
    const p=ms.find(m=>!PLACES[m.id].site);
    if(!p) return bot(`<b>${PLACES[ms[0].id].name}</b> is where collectors empty their loads. Tell me where your waste is, like <i>Penkwase</i> or <i>Ridge</i>.`);
    if(state==='done') state='idle';
    draft.pickup=p.id;
    return afterDraft(/\b(how much|price|cost|charge)\b/.test(t));
  }
  if(changed.length && !isActive()){
    if(draft.pickup){ drawPins(); refreshQuote(); return bot('Done: '+changed.join(', ')+'. The new price is on the card above.'); }
    return bot('Noted: '+changed.join(', ')+'. Now tell me where the waste is.');
  }
  if(/^(yes|yeah|yep|ok|okay|sure|confirm|request|go ahead|aane|yoo)\b/.test(t) || /\bconfirm\b/.test(t)){
    if((state==='idle'||state==='done') && draft.pickup) return confirmPickup();
    if(isActive()) return status();
    return bot('Tell me where your waste is, and I will send a collector.');
  }
  if(/^(no|nope|not now|daabi)\b/.test(t)) return bot('No problem. I am here when your bin is full.');
  if(/\b(how much|price|cost|charge)\b/.test(t)){
    if(draft.pickup) return afterDraft(true);
    return bot('Prices depend on how much waste you have and how far it goes to the disposal site. Bags start at <span class="mono">GH₵ 4.00</span>, a bin at <span class="mono">GH₵ 10.00</span> and a full aboboyaa load at <span class="mono">GH₵ 40.00</span>. Homes and hostels get 10% off, and sorted recyclables are 25% cheaper. Try <i>How much for 3 bags from Fiapre?</i>');
  }
  if(/\b(hi|hello|hey|akwaaba|maakye|maaha|maadwo|good morning|good afternoon|good evening|ete sen|wo ho te sen|how are you)\b/.test(t)){
    return bot(`${greet()}! Me ho yɛ, medaase. Where is the waste you want collected?`);
  }
  if(/\b(pick ?up|collect|rubbish|waste|refuse|trash|garbage|bola|dirt|need|want)\b/.test(t)){
    if(isActive()) return status();
    return bot('Where is the waste? Name a place like <b>Penkwase</b> or <b>New Dormaa</b>, or tap it on the map.');
  }
  bot('I did not catch a place in that. I cover areas like Penkwase, Fiapre, Abesim, Berlin Top, New Dormaa, Odumase and UENR. Try <i>Collect 2 bags from Ridge</i>.');
}
function greet(){ const h=new Date().getHours(); return h<12?'Maakye (good morning)':h<17?'Maaha (good afternoon)':'Maadwo (good evening)'; }

function afterDraft(isPriceQuestion){
  drawPins();
  return bot(`${isPriceQuestion?'Here is the price':'Got it'}: pickup at <b>${PLACES[draft.pickup].name}</b>.`+quoteHTML(++qid),600).then(()=>{
    document.querySelectorAll('.quote:not(.momo)').forEach(q=>{ if(q.id!=='q'+qid) q.classList.add('stale'); });
  });
}
function quoteInner(){
  const site=siteFor(draft.kind), r=route(draft.pickup,site), f=prices(r.km);
  const was = k => f.full ? `<s>${ghs(f.full[k])}</s>` : '';
  const opt = k => `<button type="button" class="opt ${draft.size===k?'on':''}" data-act="size" data-v="${k}">${k==='bag'?amountText('bag',draft.qty):SIZE_NAME[k]}<b>${ghs(f[k])}${was(k)}</b></button>`;
  return `<div class="q-cat">${cust==='home'?'Home &amp; hostel rate · 10% off':'Business rate · receipt for every pickup'}${draft.kind==='recycle'?' · recyclables 25% off':''} · includes a ${SERVICE_PCT} service charge</div>
  <div class="q-route"><span><i class="dot"></i>${PLACES[draft.pickup].name}</span><span><i class="dot d"></i>${PLACES[site].name}</span></div>
  <div class="q-meta">${r.km.toFixed(1)} km haul to the ${draft.kind==='recycle'?'recycling point':'disposal site'} · you get a disposal confirmation</div>
  <div class="seg seg3">${opt('bag')}${opt('bin')}${opt('load')}</div>
  ${draft.size==='bag'?`<div class="qty"><button type="button" data-act="qty" data-v="-1" aria-label="One bag fewer">−</button><b>${draft.qty}</b><button type="button" data-act="qty" data-v="1" aria-label="One more bag">+</button><span>bags, tied shut</span></div>`:''}
  <div class="seg"><button type="button" class="opt ${draft.kind==='general'?'on':''}" data-act="kind" data-v="general">General waste</button>
  <button type="button" class="opt ${draft.kind==='recycle'?'on':''}" data-act="kind" data-v="recycle">Sorted recyclables</button></div>
  <div class="seg"><button type="button" class="opt ${draft.pay==='cash'?'on':''}" data-act="pay" data-v="cash">Cash</button>
  <button type="button" class="opt ${draft.pay==='momo'?'on':''}" data-act="pay" data-v="momo">Mobile Money</button></div>
  <button type="button" class="cta" data-act="confirm">Request collector · ${ghs(f[draft.size])}</button>`;
}
function quoteHTML(id){ return `<div class="quote" id="q${id}">${quoteInner()}</div>`; }
function refreshQuote(){ const q=document.getElementById('q'+qid); if(q && !q.classList.contains('stale') && draft.pickup) q.innerHTML=quoteInner(); }

log.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b) return;
  const act=b.dataset.act, v=b.dataset.v;
  if(act==='size'){ draft.size=v; refreshQuote(); renderChips(); }
  else if(act==='qty'){ draft.size='bag'; draft.qty=Math.max(1,Math.min(MAX_BAGS,draft.qty+Number(v))); refreshQuote(); }
  else if(act==='kind'){ draft.kind=v; drawPins(); refreshQuote(); renderChips(); }
  else if(act==='pay'){ draft.pay=v; refreshQuote(); renderChips(); }
  else if(act==='confirm'){ addMsg('me','Request collector'); confirmPickup(); }
  else if(act==='rate'){ b.parentElement.querySelectorAll('button').forEach(x=>x.disabled=true); addMsg('me','★'.repeat(+v)); rate(+v); }
  else if(act==='net'){ const card=b.closest('.momo'); card.dataset.net=v; card.querySelectorAll('[data-act="net"]').forEach(x=>x.classList.toggle('on',x===b)); }
  else if(act==='momo-send'){ sendMomo(b.closest('.momo')); }
  else if(act==='pay-cash'){ payCashInstead(b.closest('.momo')); }
});
log.addEventListener('input',e=>{
  const i=e.target.closest('[data-momo]'); if(!i) return;
  const net=detectNet(i.value), card=i.closest('.momo'); if(!net||!card) return;
  card.dataset.net=net; card.querySelectorAll('[data-act="net"]').forEach(x=>x.classList.toggle('on',x.dataset.v===net));
});

/* ---------- Pickup flow ---------- */
function setPill(text,busy){ $('#pillText').textContent=text; $('#pill').classList.toggle('busy',!!busy); }
function renderTrip(){
  const box=$('#trip');
  $('.side').classList.toggle('busy',isActive());
  if(!isActive()){ box.hidden=true; setPill(fleetLabel(),false); return; }
  box.hidden=false;
  const st={searching:'Finding a collector near '+PLACES[job.from].name+'…',
    enroute:'Collector on the way',arrived:'Collector is at '+PLACES[job.from].name,
    hauling:'Taking your waste to the '+PLACES[job.to].name}[state];
  setPill(st,true);
  if(state==='searching'){ box.innerHTML=`<div class="trip-status">${st}</div><div class="bar"><i id="tbar" style="width:15%"></i></div>`; return; }
  box.innerHTML=`<div class="trip-row">${col.photo?`<img class="ava" src="${col.photo}" alt="Photo of ${col.n}">`:`<div class="ava">${initials(col.n)}</div>`}<div><div class="trip-name">${col.n}</div>
    <div class="trip-sub">★ ${col.r.toFixed(1)} · ${col.trips.toLocaleString()} pickups · ${col.ph}</div></div><span class="plate">${col.p}</span></div>
    <div class="trip-status" id="tstat">${st}</div><div class="bar"><i id="tbar"></i></div>`;
  updateBar();
}
function remaining(){ return Math.max(1,Math.ceil(mins(legKm)*(1-progress))); }
function updateBar(){
  const b=$('#tbar'), s=$('#tstat'); if(b) b.style.width=(state==='arrived'?100:progress*100)+'%';
  if(s && state==='enroute') s.textContent='Arriving in '+remaining()+' min';
  if(s && state==='hauling') s.textContent='Reaching the '+PLACES[job.to].name+' in '+remaining()+' min';
}
function confirmPickup(){
  if(isActive() || !draft.pickup) return bot('Tell me where your waste is first.');
  const site=siteFor(draft.kind), km=route(draft.pickup,site).km, f=prices(km);
  job={from:draft.pickup, to:site, km, size:draft.size, qty:draft.size==='bag'?draft.qty:1, kind:draft.kind, pay:draft.pay, cust, fare:f[draft.size]};
  state='searching';
  document.querySelectorAll('.quote:not(.momo)').forEach(q=>q.classList.add('stale'));
  renderTrip();
  bot(`Looking for a collector near <b>${PLACES[job.from].name}</b>…`);
  timers.push(setTimeout(assign, 2400));
}
let tripT={};
function assign(){
  if(state!=='searching') return;
  const pool=fleet.filter(f=>!f.busy && PLACES[f.node] && (f.serves||[]).includes(job.kind));
  if(!pool.length){ state='idle'; renderTrip(); return bot(`No collectors for ${job.kind==='recycle'?'recyclables':'general waste'} are free right now. Please try again in a few minutes.`); }
  let best=null;
  pool.forEach(f=>{ const r=route(f.node,job.from); if(!best||r.km<best.r.km) best={f,r}; });
  col=best.f; col.busy=true; colFrom=col.node; drawIdle();
  tripT={assigned:new Date().toISOString(), collected:null};
  legKm=best.r.km; progress=0; state='enroute';
  gApproach.innerHTML=''; el('polyline',{points:polyPts(best.r.path),class:'approach'},gApproach);
  setDriver(PX(col.node),PY(col.node));
  renderTrip();
  bot(`<b>${col.n}</b> accepted your pickup. Orange tricycle, plate <span class="mono">${col.p}</span>. Arriving in about <b>${mins(legKm)} min</b>. Please have ${amountText(job.size,job.qty)} ready${job.size==='bag'?', tied shut':''}.`);
  animate(best.r.path,1800,f=>{progress=f;updateBar();},arrivedAtPickup);
}
function arrivedAtPickup(){
  state='arrived'; gApproach.innerHTML=''; renderTrip();
  bot(`${first(col.n)} is at <b>${PLACES[job.from].name}</b>. Check the plate <span class="mono">${col.p}</span>${col.photo?' and that the collector matches the photo':''}, hand over your waste, then tap <b>Waste handed over</b>.`);
}
function handover(){
  if(state==='enroute'||state==='searching') return bot(`Your collector is not there yet. About <b>${remaining()} min</b> away.`);
  if(state==='hauling') return bot(`Your waste is already on the way to the ${PLACES[job.to].name}.`);
  if(state!=='arrived') return bot('There is no collector waiting for you right now. Where is your waste?');
  const r=route(job.from,job.to); legKm=r.km; progress=0; state='hauling'; tripT.collected=new Date().toISOString(); renderTrip();
  bot(`Medaase! ${first(col.n)} is taking it to the <b>${siteName(job.to)}</b>. I will confirm when it has been emptied there.`+(job.pay==='cash'?` Please pay <span class="mono">${ghs(job.fare)}</span> in cash now.`:' You pay by MoMo once it is disposed.'));
  animate(r.path,1500,f=>{progress=f;updateBar();},disposed);
}
function disposed(){
  lastFare=job.fare;
  state='done'; col.node=job.to; col.busy=false; col.trips=(col.trips||0)+1; renderTrip(); gDriver.setAttribute('visibility','hidden'); drawIdle();
  const now=new Date(), fee=serviceFee(lastFare);
  tripRec={id:'W'+Date.now().toString(36).toUpperCase(), at:now.toISOString(), day:dayKey(now), from:job.from, to:job.to,
    cust:job.cust, kind:job.kind, size:job.size, qty:job.qty, fare:lastFare, fee, collectorGets:Math.round((lastFare-fee)*100)/100,
    pay:job.pay, status:job.pay==='momo'?'awaiting':'cash',
    collector:col.id, collectorFrom:colFrom, assignedAt:tripT.assigned||null, collectedAt:tripT.collected||null};
  recordPickup(tripRec);
  const where=`Disposal confirmed: ${first(col.n)} emptied your load at the <b>${siteName(job.to)}</b> at ${fmtTime(tripRec.at)}. Price: <span class="mono">${ghs(lastFare)}</span>, including a ${SERVICE_PCT} WasteTech service charge of <span class="mono">${ghs(fee)}</span>; ${first(col.n)} receives <span class="mono">${ghs(tripRec.collectorGets)}</span>.`;
  const extra = job.cust==='business' ? ' A receipt is saved under <b>My pickups</b>.' : '';
  if(job.pay==='momo') bot(`${where}${extra} Pay with Mobile Money below.`+momoCard(++payN));
  else { bot(where+extra); askRating(); }
}
function askRating(){
  if(!col) return;
  bot(`How was your pickup with ${first(col.n)}?<div class="stars">${[1,2,3,4,5].map(n=>`<button type="button" data-act="rate" data-v="${n}" aria-label="${n} star${n>1?'s':''}">★</button>`).join('')}</div>`);
}

/* ---------- Mobile Money ---------- */
const MOMO_NETS={
  mtn:{name:'MTN MoMo',pre:['024','025','053','054','055','059']},
  telecel:{name:'Telecel Cash',pre:['020','050']},
  at:{name:'AirtelTigo Money',pre:['026','027','056','057']}
};
let payN=0, tripRec=null, momoSaved=null;
function detectNet(v){
  let d=(v||'').replace(/\D/g,''); if(d.startsWith('233')) d='0'+d.slice(3);
  const p=d.slice(0,3); return Object.keys(MOMO_NETS).find(k=>MOMO_NETS[k].pre.includes(p))||null;
}
/* SIMULATED PROVIDER. To take real payments, replace this one function with a call to your own
   payment server (Paystack, Hubtel or the MTN MoMo API). The page itself cannot make external calls. */
function requestMomo({amount,number,network,reference}){
  return new Promise(res=>setTimeout(()=>res({status:'successful',reference:'MOMO-'+reference}),4000));
}
function momoCard(n){
  const num=momoSaved?momoSaved.number:'', net=(momoSaved&&MOMO_NETS[momoSaved.network]?momoSaved.network:null)||detectNet(num)||'mtn';
  return `<div class="quote momo" id="pay${n}" data-net="${net}">
    <div class="q-cat">Mobile Money · ${ghs(lastFare)}</div>
    <div class="seg seg3">${Object.keys(MOMO_NETS).map(k=>`<button type="button" class="opt ${k===net?'on':''}" data-act="net" data-v="${k}">${MOMO_NETS[k].name}</button>`).join('')}</div>
    <div class="field"><label for="momo${n}">MoMo number</label><input id="momo${n}" type="tel" inputmode="tel" autocomplete="tel" placeholder="024 123 4567" value="${esc(num)}" data-momo="${n}"></div>
    <button type="button" class="cta" data-act="momo-send">Send payment request</button>
    <button type="button" class="linkbtn" data-act="pay-cash">Pay cash instead</button>
    <p class="formmsg" id="momoMsg${n}" role="status">You approve the payment on your own phone. WasteTech never asks for your PIN.</p></div>`;
}
async function sendMomo(card){
  if(!card||card.classList.contains('locked')) return;
  const n=card.id.slice(3), msg=$('#momoMsg'+n), input=$('#momo'+n), rec=tripRec;
  const number=normPhone(input.value), net=card.dataset.net;
  if(!number){ msg.className='formmsg err'; msg.textContent='Enter a Ghana mobile number, like 024 123 4567.'; return; }
  const det=detectNet(number);
  if(det && det!==net){ msg.className='formmsg err'; msg.textContent=`${number} is a ${MOMO_NETS[det].name} number. Choose ${MOMO_NETS[det].name} or check the number.`; return; }
  card.classList.add('locked');
  msg.className='formmsg'; msg.textContent=`Request sent to ${number}. Check your phone and enter your ${MOMO_NETS[net].name} PIN there to approve ${ghs(rec.fare)}.`;
  try{
    const res=await requestMomo({amount:rec.fare,number,network:net,reference:rec.id});
    if(!res||res.status!=='successful') throw new Error('not approved');
    msg.className='formmsg ok'; msg.textContent=`Paid · reference ${res.reference}`;
    updatePickup(rec.id,{status:'paid',network:net,ref:res.reference});
    momoSaved={network:net,number}; saveMomo();
    bot(`Payment of <span class="mono">${ghs(rec.fare)}</span> received from ${MOMO_NETS[net].name} <span class="mono">${esc(number)}</span>. Reference <span class="mono">${esc(res.reference)}</span>.`);
    askRating();
  }catch(err){
    card.classList.remove('locked');
    msg.className='formmsg err'; msg.textContent='The payment was not approved. Try again, or pay cash instead.';
    updatePickup(rec.id,{status:'failed'});
  }
}
function payCashInstead(card){
  if(!card||card.classList.contains('locked')) return;
  card.classList.add('locked');
  const rec=tripRec;
  savePickups(cur=>{
    const r=cur.recent.find(x=>x.id===rec.id); if(!r||r.pay==='cash') return;
    r.pay='cash'; r.status='cash';
    const d=cur.days[r.day]; if(d){ d.momo=Math.max(0,(d.momo||0)-1); d.cash=(d.cash||0)+1; }
  });
  addMsg('me','Pay cash instead');
  bot(`No problem. Please pay ${col?first(col.n):'your collector'} <span class="mono">${ghs(rec.fare)}</span> in cash.`);
  askRating();
}
function rate(n){
  resetDraft();
  bot(n>=4?`Medaase! I will pass your ${n} stars to ${first(col.n)}.`:`Sorry it was not great. Thanks for the ${n}-star rating; our team will review this pickup.`);
}
function status(){
  if(state==='searching') return bot('Still matching you with the nearest collector. It usually takes under a minute.');
  if(state==='enroute') return bot(`${first(col.n)} is about <b>${remaining()} min</b> from ${PLACES[job.from].name}.`);
  if(state==='arrived') return bot(`${first(col.n)} is waiting at ${PLACES[job.from].name}. Plate <span class="mono">${col.p}</span>.`);
  if(state==='hauling') return bot(`Your waste is about <b>${remaining()} min</b> from the ${PLACES[job.to].name}.`);
}
function callCollector(){ bot(`You can reach ${first(col.n)} on <span class="mono">${col.ph}</span>.${col.demo?' (Demo number.)':''}`); }
function cancel(){
  if(state==='hauling') return bot(`${first(col.n)} already has your waste and is on the way to the ${PLACES[job.to].name}, so this pickup can no longer be cancelled.`);
  if(isActive()){
    cancelAnimationFrame(animId); timers.forEach(clearTimeout); timers=[];
    if(col) col.busy=false;
    colFrom=null;
    gApproach.innerHTML=''; gDriver.setAttribute('visibility','hidden');
    state='idle'; col=null; renderTrip(); drawIdle(); drawPins();
    return bot('Pickup cancelled, no charge. Your details are kept; say <b>confirm pickup</b> to request again.');
  }
  if(draft.pickup){ resetDraft(); return bot('Cleared. Where is the waste?'); }
  bot('There is nothing to cancel right now.');
}
function resetDraft(){ draft.pickup=null; state='idle'; colFrom=null; drawPins(); renderTrip(); }
function safety(){
  bot('If there is a fire, call the <b>Ghana National Fire Service on 192</b>. Police: <b>191</b>. Ambulance: <b>193</b>. National emergency line: <b>112</b>. Never burn waste near homes. '+(isActive()&&col?`Your collector is ${col.n}, plate <span class="mono">${col.p}</span>.`:''));
}
function wasteRules(){
  bot('<b>We collect:</b> household and shop rubbish in tied bags or a bin, and bulky waste like old furniture or building rubble as a full load.<br><b>Recyclables, 25% off:</b> clean plastic bottles, sachet water rubbers, cans, paper and cardboard, kept apart from food waste. They go to the Recycling Point.<br><b>We do not collect:</b> medical waste, chemicals, car batteries, or anything still burning.');
}
function help(){
  bot('I can send a waste collector, give prices and track your pickup to the disposal site. Try:<br>• <i>Collect 3 bags from Penkwase</i><br>• <i>How much for a bin at Fiapre?</i><br>• <i>Sorted recyclables</i> or <i>pay with MoMo</i><br>• <i>Where is my collector?</i> or <i>cancel pickup</i><br>You can also tap a place on the map.');
}
function listPlaces(){ bot('I cover Sunyani and nearby towns: '+PICK_IDS.map(i=>PLACES[i].name).join(', ')+'.'); }
function setCust(v){
  cust=v;
  ['home','business'].forEach(k=>{ const b=$(k==='home'?'#catHome':'#catBusiness'); b.classList.toggle('on',k===v); b.setAttribute('aria-checked',k===v); });
  $('#heroText').innerHTML = v==='home'
    ? 'Rubbish picked up from your door<span>Homes and hostels across Sunyani</span>'
    : 'Waste collection for shops and offices<span>Same-day pickups and a receipt every time</span>';
  refreshQuote(); renderChips();
}
document.querySelectorAll('.cat button').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.cat===cust) return;
  if(isActive()) return bot('You can switch between home and business after this pickup.');
  addMsg('me', b.dataset.cat==='home' ? 'Home rate' : 'Business rate'); setCust(b.dataset.cat);
  bot(b.dataset.cat==='home'
    ? 'Home and hostel rate on. You get <b>10% off</b> every pickup.'
    : 'Business rate on. Standard prices, and a <b>receipt</b> is saved after every pickup for your records.');
}));
function placeClick(id){
  if(isActive()) return bot('You have a pickup in progress. Say <b>cancel pickup</b> to change it.');
  send(PLACES[id].site ? 'Take it to '+PLACES[id].name : 'Collect from '+PLACES[id].name);
}
$('#composer').addEventListener('submit',e=>{ e.preventDefault(); const i=$('#msg'); const v=i.value; i.value=''; send(v); });

/* ---------- Views ---------- */
const VIEWS={pickup:'#pickupView',history:'#histView',register:'#regView',collector:'#colView',admin:'#adminView'};
function showView(v){
  if(v==='admin' && !isAdmin) v='register';
  if(v==='collector' && !isCollectorMe) v='register';
  Object.keys(VIEWS).forEach(k=>{ $(VIEWS[k]).hidden = k!==v; });
  document.querySelectorAll('.tabs button').forEach(b=>{ const on=b.dataset.view===v; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
}
document.querySelectorAll('.tabs button').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));

/* ---------- Collector registration (shared database) ----------
   applications/<viewer id> : each collector's own application (only they and admins can read it)
   collectors/<viewer id>   : approved collectors, readable by everyone, written by admins only */
let db=null, myId=null, isAdmin=false, myApp=null, apps=[], regCols=[], formDirty=false;
const STATUS_LABEL={pending:'Under review',approved:'Approved',rejected:'Not approved',suspended:'Suspended'};
const YEARS_LABEL={'0':'under 1 yr','1':'1–3 yrs','3':'3–5 yrs','5':'5+ yrs'};
const stCls = s => STATUS_LABEL[s] ? s : 'pending';
const fmtDate = s => { const d=new Date(s); return isNaN(d)?'':d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}); };
const placeName = id => PLACES[id] ? PLACES[id].name : '';
const kindsText = a => (Array.isArray(a)?a:[]).map(s=>s==='recycle'?'recyclables':'general waste').join(' and ');

$('#rBase').innerHTML = PICK_IDS.map(id=>`<option value="${id}">${PLACES[id].name}</option>`).join('');
function notice(html){ const n=$('#regNotice'); n.innerHTML=html; n.hidden=!html; }
function formMsg(text,kind){ const m=$('#regMsg'); m.textContent=text; m.className='formmsg '+(kind||''); }
function setFormEnabled(on){ $('#regForm').querySelectorAll('input,select,button').forEach(x=>x.disabled=!on); }
function normPhone(v){
  let d=v.replace(/[^\d+]/g,'');
  if(d.startsWith('+233')) d='0'+d.slice(4); else if(d.startsWith('233')&&d.length===12) d='0'+d.slice(3);
  return /^0[235]\d{8}$/.test(d) ? d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6) : null;
}
function fillForm(a){
  $('#rName').value=a.name||''; $('#rPhone').value=a.phone||''; $('#rPlate').value=a.plate||'';
  if(PLACES[a.base]) $('#rBase').value=a.base;
  if(YEARS_LABEL[a.years]) $('#rYears').value=a.years;
  const s=Array.isArray(a.serves)?a.serves:[]; $('#rGeneral').checked=s.includes('general'); $('#rRecycle').checked=s.includes('recycle');
  $('#rLicence').checked=!!a.licence; $('#rCard').checked=!!a.ghanaCard; $('#rConduct').checked=!!a.conduct;
  photoData=safePhoto(a.photo); showPhoto(photoData);
  $('#regSubmit').textContent='Update application';
}
$('#regForm').addEventListener('input',()=>{ formDirty=true; });

/* Passport photo: cropped to 7:9 and shrunk to 280×360 on the device, then saved as a small JPEG. */
let photoData=null;
const PHOTO_RE=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const safePhoto = p => (typeof p==='string' && p.length<200000 && PHOTO_RE.test(p)) ? p : null;
function showPhoto(src){
  const b=$('#rPhotoBox');
  if(src){ b.innerHTML=`<img src="${src}" alt="Your passport photo">`; b.classList.add('has'); }
  else { b.innerHTML='<span>No photo yet</span>'; b.classList.remove('has'); }
}
function toPassport(file){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      const W=280,H=360,r=W/H; let sw=img.naturalWidth, sh=img.naturalHeight, sx=0, sy=0;
      if(!sw||!sh){ URL.revokeObjectURL(url); return rej(new Error('empty')); }
      if(sw/sh>r){ const nw=sh*r; sx=(sw-nw)/2; sw=nw; } else { const nh=sw/r; sy=(sh-nh)*0.3; sh=nh; }
      const c=document.createElement('canvas'); c.width=W; c.height=H; const ctx=c.getContext('2d');
      ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H); ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',0.82));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('unreadable')); };
    img.src=url;
  });
}
$('#rPhoto').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0]; e.target.value=''; if(!file) return;
  if(!/^image\//.test(file.type)) return formMsg('Choose an image file, like a JPG or PNG photo.','err');
  if(file.size>15*1024*1024) return formMsg('That photo is too large. Choose one under 15 MB.','err');
  try{ photoData=await toPassport(file); showPhoto(photoData); formDirty=true; formMsg(''); }
  catch(err){ formMsg('Could not read that photo. Try a JPG or PNG instead.','err'); }
});
$('#regForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('#rName').value.trim().replace(/\s+/g,' ');
  const phone=normPhone($('#rPhone').value);
  const plate=$('#rPlate').value.trim().toUpperCase().replace(/\s+/g,' ');
  const serves=[$('#rGeneral').checked&&'general',$('#rRecycle').checked&&'recycle'].filter(Boolean);
  const errs=[], photo=photoData||safePhoto(myApp&&myApp.photo);
  if(!photo) errs.push('Add a passport photo.');
  if(name.length<3) errs.push('Enter your full name.');
  if(!phone) errs.push('Enter a Ghana phone number, like 024 123 4567.');
  if(plate.length<5) errs.push('Enter your tricycle plate number.');
  if(!serves.length) errs.push('Choose general waste, recyclables or both.');
  if(!$('#rLicence').checked||!$('#rCard').checked||!$('#rConduct').checked) errs.push('Tick the three confirmations.');
  if(errs.length) return formMsg(errs.join(' '),'err');
  if(!db||!myId) return formMsg('Registration is not available in this view.','err');
  const btn=$('#regSubmit'); btn.disabled=true; formMsg('Sending…');
  const body={name:name.slice(0,80),phone,plate:plate.slice(0,20),base:$('#rBase').value,years:$('#rYears').value,serves,
    licence:true,ghanaCard:true,conduct:true,photo,status:'pending',submittedAt:new Date().toISOString()};
  try{
    const wasUpdate=!!myApp;
    await db.doc('applications/'+myId).set(body); formDirty=false;
    formMsg(wasUpdate?'Application updated. We will review it again.':'Application sent. We will call you to arrange verification.','ok');
  }catch(err){
    const c=err&&err.code;
    formMsg(c==='invalid_argument'||c==='not_granted'?'Your account is not allowed to send an application. Log out, log in again and try once more, or contact WasteTech.'
      :c==='quota_exceeded'?'Registration is full right now. Please contact WasteTech directly.'
      :'Could not send your application. Check your connection and try again.','err');
  }
  btn.disabled=false;
});

function renderMyApp(){
  const box=$('#myApp');
  const steps=`<ol class="steps"><li><b>Apply</b> with this form.</li><li><b>Verification.</b> We call you to check your Ghana Card, licence and tricycle in person.</li><li><b>Go live.</b> Once approved you appear in the app and start getting pickup requests.</li></ol>`;
  if(!myApp){
    box.innerHTML=`<h3>Your application</h3><p class="muted">${db&&myId?'You have not applied yet.':'Not available in this view.'}</p>${steps}`;
    return;
  }
  const st=stCls(myApp.status), live=regCols.some(r=>r.id===myId);
  const note = st==='approved' ? (live?'You are live. Customers can now be matched with you.':'Approved. You will appear in the app shortly.')
    : st==='rejected' ? 'Your application was not approved. Update your details and submit again, or contact WasteTech.'
    : st==='suspended' ? 'Your collector account is paused. Contact WasteTech to find out more.'
    : 'We will call you on the number above to arrange verification. You can edit and resubmit any time.';
  const myPhoto=safePhoto(myApp.photo);
  box.innerHTML=`<h3>Your application</h3>${myPhoto?`<img class="myphoto" src="${myPhoto}" alt="Your passport photo">`:''}<span class="status ${st}">${STATUS_LABEL[st]}</span>
    <dl class="facts"><dt>Name</dt><dd>${esc(String(myApp.name||''))}</dd><dt>Phone</dt><dd class="mono">${esc(String(myApp.phone||''))}</dd>
    <dt>Plate</dt><dd class="mono">${esc(String(myApp.plate||''))}</dd><dt>Starts at</dt><dd>${placeName(myApp.base)}</dd>
    <dt>Collects</dt><dd>${kindsText(myApp.serves)}</dd>
    <dt>Sent</dt><dd>${fmtDate(myApp.submittedAt)}</dd></dl><p class="muted">${note}</p>${st==='pending'?steps:''}`;
}

function renderAdmin(){
  if(!isAdmin) return;
  const live=new Set(regCols.map(r=>r.id));
  const order={pending:0,approved:1,suspended:2,rejected:3};
  const list=[...apps].sort((a,b)=>(order[stCls(a.status)]-order[stCls(b.status)]) || String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')));
  $('#appCount').textContent=apps.filter(a=>stCls(a.status)==='pending').length+' pending · '+regCols.length+' live';
  $('#appList').innerHTML = list.length ? list.map(a=>{
    const st=stCls(a.status), id=esc(a.id), isLive=live.has(a.id), ph=safePhoto(a.photo);
    return `<article class="app-row">${ph?`<img class="thumb" src="${ph}" alt="Photo of ${esc(String(a.name||'applicant'))}">`:'<div class="thumb" title="No photo"></div>'}<div class="app-main"><b>${esc(String(a.name||'Unnamed'))}</b><span class="status ${st}">${STATUS_LABEL[st]}</span>${isLive?'<span class="status approved">Live</span>':''}
      <div class="muted"><span class="mono">${esc(String(a.phone||''))}</span> · <span class="mono">${esc(String(a.plate||''))}</span> · starts at ${placeName(a.base)} · collects ${kindsText(a.serves)} · ${YEARS_LABEL[a.years]||''} collecting · sent ${fmtDate(a.submittedAt)}</div></div>
      <div class="app-actions">${isLive?`<button type="button" data-adm="remove" data-id="${id}">Remove</button>`:`<button type="button" class="ok" data-adm="approve" data-id="${id}">Approve</button>`}${!isLive&&st!=='rejected'?`<button type="button" data-adm="reject" data-id="${id}">Reject</button>`:''}</div></article>`;
  }).join('') : '<p class="muted">No applications yet. When collectors fill in the Become a collector form, they appear here.</p>';
}
$('#appList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-adm]'); if(!b||!db) return;
  const id=b.dataset.id, a=apps.find(x=>x.id===id); if(!a) return;
  b.disabled=true; $('#admMsg').textContent='';
  try{
    if(b.dataset.adm==='approve'){
      await db.doc('collectors/'+id).set({name:a.name,phone:a.phone,plate:a.plate,base:a.base,serves:a.serves,photo:safePhoto(a.photo),rating:5,trips:0,approvedAt:new Date().toISOString()});
      await db.doc('applications/'+id).update({status:'approved'});
    } else if(b.dataset.adm==='reject'){
      await db.doc('applications/'+id).update({status:'rejected'});
    } else if(b.dataset.adm==='remove'){
      await db.doc('collectors/'+id).delete();
      await db.doc('applications/'+id).update({status:'suspended'});
    }
  }catch(err){ $('#admMsg').textContent='That change did not save ('+((err&&err.code)||'error')+'). Try again.'; }
  b.disabled=false;
});

function rebuildFleet(){
  const prev={}; regFleet.forEach(f=>prev[f.id]=f);
  regFleet = regCols.map(r=>{
    const f = prev[r.id] || {id:r.id, busy:false, node:PLACES[r.base]?r.base:'central', trips:Number(r.trips)||0};
    const pos=posMap[r.id];
    f.online=!!(pos&&pos.online);
    if(pos && PLACES[pos.node] && !f.busy && String(pos.at||'')>(f.posAt||'')){ f.node=pos.node; f.posAt=String(pos.at||''); }
    return Object.assign(f,{n:esc(String(r.name||'Collector')), r:Number(r.rating)||5, p:esc(String(r.plate||'')), ph:esc(String(r.phone||'')),
      serves:Array.isArray(r.serves)&&r.serves.length?r.serves:['general','recycle'], photo:safePhoto(r.photo)});
  });
  const live = regFleet.filter(f=>f.online||f.busy);
  fleet = live.length ? live : demoFleet;
  drawIdle();
}

/* ---------- Collector mode ----------
   positions/<collector id> = { online, node, at, trail: [{node, at, kind: online|offline|checkin}] } */
let posMap={}, isCollectorMe=false, rmTouched=false, posWrite=Promise.resolve();
const MOVE_TXT={online:'Went online at',offline:'Went offline at',checkin:'Checked in at',
  assigned:'Took a pickup request, starting from',pickup:'Collected waste at',dropoff:'Emptied the load at'};
const fmtTime = s => { const d=new Date(s); return isNaN(d)?'':d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); };
const initials = n => String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase() || '?';
const myPos = () => (myId && posMap[myId]) || null;
function moveItem(e){
  const kind=MOVE_TXT[e.kind]?e.kind:'checkin';
  return `<li class="k-${kind}"><time>${fmtTime(e.at)}</time><i></i><span>${MOVE_TXT[kind]} <b>${PLACES[e.node].name}</b>${kind==='dropoff'&&e.fare?` · ${ghs(e.fare)}`:''}</span></li>`;
}
function rmMsg(t,k){ const m=$('#rmMsg'); m.textContent=t; m.className='formmsg '+(k||''); }
function renderCollectorMode(){
  isCollectorMe=!!(myId && regCols.some(r=>r.id===myId));
  $('#tabCollector').hidden=!isCollectorMe;
  if(!isCollectorMe){ if(!$('#colView').hidden) showView('register'); return; }
  const p=myPos(), online=!!(p&&p.online), me=regCols.find(r=>r.id===myId)||{};
  $('#rmStatus').textContent=online?'Online':'Offline';
  $('#rmStatus').className='status '+(online?'approved':'rejected');
  $('#rmToggle').textContent=online?'Go offline':'Go online';
  const sel=$('#rmPlace');
  if(!sel.options.length) sel.innerHTML=IDS.map(id=>`<option value="${id}">${PLACES[id].name}</option>`).join('');
  if(!rmTouched) sel.value=(p&&PLACES[p.node])?p.node:(PLACES[me.base]?me.base:'central');
  const today=dayKey(new Date());
  const trail=((p&&Array.isArray(p.trail))?p.trail:[]).filter(t=>t&&PLACES[t.node]&&dayKey(new Date(t.at))===today).reverse();
  $('#rmTrail').innerHTML = trail.length ? `<ol class="timeline">${trail.map(moveItem).join('')}</ol>`
    : '<p class="muted">Nothing recorded today. Go online and update your location as you move around.</p>';
}
function savePos(mutate, okText){
  if(!db||!myId) return rmMsg('Collector mode needs you to be logged in.','err');
  posWrite=posWrite.then(async()=>{
    const cur=myPos()?JSON.parse(JSON.stringify(myPos())):{online:false,trail:[]};
    if(!Array.isArray(cur.trail)) cur.trail=[];
    mutate(cur); cur.trail=cur.trail.slice(-80);
    posMap[myId]=cur; rebuildFleet(); renderCollectorMode(); renderTracking();
    await db.doc('positions/'+myId).set(cur);
    rmMsg(okText,'ok');
  }).catch(()=>rmMsg('Could not save. Check your connection and try again.','err'));
}
$('#rmPlace').addEventListener('change',()=>{ rmTouched=true; });
$('#rmToggle').addEventListener('click',()=>{
  const node=$('#rmPlace').value, on=!(myPos()&&myPos().online), at=new Date().toISOString();
  savePos(c=>{ c.online=on; c.node=node; c.at=at; c.trail.push({node,at,kind:on?'online':'offline'}); },
    on?`You are online at ${PLACES[node].name}. Nearby customers can now be matched with you.`:'You are offline. You will not get new pickups.');
});
$('#rmUpdate').addEventListener('click',()=>{
  const node=$('#rmPlace').value, at=new Date().toISOString();
  savePos(c=>{ c.node=node; c.at=at; c.trail.push({node,at,kind:'checkin'}); }, `Location updated: ${PLACES[node].name}.`);
});

/* ---------- Collector tracking (admin) ---------- */
let trkSel=null, trkDay=null, trkLayers=null;
function trackDirectory(){
  const dir={};
  regCols.forEach(r=>{ dir[r.id]={name:esc(String(r.name||'Collector')), photo:safePhoto(r.photo), demo:false}; });
  return dir;
}
function trackEvents(dir){
  const ev={};
  const push=(id,e)=>{ if(!e.at||!PLACES[e.node]) return; (ev[id]=ev[id]||[]).push(e); };
  Object.keys(posMap).forEach(id=>{ if(!dir[id]) return; const p=posMap[id];
    (Array.isArray(p&&p.trail)?p.trail:[]).forEach(t=>{ if(t) push(id,{at:String(t.at||''),node:t.node,kind:['online','offline','checkin'].includes(t.kind)?t.kind:'checkin'}); }); });
  allPickups.forEach(doc=>(Array.isArray(doc&&doc.recent)?doc.recent:[]).forEach(r=>{
    if(!r||typeof r.collector!=='string') return;
    const id=r.collector;
    if(!dir[id]){ const d=demoFleet.find(f=>f.id===id); if(!d) return; dir[id]={name:d.n, photo:null, demo:true}; }
    push(id,{at:String(r.assignedAt||r.at||''),node:r.collectorFrom,kind:'assigned'});
    push(id,{at:String(r.collectedAt||r.at||''),node:r.from,kind:'pickup'});
    push(id,{at:String(r.at||''),node:r.to,kind:'dropoff',fare:Number(r.fare)||0});
  }));
  Object.values(ev).forEach(a=>a.sort((x,y)=>x.at.localeCompare(y.at)));
  return ev;
}
function renderTracking(){
  if(!isAdmin) return;
  const svgT=$('#trkMap');
  if(!trkLayers){
    trkLayers=drawBase(svgT,false); trkLayers.dots=el('g',{},svgT);
    const now=new Date(); let o='';
    for(let i=0;i<7;i++){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i);
      o+=`<option value="${dayKey(d)}">${i===0?'Today':i===1?'Yesterday':d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</option>`; }
    $('#trkDay').innerHTML=o; trkDay=dayKey(now);
  }
  const dir=trackDirectory(), ev=trackEvents(dir);
  const isOn=id=>!!(posMap[id]&&posMap[id].online);
  const lastOf=id=>(ev[id]||[]).slice(-1)[0];
  const ids=Object.keys(dir).sort((a,b)=>(isOn(b)-isOn(a)) || String((lastOf(b)||{}).at||'').localeCompare(String((lastOf(a)||{}).at||'')));
  if(!trkSel||!dir[trkSel]) trkSel=ids[0]||null;
  $('#trkCount').textContent=`${ids.filter(isOn).length} online · ${ids.filter(id=>!dir[id].demo).length} approved`;
  $('#trkList').innerHTML = ids.length ? ids.map(id=>{
    const r=dir[id], last=lastOf(id), st=r.demo?['Demo','cash']:isOn(id)?['Online','approved']:['Offline','rejected'];
    return `<button type="button" class="trk-row ${id===trkSel?'on':''}" data-id="${esc(id)}">${r.photo?`<img class="ava" src="${r.photo}" alt="">`:`<span class="ava">${initials(r.name)}</span>`}
      <span><b>${r.name}</b><small>${last?`Last seen at ${PLACES[last.node].name} · ${fmtWhen(last.at)}`:'No movements yet'}</small></span><span class="status ${st[1]}">${st[0]}</span></button>`;
  }).join('') : '<p class="muted">No collectors to track yet. Approve collectors, and once they go online in Collector mode or make pickups, their movements appear here.</p>';

  const dots=trkLayers.dots; dots.innerHTML=''; trkLayers.route.innerHTML='';
  const dayEv=trkSel?(ev[trkSel]||[]).filter(e=>dayKey(new Date(e.at))===trkDay):[];
  let km=0;
  if(dayEv.length){
    const nodes=dayEv.map(e=>e.node).filter((n,i,a)=>i===0||n!==a[i-1]);
    let path=[nodes[0]];
    for(let i=1;i<nodes.length;i++){ const r=route(nodes[i-1],nodes[i]); km+=r.km; path=path.concat(r.path.slice(1)); }
    if(path.length>1) el('polyline',{points:polyPts(path),class:'trk-trail'},trkLayers.route);
    el('circle',{cx:PX(nodes[0]),cy:PY(nodes[0]),r:8,class:'trk-start'},trkLayers.route);
  }
  const perNode={};
  ids.forEach(id=>{
    const last=lastOf(id); if(!last) return;
    const k=perNode[last.node]=(perNode[last.node]||0)+1, x=PX(last.node)+(k-1)*24, y=PY(last.node)-24;
    const cls=id===trkSel?' sel':(!dir[id].demo&&!isOn(id))?' off':'';
    const g=el('g',{},dots); el('circle',{cx:x,cy:y,r:13,class:'trk-dot'+cls},g);
    const t=el('text',{x,y:y+4,'text-anchor':'middle',class:'trk-lab'+cls},g); t.textContent=initials(dir[id].name);
  });

  if(!trkSel){ $('#trkTitle').textContent=''; $('#trkTimeline').innerHTML=''; return; }
  const dayLabel=$('#trkDay').selectedOptions[0]?$('#trkDay').selectedOptions[0].textContent:'';
  $('#trkTitle').innerHTML=`${dir[trkSel].name} · ${esc(dayLabel)}`;
  const n=dayEv.filter(e=>e.kind==='dropoff').length;
  $('#trkTimeline').innerHTML = dayEv.length
    ? `<p class="trk-sum">${n} ${n===1?'pickup':'pickups'} · about ${km.toFixed(1)} km between recorded places</p><ol class="timeline">${dayEv.map(moveItem).join('')}</ol>`
    : '<p class="muted">No movements recorded for this collector on this day.</p>';
}
$('#trkList').addEventListener('click',e=>{ const b=e.target.closest('.trk-row'); if(!b) return; trkSel=b.dataset.id; renderTracking(); });
$('#trkDay').addEventListener('change',()=>{ trkDay=$('#trkDay').value; renderTracking(); });

function dataOff(msg){ notice(msg); setFormEnabled(false); renderMyApp(); renderHistory(); }
async function initData(){
  renderMyApp();
  const C=window.backend;
  if(!C||!C.use) return dataOff('Could not connect to the WasteTech database. Check your connection, then reload the page.');
  const [d,u]=await Promise.all([C.use('db').catch(()=>null), C.use('user').catch(()=>null)]);
  db=d;
  if(!db) return dataOff('Log in to register as a collector. Your application is tied to your account.');
  if(u){ myId=await u.id(); isAdmin=await u.canEdit(); }
  $('#tabAdmin').hidden=!isAdmin;
  db.collection('collectors').onSnapshot(s=>{ regCols=s.docs.map(x=>Object.assign({id:x.id},x.data())); rebuildFleet(); renderAdmin(); renderMyApp(); renderCollectorMode(); renderTracking(); },
    e=>console.warn('collectors feed stopped:',e&&e.code));
  db.collection('positions').onSnapshot(s=>{ const m={}; s.docs.forEach(x=>{ m[x.id]=x.data(); }); posMap=m; rebuildFleet(); renderCollectorMode(); renderTracking(); },
    e=>console.warn('positions feed stopped:',e&&e.code));
  if(myId){
    db.doc('applications/'+myId).onSnapshot(s=>{ myApp=s.exists?s.data():null; renderMyApp(); if(myApp&&!formDirty) fillForm(myApp); },
      e=>console.warn('application feed stopped:',e&&e.code));
  } else {
    dataOff('Log in to register as a collector. Your application is tied to your account.');
  }
  if(isAdmin){
    db.collection('applications').onSnapshot(s=>{ apps=s.docs.map(x=>Object.assign({id:x.id},x.data())); renderAdmin(); },
      e=>console.warn('applications feed stopped:',e&&e.code));
    db.collection('pickups').onSnapshot(s=>{ allPickups=s.docs.map(x=>x.data()); renderStats(); renderTracking(); },
      e=>console.warn('pickups feed stopped:',e&&e.code));
    renderAdmin(); renderStats(); renderTracking();
    if(location.hash==='#admin') showView('admin');
  }
  if(myId){
    db.doc('pickups/'+myId).onSnapshot(s=>{ if(!s.metadata.hasPendingWrites){ myPickups=s.exists?s.data():null; pickupsLoaded=true; renderHistory(); } },
      e=>console.warn('my pickups feed stopped:',e&&e.code));
    db.doc('data/users/'+myId+'/profile').get().then(s=>{
      const m=s.exists&&s.data().momo;
      if(m&&MOMO_NETS[m.network]&&normPhone(String(m.number||''))) momoSaved={network:m.network,number:normPhone(String(m.number))};
    }).catch(()=>{});
  }
  renderMyApp(); renderHistory();
}

/* ---------- Pickup records ----------
   pickups/<customer id> = { days: { "YYYY-MM-DD": {pickups, home, business, general, recycle, cash, momo, revenue, fees} }, recent: [last 100] }
   Each customer writes only their own document; admins read them all for the daily chart. */
let myPickups=null, allPickups=[], pickWrite=Promise.resolve();
const dayKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const blankDay = () => ({pickups:0,home:0,business:0,general:0,recycle:0,cash:0,momo:0,revenue:0,fees:0});
/* WasteTech keeps 10% of every price as a service charge, rounded to the pesewa; the collector gets the rest. */
const SERVICE_RATE = 0.10;
const SERVICE_PCT = Math.round(SERVICE_RATE*100)+'%';
function serviceFee(fare){ return Math.round(fare*SERVICE_RATE*100)/100; }
function savePickups(mutate){
  if(!db||!myId) return;
  pickWrite = pickWrite.then(async()=>{
    const cur = myPickups ? JSON.parse(JSON.stringify(myPickups)) : {};
    if(!cur.days||typeof cur.days!=='object') cur.days={};
    if(!Array.isArray(cur.recent)) cur.recent=[];
    mutate(cur); cur.updatedAt=new Date().toISOString();
    myPickups=cur; renderHistory();
    await db.doc('pickups/'+myId).set(cur);
  }).catch(e=>console.warn('pickup not saved:',e&&e.code));
}
function recordPickup(r){
  savePickups(cur=>{
    const d=cur.days[r.day]||(cur.days[r.day]=blankDay());
    d.pickups=(d.pickups||0)+1; d[r.cust]=(d[r.cust]||0)+1; d[r.kind]=(d[r.kind]||0)+1; d[r.pay]=(d[r.pay]||0)+1;
    d.revenue=Math.round(((d.revenue||0)+r.fare)*100)/100;
    d.fees=Math.round(((d.fees||0)+r.fee)*100)/100;
    cur.recent.unshift(r); cur.recent=cur.recent.slice(0,100);
  });
}
function updatePickup(id,patch){ savePickups(cur=>{ const r=cur.recent.find(x=>x.id===id); if(r) Object.assign(r,patch); }); }

/* ---------- My pickups ---------- */
let pickupsLoaded=false;
const PAY_LABEL={paid:['Paid by MoMo','approved'],cash:['Cash','cash'],awaiting:['MoMo not completed','pending'],failed:['MoMo failed','rejected']};
const fmtWhen = s => { const d=new Date(s); return isNaN(d)?'':d.toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
function cleanPickup(r){
  if(!r||typeof r!=='object'||!PLACES[r.from]||!PLACES[r.to]) return null;
  const status=PAY_LABEL[r.status]?r.status:(r.pay==='momo'?'awaiting':'cash');
  const size=SIZE_NAME[r.size]?r.size:'bag';
  return {id:String(r.id||''), at:String(r.at||''), from:r.from, to:r.to, cust:r.cust==='business'?'business':'home', kind:r.kind==='recycle'?'recycle':'general',
    size, qty:Math.max(1,Math.min(MAX_BAGS,Number(r.qty)||1)), fare:Number(r.fare)||0, fee:Number.isFinite(Number(r.fee))?Number(r.fee):0,
    status, network:MOMO_NETS[r.network]?r.network:null, ref:String(r.ref||'')};
}
function renderHistory(){
  const list=$('#tripList'); if(!list) return;
  if(!db||!myId){
    $('#tripTiles').innerHTML=''; $('#tripCount').textContent='';
    list.innerHTML='<p class="muted">Log in to see your pickups. Each pickup is saved to your account once its disposal is confirmed.</p>'; return;
  }
  if(!pickupsLoaded&&!myPickups){ list.innerHTML='<p class="muted">Loading your pickups…</p>'; return; }
  const all=((myPickups&&Array.isArray(myPickups.recent))?myPickups.recent:[]).map(cleanPickup).filter(Boolean);
  const mKey=dayKey(new Date()).slice(0,7);
  const spent=all.reduce((a,t)=>a+t.fare,0), month=all.filter(t=>dayKey(new Date(t.at)).slice(0,7)===mKey), rec=all.filter(t=>t.kind==='recycle').length;
  $('#tripCount').textContent=all.length+(all.length===1?' pickup':' pickups')+(all.length>=100?' (latest 100)':'');
  $('#tripTiles').innerHTML=[['Pickups',all.length,'saved to your account'],['Spent',ghs(spent),'on all saved pickups'],
    ['This month',ghs(month.reduce((a,t)=>a+t.fare,0)),month.length+(month.length===1?' pickup':' pickups')],
    ['Recycled',rec,rec===1?'pickup of recyclables':'pickups of recyclables']].map(t=>`<div class="tile"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></div>`).join('');
  const q=$('#tripSearch').value.trim().toLowerCase(), pay=$('#tripPay').value, kind=$('#tripKind').value;
  const shown=all.filter(t=>{
    if(pay&&t.status!==pay) return false;
    if(kind&&t.kind!==kind) return false;
    if(!q) return true;
    return [PLACES[t.from].name,PLACES[t.to].name,fmtWhen(t.at),t.ref,t.network?MOMO_NETS[t.network].name:'',PAY_LABEL[t.status][0],KIND_NAME[t.kind]].join(' ').toLowerCase().includes(q);
  });
  if(!all.length){ list.innerHTML='<p class="muted">No pickups yet. Request one on the <b>Request pickup</b> tab and it appears here once the waste is disposed.</p>'; return; }
  if(!shown.length){ list.innerHTML='<p class="muted">No pickups match that search. Clear the search or change the filters.</p>'; return; }
  list.innerHTML=shown.map(t=>{
    const [pl,pc]=PAY_LABEL[t.status];
    const momo=t.status==='paid'&&t.network?` · ${MOMO_NETS[t.network].name}${t.ref?` · ref <span class="mono">${esc(t.ref)}</span>`:''}`:'';
    return `<article class="trow"><div><div class="where">${PLACES[t.from].name}<span>→</span>${PLACES[t.to].name}</div>
      <div class="meta">${fmtWhen(t.at)}<br><span class="status ${pc}">${pl}</span>${KIND_NAME[t.kind]} · ${amountText(t.size,t.qty)} · ${t.cust==='home'?'Home rate':'Business rate'}${momo}<br>Includes ${ghs(t.fee)} service charge · collector received ${ghs(Math.round((t.fare-t.fee)*100)/100)}</div></div>
      <div class="side-r"><span class="fare">${ghs(t.fare)}</span><button type="button" class="again" data-id="${esc(t.id)}">Request again</button></div></article>`;
  }).join('');
}
['#tripSearch','#tripPay','#tripKind'].forEach(s=>$(s).addEventListener('input',renderHistory));
$('#tripList').addEventListener('click',e=>{
  const b=e.target.closest('.again'); if(!b) return;
  const t=((myPickups&&myPickups.recent)||[]).map(cleanPickup).filter(Boolean).find(x=>x.id===b.dataset.id); if(!t||PLACES[t.from].site) return;
  showView('pickup');
  if(isActive()) return bot('You have a pickup in progress. Say <b>cancel pickup</b> first if you want to request another.');
  state='idle'; draft.pickup=t.from; draft.size=t.size; draft.qty=t.size==='bag'?t.qty:draft.qty; draft.kind=t.kind;
  addMsg('me',`Request again: ${amountText(t.size,t.qty)} from ${PLACES[t.from].name}`);
  afterDraft(false);
});

function saveMomo(){ if(db&&myId) db.doc('data/users/'+myId+'/profile').set({momo:momoSaved}).catch(()=>{}); }

function renderStats(){
  const box=$('#pickStats'); if(!box||!isAdmin) return;
  const now=new Date(), keys=[];
  for(let i=13;i>=0;i--){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()-i); keys.push({k:dayKey(d),d}); }
  const agg={}; keys.forEach(({k})=>agg[k]=blankDay());
  allPickups.forEach(doc=>{ const ds=(doc&&doc.days)||{}; keys.forEach(({k})=>{ const v=ds[k]; if(v&&typeof v==='object') Object.keys(agg[k]).forEach(f=>agg[k][f]+=safeNum(v[f])); }); });
  const last7=keys.slice(-7).map(x=>agg[x.k]), sum=f=>last7.reduce((a,v)=>a+v[f],0);
  const today=agg[keys[13].k], p7=sum('pickups'), rc7=sum('recycle'), rev7=Math.round(sum('revenue')*100)/100, fee7=Math.round(sum('fees')*100)/100;
  const tiles=[['Today',today.pickups,today.pickups===1?'pickup':'pickups'],['Last 7 days',p7,p7===1?'pickup':'pickups'],
    ['Takings, last 7 days',ghs(rev7),`incl. ${ghs(fee7)} service charge`],['Recyclables',p7?Math.round(rc7/p7*100)+'%':'–','of pickups, last 7 days']];
  const top=Math.max(4,Math.ceil(Math.max(...keys.map(x=>agg[x.k].pickups))/2)*2);
  const W=700,H=220,L=34,B=28,T=12, cw=(W-L-8)/14, bw=Math.min(28,cw*0.6), y=v=>H-B-(v/top)*(H-B-T);
  let g='';
  [0,top/2,top].forEach(v=>{ g+=`<line x1="${L}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L-8}" y="${y(v)+4}" text-anchor="end" class="axis">${v}</text>`; });
  keys.forEach(({k,d},i)=>{
    const a=agg[k], cx=L+cw*i+cw/2, x=cx-bw/2;
    let segs='';
    if(a.general) segs+=`<rect x="${x}" y="${y(a.general)}" width="${bw}" height="${y(0)-y(a.general)}" rx="3" class="b-gen"/>`;
    if(a.recycle){ const h=y(0)-y(a.recycle)-(a.general?2:0); if(h>0) segs+=`<rect x="${x}" y="${y(a.general+a.recycle)}" width="${bw}" height="${h}" rx="3" class="b-rec"/>`; }
    if(i===13&&a.pickups) segs+=`<text x="${cx}" y="${y(a.pickups)-6}" text-anchor="middle" class="val">${a.pickups}</text>`;
    g+=`<g class="bar-g" data-k="${k}"><rect x="${L+cw*i}" y="${T}" width="${cw}" height="${H-B-T}" class="hit"/>${segs}<text x="${cx}" y="${H-8}" text-anchor="middle" class="axis${i===13?' strong':''}">${i===13?'Today':d.getDate()}</text></g>`;
  });
  const fmtDay=d=>d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
  const rows=[...keys].reverse().map(({k,d})=>{ const a=agg[k]; return `<tr><td>${fmtDay(d)}</td><td>${a.pickups}</td><td>${a.general}</td><td>${a.recycle}</td><td>${a.home}</td><td>${a.business}</td><td>${a.cash}</td><td>${a.momo}</td><td>${ghs(a.revenue)}</td><td>${ghs(a.fees)}</td><td>${ghs(Math.round((a.revenue-a.fees)*100)/100)}</td></tr>`; }).join('');
  box.innerHTML=`<div class="tiles">${tiles.map(t=>`<div class="tile"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--brand)"></i>General waste</span><span><i style="background:var(--leaf)"></i>Recyclables</span></div>
    <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Completed pickups per day for the last 14 days">${g}</svg><div class="tip" hidden></div></div>
    ${p7||allPickups.length?'':'<p class="muted">No completed pickups yet. Each pickup is counted here once its disposal is confirmed.</p>'}
    <details><summary>Show as table</summary><div class="tablewrap"><table class="days"><thead><tr><th>Day</th><th>Pickups</th><th>General</th><th>Recyclables</th><th>Homes</th><th>Businesses</th><th>Cash</th><th>MoMo</th><th>Takings</th><th>Service charge</th><th>To collectors</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
  const chart=box.querySelector('.chart'), tip=chart.querySelector('.tip');
  chart.addEventListener('mousemove',e=>{
    const gEl=e.target.closest('.bar-g'); if(!gEl){ tip.hidden=true; return; }
    const kd=keys.find(x=>x.k===gEl.dataset.k), a=agg[kd.k], r=chart.getBoundingClientRect();
    tip.innerHTML=`<b>${fmtDay(kd.d)}</b><br>${a.pickups} ${a.pickups===1?'pickup':'pickups'} · ${a.general} general · ${a.recycle} recyclables<br>${ghs(a.revenue)} takings · ${ghs(a.fees)} service charge<br>${a.momo} MoMo, ${a.cash} cash`;
    tip.style.left=Math.min(Math.max(e.clientX-r.left,90),r.width-90)+'px'; tip.style.top=(e.clientY-r.top-10)+'px'; tip.hidden=false;
  });
  chart.addEventListener('mouseleave',()=>{ tip.hidden=true; });
}

drawMap(); renderChips();
if(location.hash==='#register') showView('register');
/* ---------- Security hardening (lookup tables) ----------
   Stored data is written by other people, so a place, status or network name could be anything.
   Without a prototype, keys like "constructor" or "__proto__" never match a table entry. */
[PLACES,MOMO_NETS,VIEWS,STATUS_LABEL,YEARS_LABEL,MOVE_TXT,PAY_LABEL,MIN,MIN_DISC,SIZE_NAME,KIND_NAME,NUMW].forEach(o=>Object.setPrototypeOf(o,null));
/* Counts from other people's records: only finite, non-negative numbers, capped, reach the stats. */
function safeNum(n){ n=Number(n); return Number.isFinite(n)&&n>0 ? Math.min(n,1e6) : 0; }
initData();
bot('Akwaaba! I am Efua, your WasteTech assistant for Sunyani and nearby towns. Pick <b>Home &amp; hostel</b> (10% off) or <b>Shop &amp; business</b> above, then tell me where your waste is, like <i>Collect 2 bags from Penkwase</i>, or tap a place on the map.',200);
})();
