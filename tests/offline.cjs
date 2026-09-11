const {readFileSync, existsSync} = require('node:fs');
const {join} = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const assert = require('node:assert/strict');
const root = join(__dirname, '..');
const source = readFileSync(join(root,'service-worker.js'),'utf8');

function worker() {
  const handlers = {}, deleted = [], shell = [], cache = new Map();
  const context = vm.createContext({
    URL, Response, Request: class { constructor(url, options) { this.url=url; this.cache=options.cache; } },
    self: { location:{origin:'https://work.test'}, clients:{claim:async()=>{}}, skipWaiting:()=>{}, addEventListener:(name,fn)=>handlers[name]=fn },
    fetch:async()=>{ throw Error('offline'); },
    caches:{keys:async()=>['unrelated-app-cache','arbeitszeiten-pwa-v0.3.0','arbeitszeiten-pwa-v0.3.1','arbeitszeiten-pwa-v0.4.0'],delete:async key=>deleted.push(key),open:async()=>({
      addAll:async files=>{ for (const file of files) { assert.equal(file.cache,'reload'); shell.push(file.url); } }, match:async request=>cache.get(typeof request === 'string' ? request : request.url)
    })}
  });
  vm.runInContext(source,context);
  return {handlers,deleted,shell,cache};
}
test('install caches only existing app files', async()=>{
  const {handlers,shell} = worker();
  let pending; handlers.install({waitUntil:p=>pending=p}); await pending;
  assert(shell.length >= 8);
  for(const file of shell) assert(existsSync(join(root,file)),file);
});
test('activation preserves caches belonging to other apps', async()=>{
  const {handlers,deleted} = worker();
  let pending; handlers.activate({waitUntil:p=>pending=p}); await pending;
  assert.deepEqual(deleted,['arbeitszeiten-pwa-v0.3.0','arbeitszeiten-pwa-v0.3.1']);
});
test('offline navigation loads app, missing script never receives HTML', async()=>{
  const {handlers,cache} = worker();
  cache.set('./index.html',new Response('<html>app</html>'));
  const request = mode => ({method:'GET',url:'https://work.test/missing',mode});
  let pending;
  handlers.fetch({request:request('navigate'),respondWith:p=>pending=p});
  assert.equal(await (await pending).text(),'<html>app</html>');
  handlers.fetch({request:request('same-origin'),respondWith:p=>pending=p});
  assert.equal((await pending).type,'error');
});
test('cached app assets work without network',async()=>{
  const {handlers,cache} = worker();
  cache.set('https://work.test/js/app.js',new Response('app script'));
  let pending; handlers.fetch({request:{method:'GET',url:'https://work.test/js/app.js',mode:'same-origin'},respondWith:p=>pending=p});
  assert.equal(await (await pending).text(),'app script');
});
test('all DOM ids referenced by the app exist exactly once',()=>{
  const html=readFileSync(join(root,'index.html'),'utf8'), js=readFileSync(join(root,'js/app.js'),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g)) assert(ids.includes(id),id);
});
