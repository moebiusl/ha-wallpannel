const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const acorn=require('acorn');
test('Das iOS-9-Mockup bleibt in ES5 und benötigt keine modernen Browser-APIs',()=>{
 const js=fs.readFileSync('public/mockup/mockup.js','utf8');
 acorn.parse(js,{ecmaVersion:5});
 assert.doesNotMatch(js,/\b(?:fetch|Promise|URLSearchParams|ResizeObserver|IntersectionObserver)\b\s*\(/);
 assert.doesNotMatch(js,/\.(?:closest|includes|find|replaceAll)\s*\(/);
 const css=fs.readFileSync('public/mockup/mockup.css','utf8');
 assert.doesNotMatch(css,/display\s*:\s*(?:inline-)?grid\b|\b(?:var|clamp|min|max)\s*\(/);
 assert.match(css,/-webkit-flex/);
});
test('Das Mockup löst keine Netzwerk- oder HA-Gerätebefehle aus',()=>{
 const js=fs.readFileSync('public/mockup/mockup.js','utf8');
 assert.doesNotMatch(js,/XMLHttpRequest|\bfetch\s*\(|\bWebSocket\b|sendBeacon|apiPost\s*\(/);
});


test('Die Start- und Cache-Neulade-Skripte bleiben ebenfalls ES5-kompatibel',()=>{
 const html=fs.readFileSync('public/mockup/index.html','utf8');
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=2);
 for(const script of scripts)acorn.parse(script[1],{ecmaVersion:5});
});

// The actual live bundle and gesture controller must also parse in Safari 9.
test('Live-Einstieg und Regler bleiben ES5-kompatibel',()=>{
 for(const file of ['public/panel/live.js','public/panel/apps.js','public/panel/light-color.js','public/panel/light-controls.js','public/mockup/thermostat.js','public/mockup/power-fader.js','public/panel/details.js']) {
  const js=fs.readFileSync(file,'utf8');acorn.parse(js,{ecmaVersion:5});
  assert.doesNotMatch(js,/\b(?:fetch|Promise|URLSearchParams|ResizeObserver)\b\s*\(/);
  assert.doesNotMatch(js,/\.(?:closest|includes|find|replaceAll)\s*\(/);
 }
 const html=fs.readFileSync('public/panel/index.html','utf8');
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))acorn.parse(script[1],{ecmaVersion:5});
});
