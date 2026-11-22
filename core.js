// Lógica independiente de la interfaz. El texto de la Biblia nunca se genera con IA.
import {normalizeAppearance} from './appearance.js';
import {songSteps} from './songs.js';
export {validateSongs} from './songs.js';
export const BOOKS = [
  ['GEN','Génesis','Gn,Gen'],['EXO','Éxodo','Ex'],['LEV','Levítico','Lv,Lev'],['NUM','Números','Nm,Num'],['DEU','Deuteronomio','Dt,Deut'],
  ['JOS','Josué','Jos'],['JDG','Jueces','Jue,Jc'],['RUT','Rut','Rt'],['1SA','1 Samuel','1 Sam,1 S'],['2SA','2 Samuel','2 Sam,2 S'],
  ['1KI','1 Reyes','1 R,1 Rey'],['2KI','2 Reyes','2 R,2 Rey'],['1CH','1 Crónicas','1 Cr,1 Cron'],['2CH','2 Crónicas','2 Cr,2 Cron'],
  ['EZR','Esdras','Esd,Ezr'],['NEH','Nehemías','Neh'],['EST','Ester','Est'],['JOB','Job','Job'],['PSA','Salmos','Sal,Sl,Salmo'],
  ['PRO','Proverbios','Pr,Prov'],['ECC','Eclesiastés','Ec,Ecl'],['SNG','Cantares','Cnt,Cant,Cantar de los cantares'],['ISA','Isaías','Is,Isa'],
  ['JER','Jeremías','Jer,Jr'],['LAM','Lamentaciones','Lm,Lam'],['EZK','Ezequiel','Ez,Eze,Ezeq'],['DAN','Daniel','Dn,Dan'],
  ['HOS','Oseas','Os'],['JOL','Joel','Jl'],['AMO','Amós','Am'],['OBA','Abdías','Abd'],['JON','Jonás','Jon'],['MIC','Miqueas','Mi,Miq'],
  ['NAM','Nahúm','Na,Nah'],['HAB','Habacuc','Hab'],['ZEP','Sofonías','Sof'],['HAG','Hageo','Hag'],['ZEC','Zacarías','Zac'],['MAL','Malaquías','Mal'],
  ['MAT','Mateo','Mt,Mat'],['MRK','Marcos','Mr,Mc,Mar'],['LUK','Lucas','Lc,Luc'],['JHN','Juan','Jn,Jua'],['ACT','Hechos','Hch,Hech'],
  ['ROM','Romanos','Ro,Rom'],['1CO','1 Corintios','1 Co,1 Cor'],['2CO','2 Corintios','2 Co,2 Cor'],['GAL','Gálatas','Ga,Gal'],
  ['EPH','Efesios','Ef'],['PHP','Filipenses','Fil'],['COL','Colosenses','Col'],['1TH','1 Tesalonicenses','1 Ts,1 Tes'],['2TH','2 Tesalonicenses','2 Ts,2 Tes'],
  ['1TI','1 Timoteo','1 Ti,1 Tim'],['2TI','2 Timoteo','2 Ti,2 Tim'],['TIT','Tito','Tit'],['PHM','Filemón','Flm'],['HEB','Hebreos','He,Heb'],
  ['JAS','Santiago','Stg,Sant'],['1PE','1 Pedro','1 P,1 Pe,1 Ped'],['2PE','2 Pedro','2 P,2 Pe,2 Ped'],
  ['1JN','1 Juan','1 Jn,1 Jua'],['2JN','2 Juan','2 Jn,2 Jua'],['3JN','3 Juan','3 Jn,3 Jua'],['JUD','Judas','Jud'],['REV','Apocalipsis','Ap,Apoc']
].map(([id,name,aliases])=>({id,name,aliases:aliases.split(',')}));

export function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.,;!?¿¡]/g,'').replace(/\s+/g,' ').trim();
}
const bookKey = value => normalize(value).replace(/\s/g,'');
export function findBook(value) {
  const key=bookKey(value);
  return BOOKS.find(book=>[book.name,book.id,...book.aliases].some(alias=>bookKey(alias)===key));
}
export function parseReference(query) {
  const input=String(query).trim();
  const wholeBook=findBook(input);
  if(wholeBook) return {book:wholeBook,chapter:1,first:null,last:null};
  const match=input.match(/^((?:[1-3]\s*)?[a-záéíóúüñ.\s]+?)\s*(\d+)(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/i);
  if(!match) return null;
  const book=findBook(match[1]);
  if(!book) return null;
  return {book,chapter:Number(match[2]),first:match[3]?Number(match[3]):null,last:match[4]?Number(match[4]):null};
}
export function resolveReference(reference,bible) {
  const chapters=bible.books[reference.book.id];
  const chapter=chapters?.[reference.chapter-1];
  if(!chapters) throw new Error(`${reference.book.name} no está cargado en esta versión.`);
  if(!chapter) throw new Error(`${reference.book.name} tiene ${chapters.length} capítulos. Revisa la referencia.`);
  const {first,last}=reference;
  if(first!==null && (first<1||first>chapter.length||last!==null&&(last<first||last>chapter.length))) {
    throw new Error(`Este capítulo tiene ${chapter.length} versículos. Revisa el número o el rango.`);
  }
  return chapter.map((text,index)=>({book:reference.book.id,chapter:reference.chapter,verse:index+1,text,reference:`${reference.book.name} ${reference.chapter}:${index+1}`}));
}
export function buildSearchIndex(bible) {
  const rows=[];
  for(const book of BOOKS) (bible.books[book.id]??[]).forEach((chapter,ci)=>chapter.forEach((text,vi)=>{
    rows.push({book:book.id,chapter:ci+1,verse:vi+1,text,normalized:normalize(text),reference:`${book.name} ${ci+1}:${vi+1}`});
  }));
  return rows;
}
export function searchVerses(query,index,limit=100) {
  const terms=normalize(query).split(' ').filter(Boolean);
  if(!terms.length) return {results:[],total:0};
  const matches=index.filter(row=>terms.every(term=>row.normalized.includes(term)));
  return {results:matches.slice(0,limit),total:matches.length};
}
export function splitText(text,maxChars=280) {
  const words=String(text).trim().split(/\s+/).filter(Boolean);
  const chunks=[]; let line='';
  for(const word of words) {
    if(line && line.length+word.length+1>maxChars) {chunks.push(line);line=word;}
    else line+=(line?' ':'')+word;
  }
  if(line) chunks.push(line);
  return chunks;
}
export function verseSlides(rows,version='Reina-Valera 1909') {
  return rows.flatMap(row=>{
    const parts=splitText(row.text);
    return parts.map((text,i)=>({text,reference:row.reference+(parts.length>1?` · ${i+1}/${parts.length}`:''),version,key:row.reference}));
  });
}
export function textSlides(text,title='') {
  return String(text).trim().split(/\n\s*\n/).filter(Boolean).flatMap(stanza=>{
    if(stanza.length<=280) return [{text:stanza.trim(),reference:title,version:''}];
    return splitText(stanza).map(chunk=>({text:chunk,reference:title,version:''}));
  });
}
export function songSlides(song){
  const result=songSteps(song).flatMap(part=>{
    const slides=textSlides(part.text,song.title);
    return slides.map((slide,page)=>({...slide,songSectionId:part.id,songPartLabel:part.label,songStep:part.step,songPartPage:page,songPartPages:slides.length}));
  });
  if(result.length>2000)throw new Error('El orden genera más de 2,000 pantallas. Reduce las repeticiones o divide el canto.');
  return result;
}
export function safeProjection(value) {
  if(!value||!Array.isArray(value.slides)||value.slides.length>2000) return null;
  if(!value.slides.every(s=>s&&typeof s.text==='string'&&s.text.length<=50000&&typeof s.reference==='string'&&typeof s.version==='string')) return null;
  return {
    slides:value.slides,index:Math.max(0,Math.min(Math.trunc(Number(value.index)||0),Math.max(0,value.slides.length-1))),
    black:!!value.black,...normalizeAppearance(value),
    ...(value.origin&&['bible','song','text'].includes(value.origin.kind)?{origin:{kind:value.origin.kind,...(typeof value.origin.versionId==='string'?{versionId:value.origin.versionId}:{}),...(typeof value.origin.songId==='string'?{songId:value.origin.songId}:{})}}:{})
  };
}
