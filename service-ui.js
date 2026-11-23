import {SERVICE_KEY,emptyServiceList,normalizeServiceList,createServiceItem,saveServiceList,resolveServiceItem,serviceNeighbor,serviceChoices} from './service-list.js';

export function setupServiceList({getPreview,getLive,getSongs,prepare,project,sendLive,selectTab,onChange,toast}){
  const $=id=>document.getElementById(id);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons={bible:'book',song:'music',text:'text'},names={bible:'Lectura',song:'Canto',text:'Anuncio'};
  const icon=name=>`<svg aria-hidden="true"><use href="./icons.svg#${name}"/></svg>`;
  let plan=emptyServiceList(),broken=false,choices=[],lastAutoTitle='';
  function status(message,error=false){$('serviceStatus').textContent=message;$('serviceStatus').classList.toggle('save-error',error);}
  function read(){
    try{const raw=localStorage.getItem(SERVICE_KEY);plan=raw?normalizeServiceList(JSON.parse(raw)):emptyServiceList();broken=false;status(raw?'Lista recuperada. Los cambios se guardan automáticamente.':'Tu lista se guarda automáticamente en este navegador.');}
    catch{broken=true;status('No se pudo abrir la lista guardada. Restaura una copia de tus datos o vacía la lista para comenzar otra.',true);}
  }
  function resolve(item){return resolveServiceItem(item,getSongs());}
  function renderState(){
    const previewId=getPreview().origin?.serviceItemId,live=getLive(),liveId=live.slides.length?live.origin?.serviceItemId:null;
    $('addToService').disabled=broken||!getPreview().slides.length;
    $('serviceNavCount').textContent=plan.items.length||'';
    $('serviceCount').textContent=plan.items.length+' / 100';
    $('clearServiceList').disabled=!broken&&!plan.items.length;
    $('serviceName').disabled=broken;
    for(const card of $('serviceItems').children){
      const id=card.dataset.serviceId;if(!id)continue;
      const selected=id===previewId,active=id===liveId;
      card.classList.toggle('is-preview',selected);card.classList.toggle('is-live',active&&!live.black);
      card.querySelector('[data-service-action="prepare"]').setAttribute('aria-pressed',String(selected));
      card.querySelector('[data-service-state]').textContent=active?(live.black?'En negro':selected?'Vista previa · En proyección':'En proyección'):selected?'Vista previa':'';
    }
    $('serviceLiveBar').hidden=!liveId;
    if(liveId){
      const index=plan.items.findIndex(item=>item.id===liveId),item=plan.items[index];
      $('serviceLiveTitle').textContent=(plan.title.trim()||'Mi culto')+(item?` · ${index+1}/${plan.items.length} · ${item.title}`:' · Elemento retirado de la lista');
      $('servicePreviousItem').disabled=!serviceNeighbor(plan,liveId,-1);$('serviceNextItem').disabled=!serviceNeighbor(plan,liveId,1);
    }
  }
  function render(){
    if(document.activeElement!==$('serviceName'))$('serviceName').value=plan.title;
    $('serviceItems').innerHTML=plan.items.length?plan.items.map((item,index)=>{
      const resolved=resolve(item),detail=item.origin.kind==='bible'?item.slides[0].version:resolved.usingCopy?'Copia guardada':item.followSong?'Vinculado a tu biblioteca':names[item.origin.kind];
      return `<article class="service-item" data-service-id="${escape(item.id)}"><button class="service-item-pick" data-service-action="prepare" aria-label="Preparar ${escape(item.title)}, elemento ${index+1}" aria-pressed="false"><span class="service-number">${index+1}</span><span class="service-item-info"><span class="service-kind">${icon(icons[item.origin.kind])}${names[item.origin.kind]}</span><strong>${escape(item.title)}</strong><span class="service-detail">${escape(detail)} · ${resolved.slides.length} ${resolved.slides.length===1?'pantalla':'pantallas'}</span></span></button><div class="service-item-footer"><span data-service-state></span><button class="service-project" data-service-action="project" aria-label="Proyectar ${escape(item.title)}, elemento ${index+1}">${icon('play')}Proyectar</button></div><div class="service-item-actions"><button data-service-action="up" aria-label="Subir ${escape(item.title)}" ${index===0?'disabled':''}>Subir</button><button data-service-action="down" aria-label="Bajar ${escape(item.title)}" ${index===plan.items.length-1?'disabled':''}>Bajar</button><button data-service-action="remove" aria-label="Quitar ${escape(item.title)} de la lista">Quitar</button></div></article>`;
    }).join(''):'<div class="empty-library"><strong>Prepara el orden de tu culto.</strong>Elige un canto, pasaje o anuncio y pulsa «Añadir a lista» junto a la vista previa.</div>';
    renderState();
  }
  function save(next,refresh=true){
    if(broken)return false;
    try{plan=saveServiceList(localStorage,{...next,updatedAt:Date.now()});status('Lista guardada en este navegador.');if(refresh)render();else renderState();onChange();return true;}
    catch(error){status(error.message,true);toast(error.message);return false;}
  }
  function flushTitle(){
    if(broken)return false;
    const title=$('serviceName').value;return title===plan.title||save({...plan,title},false);
  }
  function prepareItem(id){
    const item=plan.items.find(item=>item.id===id);if(!item)return;
    const resolved=resolve(item);prepare(resolved.slides,resolved.origin);
    if(resolved.usingCopy)toast('El canto ya no está en tu biblioteca. Se preparó la copia guardada en la lista.');
  }
  function advance(direction,boundary=false){
    const item=serviceNeighbor(plan,getLive().origin?.serviceItemId,direction);if(!item)return false;
    const resolved=resolve(item);sendLive(resolved,boundary&&direction<0?resolved.slides.length-1:0,getLive().black);return true;
  }
  function showChoice(){
    const selected=choices.find(item=>item.id===$('serviceAddScope').value);if(!selected)return;
    if(!$('serviceItemTitle').value||$('serviceItemTitle').value===lastAutoTitle)$('serviceItemTitle').value=selected.title;
    lastAutoTitle=selected.title;
    $('serviceAddInfo').textContent=`${selected.slides.length} ${selected.slides.length===1?'pantalla':'pantallas'}. `+(selected.followSong?'Se usarán las partes y el orden actuales de este canto en tu biblioteca.':'El contenido queda guardado en la lista para usarlo sin conexión.');
  }
  $('addToService').addEventListener('click',()=>{
    if(broken)return;
    try{
      choices=serviceChoices(getPreview(),getSongs());if(!choices.length)return;
      $('serviceAddScope').innerHTML=choices.map(item=>`<option value="${item.id}">${escape(item.label)}</option>`).join('');
      $('serviceItemTitle').value='';lastAutoTitle='';$('serviceAddError').textContent='';showChoice();$('serviceAddDialog').showModal();
    }catch(error){toast(error.message);}
  });
  $('serviceAddScope').addEventListener('change',showChoice);
  $('serviceAddForm').addEventListener('submit',event=>{
    event.preventDefault();const choice=choices.find(item=>item.id===$('serviceAddScope').value);if(!choice||!flushTitle())return;
    try{
      if(plan.items.length>=100)throw new Error('Puedes guardar hasta 100 elementos en esta lista.');
      const item=createServiceItem({...choice,title:$('serviceItemTitle').value.trim()});
      if(save({...plan,items:[...plan.items,item]})){$('serviceAddDialog').close();toast('Añadido a la lista del culto.');}
    }catch(error){$('serviceAddError').textContent=error.message;}
  });
  $('serviceName').addEventListener('input',flushTitle);
  document.querySelectorAll('[data-service-source]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.serviceSource)));
  $('serviceItems').addEventListener('click',event=>{
    const button=event.target.closest('[data-service-action]'),card=button?.closest('[data-service-id]');if(!button||!card||broken)return;
    const id=card.dataset.serviceId,index=plan.items.findIndex(item=>item.id===id),action=button.dataset.serviceAction;if(index<0)return;
    if(action==='prepare'||action==='project'){prepareItem(id);if(action==='project')project();return;}
    if(!flushTitle())return;
    const items=[...plan.items];
    if(action==='remove')items.splice(index,1);
    else if(action==='up'&&index>0)[items[index-1],items[index]]=[items[index],items[index-1]];
    else if(action==='down'&&index<items.length-1)[items[index+1],items[index]]=[items[index],items[index+1]];
    else return;
    if(save({...plan,items})){
      if(action==='remove')toast('Se quitó de la lista del culto.');
      else $('serviceItems').querySelector(`[data-service-id="${id}"] [data-service-action="${action}"]`)?.focus();
    }
  });
  $('clearServiceList').addEventListener('click',()=>{
    if(!confirm('¿Vaciar la lista del culto? Los cantos de tu biblioteca se conservarán.'))return;
    const previous=broken;broken=false;if(!save(emptyServiceList()))broken=previous;
  });
  $('servicePreviousItem').addEventListener('click',()=>advance(-1));$('serviceNextItem').addEventListener('click',()=>advance(1));
  window.addEventListener('storage',event=>{if(event.key===SERVICE_KEY||event.key===null){read();render();onChange();}});
  read();render();
  return {render,renderState,flushTitle,getPlan(){if(!flushTitle())throw new Error('Guarda la lista del culto antes de descargar la copia.');return normalizeServiceList(plan);},hasNeighbor:direction=>!!serviceNeighbor(plan,getLive().origin?.serviceItemId,direction),advance};
}
