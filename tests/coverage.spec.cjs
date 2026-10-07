const {test,expect}=require('@playwright/test');
// GPU geometries are registered on render, not when scene objects are created.
async function rendered(page) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
}
test('coverage: full visibility includes grazing probes; occlusion and a second station change coverage',async({page})=>{
  await page.goto('/?test=1');await page.waitForFunction(()=>window.lab);
  const result=await page.evaluate(()=>{
    lab.state.autoRescan=false;lab.clearObstacles(true);lab.setStructure([]);lab.setStations([[-4,0]]);
    Object.assign(lab.state,{vfov:180,maxRange:35,cutoff:90});
    lab.computeCoverage();const empty=parseFloat(document.querySelector('#hudCov').textContent);
    lab.addObstacle('wall',0,0,{sx:.2,sy:3.4,sz:8},true);
    lab.computeCoverage();const blocked=parseFloat(document.querySelector('#hudCov').textContent);
    lab.setStations([[-4,0],[4,0]]);lab.computeCoverage();
    return {empty,blocked,multi:parseFloat(document.querySelector('#hudCov').textContent)};
  });
  expect(result.empty).toBe(100);
  expect(result.blocked).toBeLessThan(80);
  expect(result.multi).toBeGreaterThan(result.blocked+10);
});

test('scene resources are released when presets and station heights change',async({page})=>{
  await page.goto('/?test=1');await page.waitForFunction(()=>window.lab);
  await page.locator('[data-mode=room]').click();
  await page.evaluate(()=>{lab.state.autoRescan=false;lab.loadScene('empty');});
  await rendered(page);
  const before=await page.evaluate(()=>lab.snapshot().memory.geometries);
  for(let i=0;i<6;i++){
    await page.evaluate(()=>{lab.loadScene('office');lab.state.height=1.2;lab.syncUI();});
    await rendered(page);
    await page.evaluate(()=>{lab.loadScene('empty');lab.state.height=1.6;lab.syncUI();});
    await rendered(page);
  }
  const after=await page.evaluate(()=>lab.snapshot().memory.geometries);
  expect(after).toBeLessThanOrEqual(before+2);
});

test('real pointer drag moves a tripod and updates scanner coordinates',async({page})=>{
  await page.goto('/?test=1');await page.waitForFunction(()=>window.lab);
  await page.locator('[data-mode=room]').click();
  await page.evaluate(()=>{lab.state.autoRescan=false;lab.loadScene('empty');lab.setStations([[0,0]]);});
  await page.locator('[data-v=top]').click();
  await rendered(page);
  await page.mouse.move(720,500);await page.mouse.down();await page.mouse.move(800,560,{steps:10});await page.mouse.up();
  const s=await page.evaluate(()=>({x:lab.stations[0].x,z:lab.stations[0].z}));
  expect(Math.hypot(s.x,s.z)).toBeGreaterThan(.1);
});
