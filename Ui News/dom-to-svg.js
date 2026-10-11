async () => {
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  let defs=[],count=0;
  const rect=(r,fill,rad=0,extra='')=>`<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${rad}" fill="${esc(fill)}" ${extra}/>`;
  const text=(value,x,y,s,color)=>`<text x="${x}" y="${y}" font-family="Sarabun, Noto Sans Thai, sans-serif" font-size="${s.fontSize}" font-weight="${s.fontWeight}" fill="${esc(color||s.color)}">${esc(value)}</text>`;
  function walk(el){
    let s=getComputedStyle(el),r=el.getBoundingClientRect();
    if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||r.width===0||r.height===0)return '';
    let out='',rad=parseFloat(s.borderTopLeftRadius)||0;
    if(s.backgroundColor!=='rgba(0, 0, 0, 0)')out+=rect(r,s.backgroundColor,rad);
    if(s.backgroundImage.startsWith('linear-gradient')){
      let colors=s.backgroundImage.match(/rgba?\([^)]+\)/g)||[];
      if(colors.length){let id='gradient'+count++,up=s.backgroundImage.includes('0deg,');defs.push(`<linearGradient id="${id}" x1="0" y1="${up?1:0}" x2="0" y2="${up?0:1}">${colors.map((c,i)=>`<stop offset="${i/(colors.length-1||1)}" stop-color="${esc(c)}"/>`).join('')}</linearGradient>`);out+=rect(r,`url(#${id})`,rad);}
    }
    if(el.tagName.toLowerCase()==='svg'){
      let clone=el.cloneNode(true);clone.setAttribute('x',r.x);clone.setAttribute('y',r.y);clone.setAttribute('width',r.width);clone.setAttribute('height',r.height);clone.setAttribute('color',s.color);clone.setAttribute('style',`color:${s.color}`);out+=new XMLSerializer().serializeToString(clone);
    }else if(el.tagName==='IMG'){
      const src=window.__imageData[el.currentSrc||el.src];
      if(src)out+=`<image x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" preserveAspectRatio="xMidYMid slice" href="${src}"/>`;
    }else if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)){
      let value=el.tagName==='SELECT'?el.selectedOptions[0]?.textContent:(el.value||el.placeholder||'');
      if(el.type==='time'&&!value)value='--:-- --';
      if(el.type==='date'&&value){let [yy,mm,dd]=value.split('-');value=`${mm}/${dd}/${yy}`;}
      let px=parseFloat(s.paddingLeft)||0,py=parseFloat(s.paddingTop)||0,fs=parseFloat(s.fontSize);
      out+=text(value,r.x+px,r.y+py+fs*1.02,s,el.value?s.color:'#9ca3af');
    }else{
      let children=[...el.childNodes].sort((a,b)=>(a.nodeType===1&&getComputedStyle(a).position==='absolute'?1:0)-(b.nodeType===1&&getComputedStyle(b).position==='absolute'?1:0));
      for(let node of children){
        if(node.nodeType===1){out+=walk(node);continue;}
        if(node.nodeType!==3||!node.textContent.trim())continue;
        let lines=[];
        for(let i=0;i<node.textContent.length;i++){
          let range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);let q=range.getBoundingClientRect();if(!q.width&&!q.height)continue;
          let last=lines.at(-1);if(last&&Math.abs(last.y-q.y)<1)last.value+=node.textContent[i];else lines.push({x:q.x,y:q.y,value:node.textContent[i]});
        }
        for(let line of lines)out+=text(line.value,line.x,line.y+parseFloat(s.fontSize)*1.02,s);
      }
    }
    const bwUniform=parseFloat(s.borderTopWidth);
    if(bwUniform&&['Bottom','Left','Right'].every(e=>s['border'+e+'Width']===s.borderTopWidth)){
      const q={x:r.x+bwUniform/2,y:r.y+bwUniform/2,width:r.width-bwUniform,height:r.height-bwUniform};
      out+=rect(q,'none',Math.max(0,rad-bwUniform/2),`stroke="${s.borderTopColor}" stroke-width="${bwUniform}" ${s.borderTopStyle==='dashed'?'stroke-dasharray="6 4"':''}`);
    }
    for(let edge of bwUniform&&['Bottom','Left','Right'].every(e=>s['border'+e+'Width']===s.borderTopWidth)?[]:['Top','Bottom','Left','Right']){
      let bw=parseFloat(s['border'+edge+'Width']);if(!bw||s['border'+edge+'Style']==='none')continue;
      let x=edge==='Right'?r.right-bw/2:r.x+(edge==='Left'?bw/2:rad),y=edge==='Bottom'?r.bottom-bw/2:r.y+(edge==='Top'?bw/2:rad);
      let x2=['Top','Bottom'].includes(edge)?r.right-rad:x,y2=['Left','Right'].includes(edge)?r.bottom-rad:y;
      out+=`<line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${s['border'+edge+'Color']}" stroke-width="${bw}" ${s['border'+edge+'Style']==='dashed'?'stroke-dasharray="6 4"':''}/>`;
    }
    if(['hidden','auto','scroll'].includes(s.overflowY)||['hidden','auto','scroll'].includes(s.overflowX)||el.tagName==='IMG'){
      let id='clip'+count++;defs.push(`<clipPath id="${id}">${rect(r,'white',rad)}</clipPath>`);out=`<g clip-path="url(#${id})">${out}</g>`;
    }
    return `<g id="layer-${count++}" opacity="${s.opacity}">${out}</g>`;
  }
  const content=walk(document.getElementById('root'));
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${innerWidth}" height="${innerHeight}" viewBox="0 0 ${innerWidth} ${innerHeight}"><defs>${defs.join('')}</defs>${content}</svg>`;
}
