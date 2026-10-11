import asyncio, base64, json, os, pathlib, urllib.request, zipfile
from playwright.async_api import async_playwright

ROOT=pathlib.Path(__file__).parent
async def main():
  async with async_playwright() as p:
    proxy=os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')
    browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],proxy={'server':proxy,'bypass':'localhost,127.0.0.1'} if proxy else None)
    page=await browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    errors=[]
    cache={}
    async def cache_response(response):
      if response.request.resource_type=='image' and response.ok:
        try:
          cache[response.url]='data:'+response.headers.get('content-type','image/jpeg')+';base64,'+base64.b64encode(await response.body()).decode()
        except Exception: pass
    page.on('response',cache_response)
    page.on('pageerror',lambda e:errors.append(str(e)))
    await page.goto('http://localhost:4173',wait_until='networkidle')
    await page.add_style_tag(content='*,*::before,*::after {animation:none !important; transition:none !important;}')
    await page.evaluate('document.fonts.ready')
    report=[]
    async def capture(name):
      await page.wait_for_timeout(350)
      urls=await page.locator('img').evaluate_all('(els)=>els.map(e=>e.currentSrc||e.src)')
      async def get_image(url):
        if url in cache: return
        try:
          def fetch():
            with urllib.request.urlopen(url,timeout=12) as response:
              return 'data:'+response.headers.get_content_type()+';base64,'+base64.b64encode(response.read()).decode()
          cache[url]=await asyncio.to_thread(fetch)
        except Exception as e: errors.append('Image: '+url+' '+str(e))
      await asyncio.gather(*(get_image(url) for url in set(urls)))
      data={url:cache[url] for url in set(urls) if url in cache}
      await page.evaluate('(data)=>window.__imageData=data',data)
      svg=await page.evaluate((ROOT/'dom-to-svg.js').read_text())
      (ROOT/(name+'.svg')).write_text(svg)
      await page.screenshot(path=str(ROOT/(name+'.png')))
      report.append({'screen':name,'text_layers':svg.count('<text '),'images':len(data),'bytes':len(svg.encode())})
      print(name,flush=True)
    await capture('01-login')
    await page.get_by_role('button',name='เข้าสู่ระบบด้วย Google (ผู้ใช้ทั่วไป)').click()
    await capture('02-search')
    await page.get_by_role('button',name='ประวัติ',exact=True).click()
    await capture('04-history')
    await page.get_by_role('button',name='แชท',exact=True).click()
    await capture('05-chatbot')
    await page.get_by_role('button',name='ค้นหา',exact=True).click()
    await page.get_by_role('button').filter(has=page.locator('h3')).first.click()
    await capture('03-booking')
    await page.set_viewport_size({'width':390,'height':1200})
    await capture('03-booking-full')
    await page.set_viewport_size({'width':390,'height':844})
    await page.reload(wait_until='networkidle')
    await page.add_style_tag(content='*,*::before,*::after {animation:none !important; transition:none !important;}')
    await page.get_by_role('button',name='เข้าสู่ระบบผู้ดูแลระบบ',exact=True).click()
    await capture('06-admin')
    await page.get_by_role('button',name='อนุมัติแล้ว',exact=True).click()
    await page.get_by_role('button',name='ตรวจสภาพห้อง',exact=True).first.click()
    await capture('07-checklist')
    await page.set_viewport_size({'width':390,'height':1250})
    await capture('07-checklist-full')
    await page.set_viewport_size({'width':390,'height':844})
    await page.reload(wait_until='networkidle')
    await page.add_style_tag(content='*,*::before,*::after {animation:none !important; transition:none !important;}')
    await page.get_by_role('button',name='เข้าสู่ระบบผู้ดูแลระบบ',exact=True).click()
    # Bell is the icon-only button in the admin account bar.
    await page.locator('button').filter(has=page.locator('svg.lucide-bell')).click()
    await capture('08-notifications-empty')
    (ROOT/'verification.json').write_text(json.dumps({'screens':report,'browser_errors':errors},ensure_ascii=False,indent=2))
    print(json.dumps({'screens':report,'browser_errors':errors},ensure_ascii=False))
    await browser.close()

asyncio.run(main())
