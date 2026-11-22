import {safeProjection} from './core.js';
import {renderSlide,fitSlide} from './renderer.js';
const screen=document.getElementById('screen'),error=document.getElementById('projectionError');
const channel='BroadcastChannel' in window?new BroadcastChannel('ap-proyeccion-v1'):null;
let current={slides:[],index:0,black:false,theme:'indigo',fontSize:56},idleTimer,errorTimer;
function apply(value){const next=safeProjection(value);if(!next)return;current=next;renderSlide(screen,current.slides[current.index],current);}
function ready(){channel?.postMessage({type:'ready'});try{window.opener?.postMessage({type:'ap-ready'},location.origin);}catch{}}
if(channel)channel.onmessage=event=>{if(event.data?.type==='state')apply(event.data.payload);};
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='ap-state')apply(event.data.payload);});
window.addEventListener('storage',event=>{if(event.key==='ap-projection-v1'){try{apply(JSON.parse(event.newValue));}catch{}}});
try{apply(JSON.parse(localStorage.getItem('ap-projection-v1')));}catch{}
function control(action){
  if(channel){channel.postMessage({type:'control',action});return;}
  // Sin BroadcastChannel, la pantalla también puede avanzar en forma local.
  const next={...current};if(action==='black')next.black=!next.black;
  else next.index=Math.max(0,Math.min(next.slides.length-1,next.index+(action==='next'?1:-1)));
  apply(next);try{localStorage.setItem('ap-projection-v1',JSON.stringify(next));}catch{}
}
async function fullscreen(){
  try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch{error.textContent='No se pudo activar pantalla completa. Usa la tecla de pantalla completa de tu Chromebook o F11.';error.hidden=false;clearTimeout(errorTimer);errorTimer=setTimeout(()=>error.hidden=true,6000);}
}
function showControls(){document.body.classList.add('show-controls');clearTimeout(idleTimer);idleTimer=setTimeout(()=>document.body.classList.remove('show-controls'),3000);}
document.addEventListener('pointermove',showControls);document.addEventListener('pointerdown',showControls);
document.getElementById('fullscreen').addEventListener('click',fullscreen);
document.getElementById('previous').addEventListener('click',()=>control('prev'));
document.getElementById('next').addEventListener('click',()=>control('next'));
document.getElementById('black').addEventListener('click',()=>control('black'));
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey)return;
  if(event.key.toLowerCase()==='f'){event.preventDefault();fullscreen();}
  if(event.key.toLowerCase()==='b'){event.preventDefault();control('black');}
  if(event.key==='ArrowRight'){event.preventDefault();control('next');}
  if(event.key==='ArrowLeft'){event.preventDefault();control('prev');}
});
document.addEventListener('fullscreenchange',()=>{document.body.classList.toggle('hide-notice',!!document.fullscreenElement);showControls();});
new ResizeObserver(()=>fitSlide(screen)).observe(screen);
ready();setInterval(ready,2000);showControls();setTimeout(()=>document.body.classList.add('hide-notice'),6500);
