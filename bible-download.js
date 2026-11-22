export const MAX_BIBLE_JSON_BYTES=15_000_000;
const sizeError=()=>new Error('El archivo supera el máximo de 15 MB.');
export function parseBibleJson(text){
  try{return JSON.parse(text.replace(/^\uFEFF/,''));}
  catch{throw new Error('El archivo no contiene un JSON válido. Usa el enlace directo al archivo, no la página que lo muestra.');}
}
export async function fetchBibleJson(value,{signal,fetchImpl=globalThis.fetch,timeoutMs=30_000}={}){
  let url;
  try{url=new URL(value.trim());}catch{throw new Error('Escribe un enlace completo que empiece por https://.');}
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('Usa un enlace HTTPS sin contraseñas ni datos de acceso.');
  const controller=new AbortController();let timedOut=false,reader;
  const cancel=()=>controller.abort();
  if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
  try{
    const response=await fetchImpl(url.href,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',mode:'cors'});
    if(!response.ok)throw new Error(`No se pudo descargar el archivo (HTTP ${response.status}). Revisa el enlace.`);
    if(Number(response.headers.get('content-length'))>MAX_BIBLE_JSON_BYTES)throw sizeError();
    let text='';
    if(response.body){
      reader=response.body.getReader();const decoder=new TextDecoder();let bytes=0;
      while(true){
        const {done,value}=await reader.read();if(done)break;
        bytes+=value.byteLength;if(bytes>MAX_BIBLE_JSON_BYTES)throw sizeError();
        text+=decoder.decode(value,{stream:true});
      }
      text+=decoder.decode();
    }else{
      const buffer=await response.arrayBuffer();if(buffer.byteLength>MAX_BIBLE_JSON_BYTES)throw sizeError();text=new TextDecoder().decode(buffer);
    }
    if(controller.signal.aborted)throw new Error('Importación cancelada.');
    return parseBibleJson(text);
  }catch(error){
    if(timedOut)throw new Error('La descarga tardó demasiado. Inténtalo otra vez o importa el archivo descargado.');
    if(signal?.aborted)throw new Error('Importación cancelada.');
    if(error instanceof TypeError)throw new Error('No se pudo descargar el enlace. Revisa tu conexión o descarga el JSON e impórtalo como archivo.');
    throw error;
  }finally{
    controller.abort();clearTimeout(timer);signal?.removeEventListener('abort',cancel);if(reader)try{await reader.cancel();}catch{}
  }
}
