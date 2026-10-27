// Post-build: fold the built JS + CSS into one self-contained HTML file that works when
// double-clicked (file://), where browsers block ES-module scripts.
// Output: dist/BridgeEngineer.html (also rewrites dist/index.html the same way).

import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

// inline stylesheet(s)
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, href) => `<style>${fs.readFileSync(path.join(dist, href), 'utf8')}</style>`);

// pull the script out of <head>, inline it as a classic script at the end of <body>
let js = '';
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, src) => {
  js += fs.readFileSync(path.join(dist, src), 'utf8');
  return '';
});
if (!js) throw new Error('make-standalone: no built script found in dist/index.html');
// Escape closing tags inside the bundle: `</script` would end the inline script, and
// static servers that inject a reload script (VS Code Live Server) splice it in at the
// FIRST `</body>`/`</head>`/`</svg>` they find, which Phaser's bundle contains in a string.
js = js.replace(/<\/(script|body|head|svg|html)/gi, '<\\/$1');
html = html.replace('</body>', `<script>${js}</script>\n</body>`);

fs.writeFileSync(path.join(dist, 'BridgeEngineer.html'), html);
fs.writeFileSync(path.join(dist, 'index.html'), html);
console.log(`Standalone build written: dist/BridgeEngineer.html (${(html.length / 1e6).toFixed(2)} MB)`);

// voice-over clips are loaded at runtime from assets/vo/ next to the page
const voSrc = path.resolve('assets/vo');
if (fs.existsSync(voSrc)) {
  const voDst = path.join(dist, 'assets', 'vo');
  fs.rmSync(voDst, { recursive: true, force: true });
  fs.mkdirSync(voDst, { recursive: true });
  const clips = fs.readdirSync(voSrc).filter((f) => f.endsWith('.ogg'));
  for (const f of clips) fs.copyFileSync(path.join(voSrc, f), path.join(voDst, f));
  console.log(`Copied ${clips.length} voice-over clips to dist/assets/vo`);
}
