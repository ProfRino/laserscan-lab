const fs = require('node:fs');
const path = require('node:path');
let html = fs.readFileSync('dist/index.html', 'utf8');
const threeLicense = fs.readFileSync('node_modules/three/LICENSE', 'utf8');
html = html.replace('<head>', '<head>\n<!-- Bundled Three.js license:\n'+threeLicense+'\n-->');
html = html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (_,src) => {
  const js = fs.readFileSync(path.join('dist', src), 'utf8').replace(/<\/script/gi, '<\\/script');
  // A classic inline script works even with browsers' file:// module restrictions.
  return `<script>try {\n${js}\n} catch (error) { console.error(error); const notice = document.createElement('div'); notice.className='startup-error'; notice.setAttribute('role','alert'); notice.textContent='LaserScan Lab could not start. Enable WebGL in your browser and reopen this file.'; document.body.appendChild(notice); }<\/script>`;
});
html = html.replace(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g, (_,src) =>
  '<style>'+fs.readFileSync(path.join('dist',src),'utf8')+'</style>');
// Defer the inline application until the document body has been parsed.
const scripts = [...html.matchAll(/<script>[\s\S]*?<\/script>/g)].map(m=>m[0]);
html = html.replace(/<script>[\s\S]*?<\/script>/g,'').replace('</body>',()=>scripts.join('\n')+'\n</body>');
for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new (require('node:vm').Script)(match[1]);
if (/<(?:script|link)\b[^>]*(?:src|href)=/i.test(html)) throw Error('Standalone build still has external assets');
fs.writeFileSync('LaserScan-Lab.html',html);
fs.writeFileSync('LaserScan-Lab-v1.0.1.html',html);
console.log('Created LaserScan-Lab.html ('+Math.round(Buffer.byteLength(html)/1024)+' KiB): open directly, no server required.');
