import {BACKGROUNDS,FONTS,normalizeAppearance,slideContentKey,transitionPlan} from './appearance.js';
import {backgroundImageUrl} from './background-media.js';

function stopAnimations(layer){for(const animation of layer.getAnimations?.()??[])animation.cancel();}
function applyAppearance(layer,appearance,stage){
  layer._appearance=appearance;
  const text=appearance.textStyle,background=appearance.background;
  const backdrop=layer.querySelector('.slide-backdrop');
  if(layer._black){backdrop.style.background='#000000';layer.querySelector('.slide-tint').style.opacity='0';return;}
  backdrop.style.background=background.mode==='theme'?BACKGROUNDS.find(item=>item.id===background.theme).css:background.color;
  backdrop.style.backgroundSize='cover';backdrop.style.backgroundPosition='center';
  layer.querySelector('.slide-tint').style.opacity=background.overlay/100;
  if(background.mode==='image'){
    const id=background.imageId;
    backgroundImageUrl(id).then(url=>{
      if(!layer.isConnected||layer._appearance.background.mode!=='image'||layer._appearance.background.imageId!==id)return;
      if(url)backdrop.style.backgroundImage=`url("${url}")`;
      else stage.dispatchEvent(new CustomEvent('icthus-image-missing'));
    });
  }
  layer.style.justifyContent={top:'flex-start',center:'center',bottom:'flex-end'}[text.vertical];
  const inner=layer.querySelector('.slide-inner');if(!inner)return;
  inner.style.width=(100-text.margin*2)+'%';inner.style.textAlign=text.align;inner.style.color=text.color;
  const paragraph=inner.querySelector('.slide-text');
  paragraph.style.fontFamily=FONTS[text.fontFamily].css;paragraph.style.fontWeight=text.bold?'700':'400';paragraph.style.fontStyle=text.italic?'italic':'normal';paragraph.style.textTransform=text.uppercase?'uppercase':'none';
  paragraph.style.lineHeight=String(text.lineHeight);paragraph.style.letterSpacing=text.letterSpacing+'em';
  paragraph.style.webkitTextStroke=`${text.outline/text.fontSize}em #000000`;paragraph.style.paintOrder='stroke fill';
  paragraph.style.textShadow={none:'none',soft:'0 .04em .22em #0008',strong:'0 .04em .08em #000f,0 .08em .25em #000c'}[text.shadow];
  const reference=inner.querySelector('.slide-reference'),version=inner.querySelector('.slide-version');
  reference.hidden=!text.showReference||!reference.textContent;reference.style.fontSize=text.referenceScale+'em';
  version.hidden=!text.showVersion||!version.textContent;version.style.fontSize=(text.referenceScale*.64)+'em';version.style.color='inherit';version.style.opacity='.7';
}
function createLayer(slide,appearance,settings,stage){
  const layer=document.createElement('div');layer.className='slide-layer';layer._black=!!settings.black;
  const backdrop=document.createElement('div');backdrop.className='slide-backdrop';
  const tint=document.createElement('div');tint.className='slide-tint';layer.append(backdrop,tint);
  if(!settings.black&&slide){
    const inner=document.createElement('div');inner.className='slide-inner';
    const paragraph=document.createElement('p');paragraph.className='slide-text';paragraph.textContent=slide.text;
    const reference=document.createElement('div');reference.className='slide-reference';reference.textContent=slide.reference;
    const version=document.createElement('div');version.className='slide-version';version.textContent=slide.version;
    inner.append(paragraph,reference,version);layer.append(inner);
  }else if(!settings.black&&settings.placeholder){
    const placeholder=document.createElement('div');placeholder.className='stage-placeholder';placeholder.textContent=settings.placeholder;layer.append(placeholder);
  }
  applyAppearance(layer,appearance,stage);
  if(settings.black){backdrop.style.background='#000000';tint.style.opacity='0';}
  return layer;
}

export function renderSlide(stage,slide,settings={}){
  const appearance=normalizeAppearance(settings),contentKey=slideContentKey(slide,!!settings.black,settings.placeholder||'');
  const appearanceKey=JSON.stringify([appearance.background,appearance.textStyle]);
  stage._settings=appearance;stage.dataset.theme=appearance.theme;stage.classList.add('rendered-stage');
  stage.classList.toggle('is-black',!!settings.black);
  // Los mensajes de conexión repetidos no reconstruyen ni animan la diapositiva.
  if(stage._contentKey===contentKey&&stage._appearanceKey===appearanceKey)return;
  if(stage._contentKey===contentKey&&stage._currentLayer?.isConnected){
    applyAppearance(stage._currentLayer,appearance,stage);stage._appearanceKey=appearanceKey;fitSlide(stage);return;
  }
  const candidates=[...stage.querySelectorAll(':scope > .slide-layer')];
  let outgoing=null,outgoingOpacity=0;
  for(const layer of candidates){const opacity=Number(getComputedStyle(layer).opacity);if(opacity>=outgoingOpacity){outgoing=layer;outgoingOpacity=opacity;}}
  for(const layer of candidates){stopAnimations(layer);if(layer!==outgoing)layer.remove();}
  // Reemplaza cualquier marcador inicial de HTML por las capas de la pantalla.
  for(const child of [...stage.children])if(child!==outgoing)child.remove();
  const layer=createLayer(slide,appearance,settings,stage);stage.append(layer);stage._currentLayer=layer;
  stage._contentKey=contentKey;stage._appearanceKey=appearanceKey;
  fitSlide(stage);
  const plan=transitionPlan({previous:!!outgoing,changed:true,black:!!settings.black,reduceMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false,transition:appearance.transition});
  if(!plan||typeof layer.animate!=='function'){outgoing?.remove();layer.style.opacity='1';return;}
  // El fondo saliente permanece opaco: así el fundido no oscurece la pantalla.
  outgoingOpacity=1;
  outgoing.setAttribute('aria-hidden','true');outgoing.style.opacity=String(outgoingOpacity);outgoing.style.transform='none';
  const frames=plan.incoming.map(frame=>({...frame}));frames[0].opacity=1-outgoingOpacity;
  const incoming=layer.animate(frames,{duration:plan.duration,easing:plan.easing,fill:'both'});
  const previous=outgoing.animate([{opacity:outgoingOpacity},{opacity:outgoingOpacity}],{duration:plan.duration,easing:plan.easing,fill:'both'});
  incoming.finished.then(()=>{if(stage._currentLayer===layer){layer.style.opacity='1';layer.style.transform='none';incoming.cancel();}}).catch(()=>{});
  previous.finished.then(()=>{if(stage._currentLayer!==outgoing)outgoing.remove();}).catch(()=>{});
}

export function fitSlide(stage){
  for(const layer of stage.querySelectorAll(':scope > .slide-layer'))fitLayer(stage,layer);
}
function fitLayer(stage,layer){
  const text=layer._appearance?.textStyle;if(!text)return;
  layer.style.paddingBlock=(stage.clientHeight*text.margin/100)+'px';
  const inner=layer.querySelector('.slide-inner');if(!inner)return;
  const scale=stage.clientWidth/1280;if(!scale)return;
  let size=Math.max(4,text.fontSize*scale);inner.style.fontSize=size+'px';
  const availableHeight=stage.clientHeight*(1-text.margin*2/100),availableWidth=stage.clientWidth*(1-text.margin*2/100);
  const overflows=()=>inner.scrollHeight>availableHeight+1||inner.scrollWidth>availableWidth+1;
  if(text.autoFit){for(let index=0;index<90&&overflows()&&size>4;index++){size=Math.max(4,size*.95);inner.style.fontSize=size+'px';}}
  if(stage._currentLayer===layer)stage.dispatchEvent(new CustomEvent('icthus-fit',{detail:{requested:text.fontSize,actual:size/scale,overflow:overflows(),autoFit:text.autoFit}}));
}
