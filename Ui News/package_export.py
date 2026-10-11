import pathlib,json,xml.etree.ElementTree as ET,zipfile
root=pathlib.Path(__file__).parent
plugin=root/'figma-plugin';plugin.mkdir(exist_ok=True)
ns={'s':'http://www.w3.org/2000/svg'}
screens=[]
for path in sorted(root.glob('*.svg')):
 tree=ET.fromstring(path.read_text()); clips={}
 for c in tree.findall('.//s:clipPath',ns):
  rect=c.find('s:rect',ns)
  if rect is not None: clips[c.attrib['id']]={k:float(rect.attrib[k]) for k in ['x','y','width','height']}
 texts=[]
 def visit(node,active=[],opacity=1):
  active=list(active); opacity*=float(node.attrib.get('opacity',1))
  cp=node.attrib.get('clip-path','')
  if cp.startswith('url(#') and cp[5:-1] in clips:active.append(clips[cp[5:-1]])
  for child in list(node):
   if child.tag.endswith('}text'):
    x=float(child.attrib['x']); y=float(child.attrib['y']); fs=float(child.attrib['font-size'].replace('px','')); top=y-fs*1.02
    left=max([0]+[c['x'] for c in active]); right=min([float(tree.attrib['width'])]+[c['x']+c['width'] for c in active]); bottom=min([float(tree.attrib['height'])]+[c['y']+c['height'] for c in active]); ct=max([0]+[c['y'] for c in active])
    if ct<y and top<bottom and x<right:
     texts.append({'text':child.text or '', 'x':x,'y':top,'size':fs,'weight':child.attrib['font-weight'],'color':child.attrib['fill'],'opacity':opacity,'clip':{'x':left,'y':ct,'width':max(1,right-left),'height':max(1,bottom-ct)}})
    node.remove(child)
   else:visit(child,active,opacity)
 visit(tree)
 screens.append({'name':path.stem,'width':float(tree.attrib['width']),'height':float(tree.attrib['height']),'svg':ET.tostring(tree,encoding='unicode').replace('ns0:','').replace(':ns0',''),'texts':texts})
(plugin/'manifest.json').write_text(json.dumps({'name':'Booking Room KKU UI Import','id':'booking-room-kku-ui-import','api':'1.0.0','main':'code.js','editorType':['figma'],'networkAccess':{'allowedDomains':['none']}},indent=2))
code='const screens = '+json.dumps(screens,ensure_ascii=False)+';\n'+r'''
async function run(){
 const fonts=await figma.listAvailableFontsAsync();
 const family=['Sarabun','Noto Sans Thai','Arial','Inter'].find(f=>fonts.some(x=>x.fontName.family===f));
 const available=fonts.filter(x=>x.fontName.family===family).map(x=>x.fontName);
 const targets={400:['Regular'],500:['Medium','Regular'],600:['SemiBold','Semi Bold','Bold'],700:['Bold'],800:['ExtraBold','Extra Bold','Bold']};
 const pick=w=>available.find(f=>(targets[w]||targets[400]).includes(f.style))||available[0];
 for(const font of available)await figma.loadFontAsync(font);
 const frames=[];let offset=0;
 for(const screen of screens){
  const frame=figma.createFrame();frame.name=screen.name;frame.resize(screen.width,screen.height);frame.x=offset;frame.y=0;frame.clipsContent=true;
  const art=figma.createNodeFromSvg(screen.svg);frame.appendChild(art);art.name='Editable shapes, icons and photos';art.x=0;art.y=0;
  for(const t of screen.texts){
   const clip=figma.createFrame();frame.appendChild(clip);clip.name='Text / '+t.text.slice(0,30);clip.x=t.clip.x;clip.y=t.clip.y;clip.resize(t.clip.width,t.clip.height);clip.fills=[];clip.clipsContent=true;
   const node=figma.createText();clip.appendChild(node);node.fontName=pick(t.weight);node.fontSize=t.size;node.characters=t.text;node.name=t.text;node.x=t.x-t.clip.x;node.y=t.y-t.clip.y;node.opacity=t.opacity;
   const nums=t.color.match(/[\d.]+/g);let rgb=nums?.length>=3?nums.slice(0,3).map(Number):[156,163,175];
   if(t.color.startsWith('#'))rgb=[1,3,5].map(i=>parseInt(t.color.slice(i,i+2),16));
   node.fills=[{type:'SOLID',color:{r:rgb[0]/255,g:rgb[1]/255,b:rgb[2]/255},opacity:nums?.length===4?Number(nums[3]):1}];
  }
  frames.push(frame);offset+=screen.width+100;
 }
 figma.viewport.scrollAndZoomIntoView(frames);figma.closePlugin('Imported '+frames.length+' screens with editable text. Font: '+family);
}
run().catch(e=>figma.closePlugin('Import error: '+e.message));
'''
(plugin/'code.js').write_text(code)
(root/'README-th.md').write_text('''# Booking Room KKU UI Export

โคลนจาก https://github.com/siriphan9292/booking_room_kku

ประกอบด้วย UI หลัก 8 หน้า และแบบเต็มของหน้าจองห้อง/ตรวจสภาพห้อง ขนาดมือถือ 390 × 844 px
หน้าแจ้งเตือนเป็นสถานะว่างตามข้อมูลเริ่มต้น ภาพ PNG ใช้เปรียบเทียบเท่านั้น

## นำเข้าเร็ว
ลากไฟล์ SVG เข้า Figma ได้โดยตรง รูปทรงและไอคอนเป็นเวกเตอร์ แต่ Figma อาจแปลงข้อความเป็นเส้นเวกเตอร์

## นำเข้าให้แก้ข้อความได้
1. ติดตั้งฟอนต์ Sarabun (https://fonts.google.com/specimen/Sarabun) และเปิด Figma Desktop
2. ในไฟล์ Design เลือก Plugins → Development → Import plugin from manifest
3. เลือก figma-plugin/manifest.json ในชุดนี้
4. รัน Booking Room KKU UI Import จะได้ทุกหน้าและเลเยอร์ Text ที่แก้ไขได้

ปลั๊กอินทำงานออฟไลน์ ใช้รูปที่ฝังอยู่ในไฟล์แล้ว แต่การนำเข้าไม่ได้สร้าง Auto Layout หรือ Component variants
หากไม่มี Sarabun จะใช้ Noto Sans Thai หรือฟอนต์สำรอง ระยะข้อความอาจเปลี่ยน
ปลั๊กอินยังไม่ได้รันตรวจใน Figma เพราะ MCP บัญชี Starter เต็มโควตา

ไฟล์ export.py และ dom-to-svg.js ใช้สร้างไฟล์จาก UI จริง ส่วน verification.json บันทึกผลตรวจ browser
''')
out=pathlib.Path('/workspace/booking-room-kku-ui-export.zip')
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for file in root.rglob('*'):
  if file.is_file():z.write(file,file.relative_to(root))
print(out)
print('screens',len(screens),'editable text layers',sum(len(s['texts']) for s in screens))
