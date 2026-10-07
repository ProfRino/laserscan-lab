const {test,expect}=require('@playwright/test');
test('maximum density and three stations obey the global point cap',async({page})=>{
  test.setTimeout(120000);
  await page.setViewportSize({width:640,height:480});
  await page.goto('/?test=1');await page.waitForFunction(()=>window.lab);
  await page.evaluate(()=>{
    lab.setMode('room');lab.state.autoRescan=false;lab.loadScene('empty');
    lab.setStations([[-4,-2],[4,2],[-4,2]]);
    Object.assign(lab.state,{hStep:.25,vStep:.25,vfov:160,noise:0,maxRange:35,cutoff:89});
    lab.startScan(false);
  });
  await page.waitForFunction(()=>!lab.snapshot().running,null,{timeout:100000});
  const result=await page.evaluate(()=>lab.snapshot());
  expect(result.count).toBe(1200000);
  expect(result.counts.reduce((a,b)=>a+b,0)).toBe(result.count);
  expect(result.status).toContain('point limit');
  await expect(page.locator('#hudWarn')).toBeVisible();
});

test('missing WebGL displays an actionable startup message',async({page})=>{
  await page.addInitScript(()=>{
    const get=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};
  });
  await page.goto('/');
  await expect(page.locator('[role=alert]')).toContainText('WebGL');
});
