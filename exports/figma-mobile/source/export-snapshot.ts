export function snapshot(root:HTMLElement,overlay:boolean){
 const num=(s:string)=>parseFloat(s)||0;
 const round=(n:number)=>Math.round(n*100)/100;
 const rect=(el:Element)=>{const r=el.getBoundingClientRect();return{x:round(r.x+scrollX),y:round(r.y+scrollY),w:round(r.width),h:round(r.height)};};
 const text=(v:string,c:CSSStyleDeclaration,r:any)=>({type:'text',name:v.slice(0,64),text:v,...r,color:c.color,font:c.fontFamily,size:num(c.fontSize),weight:num(c.fontWeight),line:num(c.lineHeight)||num(c.fontSize)*1.4,spacing:num(c.letterSpacing),align:c.textAlign});
 function walk(el:Element):any{
  const c=getComputedStyle(el),r=rect(el);
  if(c.display==='none'||c.visibility==='hidden'||num(c.opacity)===0||r.w<.05||r.h<.05||el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='OPTION'||el.closest('[data-h2d-ignore]'))return null;
  if(r.x+r.w<=0||r.x>=innerWidth||el.classList.contains('skip-link'))return null;
  if(el.tagName.toLowerCase()==='svg'){
   const clone=el.cloneNode(true) as Element,originals=[el,...el.querySelectorAll('*')],copies=[clone,...clone.querySelectorAll('*')];
   for(let i=0;i<copies.length;i++){const s=getComputedStyle(originals[i]);for(const prop of ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','fill-opacity','stroke-opacity','opacity','font-family','font-size','font-weight']){const v=s.getPropertyValue(prop);if(v)copies[i].setAttribute(prop,v);}}
   clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',String(r.w));clone.setAttribute('height',String(r.h));clone.removeAttribute('class');
   return{type:'svg',name:el.getAttribute('aria-label')||el.getAttribute('class')||'Icon',...r,svg:clone.outerHTML};
  }
  if(el instanceof HTMLImageElement)return{type:'image',name:el.alt||'Image',...r,src:el.src,fit:c.objectFit};
  const n:any={type:'frame',name:el.getAttribute('aria-label')||el.id||el.tagName.toLowerCase()+(el.getAttribute('class')?' / '+el.getAttribute('class'):''),tag:el.tagName,...r,bg:c.backgroundColor,border:[num(c.borderTopWidth),num(c.borderRightWidth),num(c.borderBottomWidth),num(c.borderLeftWidth)],borderColor:c.borderTopColor,radius:[num(c.borderTopLeftRadius),num(c.borderTopRightRadius),num(c.borderBottomRightRadius),num(c.borderBottomLeftRadius)],opacity:num(c.opacity),shadow:c.boxShadow,gradient:c.backgroundImage,layout:c.display,direction:c.flexDirection,wrap:c.flexWrap,gap:num(c.gap),clip:['hidden','auto','scroll'].includes(c.overflowX)||['hidden','auto','scroll'].includes(c.overflowY),position:c.position,children:[]};
  if(el instanceof HTMLInputElement||el instanceof HTMLSelectElement||el instanceof HTMLTextAreaElement){
   if(el instanceof HTMLInputElement&&(el.type==='checkbox'||el.type==='radio')){n.bg=el.checked?'rgb(167, 59, 36)':'rgb(255,255,255)';n.border=[1,1,1,1];n.borderColor='rgb(167,59,36)';if(el.checked)n.children.push(text('✓',c,{x:r.x+2,y:r.y-1,w:r.w-4,h:r.h}));return n;}
   let v=el instanceof HTMLSelectElement?el.selectedOptions[0]?.text:el.value||el.getAttribute('placeholder')||'';
   if(el instanceof HTMLInputElement&&el.type==='password')v='•'.repeat(v.length);
   if(el instanceof HTMLInputElement&&el.type==='date'&&v)v=v.split('-').reverse().join('/');
   const paddingL=num(c.paddingLeft),paddingR=num(c.paddingRight),line=num(c.lineHeight)||num(c.fontSize)*1.4;
   if(v)n.children.push(text(v,c,{x:r.x+paddingL+num(c.borderLeftWidth),y:r.y+(r.h-line)/2,w:Math.max(1,r.w-paddingL-paddingR-2),h:line}));
   if(el instanceof HTMLSelectElement)n.children.push(text('⌄',c,{x:r.x+r.w-24,y:r.y+(r.h-line)/2,w:16,h:line}));return n;
  }
  const collectText=(child:Node)=>{
   if(!child.textContent?.trim())return;
   let content=child.textContent,segments:any[]=[];
   const range=document.createRange();
   for(let i=0;i<content.length;i++){
    range.setStart(child,i);range.setEnd(child,i+1);const cr=range.getBoundingClientRect();if(!cr.width&&!cr.height)continue;
    let group=segments[segments.length-1];if(!group||Math.abs(group.y-cr.y)>2){group={text:'',x:cr.x+scrollX,y:cr.y+scrollY,w:0,h:cr.height};segments.push(group);}
    group.text+=content[i];group.w=Math.max(group.w,cr.right+scrollX-group.x);
   }
   for(const s of segments){if(s.text.trim())n.children.push(text(s.text,c,{x:round(s.x),y:round(s.y),w:round(s.w+.8),h:round(s.h)}));}
  };
  if(el.tagName==='DETAILS'&&!el.hasAttribute('open')){const summary=el.querySelector('summary');if(summary){const d=walk(summary);if(d)n.children.push(d);}}
  else for(const child of el.childNodes){if(child.nodeType===Node.TEXT_NODE)collectText(child);else if(child.nodeType===Node.ELEMENT_NODE){const d=walk(child as Element);if(d)n.children.push(d);}}
  for(const pseudo of ['::before','::after']){
   const p=getComputedStyle(el,pseudo);let val=p.content;if(!val||val==='none'||val==='normal'||p.display==='none')continue;
   if(val.startsWith('"'))val=val.slice(1,-1);
   const pw=num(p.width),ph=num(p.height);if(pw>0&&ph>0){const x=p.left!=='auto'?r.x+num(p.left):p.right!=='auto'?r.x+r.w-num(p.right)-pw:r.x;const y=p.top!=='auto'?r.y+num(p.top):p.bottom!=='auto'?r.y+r.h-num(p.bottom)-ph:r.y;n.children.push({type:'frame',name:pseudo,...{x,y,w:pw,h:ph},bg:p.backgroundColor,radius:[num(p.borderRadius)],children:val?[text(val,p,{x,y,w:pw,h:ph})]:[]});}
  }
  return n;
 }
 const tree=walk(root);tree.w=innerWidth;tree.h=overlay?innerHeight:Math.max(innerHeight,document.documentElement.scrollHeight);tree.x=0;tree.y=0;tree.bg='rgb(248,247,244)';tree.clip=true;
 if(document.querySelector('dialog[open]')){
  const dlg=tree.children?.[0]?.children?.find((x:any)=>x.tag==='DIALOG');
  // Native dialog backdrops live outside the DOM. Recreate as an editable scrim.
  function add(n:any){const i=(n.children||[]).findIndex((x:any)=>x.tag==='DIALOG');if(i>=0)n.children.splice(i,0,{type:'frame',name:'Dialog backdrop',x:0,y:0,w:innerWidth,h:innerHeight,bg:'rgba(30,25,21,0.42)',children:[]});else for(const ch of n.children||[])add(ch);}
  add(tree);
 }
 return tree;
}
