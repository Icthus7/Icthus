import {BOOKS,normalize} from './core.js';
export const BIBLE_VERSIONS=[
  {id:'RV1909',name:'Reina-Valera 1909',short:'RV 1909',included:true,copyright:'Reina-Valera 1909 · Dominio público. Fuente: eBible.org.'},
  {id:'RVR1960',name:'Reina-Valera 1960',short:'RVR 1960',included:false,copyright:'Texto bíblico: Reina-Valera 1960® © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988. Reina-Valera 1960® es una marca registrada de Sociedades Bíblicas Unidas.'},
  {id:'TLA',name:'Traducción en Lenguaje Actual',short:'TLA',included:false,copyright:'Traducción en lenguaje actual® © Sociedades Bíblicas Unidas, 2002, 2004. Traducción en lenguaje actual® es una marca registrada de Sociedades Bíblicas Unidas.'}
];
const CHAPTER_COUNTS={"GEN":50,"EXO":40,"LEV":27,"NUM":36,"DEU":34,"JOS":24,"JDG":21,"RUT":4,"1SA":31,"2SA":24,"1KI":22,"2KI":25,"1CH":29,"2CH":36,"EZR":10,"NEH":13,"EST":10,"JOB":42,"PSA":150,"PRO":31,"ECC":12,"SNG":8,"ISA":66,"JER":52,"LAM":5,"EZK":48,"DAN":12,"HOS":14,"JOL":3,"AMO":9,"OBA":1,"JON":4,"MIC":7,"NAM":3,"HAB":3,"ZEP":3,"HAG":2,"ZEC":14,"MAL":4,"MAT":28,"MRK":16,"LUK":24,"JHN":21,"ACT":28,"ROM":16,"1CO":16,"2CO":13,"GAL":6,"EPH":6,"PHP":4,"COL":4,"1TH":5,"2TH":3,"1TI":6,"2TI":4,"TIT":3,"PHM":1,"HEB":13,"JAS":5,"1PE":5,"2PE":3,"1JN":5,"2JN":1,"3JN":1,"JUD":1,"REV":22};
const aliases={SOL:'SNG',EZE:'EZK',JOE:'JOL',NAH:'NAM',MAR:'MRK',JOH:'JHN',PHI:'PHP',JAM:'JAS','1JO':'1JN','2JO':'2JN','3JO':'3JN'};
const bookKey=value=>normalize(value).replace(/\s/g,'');
const english=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','I Samuel','II Samuel','I Kings','II Kings','I Chronicles','II Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans','I Corinthians','II Corinthians','Galatians','Ephesians','Philippians','Colossians','I Thessalonians','II Thessalonians','I Timothy','II Timothy','Titus','Philemon','Hebrews','James','I Peter','II Peter','I John','II John','III John','Jude','Revelation of John'];
function identifyBook(value){
  if(typeof value!=='string')return null;
  const canonical=aliases[value.toUpperCase()]||value.toUpperCase();
  return BOOKS.find((book,index)=>book.id===canonical||[book.name,...book.aliases,english[index]].some(name=>bookKey(name)===bookKey(value)))?.id;
}
function declaredVersion(data){
  const text=normalize([data?.id,data?.versionId,data?.translation,data?.name,data?.local_abbreviation,data?.local_title].filter(value=>typeof value==='string').join(' '));
  const versions=[];
  if(/1960|rvr60\b/.test(text))versions.push('RVR1960');
  if(/\btla\b|lenguaje actual/.test(text))versions.push('TLA');
  if(/1909|rvr09\b|rv09\b/.test(text))versions.push('RV1909');
  if(versions.length>1)throw new Error('El archivo contiene identificaciones de versiones contradictorias. Revisa su procedencia.');
  return versions[0]??null;
}
function snapshotChapters(book,id){
  const chapters=[],sourceItems=new Map();
  for(const chapter of book.chapters){
    const reference=typeof chapter?.usfm==='string'?/^([A-Z0-9]+)\.([1-9]\d*)$/.exec(chapter.usfm):null;
    if(!reference||identifyBook(reference[1])!==id||!Array.isArray(chapter.items))throw new Error('Hay capítulos con una referencia o un formato no válido.');
    const number=Number(reference[2]),signature=JSON.stringify(chapter.items);
    if(sourceItems.has(number)){
      if(sourceItems.get(number)!==signature)throw new Error(`El capítulo ${id} ${number} está repetido con contenido diferente. Revisa el archivo.`);
      continue;
    }
    if(number!==chapters.length+1)throw new Error('La numeración de los capítulos no es consecutiva.');
    const verses=[];
    for(const item of chapter.items){
      if(!item||typeof item.type!=='string')throw new Error('Hay bloques de texto con un formato no válido.');
      if(item.type!=='verse'){
        if(!/^(heading[12]|section[12]|label)$/.test(item.type)||!Array.isArray(item.verse_numbers)||item.verse_numbers.length)throw new Error('El archivo contiene bloques de texto no reconocidos. Revisa el formato.');
        continue;
      }
      const numbers=item.verse_numbers;
      if(!Array.isArray(numbers)||numbers.length!==1||!Number.isInteger(numbers[0])||numbers[0]<1||numbers[0]>200)throw new Error('El archivo contiene versículos combinados o numeración no válida; necesita una conversión revisada.');
      if(!Array.isArray(item.lines)||!item.lines.length||item.lines.some(line=>typeof line!=='string')||!item.lines.some(line=>line.trim()))throw new Error('Hay versículos vacíos o con un formato no válido. El archivo requiere revisión.');
      const number=numbers[0],text=item.lines.join('\n');
      // Un mismo versículo puede continuar después de un subtítulo o una pausa poética.
      if(number===verses.length)verses[number-1]+='\n'+text;
      else if(number===verses.length+1)verses.push(text);
      else throw new Error('La numeración de los versículos no es consecutiva. No se renumerará el texto.');
    }
    chapters.push(verses);sourceItems.set(number,signature);
  }
  return chapters;
}
export function importBibleData(input,targetId){
  const version=BIBLE_VERSIONS.find(item=>item.id===targetId);
  if(!version||version.included)throw new Error('Elige RVR1960 o TLA como versión del archivo que vas a importar.');
  const declared=declaredVersion(input);
  if(declared&&declared!==targetId)throw new Error('La versión indicada dentro del archivo no coincide con la que seleccionaste. No se cambiará su nombre.');
  const raw=input?.books??input;
  const books={};
  if(Array.isArray(raw)){
    if(raw.length!==66)throw new Error('El archivo debe contener los 66 libros de la Biblia.');
    raw.forEach((book,index)=>{
      const id=identifyBook(book?.id)||identifyBook(book?.abbrev)||identifyBook(book?.name)||identifyBook(book?.usfm)||identifyBook(book?.human)||(!book?.id&&!book?.abbrev&&!book?.name&&!book?.usfm&&!book?.human?BOOKS[index].id:null);
      if(!id||books[id])throw new Error('Hay libros duplicados o nombres de libro no reconocidos.');
      const chapters=book?.chapters;
      if(!Array.isArray(chapters))throw new Error('Cada libro necesita una lista de capítulos.');
      if(chapters.some(chapter=>Array.isArray(chapter?.items))){books[id]=snapshotChapters(book,id);return;}
      books[id]=chapters.map((chapter,ci)=>{
        if(Array.isArray(chapter))return chapter;
        if(chapter?.chapter!==undefined&&Number(chapter.chapter)!==ci+1)throw new Error('La numeración de los capítulos no es consecutiva.');
        if(!Array.isArray(chapter?.verses))throw new Error('No se reconoció el formato de los versículos.');
        return chapter.verses.map((verse,vi)=>{
          if(Number(verse.verse)!==vi+1)throw new Error('La numeración de los versículos no es consecutiva.');
          return verse.text;
        });
      });
    });
  }else if(raw&&typeof raw==='object'){
    for(const [key,chapters] of Object.entries(raw)){
      const id=identifyBook(key);if(!id||books[id])throw new Error('Hay libros duplicados o identificadores de libro no reconocidos.');books[id]=chapters;
    }
  }else throw new Error('No se reconoce este archivo. Usa un JSON con libros, capítulos y versículos.');
  if(BOOKS.some(book=>!Object.hasOwn(books,book.id))||Object.keys(books).length!==66)throw new Error('El archivo debe incluir los 66 libros de la Biblia.');
  let verseCount=0;
  for(const [id,chapters] of Object.entries(books)){
    if(!Array.isArray(chapters)||chapters.length!==CHAPTER_COUNTS[id])throw new Error(`El libro ${id} debe contener ${CHAPTER_COUNTS[id]} capítulos.`);
    for(const chapter of chapters){
      if(!Array.isArray(chapter)||chapter.length<1||chapter.length>200)throw new Error('Cada capítulo debe contener entre 1 y 200 versículos.');
      if(chapter.some(text=>typeof text!=='string'||!text.trim()||text.length>10000))throw new Error('Hay versículos vacíos o con un formato no válido. El archivo requiere revisión.');
      verseCount+=chapter.length;
    }
  }
  if(verseCount<30000||verseCount>40000)throw new Error('La cantidad de versículos no corresponde a una Biblia completa. Revisa el archivo.');
  const copyright=typeof input?.copyright==='string'?input.copyright:input?.copyright?.text;
  return {id:targetId,translation:version.name,copyright:typeof copyright==='string'?copyright.slice(0,3000):version.copyright,books,verseCount,importedAt:Date.now()};
}

let database;
function openDatabase(){
  if(!('indexedDB' in globalThis))return Promise.reject(new Error('Este navegador no permite guardar versiones bíblicas.'));
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('icthus-bibles',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('versions',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('No se pudo abrir el almacenamiento de versiones.'));
    request.onblocked=()=>reject(new Error('Cierra otras pestañas de Icthus y vuelve a intentarlo.'));
  }).catch(error=>{database=null;throw error;});
  return database;
}
export async function loadImportedBible(id){
  const db=await openDatabase();return new Promise((resolve,reject)=>{const request=db.transaction('versions').objectStore('versions').get(id);request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(new Error('No se pudo leer esta versión guardada.'));});
}
export async function saveImportedBible(bible){
  const db=await openDatabase();return new Promise((resolve,reject)=>{const transaction=db.transaction('versions','readwrite');transaction.objectStore('versions').put(bible);transaction.oncomplete=()=>resolve(bible);transaction.onerror=transaction.onabort=()=>reject(new Error('No se pudo guardar la versión. Revisa el espacio del navegador.'));});
}
