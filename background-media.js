let database;
const urls=new Map();
function openDatabase(){
  if(!('indexedDB' in globalThis))return Promise.reject(new Error('El navegador no permite guardar imágenes de fondo.'));
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('icthus-media',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('images',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('No se pudo abrir el almacenamiento de fondos.'));
    request.onblocked=()=>reject(new Error('Cierra otras pestañas de Icthus y vuelve a intentarlo.'));
  }).catch(error=>{database=null;throw error;});
  return database;
}
export async function currentBackgroundImage(){
  const db=await openDatabase();return new Promise((resolve,reject)=>{const request=db.transaction('images').objectStore('images').get('background');request.onsuccess=()=>resolve(request.result??null);request.onerror=()=>reject(new Error('No se pudo leer la imagen guardada.'));});
}
export async function backgroundImageUrl(id){
  if(!id)return null;if(urls.has(id))return urls.get(id);
  const pending=currentBackgroundImage().then(record=>{
    if(record?.id!==id||!(record.blob instanceof Blob))return null;
    return URL.createObjectURL(record.blob);
  }).catch(()=>null);
  urls.set(id,pending);return pending;
}
export async function saveBackgroundImage(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Elige una imagen JPG, PNG o WebP.');
  if(file.size>15000000)throw new Error('La imagen supera 15 MB. Elige una más pequeña.');
  let bitmap;
  try{bitmap=await createImageBitmap(file);}catch{throw new Error('No se pudo abrir esa imagen. Prueba con otro archivo.');}
  try{
    if(!bitmap.width||!bitmap.height||bitmap.width*bitmap.height>40000000)throw new Error('La imagen tiene dimensiones demasiado grandes.');
    const scale=Math.min(1,1920/bitmap.width,1080/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la imagen.');
    context.fillStyle='#101118';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(!blob)throw new Error('No se pudo guardar la imagen.');
    const record={key:'background',id:'media-'+crypto.randomUUID(),name:file.name.slice(0,200),blob};
    const db=await openDatabase();await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(record);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(new Error('No hay espacio para guardar la imagen en el navegador.'));});
    urls.set(record.id,Promise.resolve(URL.createObjectURL(blob)));return record;
  }finally{bitmap.close();}
}
