const {test,expect}=require('@playwright/test');
for(const width of [1440,1024,800,760,600,390,320]){
  test('controls do not overlap toolbar at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto('/?test=1');await page.waitForFunction(()=>window.lab);
    await page.locator('[data-mode=room]').click();
    await page.evaluate(()=>{lab.state.autoRescan=false;lab.loadScene('empty');});
    if(width<=760) await page.locator('#btnMenu').click();
    await expect.poll(async()=> (await page.locator('#panel').boundingBox()).x).toBeGreaterThanOrEqual(9);
    const layout=await page.evaluate(()=>{
      const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right};};
      return {bar:rect('topbar'),panel:rect('panel'),hud:rect('hud'),groups:[...document.querySelectorAll('#topbar>.brand,#topbar>.bar-group,#btnScan')].filter(e=>getComputedStyle(e).display!=='none').map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};})};
    });
    expect(layout.panel.top).toBeGreaterThanOrEqual(layout.bar.bottom+8);
    expect(layout.panel.left).toBeGreaterThanOrEqual(0);
    expect(layout.panel.right).toBeLessThanOrEqual(width);
    for(let a=0;a<layout.groups.length;a++)for(let b=a+1;b<layout.groups.length;b++){
      const x=layout.groups[a],y=layout.groups[b];
      const area=Math.max(0,Math.min(x.right,y.right)-Math.max(x.left,y.left))*Math.max(0,Math.min(x.bottom,y.bottom)-Math.max(x.top,y.top));
      expect(area).toBe(0);
    }
    if(width===390){
      await page.screenshot({path:'test-results/mobile-controls.png'});
      await page.locator('#btnMenu').click();await page.waitForTimeout(300);
      await page.screenshot({path:'test-results/mobile-scene.png'});
    }
  });
}
