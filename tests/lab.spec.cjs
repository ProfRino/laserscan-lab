const {test, expect} = require('@playwright/test');
const fs = require('node:fs');

test.beforeEach(async ({page}) => {
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  page.errors=errors;
  await page.goto('/?test=1');
  await page.waitForFunction(()=>window.lab);
});
test.afterEach(async ({page})=>expect(page.errors).toEqual([]));
async function room(page) {
  await page.locator('[data-mode=room]').click();
  await page.evaluate(()=>{lab.state.speedIdx=9;});
  await page.waitForFunction(()=>!lab.snapshot().running);
}
async function complete(page) {
  await page.waitForFunction(()=>lab.snapshot().status.startsWith('Complete'),null,{timeout:45000});
}

test('intro: no scanner self-returns, all steps, pulse, reset, mode changes',async({page})=>{
  await page.waitForFunction(()=>lab.snapshot().prCount>100);
  const pts=await page.evaluate(()=>lab.snapshot(true).prPoints);
  for(let i=0;i<pts.length;i+=3){
    const onShell=Math.min(Math.abs(Math.abs(pts[i])-6),Math.abs(Math.abs(pts[i+2])-4.5),Math.abs(pts[i+1]),Math.abs(pts[i+1]-4));
    expect(onShell).toBeLessThan(0.00001);
  }
  expect(await page.evaluate(()=>Number.isFinite(lab.prCast(0,-1,0)))).toBe(false);
  await page.locator('#prNext').click();
  await page.locator('#prFire').click();
  await expect(page.locator('#prExtra')).toContainText('Δt', {timeout:10000});
  await page.locator('#prNext').click();
  await page.locator('#prReset').click();
  await page.locator('#prNext').click();
  await expect(page.locator('#prTitle')).toContainText('slow turn');
  await page.screenshot({path:'test-results/intro.png'});
  await page.locator('#prGo').click();
  await page.locator('[data-mode=principle]').click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(()=>lab.snapshot().running)).toBe(false);
});

for(const [name,button,n] of [['empty','btnScEmpty',0],['columns','btnScCols',6],['office','btnScOffice',6],['flat','btnScFlat',2]]){
  test('scene '+name+' scans and computes visibility', async({page})=>{
    await room(page); await page.locator('#'+button).click(); await complete(page);
    expect(await page.evaluate(()=>lab.obstacles.length)).toBe(n);
    expect(await page.evaluate(()=>lab.snapshot().count)).toBeGreaterThan(1000);
    await expect(page.locator('#hudCov')).toContainText('%');
    await page.locator('#btnCloud').click();
    await expect(page.locator('#btnCloud')).toHaveClass('on');
    await page.screenshot({path:'test-results/scene-'+name+'.png'});
  });
}
for(const name of ['res','noise','occl','place','reg','corridor']){
  test('lesson '+name+' and registration lifecycle',async({page})=>{
    if(name==='corridor') test.setTimeout(120000);
    await room(page); await page.locator('[data-l='+name+']').click(); await complete(page);
    expect(await page.evaluate(()=>lab.snapshot().count)).toBeGreaterThan(1000);
    if(name==='corridor'){
      await expect(page.locator('#regTitle')).toContainText('Left room');
      expect(await page.evaluate(()=>lab.stations.length)).toBe(1);
      const balls = await page.evaluate(()=>lab.obstacles.filter(o=>o.kind==='sphere').map(o=>({x:o.mesh.position.x,z:o.mesh.position.z,h:o.solids.find(s=>s.s==='sp').dy,poles:o.solids.filter(s=>s.s==='c').length})));
      expect(balls).toHaveLength(6);
      for (const ball of balls) { expect(ball.h).toBe(0.16); expect(ball.poles).toBe(0); }
      for (let a=0;a<balls.length;a++) for(let b=a+1;b<balls.length;b++) {
        expect(Math.hypot(balls[a].x-balls[b].x,balls[a].z-balls[b].z)).toBeGreaterThan(1.2);
      }
      const first = await page.evaluate(()=>lab.snapshot(true));
      await page.locator('#regDone').click(); await complete(page);
      await expect(page.locator('#regTitle')).toContainText('Corridor');
      const second = await page.evaluate(()=>lab.snapshot(true));
      expect(second.counts[0]).toBe(first.counts[0]);
      expect(second.points.slice(0,100)).toEqual(first.points.slice(0,100));
      expect(second.targetPairs.find(p=>p.a===0&&p.b===1).count).toBe(3);
      await page.locator('#regDone').click(); await complete(page);
      await expect(page.locator('#regTitle')).toContainText('Right room');
      const third = await page.evaluate(()=>lab.snapshot(true));
      expect(third.counts.slice(0,2)).toEqual(second.counts.slice(0,2));
      expect(third.points.slice(0,100)).toEqual(first.points.slice(0,100));
      expect(third.counts[2]).toBeGreaterThan(1000);
      expect(third.targetPairs.find(p=>p.a===1&&p.b===2).count).toBe(3);
      expect(third.targetPairs.find(p=>p.a===0&&p.b===2).count).toBeLessThan(3);
      expect(third.networkConnected).toBe(true);
      await page.screenshot({path:'test-results/three-room-survey.png'});
      await page.locator('#regDone').click();
      expect(await page.evaluate(()=>lab.snapshot().chainStage)).toBe('done');
    } else await expect(page.locator('#lessonCard')).toBeVisible();
  });
}

test('analytic occlusion: wall, column, tabletop, sphere, doorway, nearest return, self exclusion',async({page})=>{
  await room(page);
  const results=await page.evaluate(()=>{
    lab.state.autoRescan=false; lab.clearObstacles(true); lab.setStructure([]); lab.setStations([[-5,0]]);
    const out={};
    function cast(kind,x,z,origin,dir,opts){lab.clearObstacles(true);lab.addObstacle(kind,x,z,opts,true);lab.buildColliders();return lab.cast(...origin,...dir,0);}
    out.wall=cast('wall',0,0,[0,1,-4],[0,0,1]);
    out.column=cast('cyl',0,0,[0,1,-4],[0,0,1]);
    out.table=cast('table',0,0,[0,2,0],[0,-1,0]);
    out.under=lab.cast(0,0.5,-4,0,0,1,0);
    out.sphere=cast('sphere',0,0,[0,1.44,-4],[0,0,1]);
    lab.clearObstacles(true);lab.setStations([[0,0]]);lab.buildColliders();
    out.self=lab.cast(0,1.67,0,0,0,1,0);
    lab.setStations([[0,0],[0,2]]);lab.buildColliders();
    out.future=lab.cast(0,1.67,0,0,0,1,0);
    lab.setStructure([{cx:0,cz:0,sx:2,sz:.2}]);lab.buildColliders();
    out.blocked=lab.cast(0,1,-4,0,0,1,0);
    out.open=lab.cast(2,1,-4,0,0,1,0);
    return out;
  });
  expect(results.wall.t).toBeCloseTo(3.91,5);
  expect(results.column.t).toBeCloseTo(3.7,5);
  expect(results.table.t).toBeCloseTo(1.26,5);
  expect(results.under.t).toBeCloseTo(9.5,5);
  expect(results.sphere.t).toBeCloseTo(3.84,5);
  expect(results.self.t).toBeCloseTo(5.5,5);
  expect(results.future.t).toBeCloseTo(5.5,5);
  expect(results.blocked.t).toBeCloseTo(3.9,5);
  expect(results.open.t).toBeCloseTo(9.5,5);
});

test('edits during scan, station removal, auto off, and invalid placement',async({page})=>{
  await room(page);
  await page.locator('#btnAddSt').click(); await complete(page);
  await page.evaluate(()=>{lab.state.speedIdx=0;lab.startScan(true);});
  await page.locator('[aria-label="Remove station 2"]').click(); await complete(page);
  expect(await page.evaluate(()=>lab.stations.length)).toBe(1);
  await page.locator('#tglAuto').click();
  await page.locator('#rngH').fill('2');
  expect(await page.evaluate(()=>lab.snapshot().count)).toBe(0);
  await expect(page.locator('#scanStatus')).toContainText('Changed');
  await page.evaluate(()=>{lab.clearObstacles(true);lab.addObstacle('cyl',0,0,null,true);lab.setStations([[0,0]]);lab.startScan(false);});
  await expect(page.locator('#scanStatus')).toContainText('Move station 1');
});

test('display, all parameter endpoints, scan stop, export columns and row count',async({page})=>{
  await room(page);
  for(const v of ['top','pov','orbit']){ await page.locator('[data-v='+v+']').click(); expect(await page.evaluate(()=>lab.state.viewMode)).toBe(v); }
  for(const v of ['single','distance','incidence','station']) await page.locator('[data-m='+v+']').click();
  for(const id of ['tglLaser','tglGaps']){ await page.locator('#'+id).click(); await page.locator('#'+id).click(); }
  await page.locator('#tglAuto').click();
  for(const id of ['rngH','rngV','rngRange','rngNoise','rngCut','rngVfov','rngHeight','rngSize','rngSpeed']){
    const el=page.locator('#'+id);
    for(const attr of ['min','max']){await el.fill(await el.getAttribute(attr));}
  }
  await page.evaluate(()=>{lab.state.hStep=2;lab.state.vStep=2;lab.state.speedIdx=0;lab.startScan(true);});
  await page.locator('#btnScan').click(); await expect(page.locator('#scanStatus')).toContainText('Stopped');
  await page.evaluate(()=>{lab.state.speedIdx=9;lab.startScan(false);}); await complete(page);
  await page.locator('summary').filter({hasText:/^Export$/}).click();
  const download=page.waitForEvent('download'); await page.locator('#btnExport').click();
  const result=await download; const data=fs.readFileSync(await result.path(),'utf8').trim().split('\n');
  expect(data.length).toBe(await page.evaluate(()=>lab.snapshot().count));
  for(const row of [data[0],data.at(-1)]){ const values=row.split(' ').map(Number); expect(values).toHaveLength(6); expect(values.every(Number.isFinite)).toBe(true); expect(values.slice(3).every(x=>x>=0&&x<=255)).toBe(true); }
});

test('objects add, delete, clear, station maximum, mobile controls and keyboard switches',async({page})=>{
  await room(page);
  await page.locator('#tglAuto').click();
  await page.locator('#btnClearObs').click();
  for(const id of ['btnBox','btnCol','btnWall','btnTable','btnSphere']) await page.locator('#'+id).click();
  expect(await page.evaluate(()=>lab.obstacles.length)).toBe(5);
  await page.locator('[aria-label="Remove Box 1"]').click();
  expect(await page.evaluate(()=>lab.obstacles.length)).toBe(4);
  await page.locator('#btnClearObs').click();
  for(let i=0;i<3;i++) await page.locator('#btnAddSt').click();
  expect(await page.evaluate(()=>lab.stations.length)).toBe(3);
  await page.setViewportSize({width:390,height:844});
  await page.locator('#btnMenu').click();
  await expect(page.locator('#panel')).toHaveClass('open');
  await page.locator('#tglGaps').focus(); await page.keyboard.press('Space');
  await expect(page.locator('#tglGaps')).toHaveAttribute('aria-checked','true');
  await page.locator('#btnMenu').click();
  await page.waitForTimeout(300);
  await page.screenshot({path:'test-results/mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
