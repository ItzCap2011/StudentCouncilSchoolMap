import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('../map.js',import.meta.url),'utf8');

function harness(width=390,height=620){
  const events=new Map(),frames=[];
  const classes={add(){},remove(){},toggle(){}};
  const viewport={clientWidth:width,clientHeight:height,classList:classes,
    getBoundingClientRect:()=>({left:10,top:90,width,height}),
    addEventListener:(name,handler)=>events.set(name,handler),setPointerCapture(){}};
  const svg={style:{},classList:classes,viewBox:{baseVal:{x:0,y:0,width:1650,height:460}},setAttribute(){}};
  const room={id:'A115',style:{},classList:classes,getBBox:()=>({x:900,y:50,width:148,height:76})};
  const nodes={vp:viewport,'svg-0':svg,'svg-1':svg,A115:room};
  const context=vm.createContext({
    document:{getElementById:id=>nodes[id]??null,addEventListener(){},dispatchEvent(){},
      querySelectorAll:selector=>selector==='.floor-map svg'?[svg]:[]},
    window:{requestAnimationFrame:callback=>{frames.push(callback);return frames.length;},setTimeout(){}},
    ResizeObserver:class{observe(){}},setInterval(){},CustomEvent:class{},Date,
  });
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  return {run,events,frames,room,viewport,context};
}

test('rooms center with breathing room across phone, landscape and desktop viewports',()=>{
  for(const [width,height] of [[320,480],[375,550],[390,620],[430,210],[844,160],[1100,740]]){
    const h=harness(width,height);
    for(const box of [{x:900,y:50,width:148,height:76},{x:200,y:132,width:720,height:190}]){
      h.room.getBBox=()=>box;
      h.run("focusRoom(document.getElementById('A115'),1)");
      const t=h.run('({...transforms[1]})');
      assert.ok(Math.abs(t.tx+(box.x+box.width/2)*t.s-width/2)<.001);
      assert.ok(Math.abs(t.ty+(box.y+box.height/2)*t.s-height/2)<.001);
      assert.ok(box.width*t.s<=width*.56+.001);
      assert.ok(box.height*t.s<=height*.42+.001);
    }
  }
});

test('zoom leaves the map point beneath its anchor fixed',()=>{
  const h=harness();
  h.run('transforms[0]={s:1.4,tx:-350,ty:60}');
  const before=h.run('({...transforms[0]})');
  h.run('zoom(1.25,173,230)');
  const after=h.run('({...transforms[0]})');
  assert.ok(Math.abs((173-before.tx)/before.s-(173-after.tx)/after.s)<.001);
  assert.ok(Math.abs((230-before.ty)/before.s-(230-after.ty)/after.s)<.001);
});

test('one-finger drag pans without selecting a classroom on release',()=>{
  const h=harness();h.run('initMap()');
  const event=(x,y)=>({pointerId:1,pointerType:'touch',button:0,clientX:x,clientY:y,
    target:{closest:selector=>selector==='.room'?h.room:null}});
  h.events.get('pointerdown')(event(100,200));
  h.events.get('pointermove')(event(145,230));
  h.events.get('pointerup')({...event(145,230),type:'pointerup'});
  const state=h.run('({t:{...transforms[0]},focused:focusedRoom})');
  assert.equal(state.t.tx,45);assert.equal(state.t.ty,30);assert.equal(state.focused,null);
});

test('pinch increases scale and a remaining finger continues panning without a jump',()=>{
  const h=harness();h.run('initMap()');
  const event=(id,x,y)=>({pointerId:id,pointerType:'touch',button:0,clientX:x,clientY:y,target:{closest:()=>null}});
  h.events.get('pointerdown')(event(1,100,200));
  h.events.get('pointerdown')(event(2,200,200));
  h.events.get('pointermove')(event(2,250,200));
  const pinched=h.run('({...transforms[0]})');
  assert.equal(pinched.s,1.5);
  // The map point at the old midpoint tracks the moving pinch midpoint.
  assert.ok(Math.abs(pinched.tx+140*pinched.s-165)<.001);
  h.events.get('pointerup')({...event(2,250,200),type:'pointerup'});
  h.events.get('pointermove')(event(1,115,210));
  const dragged=h.run('({...transforms[0]})');
  assert.equal(dragged.s,pinched.s);assert.equal(dragged.tx-pinched.tx,15);assert.equal(dragged.ty-pinched.ty,10);
});

test('pointer cancellation ends a gesture without selecting or continuing to pan',()=>{
  const h=harness();h.run('initMap()');
  const event={pointerId:1,pointerType:'touch',button:0,clientX:100,clientY:200,target:{closest:()=>null}};
  h.events.get('pointerdown')(event);
  h.events.get('pointercancel')({...event,type:'pointercancel'});
  h.events.get('pointermove')({...event,clientX:300});
  assert.equal(h.run('transforms[0].tx'),0);
});

test('mouse wheel changes scale while the cursor anchor remains fixed',()=>{
  const h=harness();h.run('initMap()');let prevented=false;
  h.events.get('wheel')({deltaMode:0,deltaY:80,deltaX:0,clientX:210,clientY:300,ctrlKey:false,preventDefault(){prevented=true;}});
  h.frames.shift()();const t=h.run('({...transforms[0]})');
  assert.equal(prevented,true);assert.ok(t.s<1);
  assert.ok(Math.abs(t.tx+200*t.s-200)<.001);
  assert.ok(Math.abs(t.ty+210*t.s-210)<.001);
});

test('clock ticks preserve exploration and schedule state until the lesson changes',()=>{
  const h=harness();
  h.run(`
    let renders=0,focuses=0;
    renderList=()=>renders++;
    pulseRoom=()=>focuses++;
    todayIdx=()=>0;
    nowMin=()=>530;
    curPeriod=()=>({id:'P1',slot:'P1'});
    window.__TIMETABLE__={weekA:{Mon:{P1:{room:'A115'},P2:{room:'A116'}}}};
    updateHighlight();
    transforms[0].tx=123;
    updateHighlight();
    updateHighlight();
  `);
  assert.equal(h.run('renders'),1);
  assert.equal(h.run('focuses'),1);
  assert.equal(h.run('transforms[0].tx'),123);
  h.run("curPeriod=()=>({id:'P2',slot:'P2'});updateHighlight()");
  assert.equal(h.run('renders'),2);
  assert.equal(h.run('focuses'),2);
});
