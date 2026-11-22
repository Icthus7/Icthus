export function setupInstallation({button,status,help,hostedNotice,hostedDownload}){
  let promptEvent=null;
  const standalone=window.matchMedia('(display-mode: standalone)');
  const isHosted=location.hostname.endsWith('.chatgpt.site');
  hostedNotice.hidden=!isHosted;
  hostedDownload.hidden=!isHosted&&!['127.0.0.1','localhost'].includes(location.hostname);
  function render(){
    const installed=standalone.matches;
    button.disabled=installed||!promptEvent;help.hidden=installed;
    status.textContent=installed?'Icthus está abierta como aplicación.':promptEvent?'Icthus está lista para instalar en este equipo.':'Puedes instalar Icthus desde el menú de Chrome.';
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();promptEvent=event;render();});
  window.addEventListener('appinstalled',()=>{promptEvent=null;button.disabled=true;help.hidden=true;status.textContent='Icthus se instaló en este equipo.';});
  standalone.addEventListener?.('change',render);
  button.addEventListener('click',async()=>{
    if(!promptEvent)return;const pending=promptEvent;promptEvent=null;button.disabled=true;
    try{await pending.prompt();const answer=await pending.userChoice;
      status.textContent=answer.outcome==='accepted'?'Completa la instalación en Chrome.':'Puedes instalar Icthus después desde el menú de Chrome.';
    }catch{status.textContent='Abre el menú de Chrome para instalar Icthus.';}
  });
  render();
}
