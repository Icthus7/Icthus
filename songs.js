// Partes de un canto y su orden de proyección. No contiene letras de terceros.
export const SONG_PART_TYPES=[
  {id:'verse',name:'Verso'},{id:'chorus',name:'Coro'},{id:'prechorus',name:'Precoro'},
  {id:'bridge',name:'Puente'},{id:'intro',name:'Intro'},{id:'ending',name:'Final'},
  {id:'instrumental',name:'Instrumental'},{id:'other',name:'Otra parte'}
];
export const MAX_SONG_PARTS=100,MAX_SONG_STEPS=200;
const types=new Set(SONG_PART_TYPES.map(type=>type.id));
const validPartId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function songPartLabels(sections){
  const totals={},counts={};for(const part of sections)totals[part.type]=(totals[part.type]||0)+1;
  return sections.map(part=>{
    const name=SONG_PART_TYPES.find(type=>type.id===part.type)?.name||'Parte',number=counts[part.type]=(counts[part.type]||0)+1;
    return name+(part.type==='verse'||part.type==='other'||totals[part.type]>1?' '+number:'');
  });
}
function headingType(value){
  const label=value.trim().replace(/^[\[(]\s*|\s*[\])]$/g,'').replace(/:\s*$/,'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const match=/^(verso|estrofa|verse|coro|chorus|estribillo|pre[ -]?coro|pre[ -]?chorus|puente|bridge|intro|introduccion|final|outro|ending|instrumental|otra parte)(?:\s+\d+)?$/.exec(label);
  if(!match)return null;
  if(/^(verso|estrofa|verse)$/.test(match[1]))return 'verse';
  if(/^(coro|chorus|estribillo)$/.test(match[1]))return 'chorus';
  if(/^pre/.test(match[1]))return 'prechorus';
  if(/^(puente|bridge)$/.test(match[1]))return 'bridge';
  if(/^(intro|introduccion)$/.test(match[1]))return 'intro';
  if(/^(final|outro|ending)$/.test(match[1]))return 'ending';
  return match[1]==='instrumental'?'instrumental':'other';
}
export function parseSongLyrics(value){
  if(typeof value!=='string'||value.length>50000)throw new Error('La letra puede tener hasta 50,000 caracteres.');
  const sections=[];let pending=null;
  for(const block of value.replace(/\r\n?/g,'\n').trim().split(/\n\s*\n/).filter(Boolean)){
    const lines=block.trim().split('\n'),type=headingType(lines[0]);
    if(type&&lines.length===1){
      // Una etiqueta al final o seguida por otra etiqueta se conserva como texto.
      if(pending)sections.push({id:'part-'+(sections.length+1),type:'verse',text:pending.original});
      pending={type,original:block.trim()};continue;
    }
    const text=(type?lines.slice(1):lines).join('\n').trim();
    if(text)sections.push({id:'part-'+(sections.length+1),type:type||pending?.type||'verse',text});
    pending=null;
  }
  if(pending)sections.push({id:'part-'+(sections.length+1),type:'verse',text:pending.original});
  if(sections.length>MAX_SONG_PARTS)throw new Error(`Puedes agregar hasta ${MAX_SONG_PARTS} partes por canto.`);
  return sections;
}
export function validateSongParts(value,{draft=false}={}){
  if(!Array.isArray(value)||value.length>MAX_SONG_PARTS||(!draft&&!value.length))throw new Error(`Agrega entre 1 y ${MAX_SONG_PARTS} partes al canto.`);
  const ids=new Set();
  const sections=value.map((part,index)=>{
    const id=part?.id??'part-'+(index+1);
    if(!validPartId(id)||ids.has(id)||!types.has(part?.type)||typeof part?.text!=='string')throw new Error('Hay partes repetidas o con un formato no válido.');
    ids.add(id);return {id,type:part.type,text:draft?part.text:part.text.trim()};
  });
  const labels=songPartLabels(sections);
  if(!draft){const index=sections.findIndex(part=>!part.text);if(index>=0){const error=new Error(`Escribe la letra de ${labels[index]} o elimina esa parte.`);error.sectionId=sections[index].id;throw error;}}
  if(sections.map(part=>part.text).join('\n\n').length>50000)throw new Error('La letra del canto puede tener hasta 50,000 caracteres en total.');
  return sections;
}
export function validateSongOrder(value,sections,{draft=false}={}){
  if(value===undefined||value===null)return sections.map(part=>part.id);
  const ids=new Set(sections.map(part=>part.id));
  if(!Array.isArray(value)||value.length>MAX_SONG_STEPS||(!draft&&!value.length)||value.some(id=>!ids.has(id)))throw new Error(`Elige un orden de entre 1 y ${MAX_SONG_STEPS} pasos con las partes de este canto.`);
  return [...value];
}
export function normalizeSong(value,{newId=false}={}){
  if(!value||typeof value.title!=='string'||!value.title.trim()||value.title.length>160)throw new Error('Escribe un título de hasta 160 caracteres.');
  const sections=validateSongParts(value.sections===undefined?parseSongLyrics(value.lyrics):value.sections);
  const order=validateSongOrder(value.order,sections),lyrics=sections.map(part=>part.text).join('\n\n');
  return {id:newId?globalThis.crypto.randomUUID():typeof value.id==='string'&&value.id?value.id:globalThis.crypto.randomUUID(),title:value.title.trim(),lyrics,sections,order};
}
export function songSteps(value){
  const song=normalizeSong(value),labels=songPartLabels(song.sections),parts=new Map(song.sections.map((part,index)=>[part.id,{...part,label:labels[index]}]));
  return song.order.map((id,index)=>({...parts.get(id),step:index}));
}
export function validateSongs(data){
  const songs=Array.isArray(data)?data:['ap-cantos-v1','icthus-cantos-v2'].includes(data?.schema)?data.songs:null;
  if(!Array.isArray(songs)||songs.length>500)throw new Error('El archivo debe contener una lista de hasta 500 cantos.');
  return songs.map(song=>normalizeSong(song,{newId:true}));
}
export function songDraftParts(value){
  const result={};
  if(Array.isArray(value.sections)){
    result.sections=validateSongParts(value.sections,{draft:true});
    result.order=value.order===null||value.order===undefined?null:validateSongOrder(value.order,result.sections,{draft:true});
  }
  if(typeof value.pasteText==='string'&&value.pasteText.length<=50000)result.pasteText=value.pasteText;
  return result;
}
