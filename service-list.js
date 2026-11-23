import {songSlides} from './core.js';

export const SERVICE_KEY='icthus-service-v1';
export const MAX_SERVICE_ITEMS=100;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
const fail=()=>{throw new Error('La lista del culto tiene un formato no válido.');};
export function emptyServiceList(){return {schema:'icthus-service-v1',title:'Mi culto',items:[],updatedAt:Date.now()};}
function source(value){
  if(!object(value)||!['bible','song','text'].includes(value.kind))fail();
  const result={kind:value.kind};
  if(value.kind==='bible'){
    if(typeof value.versionId!=='string'||!value.versionId||value.versionId.length>200)fail();
    result.versionId=value.versionId;
  }
  if(value.kind==='song'){
    if(typeof value.songId!=='string'||!value.songId||value.songId.length>200)fail();
    result.songId=value.songId;
  }
  return result;
}
function slide(value){
  if(!object(value)||typeof value.text!=='string'||!value.text.trim()||value.text.length>50000||typeof value.reference!=='string'||value.reference.length>500||typeof value.version!=='string'||value.version.length>200)fail();
  const result={text:value.text,reference:value.reference,version:value.version};
  if(typeof value.key==='string'&&value.key.length<=500)result.key=value.key;
  for(const key of ['songSectionId','songPartLabel'])if(typeof value[key]==='string'&&value[key].length<=100)result[key]=value[key];
  for(const key of ['songStep','songPartPage','songPartPages'])if(Number.isInteger(value[key])&&value[key]>=0&&value[key]<=2000)result[key]=value[key];
  return result;
}
export function normalizeServiceList(value){
  if(!object(value)||value.schema!=='icthus-service-v1'||typeof value.title!=='string'||value.title.length>160||!Array.isArray(value.items)||value.items.length>MAX_SERVICE_ITEMS||!Number.isFinite(value.updatedAt))fail();
  const ids=new Set();
  const items=value.items.map(item=>{
    if(!object(item)||!validId(item.id)||ids.has(item.id)||typeof item.title!=='string'||!item.title.trim()||item.title.length>160||!Array.isArray(item.slides)||!item.slides.length||item.slides.length>2000)fail();
    ids.add(item.id);const origin=source(item.origin);
    return {id:item.id,title:item.title,origin,followSong:origin.kind==='song'&&item.followSong===true,slides:item.slides.map(slide)};
  });
  const result={schema:'icthus-service-v1',title:value.title,items,updatedAt:value.updatedAt};
  if(JSON.stringify(result).length>1200000)throw new Error('La lista ocupa demasiado espacio. Quita contenido o guarda una copia antes de continuar.');
  return result;
}
export function createServiceItem(value){
  return normalizeServiceList({...emptyServiceList(),items:[{...value,id:crypto.randomUUID()}]}).items[0];
}
export function saveServiceList(storage,value){
  const result=normalizeServiceList(value);
  try{storage.setItem(SERVICE_KEY,JSON.stringify(result));}catch{throw new Error('No se pudo guardar la lista. Revisa el espacio del navegador antes de cerrar.');}
  return result;
}
export function resolveServiceItem(item,songs=[]){
  const song=item.followSong&&songs.find(song=>song.id===item.origin.songId);
  const slides=song?songSlides(song):item.slides.map(item=>({...item}));
  return {...item,slides,origin:{...item.origin,serviceItemId:item.id},usingCopy:item.followSong&&!song};
}
export function serviceNeighbor(list,id,direction){
  const index=list.items.findIndex(item=>item.id===id);
  return index<0?null:list.items[index+(direction<0?-1:1)]||null;
}
export function serviceChoices(preview,songs=[]){
  const current=preview?.slides?.[preview.index];if(!current)return [];
  const origin=source(preview.origin||{kind:'text'}),slides=preview.slides;
  if(origin.kind==='bible'){
    const key=current.key||current.reference;
    const verse=slides.filter(item=>(item.key||item.reference)===key);
    const choices=[{id:'current',title:key,origin,slides:verse,followSong:false,label:'Versículo actual · '+key}];
    const keys=[...new Set(slides.map(item=>item.key||item.reference))],parts=keys.map(key=>/^(.*):(\d+)$/.exec(key));
    const continuous=parts.length>1&&parts.every((part,index)=>part&&part[1]===parts[0][1]&&(!index||Number(part[2])===Number(parts[index-1][2])+1));
    if(continuous)choices.push({id:'whole',title:keys[0]+' – '+keys.at(-1),origin,slides,followSong:false,label:`Pasaje completo · ${keys.length} versículos (${slides.length} pantallas)`});
    return choices;
  }
  if(origin.kind==='song'){
    const song=songs.find(item=>item.id===origin.songId),whole=song?songSlides(song):slides;
    const choices=[{id:'whole',title:song?.title||current.reference||'Canto',origin,slides:whole,followSong:!!song,label:`Canto completo · ${whole.length} pantallas`}];
    if(current.songSectionId){
      const part=slides.filter(item=>item.songSectionId===current.songSectionId&&item.songStep===current.songStep);
      if(part.length&&part.length<whole.length)choices.push({id:'current',title:(current.reference+' · '+current.songPartLabel).slice(0,160),origin,slides:part,followSong:false,label:'Solo esta parte · '+current.songPartLabel});
    }
    return choices;
  }
  return [{id:'whole',title:current.reference||'Anuncio',origin,slides,followSong:false,label:`Mensaje completo · ${slides.length} ${slides.length===1?'pantalla':'pantallas'}`}];
}
