export const BACKGROUNDS=[
  {id:'indigo',name:'Índigo',css:'radial-gradient(ellipse at 78% 8%,#7452ac88,transparent 65%),linear-gradient(125deg,#16142c,#35214e)'},
  {id:'midnight',name:'Negro',css:'#000000'},
  {id:'ocean',name:'Océano',css:'radial-gradient(ellipse at 80% 10%,#287f9680,transparent 65%),linear-gradient(135deg,#071a2c,#143c48)'},
  {id:'forest',name:'Bosque',css:'radial-gradient(ellipse at 15% 100%,#47745780,transparent 70%),linear-gradient(130deg,#071c18,#173b2b)'},
  {id:'sunset',name:'Atardecer',css:'radial-gradient(ellipse at 75% 90%,#c2704480,transparent 70%),linear-gradient(135deg,#271526,#6c3240)'},
  {id:'wine',name:'Vino',css:'radial-gradient(ellipse at 10% 5%,#87315a66,transparent 65%),linear-gradient(120deg,#210c20,#482036)'},
  {id:'aurora',name:'Aurora',css:'radial-gradient(ellipse at 20% 80%,#197b7466,transparent 65%),radial-gradient(ellipse at 85% 5%,#6548a877,transparent 70%),#111c32'},
  {id:'graphite',name:'Grafito',css:'radial-gradient(ellipse at 85% 15%,#5b657255,transparent 65%),linear-gradient(140deg,#11151b,#303842)'}
];
export const FONTS={
  classic:{name:'Clásica · Georgia',css:'Georgia, "Times New Roman", serif'},
  modern:{name:'Moderna · Sistema',css:'system-ui, -apple-system, "Segoe UI", Arial, sans-serif'},
  clean:{name:'Limpia · Arial',css:'Arial, Helvetica, sans-serif'},
  readable:{name:'Amplia · Verdana',css:'Verdana, Geneva, sans-serif'},
  mono:{name:'Monoespaciada',css:'"Courier New", Courier, monospace'}
};
export const DEFAULT_TEXT={fontFamily:'classic',fontSize:56,color:'#ffffff',bold:false,italic:false,uppercase:false,align:'center',vertical:'center',lineHeight:1.45,letterSpacing:0,margin:8,shadow:'soft',outline:0,autoFit:true,referenceScale:.39,showReference:true,showVersion:true};
const finite=(value,fallback)=>value===null||value===''||typeof value==='boolean'?fallback:Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max,fallback)=>Math.min(max,Math.max(min,finite(value,fallback)));
const choice=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;
const bool=(value,fallback)=>typeof value==='boolean'?value:fallback;
const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value.toLowerCase():fallback;

export function normalizeAppearance(value={}){
  value=value&&typeof value==='object'?value:{};
  const t=value.textStyle&&typeof value.textStyle==='object'?value.textStyle:{},b=value.background&&typeof value.background==='object'?value.background:{},tr=value.transition&&typeof value.transition==='object'?value.transition:{};
  const theme=choice(b.theme??value.theme,BACKGROUNDS.map(item=>item.id),'indigo');
  const fontSize=clamp(t.fontSize??value.fontSize,20,160,56);
  const textStyle={
    fontFamily:choice(t.fontFamily,Object.keys(FONTS),'classic'),fontSize,color:color(t.color,'#ffffff'),
    bold:bool(t.bold,false),italic:bool(t.italic,false),uppercase:bool(t.uppercase,false),
    align:choice(t.align,['left','center','right'],'center'),vertical:choice(t.vertical,['top','center','bottom'],'center'),
    lineHeight:clamp(t.lineHeight,1,2,1.45),letterSpacing:clamp(t.letterSpacing,-.02,.12,0),margin:clamp(t.margin,3,20,8),
    shadow:choice(t.shadow,['none','soft','strong'],'soft'),outline:clamp(t.outline,0,3,0),autoFit:bool(t.autoFit,true),
    referenceScale:clamp(t.referenceScale,.25,.6,.39),showReference:bool(t.showReference,true),showVersion:bool(t.showVersion,true)
  };
  const imageId=typeof b.imageId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(b.imageId)?b.imageId:null;
  const background={mode:choice(b.mode,['theme','solid','image'],'theme'),theme,color:color(b.color,'#16142c'),imageId,overlay:clamp(b.overlay,0,85,0)};
  if(background.mode==='image'&&!imageId)background.mode='theme';
  return {theme,fontSize,textStyle,background,transition:{type:choice(tr.type,['none','fade','slide'],'fade'),duration:clamp(tr.duration,100,1500,400)}};
}
export function slideContentKey(slide,black=false,placeholder=''){
  return JSON.stringify([black,slide?.text??'',slide?.reference??'',slide?.version??'',placeholder]);
}
export function transitionPlan({previous=false,changed=false,black=false,reduceMotion=false,transition={type:'fade',duration:400}}={}){
  if(!previous||!changed||black||reduceMotion||transition.type==='none')return null;
  const duration=clamp(transition.duration,100,1500,400);
  return {duration,easing:'cubic-bezier(.22,.61,.36,1)',incoming:transition.type==='slide'?[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}]:[{opacity:0},{opacity:1}],outgoing:[{opacity:1},{opacity:0}]};
}
