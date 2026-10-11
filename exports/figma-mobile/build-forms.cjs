const fs=require('node:fs'),path=require('node:path');
const root=__dirname,web=path.resolve(root,'../../Room-Booking-System/apps/web');
const names={mobile:'Mobile · 360 × 800',iphone13:'iPhone 13 · 390 × 844',iphone17promax:'iPhone 17 Pro Max · 440 × 956'};
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const attr=s=>esc(s);
function node(n,parent){
 const x=n.x-(parent?.x||0),y=n.y-(parent?.y||0),w=Math.max(n.w,.1),h=Math.max(n.h,.1);
 let style=`position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;`;
 if(n.type==='text'){
  const family=/[\u0e00-\u0e7f]/.test(n.text)?'IBM Plex Sans Thai':n.font?.split(',')[0]||'Inter';
  style+=`font-family:${family};font-size:${n.size}px;font-weight:${n.weight};line-height:${h}px;letter-spacing:${n.spacing||0}px;color:${n.color};white-space:pre;overflow:visible;`;
  return `<span data-layer="${attr(n.name)}" style="${attr(style)}">${esc(n.text)}</span>`;
 }
 if(n.type==='svg')return `<div data-layer="${attr(n.name)}" style="${attr(style)}">${n.svg}</div>`;
 if(n.type==='image')return `<img data-layer="${attr(n.name)}" alt="${attr(n.name)}" src="/brand/kku-emblem-th.png" style="${attr(style+'object-fit:contain;')}"/>`;
 if(n.bg)style+=`background-color:${n.bg};`;
 if(n.gradient&&n.gradient!=='none')style+=`background-image:${n.gradient};`;
 if(n.radius?.length)style+=`border-radius:${n.radius.map(r=>r+'px').join(' ')};`;
 if(n.border?.some(b=>b>0))style+=`border-style:solid;border-color:${n.borderColor};border-width:${n.border.map(b=>b+'px').join(' ')};`;
 if(n.shadow&&n.shadow!=='none')style+=`box-shadow:${n.shadow};`;
 if(n.opacity!==undefined&&n.opacity<1)style+=`opacity:${n.opacity};`;
 if(n.clip)style+='overflow:hidden;';
 return `<div data-layer="${attr(n.name)}" style="${attr(style)}">${(n.children||[]).map(c=>node(c,n)).join('')}</div>`;
}
function prune(n,b){if(n.x+n.w<=b.x||n.y+n.h<=b.y||n.x>=b.x+b.w||n.y>=b.y+b.h)return null;let clip=b;if(n.clip){let x=Math.max(n.x,b.x),y=Math.max(n.y,b.y);clip={x,y,w:Math.max(0,Math.min(n.x+n.w,b.x+b.w)-x),h:Math.max(0,Math.min(n.y+n.h,b.y+b.h)-y)}}return {...n,children:(n.children||[]).map(c=>prune(c,clip)).filter(Boolean)}}
for(const device of ['iphone17promax']){
 const files=fs.readdirSync(path.join(root,device)).filter(x=>x.endsWith('.json')).sort().slice(35,49),screens=files.map(f=>JSON.parse(fs.readFileSync(path.join(root,device,f),'utf8')));
 for(const s of screens)s.tree=prune(s.tree,{x:0,y:0,w:s.width,h:s.height});
 if(screens.length!==14)throw Error(`${device}: expected 56, got ${screens.length}`);
 let html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>KKU SPACE — ${names[device]} — Screens 36–49</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;450;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap"><style>*{box-sizing:border-box}body{margin:0;padding:64px;background:#eee9e3;color:#302c29;font-family:'IBM Plex Sans Thai',sans-serif}.gallery{display:grid;grid-template-columns:repeat(4,${screens[0].width}px);gap:72px 48px;align-items:start}h1{font-size:48px;margin:0 0 8px}header>p{font-size:20px;margin:0 0 48px}.scene{position:relative}h2{font-size:17px;line-height:1.5;min-height:52px;margin:0 0 12px}.screen{position:relative;background:#f8f7f4;overflow:hidden}div>svg{display:block;width:100%;height:100%}</style></head><body><header><h1>${names[device]}</h1><p>KKU SPACE · หน้าจอ 36–49 จาก 56 หน้าจอ · USER / STAFF / ADMIN / AUTH / FORM · Editable UI</p></header><main class="gallery">`;
 for(const s of screens)html+=`<article class="scene" aria-label="${attr(s.name)}"><h2>${String(s.index+1).padStart(2,'0')} · ${esc(s.name)}</h2><div class="screen" aria-label="${attr(s.name)}" style="width:${s.width}px;height:${s.height}px">${node(s.tree,null)}</div></article>`;
 html+='</main><script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script></body></html>';
 fs.writeFileSync(path.join(web,`figma-${device}-forms.html`),html);
 fs.writeFileSync(path.join(root,`${device}-forms-inventory.json`),JSON.stringify(screens.map(s=>({index:s.index,name:s.name,width:s.width,height:s.height,viewport:s.viewport,nodes:s.nodes})),null,2));
 console.log(device,screens.length,'screens',Buffer.byteLength(html),'HTML bytes');
}
