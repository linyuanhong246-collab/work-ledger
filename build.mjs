import {build} from 'esbuild';
import fs from 'node:fs';
await build({entryPoints:['src/main.tsx'],bundle:true,minify:true,outfile:'dist/app.js',define:{'process.env.NODE_ENV':'"production"'}});
const css=fs.readFileSync('src/style.css','utf8');const js=fs.readFileSync('dist/app.js','utf8');
const {pwaScript}=await import('./pwa.mjs');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="theme-color" content="#185b48"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="description" content="工作账本：记下每一天工作，算清每一笔收入。云端个人账本。"><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icon-192.png"><title>工作账本</title><style>${css}</style></head><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script><script>${pwaScript}</script></body></html>`;
fs.writeFileSync('dist/index.html',html);fs.writeFileSync('dist/.nojekyll','');
