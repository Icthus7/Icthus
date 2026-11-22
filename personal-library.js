// Datos personales locales. Conserva las claves anteriores al cambio de nombre.
import {songDraftParts} from './songs.js';
export const PERSONAL_KEYS={history:'icthus-history-v1',favorites:'icthus-favorites-v1',drafts:'icthus-drafts-v1'};
const isString=value=>typeof value==='string';
const validSlide=slide=>slide&&isString(slide.text)&&slide.text.length<=50000&&isString(slide.reference)&&slide.reference.length<=500&&isString(slide.version)&&slide.version.length<=200;

export function contentEntry(slide,origin={},index=0,now=Date.now()){
  if(!validSlide(slide))return null;
  const kind=['bible','song','text'].includes(origin?.kind)?origin.kind:'text';
  const source={kind};
  let id;
  if(kind==='bible'){
    source.versionId=String(origin.versionId||'RV1909');source.reference=slide.key||slide.reference;
    id=`bible:${source.versionId}:${source.reference}`;
  }else if(kind==='song'&&isString(origin.songId)){
    source.songId=origin.songId;source.index=Math.max(0,Math.trunc(index)||0);id=`song:${origin.songId}`;
    if(isString(slide.songSectionId)&&slide.songSectionId.length<=100){source.sectionId=slide.songSectionId;source.page=Number.isInteger(slide.songPartPage)?Math.max(0,slide.songPartPage):0;source.step=Number.isInteger(slide.songStep)?Math.max(0,slide.songStep):0;}
  }else{
    source.kind='text';id='text:'+fingerprint(JSON.stringify([slide.reference,slide.text]));
  }
  const snapshot={text:slide.text,reference:slide.reference,version:slide.version};
  if(isString(slide.key))snapshot.key=slide.key;
  if(source.sectionId){snapshot.songSectionId=source.sectionId;snapshot.songPartPage=source.page;snapshot.songStep=source.step;if(isString(slide.songPartLabel))snapshot.songPartLabel=slide.songPartLabel.slice(0,100);}
  return {id,kind:source.kind,title:slide.reference||slide.text.slice(0,70),slide:snapshot,source,savedAt:now,usedAt:now};
}
function fingerprint(value){let hash=14695981039346656037n;for(const char of value){hash^=BigInt(char.codePointAt(0));hash=BigInt.asUintN(64,hash*1099511628211n);}return hash.toString(16);}
export function validEntry(value){
  return !!value&&isString(value.id)&&value.id.length<=1200&&['bible','song','text'].includes(value.kind)&&isString(value.title)&&value.title.length<=500&&validSlide(value.slide)&&value.source&&value.source.kind===value.kind&&
    (value.kind!=='bible'||isString(value.source.versionId)&&isString(value.source.reference))&&
    (value.kind!=='song'||isString(value.source.songId)&&Number.isInteger(value.source.index)&&value.source.index>=0)&&
    Number.isFinite(value.savedAt)&&Number.isFinite(new Date(value.savedAt).getTime())&&Number.isFinite(value.usedAt)&&Number.isFinite(new Date(value.usedAt).getTime());
}
export function cleanEntries(value,limit=100){return Array.isArray(value)?value.filter(validEntry).slice(0,limit):[];}
export function addToHistory(history,entry,limit=60){if(!validEntry(entry))return cleanEntries(history,limit);return [entry,...cleanEntries(history,limit).filter(item=>item.id!==entry.id)].slice(0,limit);}
export function toggleFavorite(favorites,entry,limit=100){
  const list=cleanEntries(favorites,limit);if(!validEntry(entry))return list;
  if(list.some(item=>item.id===entry.id))return list.filter(item=>item.id!==entry.id);
  if(list.length>=limit)throw new Error(`Puedes guardar hasta ${limit} favoritos. Quita uno para agregar otro.`);
  return [entry,...list];
}
export function emptyDrafts(){return {schema:'icthus-drafts-v1',text:null,songs:{}};}
export function cleanDrafts(value){
  const result=emptyDrafts();if(value?.schema!=='icthus-drafts-v1')return result;
  const text=value.text;
  if(text&&isString(text.title)&&text.title.length<=160&&isString(text.text)&&text.text.length<=20000&&Number.isFinite(text.updatedAt))result.text={title:text.title,text:text.text,updatedAt:text.updatedAt};
  if(value.songs&&typeof value.songs==='object'){
    for(const [key,song] of Object.entries(value.songs).slice(0,25)){
      if(key==='__proto__'||key==='constructor'||key==='prototype')continue;
      if(song&&isString(song.title)&&song.title.length<=160&&isString(song.lyrics)&&song.lyrics.length<=50000&&Number.isFinite(song.updatedAt)&&(song.songId===null||isString(song.songId))){
        result.songs[key]={songId:song.songId,title:song.title,lyrics:song.lyrics,updatedAt:song.updatedAt};
        try{Object.assign(result.songs[key],songDraftParts(song));}catch{/* Conserva la letra del borrador aunque sus partes requieran revisión. */}
      }
    }
  }
  return result;
}
export function savePersonal(storage,key,value){
  const serialized=JSON.stringify(value);
  if(serialized.length>1200000)throw new Error('Estos datos ocupan demasiado espacio. Reduce el contenido antes de guardarlo.');
  try{storage.setItem(key,serialized);}catch{throw new Error('No se pudo guardar en este navegador. Revisa el espacio disponible antes de cerrar.');}
  return value;
}
