const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const file=pathToFileURL(path.resolve('LaserScan-Lab.html')).href;
test.beforeEach(async({page,context})=>{
  await context.setOffline(true);
  page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));
  page.network=[];page.on('request',r=>{if(/^https?:/.test(r.url()))page.network.push(r.url());});
  await page.goto(file);
  await expect(page.locator('#prTitle')).toContainText('single laser');
});
test.afterEach(async({page})=>{expect(page.errors).toEqual([]);expect(page.network).toEqual([]);});
async function room(page){
  await page.locator('[data-mode=room]').click();
  await page.locator('#rngSpeed').fill('9');
  await expect(page.locator('#scanStatus')).toHaveText('Complete',{timeout:45000});
}
test('single file opens offline, runs every intro step, scans and exports',async({page})=>{
  await page.locator('#prNext').click();await page.locator('#prFire').click();
  await expect(page.locator('#prExtra')).toContainText('Δt',{timeout:10000});
  await page.locator('#prNext').click();await page.locator('#prNext').click();
  await room(page);
  await page.locator('summary').filter({hasText:/^Export$/}).click();
  const download=page.waitForEvent('download');await page.locator('#btnExport').click();
  expect((await download).suggestedFilename()).toBe('laserscanlab_cloud.xyz');
  expect(await page.evaluate(()=>window.lab)).toBeUndefined();
  await page.screenshot({path:'test-results/standalone.png'});
});
for(const id of ['btnScEmpty','btnScCols','btnScOffice','btnScFlat']){
  test('offline scene '+id,async({page})=>{
    await room(page);await page.locator('#'+id).click();
    await expect(page.locator('#scanStatus')).toHaveText('Complete',{timeout:45000});
    await expect(page.locator('#hudPts')).not.toHaveText('0');
    await expect(page.locator('#hudCov')).toContainText('%');
  });
}
for(const name of ['res','noise','occl','place','reg','corridor']){
  test('offline lesson '+name,async({page})=>{
    test.setTimeout(90000);
    await room(page);await page.locator('[data-l='+name+']').click();
    await expect(page.locator('#scanStatus')).toHaveText('Complete',{timeout:65000});
    if(name==='corridor'){
      for (const stage of ['Left room','Corridor','Right room']) {
        await expect(page.locator('#regTitle')).toContainText(stage,{timeout:45000});
        await expect(page.locator('#regPad')).toBeVisible();
        await page.locator('#regDone').click();
      }
      await expect(page.locator('#lTitle')).toContainText('Survey complete');
      await expect(page.locator('#hudLinks')).toContainText('connect all');
    }else await expect(page.locator('#lessonCard')).toBeVisible();
  });
}
