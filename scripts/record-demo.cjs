const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5175','--strictPort'],{windowsHide:true,stdio:'ignore'});
 let browser;
 try {
  await new Promise(r=>setTimeout(r,2500));
  browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1000,height:700}});
  await page.goto('http://127.0.0.1:5175/?test=1'); await page.waitForFunction(()=>window.lab);
  await page.addStyleTag({content:'#panel,#hud,#topbar,#prCard,#lessonCard,#regPad,#toast,#hint,#menuBtn{opacity:0!important;pointer-events:none!important} #demo{position:fixed;inset:0;pointer-events:none;font-family:Segoe UI,Arial,sans-serif;color:#202125} #demo header{padding:24px 32px;background:linear-gradient(#dedcd9,transparent)} #demo b{font-size:30px;letter-spacing:-1px} #demo small{display:block;color:#555;font-size:14px;margin-top:4px} #demo footer{position:absolute;bottom:0;left:0;right:0;padding:22px 32px;background:#202125;color:white;display:flex;justify-content:space-between;align-items:center} #demo strong{font-size:22px} #demo span{font-size:13px;color:#bbb} #demo em{color:#35c4b5;font-style:normal;font-weight:600}'});
  await page.evaluate(()=>{const d=document.createElement('div');d.id='demo';d.innerHTML='<header><b>LaserScan Lab<span style="color:#ff5a52"> ●</span></b><small>Explore laser scanning. See what the scanner sees.</small></header><footer><div><strong id="caption"></strong><br><span id="sub"></span></div><em>FREE • OFFLINE • ONE HTML FILE</em></footer>';document.body.append(d)});
  fs.mkdirSync('test-results-demo',{recursive:true}); for(const f of fs.readdirSync('test-results-demo')) if(/^\d{3}\.png$/.test(f)) fs.unlinkSync(path.join('test-results-demo',f)); let n=0;
  async function caption(a,b){await page.evaluate(([a,b])=>{document.querySelector('#caption').textContent=a;document.querySelector('#sub').textContent=b},[a,b]);}
  async function frames(k){for(let i=0;i<k;i++){await page.waitForTimeout(90);await page.screenshot({path:path.join('test-results-demo',String(n++).padStart(3,'0')+'.png')});}}
  await caption('A pulse becomes a point cloud','Watch the spinning mirror sample the world.');
  await page.evaluate(()=>lab.prSetStep(3)); await frames(8);
  await page.evaluate(()=>{lab.setMode('room');lab.state.speedIdx=1;document.querySelector('[data-l=corridor]').click()});
  await page.mouse.move(500,350); await page.mouse.wheel(0,230);
  await caption('01 / Scan the first room','Six floor targets. Two doorway links. One connected survey.');
  await frames(8);await page.evaluate(()=>lab.state.speedIdx=9);await page.waitForFunction(()=>!lab.snapshot().running);await frames(3);
  await caption('02 / Move into the corridor','Shared reference balls connect the red and green scans.');
  await page.evaluate(()=>{lab.state.speedIdx=1;document.querySelector('#regDone').click()});await frames(8);await page.evaluate(()=>lab.state.speedIdx=9);await page.waitForFunction(()=>!lab.snapshot().running);await frames(3);
  await caption('03 / Capture the final room','The third scan completes the chain. Earlier points stay fixed.');
  await page.evaluate(()=>{lab.state.speedIdx=1;document.querySelector('#regDone').click()});await frames(8);await page.evaluate(()=>lab.state.speedIdx=9);await page.waitForFunction(()=>!lab.snapshot().running);await frames(3);
  await page.evaluate(()=>document.querySelector('#regDone').click());
  await caption('Three scans. One connected survey.','Download LaserScan-Lab.html and start exploring.');await frames(8);
  await page.screenshot({path:'assets/demo.png'});
  console.log('Captured '+n+' frames; '+JSON.stringify(await page.evaluate(()=>lab.snapshot())));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});

