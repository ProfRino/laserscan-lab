const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort'],{windowsHide:true,stdio:'ignore'});
 let browser;
 try {
  await new Promise(r=>setTimeout(r,2200));
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:960,height:600}});
  // Advance the real app at a fixed cadence so slow screenshot capture cannot skip the scan.
  await page.addInitScript(()=>{
    let time=0, callbacks=[];
    performance.now=()=>time;
    window.requestAnimationFrame=cb=>{callbacks.push(cb);return callbacks.length;};
    window.demoStep=()=>{time+=1000/30;const batch=callbacks;callbacks=[];batch.forEach(cb=>cb(time));};
  });
  await page.goto('http://127.0.0.1:5175/?test=1');await page.waitForFunction(()=>window.lab,null,{polling:100});
  await page.addStyleTag({content:`#panel,#hud,#topbar,#prCard,#lessonCard,#regPad,#toast,#hint,#menuBtn{display:none!important}
  #demo{position:fixed;inset:0;pointer-events:none;font-family:Segoe UI,Arial,sans-serif;color:#23252a}
  #demo header{position:absolute;top:22px;left:26px;right:26px;display:flex;justify-content:space-between;align-items:center}
  #demo b{font-size:23px;letter-spacing:-.8px} #demo b i{color:#ff5a52;font-style:normal}
  #demo small{font-size:11px;font-weight:650;letter-spacing:1.5px;color:#555}
  #demo footer{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);border-radius:24px;padding:11px 23px;background:rgba(25,27,32,.94);color:#fff;display:flex;gap:18px;align-items:center;white-space:nowrap}
  #demo strong{font-size:15px;font-weight:600} #dots{display:flex;gap:7px} #dots span{width:9px;height:9px;border-radius:50%;background:#555} #dots span.on:nth-child(1){background:#ff5a52} #dots span.on:nth-child(2){background:#35c4b5} #dots span.on:nth-child(3){background:#f2b544}`});
  await page.evaluate(()=>{const d=document.createElement('div');d.id='demo';d.innerHTML='<header><b>LaserScan Lab<i> ●</i></b><small>INTERACTIVE • FREE • OFFLINE</small></header><footer><strong id="caption"></strong><div id="dots"><span></span><span></span><span></span></div></footer>';document.body.append(d)});
  fs.mkdirSync('test-results-demo',{recursive:true});for(const f of fs.readdirSync('test-results-demo'))if(/^\d{3}\.png$/.test(f))fs.unlinkSync(path.join('test-results-demo',f));let n=0;
  async function caption(text,stage){await page.evaluate(([text,stage])=>{document.querySelector('#caption').textContent=text;document.querySelectorAll('#dots span').forEach((el,i)=>el.classList.toggle('on',i<stage));},[text,stage]);}
  async function frame(){await page.evaluate(()=>{demoStep();demoStep()});await page.screenshot({path:path.join('test-results-demo',String(n++).padStart(3,'0')+'.png')});}
  async function frames(k){for(let i=0;i<k;i++)await frame();}
  await caption('Watch a laser build a point cloud',0);await page.evaluate(()=>lab.prSetStep(4));await frames(36);
  await page.evaluate(()=>{lab.setMode('room');lab.state.speedIdx=3;document.querySelector('[data-l=corridor]').click()});
  await page.mouse.move(40,160);await page.mouse.down();await page.mouse.move(180,230);await page.mouse.up();await page.mouse.wheel(0,160);
  for(let stage=1;stage<=3;stage++){
    await caption(['','01  Scan the first room','02  Connect through the corridor','03  Capture the final room'][stage],stage);
    if(stage>1)await page.evaluate(()=>document.querySelector('#regDone').click());
    await frames(32);
    if(await page.evaluate(()=>lab.snapshot().running))throw Error('Capture ended before scan completion');
  }
  await page.evaluate(()=>document.querySelector('#regDone').click());
  await caption('Three scans. One connected survey.',3);
  await page.mouse.move(40,160);await page.mouse.down();
  for(let i=0;i<36;i++){await page.mouse.move(40-i*4,160);await page.mouse.wheel(0,2);await frame();}
  await page.mouse.up();
  await page.screenshot({path:'assets/demo.png'});
  const result=await page.evaluate(()=>lab.snapshot());if(!result.networkConnected||result.chainStage!=='done')throw Error('Survey incomplete');
  console.log('Captured '+n+' frames with connected three-scan survey.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
