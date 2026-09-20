const ROOM_FLOOR={
  BOYS_BOARDING:0,GIRLS_BOARDING:0,BACK_COURT:0,CAN:0,MIDDLE_PITCH:0,GYM:0,POOL:0,
  A002:0,A005:0,A007:0,A008:0,A009:0,A010:0,A015:0,A016:0,A020:0,A021:0,A023:0,A024:0,
  LIBRARY:0,RECEPTION:0,BASKETBALL:0,FF:0,OFFSITE:0,
  A102:1,A103:1,A104:1,A105:1,A106:1,A107:1,A108:1,A109:1,A113:1,
  A115:1,A116:1,A117:1,A118:1,A120:1,A121:1,A122:1,
  B101a:1,B101b:1,B102a:1,B102b:1,B102c:1,AUDITORIUM:1,
  A201:2,A202:2,A203a:2,A203b:2,A204:2,A205:2,A209:2,DRAMA:2,
  A211:2,A212:2,A213:2,A215:2,A216:2,A217:2,A218:2,A219:2,
  A220:2,A221:2,A222:2,A222b:2,MPH:2,PAA:2,AUD_BALCONY:2,C201:2,C202:2,C203:2,
  A304:3,A305:3,A306:3,A308:3,A309:3,A310:3,A311:3,
  A316:3,A317:3,A320:3,A322:3,C301:3,C302:3,C303:3,C304:3,
};

const ROOM_INFO={
  BOYS_BOARDING:'Boys Boarding',GIRLS_BOARDING:'Girls Boarding',BACK_COURT:'Back Court',
  CAN:'Canteen & Dining Hall',MIDDLE_PITCH:'Middle Pitch',GYM:'Gym',POOL:'Swimming Pool',
  A002:'A002 — Sixth Form Centre',A005:'A005 — Dance Hall / Lecture Room',
  A007:'A007/A006 — PE Storage',A008:'A008 — PE Office',A009:'A009 — Security',
  A010:'A010 — School Shop',A015:'A015 — Meeting Room',A016:'A016 — Management Offices',
  A020:'A020 — Staff Lounge',A021:'A021 — Medical Centre',
  A023:'A023 — Recital Room / ECA Jazz Band',A024:'A024 — School Office',
  LIBRARY:'Library — Learning Resource Centre',RECEPTION:'Reception & Lobby',
  BASKETBALL:'Basketball Court',FF:'Front Pitch (FF) — Outdoor PE',
  OFFSITE:'Off Site — External Activity',
  A102:'A102',A103:'A103',A104:'A104',A105:'A105',A106:'A106',A107:'A107',
  A108:'A108 — Music Room',A109:'A109 — Computing Room',A113:'A113 — Humanities',
  A115:'A115 — Mathematics',A116:'A116 — Mathematics',A117:'A117 — Mathematics',
  A118:'A118 — Mathematics',A120:'A120 — Mathematics',
  A121:'A121 — KS3 Form Room',A122:'A122 — Mathematics',
  B101a:'B101a — Art Studio',B101b:'B101b — Art Studio',
  B102a:'B102a — Design Technology',B102b:'B102b — Design Technology',
  B102c:'B102c — Design Technology',AUDITORIUM:'Auditorium',
  A201:'A201',A202:'A202',A203a:'A203a',A203b:'A203b',
  A204:'A204 — Bahasa Malaysia',A205:'A205 — Spanish',
  A209:'A209 — Drama Studio',DRAMA:'Drama Studio (A209)',
  A211:'A211',A212:'A212',A213:'A213 — PSHE / Humanities',
  A215:'A215 — Mandarin',A216:'A216',A217:'A217',A218:'A218 — EAL',A219:'A219',
  A220:'A220',A221:'A221 — English Room',A222:'A222',A222b:'A222b',
  MPH:'MPH — Multi-Purpose Hall',PAA:'PAA Room / Green Room',AUD_BALCONY:'Auditorium Balcony',
  C201:'C201',C202:'C202',C203:'C203 / C204',
  A304:'A304',A305:'A305',A306:'A306 — Biology Lab',A308:'A308',
  A309:'A309',A310:'A310',A311:'A311 — Physics Lab',A316:'A316',
  A317:'A317 — Chemistry Lab',A320:'A320 — Biology Lab 2',A322:'A322 — Physics Lab 2',
  C301:'C301',C302:'C302',C303:'C303',C304:'C304',
};

const DAYS=['Mon','Tue','Wed','Thu','Fri'];

const FLOOR_NAMES=['Ground Floor','1st Floor','2nd Floor','3rd Floor'];

/* ==========================================================
   Map engine — floors, pan/zoom, highlighting, timetable render.
   Data arrives from the server via window.__TIMETABLE__.
   All DOM writes use textContent (never innerHTML) — ASVS V1.3
   ========================================================== */

const PERIODS=[
  {id:'F', lbl:'Form Time', s:'08:00', e:'08:40', slot:'F'},
  {id:'P1',lbl:'Period 1',  s:'08:40', e:'09:30', slot:'P1'},
  {id:'P2',lbl:'Period 2',  s:'09:30', e:'10:20', slot:'P2'},
  {id:'BK',lbl:'Break',     s:'10:20', e:'10:40', brk:true},
  {id:'P3',lbl:'Period 3',  s:'10:40', e:'11:30', slot:'P3'},
  {id:'P4',lbl:'Period 4',  s:'11:30', e:'12:20', slot:'P4'},
  {id:'LN',lbl:'Lunch',     s:'12:20', e:'13:10', brk:true},
  {id:'P5',lbl:'Period 5',  s:'13:10', e:'14:00', slot:'P5'},
  {id:'P6',lbl:'Period 6',  s:'14:00', e:'14:50', slot:'P6'},
  {id:'EC',lbl:'ECA',       s:'15:00', e:'16:00', slot:'ECA', eca:true},
];

let isWeekB=false, dayIdx=0, currentFloor=0;
let transforms=[{s:1,tx:0,ty:0},{s:1,tx:0,ty:0},{s:1,tx:0,ty:0},{s:1,tx:0,ty:0}];
let lastAutomaticRoomKey='';
let focusedRoom=null;
let userMovedMap=false;

const $ = (id)=>document.getElementById(id);
const setText=(id,v)=>{const el=$(id); if(el) el.textContent = v ?? '';};

function makeLucideIcon(pathData){
  const ns='http://www.w3.org/2000/svg';
  const icon=document.createElementNS(ns,'svg');
  icon.setAttribute('class','ui-icon');
  icon.setAttribute('viewBox','0 0 24 24');
  icon.setAttribute('aria-hidden','true');
  icon.setAttribute('focusable','false');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',pathData);
  icon.appendChild(path);
  return icon;
}

function toMin(t){const[h,m]=String(t).split(':').map(Number);return h*60+m;}
function nowMin(){const n=new Date();return n.getHours()*60+n.getMinutes();}
function todayIdx(){const d=new Date().getDay();return (d>=1&&d<=5)?d-1:-1;}
function curPeriod(){const m=nowMin();return PERIODS.find(p=>m>=toMin(p.s)&&m<toMin(p.e))||null;}
function week(){ const t=window.__TIMETABLE__; return !t?null:(isWeekB?t.weekB:t.weekA); }

/* ---------------- clock ---------------- */
function updateClock(){
  const n=new Date(), h=n.getHours();
  setText('clock-hm', (h%12||12)+':'+String(n.getMinutes()).padStart(2,'0'));
  setText('clock-ampm', h>=12?'PM':'AM');
  const wd=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  setText('date-display', wd[n.getDay()]+', '+n.toLocaleDateString('en-MY',{day:'numeric',month:'long',year:'numeric'}));
  const cp=curPeriod(), b=$('p-badge');
  if(b){
    if(cp){ b.textContent = cp.eca?'ECA Time':cp.lbl; b.className='p-pill'+((cp.brk||cp.eca)?' brk':''); }
    else { const m=nowMin(); b.textContent = m<toMin('08:00')?'Before School':m>=toMin('16:00')?'After School':'—'; b.className='p-pill brk'; }
  }
  updateHighlight();
}

/* ---------------- floors ---------------- */
function switchFloor(f){
  const cur=$('floor-'+currentFloor); if(cur) cur.classList.remove('active');
  document.querySelectorAll('.floor-btn').forEach(b=>b.classList.toggle('active', Number(b.dataset.floor)===f));
  currentFloor=f;
  const nxt=$('floor-'+f); if(nxt) nxt.classList.add('active');
  if(!transforms[f].ready)resetView();else applyT();
}

/* ---------------- pan & zoom ---------------- */
function svgEl(){ return $('svg-'+currentFloor); }
function applyT(){ const t=transforms[currentFloor], s=svgEl();
  if(s) s.style.transform=`translate(${t.tx}px,${t.ty}px) scale(${t.s})`; }
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function zoom(f,anchorX,anchorY){
  const vp=$('vp'),t=transforms[currentFloor];if(!vp)return;
  const r=vp.getBoundingClientRect();
  const x=Number.isFinite(anchorX)?anchorX:r.width/2;
  const y=Number.isFinite(anchorY)?anchorY:r.height/2;
  const nextScale=clamp(t.s*f,.1,6),factor=nextScale/t.s;
  t.tx=x-(x-t.tx)*factor;t.ty=y-(y-t.ty)*factor;t.s=nextScale;applyT();
}
function resetView(){
  const vp=$('vp'),svg=svgEl();if(!vp||!svg||!vp.clientWidth||!vp.clientHeight)return;
  const bounds=svg.viewBox.baseVal,t=transforms[currentFloor];
  t.s=Math.min((vp.clientWidth-32)/bounds.width,(vp.clientHeight-32)/bounds.height,1);
  t.tx=(vp.clientWidth-bounds.width*t.s)/2-bounds.x*t.s;
  t.ty=(vp.clientHeight-bounds.height*t.s)/2-bounds.y*t.s;
  t.ready=true;focusedRoom=null;userMovedMap=false;applyT();
}

function focusRoom(el,fl){
  const vp=$('vp'),svg=$('svg-'+fl);if(!vp||!svg||!el)return;
  const viewport=vp.getBoundingClientRect(),room=el.getBBox(),t=transforms[fl];
  if(!viewport.width||!viewport.height||!room.width||!room.height||!t.s)return;

  // The SVG has explicit dimensions matching its viewBox, so one SVG unit is
  // one untransformed CSS pixel on desktop and phone, at every orientation.
  const viewBox=svg.viewBox.baseVal;
  const left=room.x-viewBox.x,top=room.y-viewBox.y;
  const width=room.width,height=room.height;

  // Keep a comfortable amount of map visible around the selected room.
  const framedWidth=Math.min(viewport.width*.56,clamp(viewport.width*.34,180,380));
  const framedHeight=Math.min(viewport.height*.42,clamp(viewport.height*.30,90,260));
  const nextScale=clamp(Math.min(framedWidth/width,framedHeight/height),.05,4);
  const centreX=left+width/2,centreY=top+height/2;
  t.s=nextScale;
  t.tx=viewport.width/2-centreX*nextScale;
  t.ty=viewport.height/2-centreY*nextScale;

  t.ready=true;focusedRoom=el;userMovedMap=false;applyT();
}

/* ---------------- highlighting ---------------- */
function clearHighlight(){
  document.querySelectorAll('.room').forEach(r=>{
    r.style.fill='';r.style.stroke='';r.style.strokeWidth='';r.classList.remove('pulsing');});
}
function pulseRoom(id, silent, shouldFocus=true){
  if(!silent)document.dispatchEvent(new CustomEvent('map:room-selected',{detail:{room:id}}));
  clearHighlight();
  const lookup = (id==='A209' && $('DRAMA')) ? 'DRAMA' : id;
  const fl = ROOM_FLOOR[lookup] ?? ROOM_FLOOR[id] ?? currentFloor;
  if(fl!==currentFloor) switchFloor(fl);
  const el=$(lookup)||$(id);
  if(!el){ if(!silent){ setText('lcr', ROOM_INFO[id]||id); setText('floor-tag', FLOOR_NAMES[fl]||''); } return; }
  el.style.fill='#f4c400'; el.style.stroke='#b8920a'; el.style.strokeWidth='3';
  el.classList.add('pulsing');
  if(shouldFocus)focusRoom(el,fl);
  if(!silent){ setText('lcr', ROOM_INFO[id]||id);setText('lct','Selected classroom'); setText('floor-tag', FLOOR_NAMES[fl]||''); }
}

function updateHighlight(){
  const w=week(); if(!w) return;
  const di=todayIdx(),cp=curPeriod();
  const day=w[DAYS[di]]||{},lesson=cp?day[cp.slot]:null;
  const automaticRoomKey=`${new Date().toDateString()}:${isWeekB?'B':'A'}:${di}:${cp?.id??(nowMin()<480?'before':'after')}:${lesson?.room??''}`;
  // A clock refresh must not switch floors, steal a user's camera position,
  // clear a manually selected room or rebuild the schedule under their finger.
  if(automaticRoomKey===lastAutomaticRoomKey)return;
  lastAutomaticRoomKey=automaticRoomKey;
  renderList();
  if(di<0){setText('lcr','Weekend · No Classes'); setText('lct','Explore the map or open your timetable'); setText('floor-tag',''); clearHighlight(); return; }
  if(!cp){ const m=nowMin();
    setText('lcr', m<toMin('08:00')?'Before School':m>=toMin('16:00')?'After School':'—');
    setText('lct',''); setText('floor-tag',''); clearHighlight(); return; }
  if(cp.brk){setText('lcr', cp.lbl+' · '+cp.s+'–'+cp.e); setText('lct','Enjoy your break!');
    setText('floor-tag',''); clearHighlight(); return; }
  if(!lesson){setText('lcr','No class'); setText('lct',''); setText('floor-tag',''); clearHighlight(); return; }
  setText('lcr', lesson.room==='OFFSITE' ? 'Off Site — External Activity' : (ROOM_INFO[lesson.room]||lesson.room));
  setText('lct', [lesson.subject, lesson.teacher].filter(Boolean).join(' · '));
  setText('floor-tag', FLOOR_NAMES[ROOM_FLOOR[lesson.room]] || '');
  pulseRoom(lesson.room,true);
}

/* ---------------- schedule list ---------------- */
function buildDayTabs(){
  const tabs=$('day-tabs'); if(!tabs) return;
  tabs.textContent='';
  const t=todayIdx(); dayIdx = t>=0 ? t : 0;
  DAYS.forEach((d,i)=>{
    const el=document.createElement('button');el.type='button';
    el.setAttribute('aria-pressed',String(i===dayIdx));
    el.className='day-tab'+(i===dayIdx?' active':'');
    el.textContent=d;
    el.addEventListener('click',()=>{
      dayIdx=i;
      tabs.querySelectorAll('.day-tab').forEach((x,xi)=>{x.classList.toggle('active',xi===i);x.setAttribute('aria-pressed',String(xi===i));});
      renderList();
    });
    tabs.appendChild(el);
  });
  renderList();
}

function renderList(){
  const w=week(), list=$('p-list'); if(!w||!list) return;
  const day=w[DAYS[dayIdx]]||{};
  list.textContent='';
  const cp=curPeriod(), isToday=dayIdx===todayIdx();
  let ecaShown=false;

  PERIODS.forEach(p=>{
    if(p.brk){
      const d=document.createElement('div');
      d.className='brk-div'; d.textContent=`— ${p.lbl}  ${p.s}–${p.e} —`;
      list.appendChild(d); return;
    }
    const lesson=day[p.slot]; if(!lesson) return;
    if(p.eca && !ecaShown){
      const hd=document.createElement('div');
      hd.className='eca-hdr'; hd.textContent=`— ECA  ${p.s}–${p.e} —`;
      list.appendChild(hd); ecaShown=true;
    }
    const row=document.createElement('button');row.type='button';
    row.setAttribute('aria-label',`${lesson.subject}, ${lesson.room}, ${lesson.start||p.s} to ${lesson.end||p.e}. Show on map`);
    row.className='p-row'+((isToday&&cp&&cp.id===p.id)?' now':'');

    const num=document.createElement('div');
    num.className='pnum';
    if(p.eca){
      num.appendChild(makeLucideIcon('M11.53 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.59 1.16l5.17.76a.53.53 0 0 1 .29.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0l-4.62 2.43a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.91l5.17-.75a2.12 2.12 0 0 0 1.6-1.16Z'));
    } else {
      num.textContent = p.id==='F'?'F':p.id.replace('P','');
    }

    const info=document.createElement('div'); info.className='pinfo';
    const t1=document.createElement('div'); t1.className='ptime';
    t1.textContent=(lesson.start||p.s)+'–'+(lesson.end||p.e);
    const t2=document.createElement('div'); t2.className='plbl'; t2.textContent=lesson.subject||'';
    const t3=document.createElement('div'); t3.className='pteach'; t3.textContent=lesson.teacher||'';
    info.append(t1,t2,t3);

    const rm=document.createElement('div'); rm.className='proom';
    rm.textContent = lesson.room==='OFFSITE' ? 'Off Site' : lesson.room;

    row.append(num,info,rm);
    row.addEventListener('click',()=>{ if(lesson.room) pulseRoom(lesson.room); });
    list.appendChild(row);
  });
}

/* ---------------- wiring ---------------- */
function initMap(){
  document.querySelectorAll('.floor-map svg').forEach(svg=>{
    svg.setAttribute('width',svg.viewBox.baseVal.width);
    svg.setAttribute('height',svg.viewBox.baseVal.height);
  });
  document.querySelectorAll('.floor-btn').forEach(b=>
    b.addEventListener('click',()=>switchFloor(Number(b.dataset.floor))));
  $('zin') ?.addEventListener('click',()=>{userMovedMap=true;zoom(1.2);});
  $('zout')?.addEventListener('click',()=>{userMovedMap=true;zoom(0.83);});
  $('zrst')?.addEventListener('click',resetView);

  const wt=$('week-toggle');
  wt?.addEventListener('change',e=>{
    isWeekB=e.target.checked;
    setText('wk-name', isWeekB?'Week B':'Week A');
    setText('wk-sub',  isWeekB?'Timetable Week 2':'Timetable Week 1');
    setText('tt-wk',   '— '+(isWeekB?'Week B':'Week A'));
    $('lbl-a').className='wk-letter'+(isWeekB?'':' on');
    $('lbl-b').className='wk-letter'+(isWeekB?' on':'');
    renderList(); updateHighlight();
  });

  const vp=$('vp'); if(!vp) return;
  const pointers=new Map();
  let gesture=null,gestureMoved=false,tapRoom=null;
  function pointerFrame(){
    const points=[...pointers.values()],first=points[0];if(!first)return null;
    if(points.length<2)return {x:first.x,y:first.y,distance:0,count:1};
    const second=points[1];
    return {x:(first.x+second.x)/2,y:(first.y+second.y)/2,distance:Math.hypot(second.x-first.x,second.y-first.y),count:2};
  }
  vp.addEventListener('pointerdown',e=>{
    if(e.target.closest('button')||(e.pointerType==='mouse'&&e.button!==0&&e.button!==1))return;
    if(e.button===1)e.preventDefault();
    if(!pointers.size){gestureMoved=false;tapRoom=e.button===0?e.target.closest('.room'):null;}
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    vp.setPointerCapture(e.pointerId);
    gesture=pointerFrame();
    if(pointers.size>1){gestureMoved=true;tapRoom=null;}
  });
  vp.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    const next=pointerFrame();if(!gesture||!next)return;
    const dx=next.x-gesture.x,dy=next.y-gesture.y;
    if(!gestureMoved&&next.count===1&&Math.hypot(dx,dy)<4)return;
    gestureMoved=true;userMovedMap=true;vp.classList.add('panning');
    const t=transforms[currentFloor];
    if(next.count===2&&gesture.distance>0){
      const rect=vp.getBoundingClientRect(),x=gesture.x-rect.left,y=gesture.y-rect.top;
      const nextScale=clamp(t.s*next.distance/gesture.distance,.1,6),factor=nextScale/t.s;
      t.tx=x-(x-t.tx)*factor+dx;t.ty=y-(y-t.ty)*factor+dy;t.s=nextScale;
    }else{t.tx+=dx;t.ty+=dy;}
    gesture=next;applyT();
  });
  function endPointer(e){
    if(!pointers.has(e.pointerId))return;
    const selected=pointers.size===1&&!gestureMoved&&e.type==='pointerup'?tapRoom:null;
    pointers.delete(e.pointerId);gesture=pointerFrame();
    if(!pointers.size){vp.classList.remove('panning');tapRoom=null;}
    if(selected)pulseRoom(selected.id);
  }
  vp.addEventListener('pointerup',endPointer);
  vp.addEventListener('pointercancel',endPointer);
  vp.addEventListener('lostpointercapture',endPointer);
  vp.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});

  let wheelFrame=0,wheelDelta=0,wheelX=0,wheelY=0;
  const flushWheel=()=>{
    wheelFrame=0;
    const delta=clamp(wheelDelta,-160,160);
    if(delta){userMovedMap=true;zoom(Math.exp(-delta*.0018),wheelX,wheelY);}
    wheelDelta=0;
    applyT();
  };
  vp.addEventListener('wheel',e=>{
    e.preventDefault();
    const unit=e.deltaMode===1?16:e.deltaMode===2?vp.clientHeight:1;
    const r=vp.getBoundingClientRect();
    wheelX=e.clientX-r.left;wheelY=e.clientY-r.top;
    const primary=Math.abs(e.deltaY)>=Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    wheelDelta+=clamp(primary*unit*(e.ctrlKey?1.6:1),-100,100);
    if(!wheelFrame){
      const schedule=window.requestAnimationFrame||((callback)=>window.setTimeout(callback,16));
      wheelFrame=schedule(flushWheel);
    }
  },{passive:false});

  let viewportWidth=0,viewportHeight=0;
  new ResizeObserver(()=>{
    const width=vp.clientWidth,height=vp.clientHeight;
    if(!width||!height)return;
    const t=transforms[currentFloor];
    if(!t.ready){resetView();}
    else if(focusedRoom&&focusedRoom.closest('.floor-map')?.id===`floor-${currentFloor}`&&!userMovedMap){focusRoom(focusedRoom,currentFloor);}
    else if(!userMovedMap){resetView();}
    else if(viewportWidth&&viewportHeight){
      t.tx+=(width-viewportWidth)/2;t.ty+=(height-viewportHeight)/2;applyT();
    }
    viewportWidth=width;viewportHeight=height;
  }).observe(vp);

  // tooltips
  const tip=$('tip');
  document.querySelectorAll('.room').forEach(r=>{
    r.addEventListener('mouseenter',()=>{ if(tip){tip.textContent=ROOM_INFO[r.id]||r.id;tip.style.opacity='1';}});
    r.addEventListener('mousemove',e=>{
      if(!tip)return;
      const rc=document.querySelector('.map-area').getBoundingClientRect();
      tip.style.left=(e.clientX-rc.left-tip.offsetWidth/2)+'px';
      tip.style.top=(e.clientY-rc.top-tip.offsetHeight-12)+'px';});
    r.addEventListener('mouseleave',()=>{ if(tip) tip.style.opacity='0';});
    r.addEventListener('click',e=>{if(e.detail===0)pulseRoom(r.id);});
  });

  updateClock();
  setInterval(updateClock, 20000);
}

// app.js dispatches this once /api/me/timetable has returned
document.addEventListener('timetable:loaded', ()=>{ lastAutomaticRoomKey=''; buildDayTabs(); updateHighlight(); });
document.addEventListener('DOMContentLoaded', initMap);
