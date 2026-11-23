import {BOOKS,normalize,parseReference,resolveReference,buildSearchIndex,searchVerses,verseSlides,textSlides,songSlides,validateSongs,safeProjection} from './core.js';
import {SONG_PART_TYPES,MAX_SONG_PARTS,MAX_SONG_STEPS,parseSongLyrics,normalizeSong,songSteps,songPartLabels,validateSongParts,validateSongOrder} from './songs.js';
import {renderSlide,fitSlide} from './renderer.js';
import {PERSONAL_KEYS,contentEntry,cleanEntries,addToHistory,toggleFavorite,emptyDrafts,cleanDrafts,savePersonal} from './personal-library.js';
import {BIBLE_VERSIONS,importBibleData,loadImportedBible,saveImportedBible} from './versions.js';
import {MAX_BIBLE_JSON_BYTES,parseBibleJson,fetchBibleJson} from './bible-download.js';
import {BACKGROUNDS,FONTS,DEFAULT_TEXT,normalizeAppearance} from './appearance.js';
import {currentBackgroundImage,backgroundImageUrl,saveBackgroundImage} from './background-media.js';
import {MAX_DATA_BACKUP_BYTES,createDataBackup,parseDataBackup,restoreDataBackup} from './backup.js';
import {setupInstallation} from './install.js';
import {setupServiceList} from './service-ui.js';

const $=id=>document.getElementById(id);
const icon=name=>`<svg aria-hidden="true"><use href="./icons.svg#${name}"/></svg>`;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEYS={songs:'ap-songs-v1',projection:'ap-projection-v1',settings:'ap-settings-v1'};
function readStored(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
const settings=readStored(KEYS.settings,{theme:'indigo',fontSize:56})||{};
const initialProjection=safeProjection(readStored(KEYS.projection,null))||{slides:[],index:0,black:false,theme:'indigo',fontSize:56};
const sampleSong={id:'original-example',title:'Hoy te cantamos · Ejemplo',lyrics:'Hoy nos reunimos para darte honor,\ncon nuestras voces y el corazón.\nEn cada paso, en cada lugar,\ntu amor nos mueve a compartir y amar.\n\nHoy te cantamos, Dios de bondad,\neres refugio, vida y verdad.\nJuntos llevamos tu luz al andar,\ny nuestras manos te quieren honrar.\n\nQue nuestra fe se convierta en acción,\nque nadie quede sin una oración.\nAbre los ojos de nuestro interior,\npara servirte con todo el amor.'};
const storedSongs=readStored(KEYS.songs,null);
const sampleParts=parseSongLyrics(sampleSong.lyrics);sampleParts[1].type='chorus';Object.assign(sampleSong,normalizeSong({...sampleSong,sections:sampleParts,order:[sampleParts[0].id,sampleParts[1].id,sampleParts[2].id,sampleParts[1].id]}));
const state={tab:'bible',bible:null,versionId:'RV1909',versionCache:new Map(),searchIndex:[],rows:[],preview:{slides:[],index:0,origin:null},live:initialProjection,
  songs:Array.isArray(storedSongs)?storedSongs.flatMap(song=>{try{return [normalizeSong(song)];}catch{return [];}}):[sampleSong],
  selectedSong:null,...normalizeAppearance(settings),backgroundImageRecord:null,lastHeartbeat:0,storageWarned:false,
  history:cleanEntries(readStored(PERSONAL_KEYS.history,[]),60),favorites:cleanEntries(readStored(PERSONAL_KEYS.favorites,[])),drafts:cleanDrafts(readStored(PERSONAL_KEYS.drafts,null))};
let outputWindow=null,toastTimer,searchTimer,loadingVersion=0,currentSongDraftKey=null,textDraftDirty=false,songDraftDirty=false,textDraftTimer,songDraftTimer;
let songEditorSections=[],songEditorOrder=null,songPartsKey='';
let serviceUI=null;
const channel='BroadcastChannel' in window?new BroadcastChannel('ap-proyeccion-v1'):null;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function sendProjection(){
  Object.assign(state.live,normalizeAppearance(state));
  try{localStorage.setItem(KEYS.projection,JSON.stringify(state.live));}catch{if(!state.storageWarned){toast('El navegador no pudo guardar la proyección. Mantén abiertas ambas ventanas.');state.storageWarned=true;}}
  channel?.postMessage({type:'state',payload:state.live});
  try{if(outputWindow&&!outputWindow.closed)outputWindow.postMessage({type:'ap-state',payload:state.live},location.origin);}catch{}
  renderLive();
}
function receiveMessage(message){
  if(message?.type==='ready'){state.lastHeartbeat=Date.now();updateConnection();channel?.postMessage({type:'state',payload:state.live});}
  if(message?.type==='control'&&['next','prev','black'].includes(message.action)){
    if(message.action==='black')toggleBlack();else moveLive(message.action==='next'?1:-1);
  }
}
if(channel)channel.onmessage=event=>receiveMessage(event.data);
window.addEventListener('message',event=>{if(event.origin!==location.origin)return;if(event.data?.type==='ap-ready'){state.lastHeartbeat=Date.now();updateConnection();sendProjection();}else if(event.data?.type==='ap-control')receiveMessage({type:'control',action:event.data.action});});
window.addEventListener('storage',event=>{
  if(event.key===KEYS.projection){try{const next=safeProjection(JSON.parse(event.newValue));if(next){state.live=next;renderLive();}}catch{}}
  if(event.key===PERSONAL_KEYS.history){state.history=cleanEntries(readStored(PERSONAL_KEYS.history,[]),60);renderSavedLists();}
  if(event.key===PERSONAL_KEYS.favorites){state.favorites=cleanEntries(readStored(PERSONAL_KEYS.favorites,[]));renderSavedLists();renderFavoriteButton();}
});
function updateConnection(){
  const connected=Date.now()-state.lastHeartbeat<5000;
  $('outputStatus').classList.toggle('connected',connected);
  $('outputStatus').innerHTML=`<i></i>${connected?'Salida conectada':'Salida cerrada'}`;
  $('liveDot').classList.toggle('active',connected&&!!state.live.slides.length&&!state.live.black);
}
setInterval(updateConnection,2000);
$('openOutput').addEventListener('click',()=>{
  outputWindow=window.open(new URL('./projection.html',location.href).href,'ap-projection','popup,width=1280,height=720');
  if(!outputWindow){toast('Permite las ventanas emergentes de este sitio y vuelve a pulsar «Abrir proyección».');return;}
  outputWindow.focus();sendProjection();
});

function selectTab(tab){
  state.tab=tab;
  for(const button of document.querySelectorAll('[data-tab]')){const active=button.dataset.tab===tab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  for(const name of ['bible','songs','text','history','favorites','service'])$(name+'Panel').hidden=tab!==name;
  if(tab==='songs')renderSongs();
  if(tab==='history'||tab==='favorites')renderSavedLists();
  renderSongParts();
}
document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>selectTab(button.dataset.tab)));
function setPreview(slides,index=0,origin={kind:'text'}){state.preview={slides,index,origin};renderPreview();}
function renderPreview(){
  const {slides,index}=state.preview,slide=slides[index];
  renderSlide($('previewStage'),slide,{...normalizeAppearance(state),placeholder:slide?'':'Selecciona contenido en tu biblioteca'});
  $('selectionLabel').textContent=slide?.songPartLabel?`${slide.reference} · ${slide.songPartLabel}`:slide?.reference||'Sin selección';
  $('previewPosition').textContent=slides.length?`${index+1} / ${slides.length}`:'0 / 0';
  $('previewPrev').disabled=index<=0;$('previewNext').disabled=index>=slides.length-1;$('projectSlide').disabled=!slide;
  document.querySelectorAll('.verse-card').forEach(card=>{
    const selected=card.dataset.key===slide?.key;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));
  });
  renderFavoriteButton();
  renderSongParts();
  serviceUI?.renderState();
}
function movePreview(direction){const next=state.preview.index+direction;if(next<0||next>=state.preview.slides.length)return;state.preview.index=next;renderPreview();scrollSelectedVerse();}
function renderLive(){
  const {slides,index,black}=state.live;
  renderSlide($('liveStage'),slides[index],{...state.live,placeholder:!slides.length&&!black?'La pantalla está en espera':''});
  const slide=slides[index];$('liveCaption').textContent=black?'Pantalla negra':slide?.songPartLabel?`${slide.reference} · ${slide.songPartLabel}`:slide?.reference||'Sin contenido';
  $('livePosition').textContent=slides.length?`${index+1} / ${slides.length}`:'Sin contenido';
  $('livePrev').disabled=!slides.length||(index<=0&&!serviceUI?.hasNeighbor(-1));$('liveNext').disabled=!slides.length||(index>=slides.length-1&&!serviceUI?.hasNeighbor(1));
  $('blackout').setAttribute('aria-pressed',String(black));
  updateConnection();
  renderSongParts();
  serviceUI?.renderState();
}
function project(){
  if(!state.preview.slides.length)return;
  state.live={slides:state.preview.slides.map(s=>({...s})),index:state.preview.index,origin:state.preview.origin,black:false,...normalizeAppearance(state)};
  sendProjection();
  rememberProjection();
  if(Date.now()-state.lastHeartbeat>=5000)toast('Contenido preparado. Pulsa «Abrir proyección» para mostrarlo en otra ventana.');
}
function moveLive(direction){if(!state.live.slides.length)return;const next=state.live.index+direction;if(next<0||next>=state.live.slides.length){serviceUI?.advance(direction,true);return;}state.live.index=next;sendProjection();rememberProjection();}
function toggleBlack(){state.live.black=!state.live.black;sendProjection();}
$('previewPrev').addEventListener('click',()=>movePreview(-1));$('previewNext').addEventListener('click',()=>movePreview(1));
$('projectSlide').addEventListener('click',project);$('livePrev').addEventListener('click',()=>moveLive(-1));$('liveNext').addEventListener('click',()=>moveLive(1));
$('blackout').addEventListener('click',toggleBlack);$('clearOutput').addEventListener('click',()=>{state.live.slides=[];state.live.index=0;state.live.black=false;sendProjection();});

function saveSettings(){try{localStorage.setItem(KEYS.settings,JSON.stringify({...normalizeAppearance(state),versionId:state.versionId}));}catch{toast('Los ajustes se aplicaron, pero el navegador no pudo guardarlos para la próxima sesión.');}}
function saveAppearance(){saveSettings();renderPreview();sendProjection();}
function changeAppearance(patch){Object.assign(state,normalizeAppearance({...normalizeAppearance(state),...patch}));updateAppearance();saveAppearance();}
function changeText(patch){changeAppearance({textStyle:{...state.textStyle,...patch}});}
function updateAppearance(){
  for(const button of document.querySelectorAll('.theme-swatch')){const selected=state.background.mode==='theme'&&button.dataset.theme===state.theme;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));}
  const text=state.textStyle;
  $('fontSize').value=text.fontSize;if(document.activeElement!==$('fontSizeNumber'))$('fontSizeNumber').value=text.fontSize;$('fontValue').textContent=text.fontSize+' px';
  for(const id of ['fontFamily','textAlign','verticalAlign','textShadow'])$(id).value={fontFamily:text.fontFamily,textAlign:text.align,verticalAlign:text.vertical,textShadow:text.shadow}[id];
  $('textColor').value=text.color;$('solidColor').value=state.background.color;
  for(const [id,key] of [['textBold','bold'],['textItalic','italic'],['textUppercase','uppercase']]){$(id).setAttribute('aria-pressed',String(text[key]));}
  for(const [id,key] of [['autoFit','autoFit'],['showReference','showReference'],['showVersion','showVersion']])$(id).checked=text[key];
  for(const [id,key] of [['lineHeight','lineHeight'],['letterSpacing','letterSpacing'],['textMargin','margin'],['textOutline','outline'],['referenceScale','referenceScale']]){$(id).value=text[key];$(id+'Value').textContent={lineHeight:Number(text.lineHeight).toFixed(2),letterSpacing:Number(text.letterSpacing).toFixed(2)+' em',textMargin:text.margin+' %',textOutline:text.outline+' px',referenceScale:Math.round(text.referenceScale*100)+' %'}[id];}
  $('backgroundOverlay').value=state.background.overlay;$('backgroundOverlayValue').textContent=state.background.overlay+' %';
  $('solidMode').setAttribute('aria-pressed',String(state.background.mode==='solid'));$('imageMode').setAttribute('aria-pressed',String(state.background.mode==='image'));
  $('imageControls').hidden=state.background.mode!=='image';
  $('transitionType').value=state.transition.type;$('transitionDuration').value=state.transition.duration;if(document.activeElement!==$('transitionSeconds'))$('transitionSeconds').value=Number((state.transition.duration/1000).toFixed(2));$('transitionValue').textContent=(state.transition.duration/1000).toFixed(2)+' s';
  $('transitionDuration').disabled=$('transitionSeconds').disabled=state.transition.type==='none';
}
for(const background of BACKGROUNDS){const button=document.createElement('button');button.className='theme-swatch';button.dataset.theme=background.id;button.setAttribute('aria-label','Fondo '+background.name);button.setAttribute('aria-pressed','false');const swatch=document.createElement('span');swatch.style.background=background.css;button.append(swatch,document.createTextNode(background.name));$('themeOptions').append(button);button.addEventListener('click',()=>changeAppearance({background:{...state.background,mode:'theme',theme:background.id}}));}
for(const [id,font] of Object.entries(FONTS)){const option=document.createElement('option');option.value=id;option.textContent=font.name;$('fontFamily').append(option);}
$('fontSize').addEventListener('input',()=>changeText({fontSize:Number($('fontSize').value)}));
$('fontSizeNumber').addEventListener('input',()=>{const value=Number($('fontSizeNumber').value);if($('fontSizeNumber').value!==''&&value>=20&&value<=160)changeText({fontSize:value});});
$('fontSizeNumber').addEventListener('blur',()=>{changeText({fontSize:Number($('fontSizeNumber').value)});$('fontSizeNumber').value=state.fontSize;});
for(const [id,key] of [['fontFamily','fontFamily'],['textAlign','align'],['verticalAlign','vertical'],['textShadow','shadow']])$(id).addEventListener('change',()=>changeText({[key]:$(id).value}));
$('textColor').addEventListener('input',()=>changeText({color:$('textColor').value}));
for(const [id,key] of [['textBold','bold'],['textItalic','italic'],['textUppercase','uppercase']])$(id).addEventListener('click',()=>changeText({[key]:!state.textStyle[key]}));
for(const [id,key] of [['autoFit','autoFit'],['showReference','showReference'],['showVersion','showVersion']])$(id).addEventListener('change',()=>changeText({[key]:$(id).checked}));
for(const [id,key] of [['lineHeight','lineHeight'],['letterSpacing','letterSpacing'],['textMargin','margin'],['textOutline','outline'],['referenceScale','referenceScale']])$(id).addEventListener('input',()=>changeText({[key]:Number($(id).value)}));
$('resetTextStyle').addEventListener('click',()=>{changeAppearance({textStyle:{...DEFAULT_TEXT}});toast('Estilo de texto restablecido.');});
$('solidMode').addEventListener('click',()=>changeAppearance({background:{...state.background,mode:'solid'}}));
$('solidColor').addEventListener('input',()=>changeAppearance({background:{...state.background,mode:'solid',color:$('solidColor').value}}));
$('backgroundOverlay').addEventListener('input',()=>changeAppearance({background:{...state.background,overlay:Number($('backgroundOverlay').value)}}));
$('imageMode').addEventListener('click',()=>{if(state.backgroundImageRecord)changeAppearance({background:{...state.background,mode:'image',imageId:state.backgroundImageRecord.id}});else $('backgroundImageFile').click();});
$('changeBackgroundImage').addEventListener('click',()=>$('backgroundImageFile').click());
$('backgroundImageFile').addEventListener('change',async()=>{
  const file=$('backgroundImageFile').files[0];if(!file)return;$('imageMode').disabled=$('changeBackgroundImage').disabled=true;$('imageStatus').textContent='Guardando imagen…';
  try{const record=await saveBackgroundImage(file);state.backgroundImageRecord=record;changeAppearance({background:{...state.background,mode:'image',imageId:record.id,overlay:35}});await showBackgroundImage(record);toast('Fondo guardado en este navegador.');}
  catch(error){$('imageStatus').textContent=error.message;toast(error.message);}
  finally{$('backgroundImageFile').value='';$('imageMode').disabled=$('changeBackgroundImage').disabled=false;}
});
async function showBackgroundImage(record){$('imageStatus').textContent=record.name;const url=await backgroundImageUrl(record.id);if(url)$('backgroundImageThumb').src=url;}
async function restoreBackgroundImage(){
  try{const record=await currentBackgroundImage();if(record){state.backgroundImageRecord=record;await showBackgroundImage(record);if(state.background.mode==='image'&&state.background.imageId!==record.id)changeAppearance({background:{...state.background,imageId:record.id}});}
    else if(state.background.mode==='image'){changeAppearance({background:{...state.background,mode:'theme',imageId:null}});$('imageStatus').textContent='Vuelve a elegir tu imagen de fondo.';}}
  catch{if(state.background.mode==='image')toast('No se pudo leer el fondo guardado. Vuelve a elegir la imagen.');}
}
$('transitionType').addEventListener('change',()=>changeAppearance({transition:{...state.transition,type:$('transitionType').value}}));
$('transitionDuration').addEventListener('input',()=>changeAppearance({transition:{...state.transition,duration:Number($('transitionDuration').value)}}));
$('transitionSeconds').addEventListener('input',()=>{const value=Number($('transitionSeconds').value);if($('transitionSeconds').value!==''&&value>=.1&&value<=1.5)changeAppearance({transition:{...state.transition,duration:value*1000}});});
$('transitionSeconds').addEventListener('blur',()=>{changeAppearance({transition:{...state.transition,duration:Number($('transitionSeconds').value)*1000}});$('transitionSeconds').value=Number((state.transition.duration/1000).toFixed(2));});
document.querySelectorAll('[data-design-tab]').forEach(button=>button.addEventListener('click',()=>{for(const tab of document.querySelectorAll('[data-design-tab]')){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;$(tab.getAttribute('aria-controls')).hidden=!active;}}));
$('designTabs').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const buttons=[...$('designTabs').querySelectorAll('button')],index=buttons.indexOf(document.activeElement),target=buttons[(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];target.click();target.focus();});
$('previewStage').addEventListener('icthus-fit',event=>{const {overflow,autoFit,actual,requested}=event.detail;$('fitStatus').textContent=overflow?'El texto excede el área. Reduce la letra o activa el ajuste automático.':autoFit&&actual<requested-.5?`Vista previa ajustada a ${Math.round(actual)} px para mostrar todo el texto.`:'';$('fitStatus').classList.toggle('fit-warning',overflow);});
$('previewStage').addEventListener('icthus-image-missing',()=>{$('imageStatus').textContent='Vuelve a elegir la imagen de fondo.';});
restoreBackgroundImage();

function scrollSelectedVerse(){
  const list=$('bibleResults'),selected=list.querySelector('.verse-card.selected');if(!selected)return;
  const listRect=list.getBoundingClientRect(),cardRect=selected.getBoundingClientRect();
  if(cardRect.top<listRect.top||cardRect.bottom>listRect.bottom)list.scrollTop+=cardRect.top-listRect.top-8;
}
function renderVerseResults(rows,title,count){
  state.rows=rows;$('bibleResultsTitle').textContent=title;$('bibleResultsCount').textContent=count;
  $('bibleResults').innerHTML=rows.length?rows.map((row,index)=>`<button class="verse-card" data-index="${index}" data-key="${escape(row.reference)}" aria-pressed="false"><span class="verse-title">${escape(row.reference)}${icon('play')}</span><span class="verse-body">${escape(row.text)}</span></button>`).join(''):'<div class="empty-library"><strong>No encontramos coincidencias.</strong>Prueba con otras palabras o escribe una referencia como Juan 3:16.</div>';
}
function chooseVerse(index){
  const row=state.rows[index];if(!row)return;
  state.selectedSong=null;const slides=verseSlides(state.rows,state.bible.translation),position=slides.findIndex(s=>s.key===row.reference);
  setPreview(slides,Math.max(0,position),{kind:'bible',versionId:state.versionId});
}
$('bibleResults').addEventListener('click',event=>{const card=event.target.closest('[data-index]');if(card)chooseVerse(Number(card.dataset.index));});
function searchBible(){
  if(!state.bible)return;
  const query=$('bibleSearch').value.trim();
  if(!query){renderVerseResults([],'ESCRIBE UNA REFERENCIA','');$('bibleResults').innerHTML='<div class="empty-library">Busca un pasaje como <strong>Juan 3:16</strong>o escribe palabras que recuerdes.</div>';return;}
  const reference=parseReference(query);
  if(reference){
    try{
      let rows=resolveReference(reference,state.bible);
      if(reference.first!==null&&reference.last!==null)rows=rows.filter(r=>r.verse>=reference.first&&r.verse<=reference.last);
      renderVerseResults(rows,`${reference.book.name.toUpperCase()} · CAPÍTULO ${reference.chapter}`,`${rows.length} versículos`);
      chooseVerse(Math.max(0,rows.findIndex(row=>row.verse===reference.first)));scrollSelectedVerse();
      $('bookSelect').value=reference.book.id;updateChapters(reference.chapter);
    }catch(error){$('bibleResultsTitle').textContent='REVISA LA REFERENCIA';$('bibleResultsCount').textContent='';$('bibleResults').innerHTML=`<div class="search-error">${escape(error.message)}</div>`;state.rows=[];}
    return;
  }
  if(/[0-9]\s*[:]/.test(query)){
    renderVerseResults([],'REFERENCIA NO RECONOCIDA','');$('bibleResults').innerHTML='<div class="empty-library">Revisa el nombre del libro. Prueba con <strong>1 Juan 4:8</strong>o con el nombre completo del libro.</div>';return;
  }
  if(normalize(query).length<2){renderVerseResults([],'ESCRIBE AL MENOS DOS LETRAS','');return;}
  const {results,total}=searchVerses(query,state.searchIndex);
  renderVerseResults(results,'RESULTADOS DE BÚSQUEDA',total>100?`100 de ${total}`:String(total));
  if(results.length)chooseVerse(0);
}
$('bibleSearchForm').addEventListener('submit',event=>{event.preventDefault();clearTimeout(searchTimer);searchBible();});
$('bibleSearch').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(searchBible,260);});
document.querySelectorAll('[data-ref]').forEach(button=>button.addEventListener('click',()=>{clearTimeout(searchTimer);$('bibleSearch').value=button.dataset.ref;searchBible();}));
for(const book of BOOKS){const option=document.createElement('option');option.value=book.id;option.textContent=book.name;$('bookSelect').append(option);}
function updateChapters(selected=1){const count=state.bible?.books[$('bookSelect').value]?.length||1;$('chapterSelect').replaceChildren();for(let i=1;i<=count;i++){const option=document.createElement('option');option.value=i;option.textContent=i;$('chapterSelect').append(option);}$('chapterSelect').value=Math.min(selected,count);}
$('bookSelect').addEventListener('change',()=>updateChapters());
$('browseChapter').addEventListener('click',()=>{const book=BOOKS.find(book=>book.id===$('bookSelect').value);$('bibleSearch').value=`${book.name} ${$('chapterSelect').value}`;searchBible();});

function renderSongs(){
  const terms=normalize($('songSearch').value).split(' ').filter(Boolean);
  const matches=state.songs.filter(song=>terms.every(term=>normalize(song.title+' '+song.lyrics).includes(term)));
  $('songCount').textContent=String(matches.length);
  $('songResults').innerHTML=matches.length?matches.map(song=>`<article class="song-card ${state.selectedSong===song.id?'selected':''}" data-song-id="${escape(song.id)}"><button class="song-main" data-song-action="select"><span class="song-title">${icon('music')}${escape(song.title)}</span><p class="song-desc">${escape(song.lyrics.split('\n')[0])}</p></button><div class="song-bottom"><span>${song.sections.length} ${song.sections.length===1?'parte':'partes'} · ${song.order.length} ${song.order.length===1?'paso':'pasos'}${song.id==='original-example'?' · Ejemplo':''}</span><div class="song-actions"><button class="icon-button" data-song-action="edit" aria-label="Editar ${escape(song.title)}">${icon('edit')}</button><button class="icon-button" data-song-action="delete" aria-label="Eliminar ${escape(song.title)}">${icon('trash')}</button></div></div></article>`).join(''):`<div class="empty-library"><strong>${state.songs.length?'Sin coincidencias':'Tu biblioteca empieza aquí.'}</strong>${state.songs.length?'Busca por título o por una parte de la letra.':'Pulsa Agregar para crear tu primer canto, o importa una letra desde un archivo.'}</div>`;
  renderSongParts();
}
function renderSongParts(){
  const song=state.songs.find(item=>item.id===state.selectedSong),panel=$('songPartsPanel');panel.hidden=state.tab!=='songs'||!song;if(panel.hidden)return;
  $('songPartsTitle').textContent=song.title;
  const key=JSON.stringify([song.id,song.title,song.sections,song.order]);
  if(songPartsKey!==key){
    const slides=songSlides(song);
    $('songPartSteps').innerHTML=songSteps(song).map(part=>{
      const pages=slides.filter(slide=>slide.songStep===part.step).length;
      return `<article class="song-step-card" data-song-step-card="${part.step}"><button type="button" class="song-part-pick" data-song-step="${part.step}" data-part-action="preview" aria-label="Preparar ${escape(part.label)}, paso ${part.step+1}" aria-pressed="false"><span class="song-step-heading"><span class="song-step-number">${part.step+1}</span><strong>${escape(part.label)}</strong>${pages>1?`<span class="song-step-pages">${pages} pantallas</span>`:''}</span><span class="song-step-text">${escape(part.text)}</span></button><div class="song-step-footer"><span class="song-step-status" data-part-status></span><button type="button" class="song-part-project" data-song-step="${part.step}" data-part-action="project" aria-label="Proyectar ${escape(part.label)}, paso ${part.step+1}">${icon('play')}Proyectar</button></div></article>`;
    }).join('');songPartsKey=key;
  }
  const preview=state.preview.origin?.kind==='song'&&state.preview.origin.songId===song.id?state.preview.slides[state.preview.index]:null;
  const live=state.live.origin?.kind==='song'&&state.live.origin.songId===song.id?state.live.slides[state.live.index]:null;
  for(const card of $('songPartSteps').children){
    const step=Number(card.dataset.songStepCard),selected=preview?.songStep===step,projected=live?.songStep===step;
    card.classList.toggle('in-preview',selected);card.classList.toggle('in-output',projected&&!state.live.black);card.querySelector('.song-part-pick').setAttribute('aria-pressed',String(selected));
    card.querySelector('[data-part-status]').textContent=projected?(state.live.black?'Salida en negro':selected?'Vista previa · En proyección':'En proyección'):selected?'Vista previa':'';
  }
}
function chooseSongStep(song,step=0,send=false){
  const slides=songSlides(song),index=slides.findIndex(slide=>slide.songStep===step);if(index<0)return;
  state.selectedSong=song.id;if(state.tab!=='songs')selectTab('songs');setPreview(slides,index,{kind:'song',songId:song.id});renderSongs();if(send)project();
}
function chooseSong(song){chooseSongStep(song);}
$('songPartSteps').addEventListener('click',event=>{const button=event.target.closest('[data-song-step]'),song=state.songs.find(item=>item.id===state.selectedSong);if(button&&song)chooseSongStep(song,Number(button.dataset.songStep),button.dataset.partAction==='project');});
$('editSelectedSong').addEventListener('click',()=>{const song=state.songs.find(item=>item.id===state.selectedSong);if(song)openSongEditor(song);});
function persistSongs(songs){
  if(songs.length>500)throw new Error('Puedes guardar hasta 500 cantos.');
  const normalized=songs.map(song=>{const next=normalizeSong(song);songSlides(next);return next;}),payload=JSON.stringify(normalized);
  if(payload.length>3500000)throw new Error('La biblioteca es demasiado grande. Respáldala y reduce el tamaño antes de guardar.');
  try{localStorage.setItem(KEYS.songs,payload);}catch{throw new Error('No se pudo guardar. Revisa el espacio del navegador o usa una ventana normal, fuera de incógnito.');}
  state.songs=normalized;renderSongs();serviceUI?.render();
}
function newSongPart(type='verse'){return {id:crypto.randomUUID(),type,text:''};}
function effectiveSongOrder(){return songEditorOrder??songEditorSections.map(part=>part.id);}
function markSongDraftDirty(){songDraftDirty=true;$('songError').textContent='';$('songDraftStatus').textContent='Guardando borrador…';clearTimeout(songDraftTimer);songDraftTimer=setTimeout(saveSongDraft,350);}
function renderSongOrder(){
  const labels=songPartLabels(songEditorSections),parts=new Map(songEditorSections.map((part,index)=>[part.id,labels[index]])),order=effectiveSongOrder(),selected=$('songOrderPart').value;
  $('songOrderList').innerHTML=order.map((id,index)=>`<li><span class="song-order-label"><span>${index+1}</span><strong>${escape(parts.get(id)||'Parte')}</strong></span><div class="song-order-actions"><button type="button" data-song-order-index="${index}" data-order-action="up" aria-label="Mover antes el paso ${index+1}" ${index===0?'disabled':''}>Antes</button><button type="button" data-song-order-index="${index}" data-order-action="down" aria-label="Mover después el paso ${index+1}" ${index===order.length-1?'disabled':''}>Después</button><button type="button" data-song-order-index="${index}" data-order-action="remove" aria-label="Quitar el paso ${index+1}">Quitar</button></div></li>`).join('');
  $('songOrderPart').innerHTML=songEditorSections.map((part,index)=>`<option value="${escape(part.id)}">${escape(labels[index])}</option>`).join('');
  if(parts.has(selected))$('songOrderPart').value=selected;
  else if(songEditorSections.some(part=>part.type==='chorus'))$('songOrderPart').value=songEditorSections.find(part=>part.type==='chorus').id;
  $('addSongOrder').disabled=!songEditorSections.length||order.length>=MAX_SONG_STEPS;
  $('songEditorCount').textContent=`${songEditorSections.length} ${songEditorSections.length===1?'parte':'partes'} · ${order.length} ${order.length===1?'paso':'pasos'}`;
  $('songPasteReplace').hidden=!songEditorSections.some(part=>part.text.trim());
}
function renderSongEditor(focusId=null,focusType='textarea'){
  const labels=songPartLabels(songEditorSections);
  $('songSectionsEditor').innerHTML=songEditorSections.map((part,index)=>`<article class="song-section-editor" data-section-id="${escape(part.id)}"><div class="song-section-heading"><strong>${escape(labels[index])}</strong><div class="song-section-actions"><button type="button" data-section-action="up" aria-label="Subir ${escape(labels[index])}" ${index===0?'disabled':''}>Subir</button><button type="button" data-section-action="down" aria-label="Bajar ${escape(labels[index])}" ${index===songEditorSections.length-1?'disabled':''}>Bajar</button><button type="button" data-section-action="remove" aria-label="Quitar ${escape(labels[index])}">Quitar</button></div></div><label class="field-label" for="song-part-type-${index}">Tipo de parte</label><select class="text-input" id="song-part-type-${index}" data-section-type>${SONG_PART_TYPES.map(type=>`<option value="${type.id}" ${part.type===type.id?'selected':''}>${type.name}</option>`).join('')}</select><label class="field-label" for="song-part-text-${index}">Letra de ${escape(labels[index])}</label><textarea class="text-input song-part-lyrics" id="song-part-text-${index}" data-section-text maxlength="50000" rows="4" placeholder="Escribe o pega la letra de esta parte…">${escape(part.text)}</textarea></article>`).join('');
  document.querySelectorAll('[data-add-song-part]').forEach(button=>button.disabled=songEditorSections.length>=MAX_SONG_PARTS);renderSongOrder();
  if(focusId){const card=[...$('songSectionsEditor').children].find(element=>element.dataset.sectionId===focusId);card?.querySelector(focusType==='select'?'select':'textarea')?.focus();}
}
function openSongEditor(song=null,draftKey=null){
  currentSongDraftKey=draftKey||song?.id||'new';const draft=state.drafts.songs[currentSongDraftKey];songDraftDirty=false;
  const sections=draft?.sections??(draft?parseSongLyrics(draft.lyrics):song?.sections??[]);songEditorSections=sections.length?sections.map(part=>({...part})):[newSongPart()];
  const order=draft?draft.order:song?.order;songEditorOrder=Array.isArray(order)&&JSON.stringify(order)!==JSON.stringify(songEditorSections.map(part=>part.id))?[...order]:null;
  $('songDialogTitle').textContent=draft?'Retomar borrador':song?'Editar canto':'Agregar canto';$('songId').value=draft?.songId||song?.id||'';$('songTitle').value=draft?.title??song?.title??'';$('songLyrics').value=draft?.pasteText??'';$('songError').textContent='';$('songDraftStatus').classList.remove('save-error');$('songPasteDetails').open=!!draft?.pasteText;
  renderSongEditor();
  $('songDraftStatus').textContent=draft?'Borrador recuperado. Los cambios se guardan automáticamente.':'Los cambios se guardan automáticamente.';$('songDialog').showModal();
}
$('songSectionsEditor').addEventListener('input',event=>{
  if(!event.target.matches('[data-section-text]'))return;const part=songEditorSections.find(part=>part.id===event.target.closest('[data-section-id]').dataset.sectionId);if(part){part.text=event.target.value;markSongDraftDirty();$('songPasteReplace').hidden=!songEditorSections.some(part=>part.text.trim());}
});
$('songSectionsEditor').addEventListener('change',event=>{
  if(!event.target.matches('[data-section-type]'))return;const part=songEditorSections.find(part=>part.id===event.target.closest('[data-section-id]').dataset.sectionId);if(part){part.type=event.target.value;renderSongEditor(part.id,'select');markSongDraftDirty();}
});
$('songSectionsEditor').addEventListener('click',event=>{
  const button=event.target.closest('[data-section-action]');if(!button)return;const id=button.closest('[data-section-id]').dataset.sectionId,index=songEditorSections.findIndex(part=>part.id===id),action=button.dataset.sectionAction;
  if(index<0)return;
  if(action==='remove'){songEditorSections.splice(index,1);if(songEditorOrder)songEditorOrder=songEditorOrder.filter(partId=>partId!==id);if(!songEditorSections.length){songEditorSections=[newSongPart()];songEditorOrder=null;}}
  else{const next=index+(action==='up'?-1:1);if(next<0||next>=songEditorSections.length)return;[songEditorSections[index],songEditorSections[next]]=[songEditorSections[next],songEditorSections[index]];}
  renderSongEditor(action==='remove'?null:id);markSongDraftDirty();
});
document.querySelectorAll('[data-add-song-part]').forEach(button=>button.addEventListener('click',()=>{
  if(songEditorSections.length>=MAX_SONG_PARTS)return;const part=newSongPart(button.dataset.addSongPart);songEditorSections.push(part);if(songEditorOrder&&songEditorOrder.length<MAX_SONG_STEPS)songEditorOrder.push(part.id);renderSongEditor(part.id);markSongDraftDirty();
}));
$('songOrderList').addEventListener('click',event=>{
  const button=event.target.closest('[data-song-order-index]');if(!button)return;const index=Number(button.dataset.songOrderIndex),order=[...effectiveSongOrder()],action=button.dataset.orderAction;
  if(action==='remove')order.splice(index,1);else{const next=index+(action==='up'?-1:1);if(next<0||next>=order.length)return;[order[index],order[next]]=[order[next],order[index]];}
  songEditorOrder=order;renderSongOrder();markSongDraftDirty();
});
$('addSongOrder').addEventListener('click',()=>{const id=$('songOrderPart').value,order=effectiveSongOrder();if(!id||order.length>=MAX_SONG_STEPS)return;songEditorOrder=[...order,id];renderSongOrder();markSongDraftDirty();});
$('resetSongOrder').addEventListener('click',()=>{songEditorOrder=null;renderSongOrder();markSongDraftDirty();});
$('splitSongLyrics').addEventListener('click',()=>{
  try{const parts=parseSongLyrics($('songLyrics').value);if(!parts.length)throw new Error('Pega primero la letra completa del canto.');songEditorSections=parts.map(part=>({...part,id:crypto.randomUUID()}));songEditorOrder=null;$('songLyrics').value='';$('songPasteDetails').open=false;renderSongEditor(songEditorSections[0].id);markSongDraftDirty();toast('Letra separada. Revisa el tipo de cada parte.');}
  catch(error){$('songError').textContent=error.message;}
});
$('addSong').addEventListener('click',()=>openSongEditor());$('songSearch').addEventListener('input',renderSongs);
$('songResults').addEventListener('click',event=>{
  const button=event.target.closest('[data-song-action]'),card=button?.closest('[data-song-id]');if(!button||!card)return;
  const song=state.songs.find(s=>s.id===card.dataset.songId);if(!song)return;
  if(button.dataset.songAction==='select')chooseSong(song);
  if(button.dataset.songAction==='edit')openSongEditor(song);
  if(button.dataset.songAction==='delete'&&confirm(`¿Eliminar «${song.title}» de tus cantos guardados?`)){
    try{persistSongs(state.songs.filter(s=>s.id!==song.id));if(state.selectedSong===song.id)state.selectedSong=null;renderSongParts();toast('Canto eliminado.');}catch(error){toast(error.message);}
  }
});
$('songForm').addEventListener('submit',event=>{
  event.preventDefault();
  try{
    if($('songLyrics').value.trim())throw new Error('Pulsa Convertir en partes para agregar la letra que pegaste antes de guardar.');
    const song=normalizeSong({id:$('songId').value||crypto.randomUUID(),title:$('songTitle').value,sections:songEditorSections,order:effectiveSongOrder()});
    const songs=state.songs.filter(item=>item.id!==song.id);songs.push(song);persistSongs(songs);songDraftDirty=false;clearTimeout(songDraftTimer);
    let draftError='';try{removeSongDraft(currentSongDraftKey);}catch(error){draftError=error.message;}
    currentSongDraftKey=null;$('songDialog').close();chooseSong(state.songs.find(item=>item.id===song.id));toast(draftError?'Canto guardado. No se pudo quitar su borrador: '+draftError:'Canto y orden guardados en este navegador.');
  }catch(error){$('songError').textContent=error.message;if(error.sectionId){const card=[...$('songSectionsEditor').children].find(element=>element.dataset.sectionId===error.sectionId);card?.querySelector('textarea')?.focus();}}
});
$('importSongs').addEventListener('click',()=>$('songFile').click());
$('songFile').addEventListener('change',async()=>{
  const file=$('songFile').files[0];if(!file)return;
  try{
    if(file.size>3500000)throw new Error('El archivo supera el máximo de 3.5 MB.');
    const content=await file.text();let songs;
    if(/\.txt$/i.test(file.name))songs=validateSongs([{title:file.name.replace(/\.txt$/i,'').slice(0,160),lyrics:content}]);
    else if(/\.json$/i.test(file.name))songs=validateSongs(JSON.parse(content));
    else throw new Error('Selecciona un archivo .txt o un respaldo .json.');
    if(state.songs.length+songs.length>500)throw new Error('Puedes guardar hasta 500 cantos en esta primera versión.');
    persistSongs([...state.songs,...songs]);if(songs[0])chooseSong(songs[0]);toast(`${songs.length} canto(s) importado(s).`);
  }catch(error){toast(error instanceof SyntaxError?'El archivo JSON no tiene un formato válido.':error.message);}
  finally{$('songFile').value='';}
});
$('exportSongs').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({schema:'icthus-cantos-v2',songs:state.songs},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`mis-cantos-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Respaldo preparado para descargar.');
});
$('prepareText').addEventListener('click',()=>{const text=$('freeText').value.trim();if(!text){toast('Escribe un mensaje para preparar la vista previa.');return;}state.selectedSong=null;setPreview(textSlides(text,$('freeTitle').value.trim()));});

function help(){$('helpDialog').showModal();}
$('openHelp').addEventListener('click',help);$('shortcutsHelp').addEventListener('click',help);$('versionInfo').addEventListener('click',help);
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$(button.dataset.close).close()));
document.addEventListener('keydown',event=>{
  if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||document.querySelector('dialog[open]'))return;
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.activeElement?.isContentEditable)return;
  // Los botones conservan Enter para su propia acción, sin activar también la proyección.
  if(event.key==='Enter'&&document.activeElement?.tagName!=='BUTTON'){event.preventDefault();project();}
  if(event.key==='ArrowRight'){event.preventDefault();moveLive(1);}
  if(event.key==='ArrowLeft'){event.preventDefault();moveLive(-1);}
  if(event.key.toLowerCase()==='b'){event.preventDefault();toggleBlack();}
  if(event.key==='/'){event.preventDefault();if(['history','favorites','service'].includes(state.tab))selectTab('bible');const target=state.tab==='songs'?$('songSearch'):state.tab==='text'?$('freeText'):$('bibleSearch');target.focus();}
});
const resizeObserver=new ResizeObserver(entries=>{for(const entry of entries)fitSlide(entry.target);});resizeObserver.observe($('previewStage'));resizeObserver.observe($('liveStage'));
updateAppearance();renderLive();renderSongs();renderSavedLists();restoreDrafts();renderSongDrafts();
async function loadBible(){
  try{
    const response=await fetch('./data/rv1909.json');if(!response.ok)throw new Error('download');
    const base=await response.json();base.id='RV1909';state.versionCache.set('RV1909',base);
    const imported=await Promise.allSettled(BIBLE_VERSIONS.filter(v=>!v.included).map(v=>loadImportedBible(v.id)));
    for(const result of imported)if(result.status==='fulfilled'&&result.value&&BIBLE_VERSIONS.some(v=>v.id===result.value.id))state.versionCache.set(result.value.id,result.value);
    renderVersionOptions();const desired=state.versionCache.has(settings.versionId)?settings.versionId:'RV1909';await activateVersion(desired);
  }catch{
    $('bibleResultsTitle').textContent='NO SE PUDO CARGAR';$('bibleResults').innerHTML='<div class="search-error">No se pudo descargar la Biblia. Revisa tu conexión y <button class="text-button" id="retryBible">vuelve a intentarlo</button>.</div>';$('retryBible').addEventListener('click',loadBible);$('selectionLabel').textContent='Sin selección';
  }
}
loadBible();
async function setupOffline(){
  if(!('serviceWorker' in navigator)){$('offlineStatus').textContent='Modo en línea';return;}
  try{
    const registration=await navigator.serviceWorker.register('./sw.js');
    navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='offline-ready')showOfflineReady();});
    const ready=await navigator.serviceWorker.ready;
    if(ready.active)ready.active.postMessage({type:'check-ready'});
    registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='activated')worker.postMessage({type:'check-ready'});});});
    $('offlineStatus').innerHTML=icon('download')+'Preparando modo sin conexión…';
  }catch{$('offlineStatus').textContent='Modo en línea · no se completó la descarga';}
}
function showOfflineReady(){$('offlineStatus').classList.add('ready');$('offlineStatus').innerHTML=icon('check')+'Lista sin conexión';$('appOfflineInfo').textContent='Lista sin conexión. Puedes buscar y proyectar el contenido guardado en este navegador.';}
setupOffline();

// Historial y favoritos: recuperar contenido nunca lo envía a la salida.
function entryFor(slide,origin,index=0){
  if(!origin?.kind){const version=BIBLE_VERSIONS.find(v=>v.name===slide?.version);origin=version?{kind:'bible',versionId:version.id}:{kind:'text'};}
  return contentEntry(slide,origin,index);
}
function previewEntry(){return entryFor(state.preview.slides[state.preview.index],state.preview.origin,state.preview.index);}
function renderFavoriteButton(){
  const entry=previewEntry(),saved=!!entry&&state.favorites.some(item=>item.id===entry.id),button=$('toggleFavorite');
  button.disabled=!entry;button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',saved?'Quitar de favoritos':'Guardar en favoritos');button.innerHTML=icon('star')+`<span>${saved?'Guardado':'Guardar'}</span>`;
}
function toggleEntryFavorite(entry){
  if(!entry)return;
  try{const next=toggleFavorite(state.favorites,entry);savePersonal(localStorage,PERSONAL_KEYS.favorites,next);state.favorites=next;renderSavedLists();renderFavoriteButton();toast(next.some(item=>item.id===entry.id)?'Guardado en favoritos.':'Se quitó de favoritos.');}
  catch(error){toast(error.message);}
}
$('toggleFavorite').addEventListener('click',()=>toggleEntryFavorite(previewEntry()));
function rememberProjection(){
  const entry=entryFor(state.live.slides[state.live.index],state.live.origin,state.live.index);if(!entry)return;
  try{const next=addToHistory(state.history,entry);savePersonal(localStorage,PERSONAL_KEYS.history,next);state.history=next;renderSavedLists();}
  catch(error){toast('No se pudo guardar el historial. '+error.message);}
}
function entryDate(value){return new Date(value).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}
function savedCard(entry){
  const favorite=state.favorites.some(item=>item.id===entry.id),kind={bible:'Versículo',song:'Canto',text:'Mensaje'}[entry.kind];
  return `<article class="saved-card" data-entry-id="${escape(entry.id)}"><button class="saved-main" data-saved-action="restore" aria-label="Preparar ${escape(entry.title)}"><span class="saved-kind">${icon(entry.kind==='bible'?'book':entry.kind==='song'?'music':'text')}${kind}${entry.slide.version?' · '+escape(entry.slide.version):''}</span><strong>${escape(entry.title)}</strong><p>${escape(entry.slide.text)}</p></button><div class="saved-card-footer"><time datetime="${new Date(entry.usedAt).toISOString()}">${escape(entryDate(entry.usedAt))}</time><button class="icon-button saved-star" data-saved-action="favorite" aria-pressed="${favorite}" aria-label="${favorite?'Quitar de favoritos':'Guardar en favoritos'}">${icon('star')}</button></div></article>`;
}
function renderSavedLists(){
  $('historyCount').textContent=state.history.length;$('favoritesCount').textContent=state.favorites.length;$('clearHistory').disabled=!state.history.length;
  $('historyResults').innerHTML=state.history.length?state.history.map(savedCard).join(''):'<div class="empty-library"><strong>Aquí comienza tu historial.</strong>Los contenidos aparecerán cuando pulses Proyectar o avances en la salida.</div>';
  $('favoritesResults').innerHTML=state.favorites.length?state.favorites.map(savedCard).join(''):'<div class="empty-library"><strong>Ten tus mensajes a mano.</strong>Selecciona un versículo, canto o anuncio y pulsa la estrella de la vista previa.</div>';
}
async function restoreEntry(entry){
  if(entry.kind==='bible'&&state.versionCache.has(entry.source.versionId)){
    const ready=await activateVersion(entry.source.versionId,entry.source.reference);
    if(ready){
      const index=state.preview.slides.findIndex(slide=>slide.key===entry.source.reference&&slide.text===entry.slide.text);
      if(index>=0){state.preview.index=index;renderPreview();scrollSelectedVerse();return;}
      if(state.preview.slides.some(slide=>slide.key===entry.source.reference))return;
    }
  }
  if(entry.kind==='song'){
    const song=state.songs.find(item=>item.id===entry.source.songId);
    if(song){
      const slides=songSlides(song);let index;
      if(entry.source.sectionId){
        index=slides.findIndex(slide=>slide.songSectionId===entry.source.sectionId&&slide.songStep===entry.source.step&&slide.songPartPage===(entry.source.page||0));
        if(index<0)index=slides.findIndex(slide=>slide.songSectionId===entry.source.sectionId&&slide.songPartPage===(entry.source.page||0));
        if(index<0)index=slides.findIndex(slide=>slide.songSectionId===entry.source.sectionId);
        if(index<0){state.selectedSong=null;selectTab('songs');setPreview([{...entry.slide}],0,entry.source);toast('Esta parte ya no está en el orden del canto. Se recuperó el texto guardado.');return;}
      }else{index=slides.findIndex(slide=>slide.text===entry.slide.text);if(index<0)index=Math.min(entry.source.index||0,slides.length-1);}
      chooseSong(song);state.preview.index=index;renderPreview();return;
    }
  }
  // También permite recuperar un anuncio o el último texto de un canto eliminado.
  setPreview([{...entry.slide}],0,entry.source);toast('Contenido recuperado en la vista previa.');
}
for(const id of ['historyResults','favoritesResults'])$(id).addEventListener('click',event=>{
  const button=event.target.closest('[data-saved-action]'),card=button?.closest('[data-entry-id]');if(!button||!card)return;
  const entry=(id==='historyResults'?state.history:state.favorites).find(item=>item.id===card.dataset.entryId);if(!entry)return;
  if(button.dataset.savedAction==='favorite')toggleEntryFavorite(entry);else restoreEntry(entry).catch(()=>toast('No se pudo recuperar el contenido. Vuelve a buscarlo en tu biblioteca.'));
});
$('clearHistory').addEventListener('click',()=>{
  if(!state.history.length||!confirm('¿Vaciar el historial de proyección? Tus favoritos y cantos se conservarán.'))return;
  try{savePersonal(localStorage,PERSONAL_KEYS.history,[]);state.history=[];renderSavedLists();toast('Historial vacío.');}catch(error){toast(error.message);}
});

// Borradores: escritura local con espera breve y guardado al cerrar o recargar.
function writeDrafts(next){if(Object.keys(next.songs).length>25)throw new Error('Tienes 25 borradores de cantos. Guarda o descarta uno antes de crear otro.');const cleaned=cleanDrafts(next);savePersonal(localStorage,PERSONAL_KEYS.drafts,cleaned);state.drafts=cleaned;renderSongDrafts();}
function restoreDrafts(){
  if(state.drafts.text){$('freeTitle').value=state.drafts.text.title;$('freeText').value=state.drafts.text.text;$('textDraftStatus').textContent='Borrador recuperado.';}
}
function renderSongDrafts(){
  const entries=Object.entries(state.drafts.songs).sort((a,b)=>b[1].updatedAt-a[1].updatedAt);
  $('songDraftBrowser').hidden=!entries.length;$('songDraftCount').textContent=entries.length;
  $('songDraftList').innerHTML=entries.map(([key,draft])=>`<button class="draft-item" data-draft-key="${escape(key)}"><strong>${escape(draft.title||'Canto sin título')}</strong><span>${escape(entryDate(draft.updatedAt))}</span></button>`).join('');
}
function saveTextDraft(){
  clearTimeout(textDraftTimer);if(!textDraftDirty)return;
  const title=$('freeTitle').value,text=$('freeText').value;
  try{writeDrafts({...state.drafts,text:title.trim()||text.trim()?{title,text,updatedAt:Date.now()}:null});textDraftDirty=false;$('textDraftStatus').textContent=state.drafts.text?'Borrador guardado.':'Sin borrador.';$('textDraftStatus').classList.remove('save-error');}
  catch(error){$('textDraftStatus').textContent=error.message;$('textDraftStatus').classList.add('save-error');}
}
function saveSongDraft(){
  clearTimeout(songDraftTimer);if(!songDraftDirty||!currentSongDraftKey)return;
  try{
    const title=$('songTitle').value,sections=validateSongParts(songEditorSections,{draft:true}),lyrics=sections.map(part=>part.text).join('\n\n'),pasteText=$('songLyrics').value,songs={...state.drafts.songs};
    if(title.trim()||lyrics.trim()||pasteText.trim()||sections.length>1||sections.some(part=>part.type!=='verse'))songs[currentSongDraftKey]={songId:$('songId').value||null,title,lyrics,sections,order:songEditorOrder===null?null:validateSongOrder(songEditorOrder,sections,{draft:true}),pasteText,updatedAt:Date.now()};else delete songs[currentSongDraftKey];
    writeDrafts({...state.drafts,songs});songDraftDirty=false;$('songDraftStatus').textContent='Borrador guardado. Puedes cerrar y retomarlo después.';$('songDraftStatus').classList.remove('save-error');
  }
  catch(error){$('songDraftStatus').textContent=error.message;$('songDraftStatus').classList.add('save-error');}
}
function removeSongDraft(key){if(!key)return;const songs={...state.drafts.songs};delete songs[key];writeDrafts({...state.drafts,songs});}
for(const id of ['freeTitle','freeText'])$(id).addEventListener('input',()=>{textDraftDirty=true;$('textDraftStatus').textContent='Guardando borrador…';clearTimeout(textDraftTimer);textDraftTimer=setTimeout(saveTextDraft,350);});
for(const id of ['songTitle','songLyrics'])$(id).addEventListener('input',markSongDraftDirty);
$('songDialog').addEventListener('close',saveSongDraft);
window.addEventListener('pagehide',()=>{saveTextDraft();saveSongDraft();});
window.addEventListener('beforeunload',()=>{saveTextDraft();saveSongDraft();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){saveTextDraft();saveSongDraft();}});
$('songDraftList').addEventListener('click',event=>{const button=event.target.closest('[data-draft-key]');if(!button)return;const draft=state.drafts.songs[button.dataset.draftKey];if(draft)openSongEditor(state.songs.find(song=>song.id===draft.songId)||null,button.dataset.draftKey);});
$('discardTextDraft').addEventListener('click',()=>{
  if(($('freeTitle').value||$('freeText').value)&&!confirm('¿Vaciar este borrador de anuncio?'))return;
  try{writeDrafts({...state.drafts,text:null});clearTimeout(textDraftTimer);textDraftDirty=false;$('freeTitle').value='';$('freeText').value='';$('textDraftStatus').textContent='Sin borrador.';}catch(error){toast(error.message);}
});
$('discardSongDraft').addEventListener('click',()=>{
  if(!confirm('¿Descartar este borrador? El canto guardado en tu biblioteca se conservará.'))return;
  try{removeSongDraft(currentSongDraftKey);clearTimeout(songDraftTimer);songDraftDirty=false;currentSongDraftKey=null;$('songDialog').close();toast('Borrador descartado.');}catch(error){toast(error.message);}
});

// Versiones: cada búsqueda y cada favorito conserva la edición correspondiente.
function renderVersionOptions(){
  $('bibleVersion').innerHTML=BIBLE_VERSIONS.map(version=>`<option value="${version.id}">${escape(version.name)}${version.included||state.versionCache.has(version.id)?'':' · añadir archivo'}</option>`).join('');$('bibleVersion').value=state.versionId;
  $('versionAvailability').innerHTML=BIBLE_VERSIONS.map(version=>`<div class="version-state"><strong>${escape(version.name)}</strong><span class="${version.included||state.versionCache.has(version.id)?'available':''}">${version.included?'Incluida':state.versionCache.has(version.id)?'Archivo cargado':'Pendiente de activar'}</span></div>`).join('');
}
function openVersions(target){if(target&&target!=='RV1909')$('importVersionTarget').value=target;$('versionImportError').textContent='';$('versionImportStatus').textContent='';renderVersionOptions();$('versionsDialog').showModal();}
let versionImportController=null;
$('importVersionSource').addEventListener('change',()=>{
  const isUrl=$('importVersionSource').value==='url';$('versionFileFields').hidden=isUrl;$('versionUrlFields').hidden=!isUrl;
  $('versionImportError').textContent='';$('versionImportStatus').textContent='';
});
$('versionsDialog').addEventListener('close',()=>versionImportController?.abort());
$('manageVersions').addEventListener('click',()=>openVersions());
$('bibleVersion').addEventListener('change',()=>{
  const id=$('bibleVersion').value;
  if(!state.versionCache.has(id)){$('bibleVersion').value=state.versionId;openVersions(id);return;}
  activateVersion(id).catch(()=>toast('No se pudo cambiar la versión. Inténtalo de nuevo.'));
});
async function activateVersion(id,query=$('bibleSearch').value){
  const token=++loadingVersion;let bible=state.versionCache.get(id);
  if(!bible&&!BIBLE_VERSIONS.find(version=>version.id===id)?.included)bible=await loadImportedBible(id);
  if(token!==loadingVersion)return false;
  if(!bible)return false;
  state.versionCache.set(id,bible);state.bible=bible;state.versionId=id;state.searchIndex=buildSearchIndex(bible);
  const metadata=BIBLE_VERSIONS.find(version=>version.id===id);
  renderVersionOptions();$('versionBadge').textContent=metadata.short;$('bibleInfo').textContent=`${Object.keys(bible.books).length} libros · ${metadata.name}`;$('activeVersionCopyright').textContent=bible.copyright||metadata.copyright;
  saveSettings();updateChapters();$('bibleSearch').value=query;searchBible();return true;
}
$('importBibleVersion').addEventListener('click',async()=>{
  const file=$('bibleVersionFile').files[0],isUrl=$('importVersionSource').value==='url',target=$('importVersionTarget').value;
  $('versionImportError').textContent='';$('versionImportStatus').textContent='';
  if(!isUrl&&!file){$('versionImportError').textContent='Selecciona el archivo JSON de la versión.';return;}
  if(isUrl&&!$('bibleVersionUrl').value.trim()){$('versionImportError').textContent='Pega el enlace directo al archivo JSON.';return;}
  const controls=['importBibleVersion','importVersionTarget','importVersionSource','bibleVersionFile','bibleVersionUrl'];
  controls.forEach(id=>$(id).disabled=true);const controller=new AbortController();versionImportController=controller;
  try{
    if(!isUrl&&file.size>MAX_BIBLE_JSON_BYTES)throw new Error('El archivo supera el máximo de 15 MB.');
    $('versionImportStatus').textContent=isUrl?'Descargando el archivo…':'Revisando el archivo…';
    const data=isUrl?await fetchBibleJson($('bibleVersionUrl').value,{signal:controller.signal}):parseBibleJson(await file.text());
    if(controller.signal.aborted)return;
    const bible=importBibleData(data,target);
    $('versionImportStatus').textContent='Guardando la versión en este navegador…';await saveImportedBible(bible);state.versionCache.set(target,bible);renderVersionOptions();
    if(controller.signal.aborted)return;
    await activateVersion(target);
    $('versionImportStatus').textContent=`${bible.translation} cargada: 66 libros · ${bible.verseCount.toLocaleString('es-MX')} versículos. Ya puedes buscar y proyectar.`;
    $('bibleVersionFile').value='';$('bibleVersionUrl').value='';toast('Versión bíblica importada y activada.');
  }catch(error){$('versionImportStatus').textContent='';if(!controller.signal.aborted)$('versionImportError').textContent=error.message;}
  finally{controls.forEach(id=>$(id).disabled=false);if(versionImportController===controller)versionImportController=null;}
});

// Instalación y traslado: los datos se revisan antes de sustituir el almacenamiento local.
setupInstallation({button:$('installIcthus'),status:$('installationStatus'),help:$('installChromeHelp'),hostedNotice:$('hostedInstallNotice'),hostedDownload:$('hostedPackageDownload')});
$('openAppTools').addEventListener('click',()=>$('appToolsDialog').showModal());
let pendingAppBackup=null;
$('exportAppData').addEventListener('click',()=>{
  $('appBackupError').textContent='';$('appBackupStatus').textContent='';
  try{
    saveTextDraft();saveSongDraft();if(textDraftDirty||songDraftDirty)throw new Error('No se pudo guardar el borrador actual. Revisa el aviso antes de descargar la copia.');
    const backup=createDataBackup({songs:state.songs,settings:{...normalizeAppearance(state),versionId:state.versionId},history:state.history,favorites:state.favorites,drafts:state.drafts,serviceList:serviceUI.getPlan()});
    const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`icthus-mis-datos-${new Date().toISOString().slice(0,10)}.json`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('appBackupStatus').textContent='Copia preparada para descargar. Consérvala para restaurarla en el nuevo enlace.';
  }catch(error){$('appBackupError').textContent=error.message;}
});
let backupFileGeneration=0;
$('appBackupFile').addEventListener('change',async()=>{
  const generation=++backupFileGeneration;pendingAppBackup=null;$('restoreAppData').disabled=true;$('appBackupSummary').hidden=true;$('appBackupError').textContent='';$('appBackupStatus').textContent='';
  const file=$('appBackupFile').files[0];if(!file)return;
  try{
    if(file.size>MAX_DATA_BACKUP_BYTES)throw new Error('La copia supera 15 MB.');
    const backup=parseDataBackup(JSON.parse(await file.text()));if(generation!==backupFileGeneration)return;
    pendingAppBackup=backup;const d=backup.data,count=Object.keys(d.drafts.songs).length+(d.drafts.text?1:0);
    $('appBackupSummary').textContent=`Copia revisada: ${d.songs.length} cantos, ${d.favorites.length} favoritos, ${d.history.length} entradas de historial y ${count} borradores. `+(d.serviceList?`Incluye una lista del culto con ${d.serviceList.items.length} elementos. `:'No incluye lista del culto; se conservará la actual. ')+'Tus datos todavía no han cambiado.';
    $('appBackupSummary').hidden=false;$('restoreAppData').disabled=false;
  }catch(error){if(generation===backupFileGeneration)$('appBackupError').textContent=error instanceof SyntaxError?'El archivo no contiene una copia JSON válida.':error.message;}
});
$('restoreAppData').addEventListener('click',async()=>{
  if(!pendingAppBackup||!confirm('¿Restaurar esta copia? Reemplazará tus datos de este enlace. La lista del culto solo se reemplaza si está incluida en la copia.'))return;
  $('restoreAppData').disabled=true;$('appBackupError').textContent='';
  try{
    const backup=parseDataBackup(pendingAppBackup),background=backup.data.settings.background;
    if(background.mode==='image'){
      const image=await currentBackgroundImage().catch(()=>null);
      if(image?.id!==background.imageId){background.mode='theme';background.imageId=null;}
    }
    restoreDataBackup(localStorage,backup);textDraftDirty=false;songDraftDirty=false;clearTimeout(textDraftTimer);clearTimeout(songDraftTimer);location.reload();
  }catch(error){$('appBackupError').textContent=error.message;$('restoreAppData').disabled=false;}
});

// Lista del culto: seleccionar prepara; solo los controles de proyección cambian la salida.
serviceUI=setupServiceList({
  getPreview:()=>state.preview,getLive:()=>state.live,getSongs:()=>state.songs,selectTab,project,toast,
  prepare:(slides,origin)=>{state.selectedSong=null;setPreview(slides,0,origin);},
  sendLive:(item,index=0,black=false)=>{
    state.live={slides:item.slides.map(slide=>({...slide})),index,origin:item.origin,black:!!black,...normalizeAppearance(state)};
    sendProjection();rememberProjection();
  },
  onChange:()=>renderLive()
});
renderLive();
