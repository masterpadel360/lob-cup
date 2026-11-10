// Prueba la app en Chrome headless a 390 px: capturas de cada pantalla, errores de JS,
// desbordes horizontales y el flujo completo (cargar → rival confirma → tabla/ranking;
// disputa → organizador resuelve; reserva; autoconfirmación).
// Uso: node herramientas/capturas.mjs [demo|modular] [carpeta-salida]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const modo = process.argv[2] || 'demo';
const out = process.argv[3] || join(raiz, 'capturas');
mkdirSync(out, { recursive: true });
const W = 390, H = 844, PORT = 9351, HTTP = 5181;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Servidor estático (los módulos ES necesitan http)
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const p = join(raiz, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(raiz) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TIPOS[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
}).listen(HTTP);
const URL_APP = modo === 'demo' ? pathToFileURL(join(raiz, 'demo', 'lob-cup-demo.html')).href : `http://localhost:${HTTP}/index.html`;

const perfil = join(tmpdir(), 'lobcup-chrome-' + Date.now());
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${perfil}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const killer = setTimeout(() => { console.error('TIMEOUT'); fin(2); }, 300000);
let ws, nid = 0; const pend = new Map(); const errores = []; const fallas = []; let oks = 0;
function cdp(method, params = {}) { const id = ++nid; ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => pend.set(id, { res, rej })); }
async function ev(expr) { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) { const e = 'EVAL ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text); errores.push(e.slice(0, 300)); return undefined; } return r.result && r.result.value; }
async function esperar(expr, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await dormir(150); } return false; }
function chequear(nombre, cond, extra) { if (cond) oks++; else { fallas.push(nombre + (extra !== undefined ? ' ' + JSON.stringify(extra) : '')); console.log('FALLA', nombre, extra !== undefined ? JSON.stringify(extra) : ''); } }
function fin(code) { clearTimeout(killer); try { ws && ws.close(); } catch {} try { chrome.kill(); } catch {} server.close(); setTimeout(() => process.exit(code), 300); }

// Captura la página entera (o solo la hoja abierta) y revisa desbordes.
async function foto(nombre, { completa = true } = {}) {
  await dormir(250);
  const desborde = await ev(`(()=>{const W=innerWidth;const out=[];
    if(document.documentElement.scrollWidth>W+1) out.push('documento '+document.documentElement.scrollWidth);
    document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(!r.width) return;
      let p=el.parentElement, scroller=false; while(p){const o=getComputedStyle(p).overflowX; if(o==='auto'||o==='scroll'||o==='hidden'){scroller=true;break;} p=p.parentElement;}
      if(!scroller && (r.right>W+1||r.left<-1)) out.push(el.tagName+'.'+String(el.className).slice(0,30)+' '+Math.round(r.left)+'..'+Math.round(r.right));
      if(el.children.length===0 && el.scrollWidth>el.clientWidth+2 && getComputedStyle(el).overflowX==='visible' && !/INPUT|SELECT|TEXTAREA|svg|path|circle|rect/i.test(el.tagName) && getComputedStyle(el).textOverflow!=='ellipsis') out.push('texto '+el.tagName+'.'+String(el.className).slice(0,20)+' "'+el.textContent.slice(0,25)+'"');
      const cs=getComputedStyle(el); if((el.tagName==='BUTTON'||el.tagName==='A') && r.height<36 && cs.display!=='none' && !el.closest('.chip,.marcador')) out.push('chico '+el.tagName+'.'+String(el.className).slice(0,20)+' '+Math.round(r.height)+'px "'+el.textContent.trim().slice(0,20)+'"');
    }); return out.slice(0,10)})()`);
  chequear('sin desborde en ' + nombre, desborde && desborde.length === 0, desborde);
  const hoja = await ev('!!document.querySelector(".sheet")');
  let alto = H;
  if (completa && !hoja) alto = Math.min(6000, Math.max(H, await ev('document.documentElement.scrollHeight')));
  if (alto !== H) await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: alto, deviceScaleFactor: 2, mobile: true });
  await dormir(200);
  const r = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, nombre + '.png'), Buffer.from(r.data, 'base64'));
  if (alto !== H) await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  console.log('foto', nombre);
}
const click = (sel) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return false; e.click(); return true})()`);
async function clic(sel, nombre) { const ok = await click(sel); chequear('existe ' + (nombre || sel), ok); await dormir(250); return ok; }
const tab = (t) => clic(`.tabs [data-v="${t}"]`, 'tab ' + t);
// Pone un marcador en el editor desde cero: [[6,4],[6,3]]
async function marcar(sets) {
  for (let i = 0; i < sets.length; i++) for (let j = 0; j < 2; j++) {
    for (let k = 0; k < sets[i][j]; k++) { await ev(`document.querySelector('[data-act="st"][data-i="${i}"][data-j="${j}"][data-d="1"]').click()`); }
  }
  await dormir(150);
}
// Datos derivados para comparar antes/después
const miFila = `(()=>{const S=LOB.S; const p=S.x.miPareja; const t=S.x.tabla(p.categoria_id).find(r=>r.id===p.id); const rk=S.x.ranking.find(r=>r.id===S.d.yo); return {pj:t.pj,pts:t.pts,pos:t.pos,rk:rk.pts,rpj:rk.pj}})()`;

try {
  let info; for (let i = 0; i < 60; i++) { try { info = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (info.find((t) => t.type === 'page')) break; } catch {} await dormir(250); }
  ws = new WebSocket(info.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { const p = pend.get(d.id); pend.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errores.push('EXC ' + (d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text).slice(0, 300));
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errores.push('CONSOLE ' + d.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !/fonts\.(googleapis|gstatic)/.test(d.params.entry.url || '')) errores.push('LOG ' + d.params.entry.text.slice(0, 200) + ' ' + (d.params.entry.url || '')); });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Log.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await cdp('Page.navigate', { url: URL_APP });
  await esperar('!!(window.LOB && LOB.S.d)');
  await ev('localStorage.clear()'); await cdp('Page.reload'); await dormir(300);
  chequear('carga la app', await esperar('!!(window.LOB && LOB.S.d && document.querySelector(".tabs"))'));
  chequear('título', (await ev('document.title')) === 'LOB CUP');
  chequear('modo demo', (await ev('LOB.S.capa.modo')) === 'demo');
  const prefijo = modo === 'demo' ? '' : 'modular-';

  if (modo !== 'demo') { // solo ver que el modular arranca igual
    await foto(prefijo + '01-inicio');
    await tab('tabla'); await foto(prefijo + '04-tabla');
    throw null;
  }

  // ---------- Pantallas del jugador
  await foto('01-inicio');
  await tab('partidos'); await foto('02-mis-partidos');
  await clic('[data-act="sub"][data-v="fixture"]'); await foto('03-fixture');
  await tab('tabla'); await foto('04-tabla');
  await tab('ranking'); await foto('05-ranking');
  await clic('.rk-row[data-act="jugador"]', 'fila ranking'); await foto('05b-ficha-jugador'); await ev('LOB.cerrar()');
  await tab('perfil'); await foto('06-perfil');
  await clic('[data-act="puntos"]'); await foto('06b-reglas'); await ev('LOB.cerrar()');

  // ---------- Flujo 1: el rival cargó → confirmo → tabla y ranking cambian
  await tab('inicio');
  const antes = await ev(miFila);
  const idConf = await ev(`document.querySelector('.pend [data-act="confirmar"]').dataset.id`);
  await ev('LOB.cerrar()');
  await ev(`(()=>{LOB.S.sheet={tipo:'partido',id:${idConf}}; LOB.render(); return 1})()`); await foto('07-detalle-por-confirmar'); await ev('LOB.cerrar()');
  await clic('.pend [data-act="confirmar"]', 'confirmar');
  await dormir(300);
  const despues = await ev(miFila);
  chequear('confirmar suma PJ en la tabla', despues.pj === antes.pj + 1, [antes, despues]);
  chequear('confirmar suma partido en ranking', despues.rpj === antes.rpj + 1, [antes, despues]);
  chequear('estado confirmado', (await ev(`LOB.S.d.partidos.find(m=>m.id===${idConf}).estado`)) === 'confirmado');

  // ---------- Flujo 2: cargo yo (6-4 6-3) → rival confirma → +100
  const prox = await ev(`(()=>{const b=document.querySelector('.hero [data-act="cargar"]'); return b && b.dataset.id})()`);
  await clic('.hero [data-act="cargar"]', 'cargar resultado');
  await marcar([[6, 4], [6, 3]]);
  await foto('08-cargar-resultado');
  chequear('veredicto ganamos', /Ganaron ustedes/.test(await ev('document.querySelector(".veredicto").textContent')));
  // un set inválido deshabilita
  await ev(`document.querySelector('[data-act="st"][data-i="0"][data-j="1"][data-d="1"]').click()`); await dormir(100);
  chequear('6-5 bloquea el botón', await ev('document.querySelector("[data-act=guardarEd]").disabled'));
  await ev(`document.querySelector('[data-act="st"][data-i="0"][data-j="1"][data-d="-1"]').click()`); await dormir(100);
  const a2 = await ev(miFila);
  await clic('[data-act="guardarEd"]', 'guardar resultado'); await dormir(300);
  chequear('queda por confirmar', (await ev(`LOB.S.d.partidos.find(m=>m.id===${prox}).estado`)) === 'por_confirmar');
  await foto('09-esperando-rival');
  await clic(`.pend [data-act="simConfirma"][data-id="${prox}"]`, 'demo rival confirma'); await dormir(300);
  const b2 = await ev(miFila);
  chequear('ganar 2-0 suma 1 punto en la tabla', b2.pts === a2.pts + 1, [a2, b2]);
  chequear('ganar 2-0 suma 100 en el ranking', b2.rk === a2.rk + 100, [a2, b2]);
  await tab('tabla'); await foto('10-tabla-actualizada');
  await tab('ranking'); await foto('11-ranking-actualizado');

  // ---------- Reservar turno del próximo partido
  await tab('inicio');
  const prox3 = await ev(`(()=>{const b=document.querySelector('.hero [data-act="reservar"]'); return b && b.dataset.id})()`);
  await clic('.hero [data-act="reservar"]', 'reservar');
  await clic('.slot:not([disabled])', 'turno libre');
  await foto('12-reservar');
  await clic('[data-act="rsOk"]', 'confirmar reserva'); await dormir(300);
  chequear('reserva pendiente', await ev(`LOB.S.d.reservas.some(r=>r.partido_id===${prox3}&&r.estado==='pendiente')`));
  await foto('13-detalle-con-turno'); await ev('LOB.cerrar()');
  await foto('14-inicio-con-sena');

  // ---------- Flujo 3: cargo → rival rechaza → organizador resuelve
  await ev(`(()=>{LOB.S.sheet={tipo:'partido',id:${prox3}}; LOB.render(); return 1})()`);
  await clic('.sheet [data-act="cargar"]', 'cargar desde detalle');
  await marcar([[6, 4], [3, 6], [11, 9]]);
  chequear('aparece súper tie-break', await ev('document.querySelectorAll(".score .step").length === 6'));
  await clic('[data-act="guardarEd"]'); await dormir(300);
  await clic(`.pend [data-act="simRechaza"][data-id="${prox3}"]`, 'demo rival rechaza'); await dormir(300);
  chequear('queda en disputa', (await ev(`LOB.S.d.partidos.find(m=>m.id===${prox3}).estado`)) === 'en_disputa');
  // como jugador: no lo puedo resolver
  chequear('jugador no ve panel', !(await ev('!!document.querySelector(".tabs [data-v=panel]")')));
  // organizador
  await ev(`(async()=>{document.querySelector('#verComo').value='org'; document.querySelector('#verComo').dispatchEvent(new Event('change',{bubbles:true})); return 1})()`);
  await esperar('LOB.S.x.esOrg'); await dormir(300);
  await foto('15-org-bandeja');
  const nDisp = await ev(`LOB.S.d.partidos.filter(m=>m.estado==='en_disputa').length`);
  await clic(`[data-act="orgEditar"][data-id="${prox3}"]`, 'org: otro resultado');
  await foto('16-org-editor');
  await clic('[data-act="guardarEd"]', 'org guarda'); await dormir(300);
  const res = await ev(`(()=>{const m=LOB.S.d.partidos.find(m=>m.id===${prox3}); return {e:m.estado,v:m.confirmado_via,s:m.sets}})()`);
  chequear('organizador resolvió', res.e === 'confirmado' && res.v === 'organizador', res);
  chequear('una disputa menos', (await ev(`LOB.S.d.partidos.filter(m=>m.estado==='en_disputa').length`)) === nDisp - 1);
  // la otra disputa: vale lo del rival
  const otra = await ev(`(()=>{const b=document.querySelector('[data-act="orgVale"][data-v="rival"]'); return b && b.dataset.id})()`);
  if (otra) { await clic(`[data-act="orgVale"][data-v="rival"][data-id="${otra}"]`); await dormir(300); chequear('vale lo del rival', (await ev(`LOB.S.d.partidos.find(m=>m.id===${otra}).estado`)) === 'confirmado'); }
  // seña
  const nSena = await ev(`LOB.S.d.reservas.filter(r=>r.estado==='pendiente').length`);
  await clic('[data-act="orgSena"]', 'seña recibida'); await dormir(300);
  chequear('seña confirmada', (await ev(`LOB.S.d.reservas.filter(r=>r.estado==='pendiente').length`)) === nSena - 1);
  await tab('partidos'); await foto('17-org-fixture');
  await tab('panel'); await foto('18-org-parejas');
  await clic('[data-act="sub"][data-v="fixture"]'); await foto('19-org-fixture-gen');
  await clic('[data-act="sub"][data-v="ajustes"]'); await foto('20-org-ajustes');
  // cambiar horas de autoconfirmación
  await ev(`(()=>{const i=document.querySelector('[data-cfg="horas_autoconfirmar"]'); i.value='48'; return 1})()`);
  await clic('[data-act="orgConfig"]'); await dormir(300);
  chequear('config guardada', (await ev('LOB.S.d.config.horas_autoconfirmar')) === 48);
  await clic('[data-act="sub"][data-v="actividad"]'); await foto('21-org-actividad');

  // ---------- Autoconfirmación
  const porConf = await ev(`LOB.S.d.partidos.filter(m=>m.estado==='por_confirmar').length`);
  await clic('[data-act="menuDemo"]'); await foto('22-menu-demo');
  await clic('[data-act="demoReloj"]'); await dormir(400);
  chequear('adelantar 48 h autoconfirma todo', porConf > 0 && (await ev(`LOB.S.d.partidos.filter(m=>m.estado==='por_confirmar').length`)) === 0, porConf);
  chequear('marca autoconfirmado', await ev(`LOB.S.d.partidos.some(m=>m.confirmado_via==='auto' && m.confirmado_at > Date.now()-60000)`));

  // ---------- Modo oscuro (de vuelta como jugador)
  await clic('[data-act="menuDemo"]'); await clic('[data-act="demoVer"][data-v="yo"]'); await dormir(300);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await tab('inicio'); await foto('23-oscuro-inicio');
  await tab('tabla'); await foto('24-oscuro-tabla');
  await tab('ranking'); await foto('25-oscuro-ranking');
  chequear('fondo oscuro', (await ev('getComputedStyle(document.body).backgroundColor')) === 'rgb(10, 11, 13)');
  await ev(`document.documentElement.dataset.theme='light'`); await dormir(100);
  chequear('forzar claro gana al sistema', (await ev('getComputedStyle(document.body).backgroundColor')) === 'rgb(242, 242, 238)');
  await ev(`delete document.documentElement.dataset.theme`);
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });

  // ---------- Inscripción (jugadora de otra categoría con código)
  await ev(`(async()=>{await LOB.S.capa.demo.reiniciar(); await LOB.recargar(); return 1})()`);
  // ---------- Persistencia: recargar mantiene lo hecho
  await ev(`(async()=>{const m=LOB.S.d.partidos.find(x=>x.estado==='por_confirmar' && LOB.S.x.misParejas.some(p=>p.id===x.a||p.id===x.b)); await LOB.S.capa.confirmarResultado(m.id); await LOB.recargar(); return 1})()`);
  const confAntes = await ev(`LOB.S.d.partidos.filter(m=>m.estado==='confirmado').length`);
  await cdp('Page.reload'); await esperar('!!(window.LOB && LOB.S.d)');
  chequear('localStorage guarda la demo', (await ev(`LOB.S.d.partidos.filter(m=>m.estado==='confirmado').length`)) === confAntes);
} catch (e) { if (e) { console.error('ERROR', e.message); fallas.push('excepción ' + e.message); } }

// ---------- Sin localStorage (navegador que lo bloquea)
try {
  if (modo === 'demo') {
    await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "Object.defineProperty(window,'localStorage',{get(){throw new Error('bloqueado')}})" });
    await cdp('Page.reload');
    chequear('anda sin localStorage', await esperar('!!(window.LOB && LOB.S.d && document.querySelector(".tabs"))'));
    errores.splice(0, errores.length, ...errores.filter((e) => !/bloqueado/.test(e) || /EXC/.test(e)));
  }
} catch (e) { fallas.push('sin storage ' + e.message); }

console.log('\nERRORES JS:', errores.length ? '\n' + errores.join('\n') : 'ninguno');
console.log(`CHEQUEOS: ${oks} ok, ${fallas.length} fallas`);
fin(fallas.length || errores.length ? 1 : 0);
