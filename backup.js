import {normalizeSong} from './songs.js';
import {songSlides} from './core.js';
import {normalizeAppearance} from './appearance.js';
import {PERSONAL_KEYS,validEntry,cleanDrafts,emptyDrafts} from './personal-library.js';

export const MAX_DATA_BACKUP_BYTES=15000000;
export const APP_DATA_KEYS={songs:'ap-songs-v1',settings:'ap-settings-v1',...PERSONAL_KEYS};
const fail=()=>{throw new Error('La copia de Icthus no es válida o supera los límites de almacenamiento.');};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const serialized=value=>JSON.stringify(value);

export function parseDataBackup(value){
  if(!object(value)||value.schema!=='icthus-backup-v1'||!Number.isFinite(Date.parse(value.createdAt))||!object(value.data))fail();
  if(serialized(value).length>MAX_DATA_BACKUP_BYTES)fail();
  const data=value.data;
  if(!Array.isArray(data.songs)||data.songs.length>500)fail();
  const ids=new Set();
  const songs=data.songs.map(item=>{
    if(!object(item)||typeof item.id!=='string'||!item.id||item.id.length>200||ids.has(item.id))fail();
    ids.add(item.id);const song=normalizeSong(item);songSlides(song);return song;
  });
  if(!object(data.settings))fail();
  const settings={...normalizeAppearance(data.settings),versionId:['RV1909','RVR1960','TLA'].includes(data.settings.versionId)?data.settings.versionId:'RV1909'};
  const entries=(items,limit)=>{
    if(!Array.isArray(items)||items.length>limit||items.some(item=>!validEntry(item))||new Set(items.map(item=>item.id)).size!==items.length)fail();
    return JSON.parse(serialized(items));
  };
  const history=entries(data.history,60),favorites=entries(data.favorites,100);
  if(!object(data.drafts)||data.drafts.schema!=='icthus-drafts-v1'||!object(data.drafts.songs)||Object.keys(data.drafts.songs).length>25)fail();
  const drafts=cleanDrafts(data.drafts);
  if(!!data.drafts.text!==!!drafts.text||Object.keys(data.drafts.songs).length!==Object.keys(drafts.songs).length)fail();
  for(const [key,draft] of Object.entries(data.drafts.songs)){
    // cleanDrafts can recover legacy lyrics; a full backup must retain valid structured parts.
    if(draft.sections&&serialized(drafts.songs[key].sections)!==serialized(draft.sections))fail();
    if(draft.order!==undefined&&serialized(drafts.songs[key].order)!==serialized(draft.order))fail();
  }
  const result={schema:'icthus-backup-v1',appVersion:'0.5.0',createdAt:value.createdAt,data:{songs,settings,history,favorites,drafts}};
  for(const [key,item] of Object.entries(result.data))if(serialized(item).length>(key==='songs'?3000000:1200000))fail();
  return result;
}

export function createDataBackup({songs=[],settings={},history=[],favorites=[],drafts=emptyDrafts()}={}){
  return parseDataBackup({schema:'icthus-backup-v1',appVersion:'0.5.0',createdAt:new Date().toISOString(),data:{songs,settings,history,favorites,drafts}});
}

export function restoreDataBackup(storage,value){
  const backup=parseDataBackup(value),before=new Map();
  for(const key of Object.values(APP_DATA_KEYS))before.set(key,storage.getItem(key));
  try{for(const [name,key] of Object.entries(APP_DATA_KEYS))storage.setItem(key,serialized(backup.data[name]));}
  catch{
    let recovered=true;
    for(const [key,previous] of before)try{if(previous===null)storage.removeItem(key);else storage.setItem(key,previous);}catch{recovered=false;}
    throw new Error(recovered?'No se pudo restaurar la copia. Tus datos anteriores se conservaron. Revisa el espacio disponible.':'No se pudo completar la restauración ni recuperar todos los datos anteriores. Conserva tu copia y vuelve a intentarlo.');
  }
  return backup;
}
