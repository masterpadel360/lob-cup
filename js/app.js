// =====================================================================
// LOB CUP — pantalla (la misma para demo y para Supabase)
// =====================================================================
import { crearCapaDatos } from './datos.js';
import { calcularTabla, calcularRanking, validarSets, contarSets, linkWhatsApp, resumenFecha, fechaISO } from './logica.js';

const CFG = window.LOB_CONFIG || {};
const MARCA = CFG.marca || 'LOB CUP';
const HORA = 3600e3, DIA = 24 * HORA;

const S = {
  capa: null, d: null, x: null, tab: 'inicio', sub: { partidos: 'mios', panel: 'parejas', login: 'entrar' },
  cat: null, fecha: null, rk: 'todos', sheet: null, ed: null, rs: null, armado: null, cargando: true, errorCarga: null,
};

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel) => document.querySelector(sel);
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGO = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-AR');
function fechaCorta(iso) { const d = new Date(iso + 'T12:00:00'); return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; }
function cuando(ms) {
  const d = new Date(ms); const hoy = new Date();
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === hoy.toDateString()) return `hoy ${hh}`;
  return `${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} ${hh}`;
}
function falta(ms) {
  const dif = ms - Date.now();
  if (dif <= 0) return 'ya';
  const h = Math.round(dif / HORA);
  return h < 1 ? `en ${Math.max(1, Math.round(dif / 60000))} min` : h < 48 ? `en ${h} h` : `en ${Math.round(h / 24)} días`;
}
function hace(ms) {
  const dif = Date.now() - ms;
  const h = Math.floor(dif / HORA);
  if (dif < 0) return cuando(ms);
  if (h < 1) return `hace ${Math.max(1, Math.round(dif / 60000))} min`;
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

const I = {
  inicio: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  partidos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  tabla: '<path d="M4 5h16M4 10h16M4 15h16M4 20h16"/><path d="M9 3v19"/>',
  ranking: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M10 17h4"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  panel: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  wa: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.5"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pelota: '<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5c3 3 3 10 0 13M18.5 5.5c-3 3-3 10 0 13"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3v3H8z"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  pesos: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
const ico = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const LOGO = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x=".5" y=".5" width="39" height="39" rx="12" fill="#0d2150" stroke="rgba(255,255,255,.16)"/><path d="M7 31 Q 17 1 32 21" fill="none" stroke="#d4f23f" stroke-width="2.4" stroke-dasharray="3.2 3.2" stroke-linecap="round"/><circle cx="31" cy="25.5" r="5.2" fill="#d4f23f"/><path d="M27.6 22.5c2 1.6 2.4 4.4 1 6.3" fill="none" stroke="#0d2150" stroke-width="1.2"/></svg>';

// ---------------------------------------------------------------------
// Índices (se arman cada vez que se recarga)
// ---------------------------------------------------------------------
function indexar(d) {
  const jug = new Map(d.jugadores.map((j) => [j.id, j]));
  const par = new Map(d.parejas.map((p) => [p.id, p]));
  const cat = new Map(d.categorias.map((c) => [c.id, c]));
  const yo = d.yo ? jug.get(d.yo) : null;
  const esOrg = !!(yo && yo.rol === 'organizador');
  const misParejas = d.parejas.filter((p) => p.estado === 'activa' && d.yo && (p.jugador1 === d.yo || p.jugador2 === d.yo));
  const miPareja = misParejas.find((p) => p.jugador2) || misParejas[0] || null;
  const reservaDe = new Map();
  for (const r of d.reservas) if (r.estado !== 'cancelada') reservaDe.set(r.partido_id, r);
  const jugadoresRk = d.jugadores.filter((j) => j.rol !== 'organizador');
  const ranking = calcularRanking(jugadoresRk.map((j) => ({ id: j.id, nombre: `${j.nombre} ${j.apellido}`.trim() })), d.parejas, d.partidos, d.config);
  const catsDe = new Map();
  for (const p of d.parejas) for (const j of [p.jugador1, p.jugador2]) if (j) { if (!catsDe.has(j)) catsDe.set(j, new Set()); catsDe.get(j).add(p.categoria_id); }
  const tablas = new Map();
  const tabla = (cid) => {
    if (!tablas.has(cid)) tablas.set(cid, calcularTabla(d.parejas.filter((p) => p.categoria_id === cid), d.partidos.filter((m) => m.categoria_id === cid), d.config));
    return tablas.get(cid);
  };
  return { jug, par, cat, yo, esOrg, misParejas, miPareja, reservaDe, ranking, catsDe, tabla };
}

const J = (id) => S.x.jug.get(id) || { nombre: '¿?', apellido: '' };
const nombreJ = (id) => { const j = J(id); return `${j.nombre} ${j.apellido}`.trim(); };
const apeJ = (id) => { const j = J(id); return j.apellido || j.nombre; };
function nombreP(pid) { const p = S.x.par.get(pid); if (!p) return '¿?'; return p.jugador2 ? `${apeJ(p.jugador1)} / ${apeJ(p.jugador2)}` : `${apeJ(p.jugador1)} (sin compañero)`; }
function nombrePLargo(pid) { const p = S.x.par.get(pid); if (!p) return '¿?'; return p.jugador2 ? `${nombreJ(p.jugador1)} y ${nombreJ(p.jugador2)}` : nombreJ(p.jugador1); }
const catCorta = (cid) => { const c = S.x.cat.get(cid); return c ? `${c.nivel}.ª ${c.genero}` : ''; };
const miParejaEn = (m) => S.x.misParejas.map((p) => p.id).find((id) => id === m.a || id === m.b) || null;
const rivalDe = (m, mi) => (m.a === mi ? m.b : m.a);
const partido = (id) => S.d.partidos.find((m) => m.id === Number(id));
const inicial = (id) => { const j = J(id); return ((j.nombre || '?')[0] + (j.apellido || '')[0] || '').toUpperCase(); };

// ---------------------------------------------------------------------
// Carga
// ---------------------------------------------------------------------
async function recargar() {
  try {
    S.d = await S.capa.cargar();
    S.x = indexar(S.d);
    S.errorCarga = null;
    if (!S.cat || !S.x.cat.has(S.cat)) S.cat = S.x.miPareja ? S.x.miPareja.categoria_id : (S.d.categorias[0] || {}).id;
  } catch (e) {
    S.errorCarga = e.message;
  }
  S.cargando = false;
  render();
}

async function hacer(fn, ok) {
  try {
    const r = await fn();
    if (ok) toast(typeof ok === 'function' ? ok(r) : ok);
    await recargar();
    return r;
  } catch (e) {
    toast(e.message || 'Algo salió mal.', true);
    return undefined;
  }
}

let toastT = null;
function toast(msg, mal = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (mal ? ' mal' : ''); t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, mal ? 4200 : 2600);
}

// ---------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------
function render() {
  const app = $('#app');
  if (S.cargando) { app.innerHTML = `<main><div class="vacio"><b>Cargando…</b></div></main>`; return; }
  if (S.errorCarga && !S.d) { app.innerHTML = `${vTop()}<main><div class="card pad"><b>No se pudo cargar la liga.</b><p class="mute small">${esc(S.errorCarga)}</p><button class="btn volt block" style="margin-top:12px" data-act="reintentar">Reintentar</button></div></main>`; return; }
  const vistas = { inicio: vInicio, partidos: vPartidos, tabla: vTabla, ranking: vRanking, perfil: vPerfil, panel: vPanel };
  if (S.tab === 'panel' && !S.x.esOrg) S.tab = 'inicio';
  app.innerHTML = `${vTop()}<main id="vista">${(vistas[S.tab] || vInicio)()}<p class="pie">${esc(MARCA)} · ${esc(S.d.config.temporada)}${S.capa.modo === 'demo' ? ' · modo demo, datos inventados' : ''}</p></main>${vTabs()}`;
  renderSheet();
}

function vTop() {
  const demo = S.capa && S.capa.demo;
  let barra = '';
  if (demo && S.d) {
    const yoId = S.d.yo;
    const grupos = S.d.categorias.map((c) => {
      const js = [];
      for (const p of S.d.parejas.filter((x) => x.categoria_id === c.id)) for (const j of [p.jugador1, p.jugador2]) if (j) js.push(j);
      return `<optgroup label="${esc(c.nombre)}">${js.map((j) => `<option value="${esc(j)}"${j === yoId ? ' selected' : ''}>${esc(nombreJ(j))}</option>`).join('')}</optgroup>`;
    }).join('');
    barra = `<div class="demo-bar"><div class="demo-in"><span class="tag">DEMO</span><label class="sr" for="verComo">Ver como</label>
      <select id="verComo" data-chg="verComo" aria-label="Ver como"><option value="org"${yoId === 'org' ? ' selected' : ''}>Ver como: organizador</option>${grupos}</select>
      <button class="icon-btn" data-act="menuDemo" aria-label="Opciones de la demo">${ico('mas')}</button></div></div>`;
  }
  const temporada = S.d ? `<span class="pill">${esc(S.d.config.temporada.replace('Temporada ', 'T'))}</span>` : '';
  const perfilOrg = S.x && S.x.esOrg ? `<button class="icon-btn" data-act="tab" data-v="perfil" aria-label="Mi perfil">${ico('perfil')}</button>` : '';
  return `<header class="top"><div class="top-in"><a class="logo" href="#" data-act="tab" data-v="inicio" aria-label="${esc(MARCA)}: inicio">${LOGO}<b>${esc(MARCA)}</b></a><span class="sp"></span>${temporada}${perfilOrg}</div></header>${barra}`;
}

function vTabs() {
  const org = S.x.esOrg;
  const urg = org ? S.d.partidos.filter((m) => m.estado === 'en_disputa').length + S.d.reservas.filter((r) => r.estado === 'pendiente').length : pendientes().filter((p) => p.urg).length;
  const t = [['inicio', 'Inicio'], ['partidos', 'Partidos'], ['tabla', 'Tabla'], ['ranking', 'Ranking'], org ? ['panel', 'Panel'] : ['perfil', 'Perfil']];
  return `<nav class="tabs" aria-label="Secciones"><div class="tabs-in">${t.map(([k, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}" aria-label="${n}"${S.tab === k ? ' aria-current="page"' : ''}>${ico(k)}<span>${n}</span>${k === 'inicio' && urg ? `<span class="badge">${urg}</span>` : ''}</button>`).join('')}</div></nav>`;
}

// ---------------------------------------------------------------------
// Pendientes del jugador ("notificaciones")
// ---------------------------------------------------------------------
function proximoDe(pid) {
  return S.d.partidos.filter((m) => (m.a === pid || m.b === pid) && m.estado === 'pendiente').sort((x, y) => x.fecha - y.fecha)[0] || null;
}
function pendientes() {
  if (!S.x.yo || S.x.esOrg) return [];
  const out = [];
  const mias = new Set(S.x.misParejas.map((p) => p.id));
  for (const p of S.x.misParejas) {
    if (!p.jugador2 && p.jugador1 === S.d.yo) out.push({ tipo: 'codigo', p, urg: false });
  }
  for (const m of S.d.partidos) {
    const mi = mias.has(m.a) ? m.a : mias.has(m.b) ? m.b : null;
    if (!mi) continue;
    if (m.estado === 'por_confirmar' && m.cargado_pareja !== mi) out.push({ tipo: 'confirmar', m, mi, urg: true });
    else if (m.estado === 'por_confirmar') out.push({ tipo: 'esperando', m, mi });
    else if (m.estado === 'en_disputa') out.push({ tipo: 'disputa', m, mi });
    else if (m.estado === 'pendiente') {
      const r = S.x.reservaDe.get(m.id);
      if (r && new Date(`${r.fecha}T${r.fin === '24:00' ? '23:59' : r.fin}:00`).getTime() < Date.now()) out.push({ tipo: 'cargar', m, mi, r, urg: true });
      else if (r && r.estado === 'pendiente') out.push({ tipo: 'sena', m, mi, r });
    }
  }
  for (const p of S.x.misParejas) {
    const prox = p.jugador2 && proximoDe(p.id);
    if (prox && !S.x.reservaDe.get(prox.id)) out.push({ tipo: 'reservar', m: prox, mi: p.id });
  }
  const orden = { confirmar: 0, cargar: 1, sena: 2, reservar: 3, esperando: 4, disputa: 5, codigo: 6 };
  return out.sort((x, y) => orden[x.tipo] - orden[y.tipo]);
}

function tarjetaPendiente(p) {
  const demo = S.capa.demo;
  const cfg = S.d.config;
  if (p.tipo === 'confirmar') {
    const riv = rivalDe(p.m, p.mi);
    return `<div class="card pend urg"><div class="ico">${ico('check')}</div><div class="grow"><b>Confirmá el resultado</b>
      <p>${esc(nombreP(riv))} cargó ${esc(setsTxt(p.m, p.mi))} (fecha ${p.m.fecha}). Si no respondés, se confirma solo ${falta(p.m.vence_at)}.</p>
      <div class="btns"><button class="btn volt sm" data-act="confirmar" data-id="${p.m.id}">Confirmar</button><button class="btn ghost sm" data-act="disputar" data-id="${p.m.id}">No es así</button></div></div></div>`;
  }
  if (p.tipo === 'esperando') {
    return `<div class="card pend"><div class="ico">${ico('reloj')}</div><div class="grow"><b>Esperando a ${esc(nombreP(rivalDe(p.m, p.mi)))}</b>
      <p>Cargaste ${esc(setsTxt(p.m, p.mi))}. Si no lo confirman, queda firme ${falta(p.m.vence_at)}.</p>
      ${demo ? `<div class="btns"><button class="btn dark sm" data-act="simConfirma" data-id="${p.m.id}">Demo: rival confirma</button><button class="btn ghost sm" data-act="simRechaza" data-id="${p.m.id}">Demo: rival rechaza</button></div>` : ''}</div></div>`;
  }
  if (p.tipo === 'disputa') {
    return `<div class="card pend hot"><div class="ico">${ico('alerta')}</div><div class="grow"><b>Resultado en revisión</b><p>Fecha ${p.m.fecha} contra ${esc(nombreP(rivalDe(p.m, p.mi)))}: lo define el organizador.</p>
      <div class="btns one"><button class="btn ghost sm" data-act="partido" data-id="${p.m.id}">Ver el partido</button></div></div></div>`;
  }
  if (p.tipo === 'cargar') {
    return `<div class="card pend urg"><div class="ico">${ico('pelota')}</div><div class="grow"><b>¿Cómo salió?</b><p>Jugaste la fecha ${p.m.fecha} contra ${esc(nombreP(rivalDe(p.m, p.mi)))}. Cargá el resultado.</p>
      <div class="btns one"><button class="btn volt sm" data-act="cargar" data-id="${p.m.id}">Cargar resultado</button></div></div></div>`;
  }
  if (p.tipo === 'sena') {
    const txt = `Hola! Reservé el turno del ${fechaCorta(p.r.fecha)} a las ${p.r.inicio} (cancha ${p.r.cancha}) para ${nombreP(p.m.a)} vs ${nombreP(p.m.b)}. Te paso el comprobante de la seña.`;
    return `<div class="card pend"><div class="ico">${ico('pesos')}</div><div class="grow"><b>Turno pendiente de seña</b>
      <p>${esc(fechaCorta(p.r.fecha))} ${esc(p.r.inicio)} · cancha ${p.r.cancha}. Transferí ${pesos(cfg.monto_sena)} al alias <b style="display:inline">${esc(cfg.alias)}</b> y mandá el comprobante.</p>
      <div class="btns"><a class="btn dark sm" href="${esc(linkWhatsApp(cfg.whatsapp_org, txt))}" target="_blank" rel="noopener">${ico('wa')}Comprobante</a><button class="btn ghost sm" data-act="partido" data-id="${p.m.id}">Ver turno</button></div></div></div>`;
  }
  if (p.tipo === 'reservar') {
    return `<div class="card pend"><div class="ico">${ico('cal')}</div><div class="grow"><b>Reservá la fecha ${p.m.fecha}</b><p>Coordiná con ${esc(nombreP(rivalDe(p.m, p.mi)))} y elegí un turno libre.</p>
      <div class="btns"><button class="btn dark sm" data-act="reservar" data-id="${p.m.id}">Reservar</button><button class="btn ghost sm" data-act="wa" data-id="${p.m.id}">${ico('wa')}Rival</button></div></div></div>`;
  }
  if (p.tipo === 'codigo') {
    const c = S.x.cat.get(p.p.categoria_id);
    const txt = `Sumate a mi pareja en la ${MARCA} (${c.nombre}). Entrá a la app y poné este código: ${p.p.codigo || ''}`;
    return `<div class="card pend"><div class="ico">${ico('link')}</div><div class="grow"><b>Falta tu compañero</b><p>${esc(c.nombre)}: pasale el código <b style="display:inline">${esc(p.p.codigo || '…')}</b> para que se sume.</p>
      <div class="btns one"><a class="btn dark sm" href="${esc('https://wa.me/?text=' + encodeURIComponent(txt))}" target="_blank" rel="noopener">${ico('wa')}Mandar código</a></div></div></div>`;
  }
  return '';
}

// Sets como texto desde el lado de una pareja ("6-4 3-6 11-9")
function setsTxt(m, desde) {
  const s = desde === m.b ? m.sets.map(([a, b]) => [b, a]) : m.sets;
  return m.wo ? `W.O. (${s.map(([a, b]) => `${a}-${b}`).join(' ')})` : s.map(([a, b]) => `${a}-${b}`).join(' ');
}

// ---------------------------------------------------------------------
// INICIO
// ---------------------------------------------------------------------
function vInicio() {
  if (S.x.esOrg) return vBandeja();
  if (!S.x.yo) return vBienvenida();
  const yo = S.x.yo, p = S.x.miPareja;
  let h = `<section class="stage"><div class="saludo"><div><p class="kicker">${esc(S.d.config.temporada)}</p><h1 class="h1">Hola, ${esc(yo.nombre || 'jugador')}</h1>
    <p class="mute small">${p ? `${esc(S.x.cat.get(p.categoria_id).nombre)} · con ${esc(p.jugador2 ? nombreJ(p.jugador1 === yo.id ? p.jugador2 : p.jugador1) : 'compañero a confirmar')}` : 'Todavía no estás en una pareja'}</p></div></div>`;
  if (!p) return h + `</section><div class="sec">${vSumate()}</div>`;
  const st = p.jugador2 && S.x.tabla(p.categoria_id).find((r) => r.id === p.id);
  if (st) h += `<div class="hero-stats"><div><b>${st.pos}°</b><span>Puesto</span></div><div><b>${st.pts}</b><span>Puntos</span></div><div><b>${st.pj}</b><span>Jugados</span></div><div><b>${st.pj ? Math.round((st.pg / st.pj) * 100) + '%' : '–'}</b><span>Ganados</span></div></div>`;
  h += `<div class="sec">${heroProximo(p)}</div></section>`;
  const pend = pendientes();
  if (pend.length) h += `<div class="sec"><div class="sec-h"><h2 class="h2">Para hacer</h2><span class="chip ${pend.some((x) => x.urg) ? 'volt' : ''}">${pend.length}</span></div><div class="stack">${pend.map(tarjetaPendiente).join('')}</div></div>`;
  h += miniTabla(p.categoria_id, p.id);
  h += destacados(p.categoria_id);
  return h;
}

function vBienvenida() {
  return `<div class="hero"><p class="kicker">${esc(CFG.lema || 'Liga amateur de pádel')}</p><div class="fecha-big" style="margin-top:8px">Jugá.<br>Cargá.<br>Subí.</div>
    <p style="margin-top:12px;color:var(--hero-mute)">Fixture, resultados, tabla y ranking: todo lo manejan los jugadores desde el celu.</p>
    <div class="acciones"><button class="btn volt" data-act="tab" data-v="perfil">Entrar</button><button class="btn ghost" data-act="tab" data-v="tabla">Ver la tabla</button></div></div>
    ${destacados(S.cat)}`;
}

function heroProximo(p) {
  if (!p.jugador2) return `<div class="hero"><p class="kicker">Tu pareja</p><div class="fecha-big" style="font-size:40px;margin-top:6px">Falta tu compañero</div><p style="margin-top:10px;color:var(--hero-mute)">Pasale el código <b style="color:var(--volt)">${esc(p.codigo || '…')}</b>. Cuando se sume, entran al fixture.</p></div>`;
  const m = proximoDe(p.id);
  const st = S.x.tabla(p.categoria_id).find((r) => r.id === p.id);
  if (!m) {
    return `<div class="hero"><p class="kicker">Tu temporada</p><div class="fecha-big" style="font-size:44px;margin-top:6px">Sin partidos pendientes</div>
      <p style="margin-top:10px;color:var(--hero-mute)">Ya jugaste todas tus fechas. Mirá cómo quedó la tabla.</p></div>`;
  }
  const riv = rivalDe(m, p.id);
  const r = S.x.reservaDe.get(m.id);
  const stR = S.x.tabla(p.categoria_id).find((x) => x.id === riv);
  const chips = [];
  if (r) chips.push(`<span class="chip">${ico('cal').replace('<svg', '<svg width="14" height="14"')} ${esc(fechaCorta(r.fecha))} ${esc(r.inicio)} · cancha ${r.cancha}</span>`, r.estado === 'confirmada' ? '<span class="chip volt">Turno confirmado</span>' : '<span class="chip" style="color:var(--warn)">Seña pendiente</span>');
  else chips.push('<span class="chip">Sin turno todavía</span>');
  return `<div class="hero"><p class="kicker">Tu próximo partido</p><div class="fecha-big" style="margin-top:6px">Fecha ${m.fecha}</div>
    <div class="vs"><div class="lado"><b>${esc(nombreP(p.id))}</b><span>${st ? `${st.pos}° · ${st.pts} pts` : ''}</span></div><div class="x">VS</div><div class="lado der"><b>${esc(nombreP(riv))}</b><span>${stR ? `${stR.pos}° · ${stR.pts} pts` : ''}</span></div></div>
    <div class="chips">${chips.join('')}</div>
    <div class="acciones">
      ${r ? `<button class="btn volt" data-act="cargar" data-id="${m.id}">Cargar resultado</button>` : `<button class="btn volt" data-act="reservar" data-id="${m.id}">Reservar turno</button>`}
      <button class="btn ghost" data-act="wa" data-id="${m.id}">${ico('wa')}Rivales</button>
      ${r ? '' : `<button class="btn ghost" data-act="cargar" data-id="${m.id}" style="grid-column:1/-1">Ya jugamos: cargar resultado</button>`}
      ${S.capa.demo ? `<button class="btn ghost" data-act="simCarga" data-id="${m.id}" style="grid-column:1/-1">Demo: el rival carga el resultado</button>` : ''}
    </div></div>`;
}

function miniTabla(cid, mia) {
  const t = S.x.tabla(cid);
  if (!t.length) return '';
  const pos = t.findIndex((r) => r.id === mia);
  let filas = t.slice(0, 4);
  if (pos >= 4) filas = [...t.slice(0, 3), t[pos]];
  return `<div class="sec"><div class="sec-h"><h2 class="h2">${esc(S.x.cat.get(cid).nombre)}</h2><button class="link" data-act="irTabla" data-v="${cid}">Tabla completa</button></div>
    <div class="card">${tablaHTML(filas, mia)}</div></div>`;
}

function destacados(cid) {
  if (!cid) return '';
  const ms = S.d.partidos.filter((m) => m.categoria_id === cid);
  const fechas = [...new Set(ms.filter((m) => m.estado === 'confirmado').map((m) => m.fecha))].sort((a, b) => b - a);
  if (!fechas.length) return '';
  const f = fechas[0];
  const rf = resumenFecha(ms, f);
  const enCat = new Set(); for (const p of S.d.parejas) if (p.categoria_id === cid) { enCat.add(p.jugador1); if (p.jugador2) enCat.add(p.jugador2); }
  const enRacha = S.x.ranking.filter((r) => enCat.has(r.id) && r.racha && r.racha.tipo === 'G').sort((a, b) => b.racha.n - a.racha.n)[0];
  const ganLado = (m) => (m.ganador === m.a ? [m.a, m.b] : [m.b, m.a]);
  let h = `<div class="sec"><div class="sec-h"><h2 class="h2">Fecha ${f} en números</h2><span class="mute small">${esc(catCorta(cid))}</span></div><div class="dest">
    <div class="card"><span class="kicker">Jugados</span><div class="big num">${rf.jugados}/${rf.total}</div></div>
    <div class="card"><span class="kicker">Súper tie-breaks</span><div class="big num">${rf.stbs}</div></div>`;
  if (rf.paliza) { const [g, p] = ganLado(rf.paliza.partido); h += `<div class="card full"><span class="kicker">La paliza</span><b>${esc(nombreP(g))} le ganó a ${esc(nombreP(p))} ${esc(setsTxt(rf.paliza.partido, g))}</b></div>`; }
  if (rf.partidazo) { const [g, p] = ganLado(rf.partidazo.partido); h += `<div class="card full"><span class="kicker">El partidazo</span><b>${esc(nombreP(g))} vs ${esc(nombreP(p))}: ${esc(setsTxt(rf.partidazo.partido, g))}</b></div>`; }
  if (enRacha && enRacha.racha.n >= 2) h += `<div class="card full"><span class="kicker">En racha</span><b>${esc(enRacha.nombre)} · ${enRacha.racha.n} triunfos seguidos</b></div>`;
  return h + '</div></div>';
}

function vSumate() {
  const g = S.x.yo && S.x.yo.genero;
  const cats = S.d.categorias.filter((c) => c.inscripcion_abierta && (!g || c.genero === g));
  return `<div class="card pad"><h2 class="h2">Sumate a la liga</h2><p class="mute small" style="margin-top:4px">Armá tu pareja: vos la creás y le pasás el código a tu compañero.</p>
    <label class="campo" style="margin-top:12px"><span>Categoría</span><select id="catNueva">${cats.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('')}</select></label>
    <button class="btn volt block" style="margin-top:12px" data-act="crearPareja"${cats.length ? '' : ' disabled'}>Crear mi pareja</button>
    <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px"><label class="campo"><span>¿Tu compañero ya la creó? Poné su código</span><input id="codigo" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="Ej: LOB7K2"></label>
    <button class="btn dark block" style="margin-top:10px" data-act="unirme">Unirme</button></div></div>`;
}

// Inicio del organizador: la bandeja de excepciones
function vBandeja() {
  const disp = S.d.partidos.filter((m) => m.estado === 'en_disputa');
  const senas = S.d.reservas.filter((r) => r.estado === 'pendiente').sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));
  const porConf = S.d.partidos.filter((m) => m.estado === 'por_confirmar');
  const total = S.d.partidos.length, conf = S.d.partidos.filter((m) => m.estado === 'confirmado').length;
  const incompletas = S.d.parejas.filter((p) => p.estado === 'activa' && !p.jugador2);
  let h = `<p class="kicker">Organización</p><h1 class="h1">Bandeja</h1><p class="mute small" style="margin-top:6px">Solo lo que necesita tu atención. El resto lo resuelven los jugadores.</p>
    <div class="hero sec"><p class="kicker">La liga hoy</p><div class="stats" style="margin-top:10px">
      <div class="stat"><b>${disp.length}</b><span>Disputas</span></div><div class="stat"><b>${senas.length}</b><span>Señas</span></div>
      <div class="stat"><b>${porConf.length}</b><span>Por confirmar</span></div><div class="stat"><b>${total ? Math.round((conf / total) * 100) : 0}%</b><span>Jugado</span></div></div></div>`;
  h += `<div class="sec"><div class="sec-h"><h2 class="h2">Disputas</h2><span class="chip ${disp.length ? 'hot' : ''}">${disp.length}</span></div>`;
  h += disp.length ? `<div class="stack">${disp.map(tarjetaDisputa).join('')}</div>` : `<div class="card vacio"><b>Sin disputas</b>Todo confirmado entre jugadores.</div>`;
  h += `</div><div class="sec"><div class="sec-h"><h2 class="h2">Señas para revisar</h2><span class="chip">${senas.length}</span></div>`;
  h += senas.length ? `<div class="card lista">${senas.map((r) => { const m = partido(r.partido_id); return `<div class="partido"><div class="meta"><span>${esc(fechaCorta(r.fecha))} ${esc(r.inicio)} · cancha ${r.cancha}</span><span>${esc(catCorta(m.categoria_id))} · F${m.fecha}</span></div>
      <b class="small">${esc(nombreP(m.a))} vs ${esc(nombreP(m.b))}</b><div class="btns" style="margin-top:10px"><button class="btn ok sm" data-act="orgSena" data-id="${r.id}">Seña recibida</button><button class="btn ghost sm" data-act="orgCancelaTurno" data-id="${r.id}">${S.armado === 'ct' + r.id ? '¿Seguro? Tocá de nuevo' : 'Cancelar turno'}</button></div></div>`; }).join('')}</div>` : `<div class="card vacio"><b>Nada pendiente</b></div>`;
  h += '</div>';
  if (porConf.length) h += `<div class="sec"><div class="sec-h"><h2 class="h2">Esperando al rival</h2><span class="chip">${porConf.length}</span></div><div class="card lista">${porConf.sort((a, b) => a.vence_at - b.vence_at).map((m) => tarjetaPartido(m)).join('')}</div><p class="ayuda">Se confirman solos a las ${S.d.config.horas_autoconfirmar} h de cargados.</p></div>`;
  if (incompletas.length) h += `<div class="sec"><div class="sec-h"><h2 class="h2">Parejas sin completar</h2></div><div class="card lista">${incompletas.map((p) => `<div class="partido"><b class="small">${esc(nombreJ(p.jugador1))}</b><div class="mute small">${esc(S.x.cat.get(p.categoria_id).nombre)} · esperando compañero</div></div>`).join('')}</div></div>`;
  return h;
}

function tarjetaDisputa(m) {
  const cargo = m.cargado_pareja, otro = rivalDe(m, cargo);
  return `<div class="card pad"><div class="row" style="justify-content:space-between"><span class="kicker">${esc(S.x.cat.get(m.categoria_id).nombre)} · Fecha ${m.fecha}</span><span class="chip hot">En disputa</span></div>
    <p class="small" style="margin-top:8px"><b>${esc(nombreP(m.a))}</b> vs <b>${esc(nombreP(m.b))}</b></p>
    <div class="versiones" style="margin-top:10px"><div class="card"><b>Cargó ${esc(nombreP(cargo))}</b><div class="sets-txt">${esc(setsTxt(m, cargo))}</div></div>
    <div class="card"><b>Dice ${esc(nombreP(otro))}</b><div class="sets-txt">${m.disputa_sets ? esc(setsTxt({ ...m, sets: m.disputa_sets, wo: false }, cargo)) : '—'}</div></div></div>
    ${m.disputa_motivo ? `<p class="small mute" style="margin-top:8px">“${esc(m.disputa_motivo)}”</p>` : ''}
    <p class="ayuda">Los dos resultados se muestran desde el lado de ${esc(nombreP(cargo))}.</p>
    <div class="btns" style="margin-top:10px"><button class="btn dark sm" data-act="orgVale" data-id="${m.id}" data-v="cargado">Vale lo cargado</button>
    ${m.disputa_sets ? `<button class="btn dark sm" data-act="orgVale" data-id="${m.id}" data-v="rival">Vale lo del rival</button>` : ''}
    <button class="btn ghost sm" data-act="orgEditar" data-id="${m.id}" style="${m.disputa_sets ? 'grid-column:1/-1' : ''}">Otro resultado</button></div></div>`;
}

// ---------------------------------------------------------------------
// PARTIDOS
// ---------------------------------------------------------------------
function chipEstado(m) {
  const r = S.x.reservaDe.get(m.id);
  if (m.estado === 'confirmado') return m.wo ? '<span class="chip solid">W.O.</span>' : m.confirmado_via === 'auto' ? '<span class="chip ok"><span class="dot"></span>Autoconfirmado</span>' : m.confirmado_via === 'organizador' ? '<span class="chip ok"><span class="dot"></span>Definido por la org.</span>' : '<span class="chip ok"><span class="dot"></span>Confirmado</span>';
  if (m.estado === 'por_confirmar') return '<span class="chip warn"><span class="dot"></span>Por confirmar</span>';
  if (m.estado === 'en_disputa') return '<span class="chip hot"><span class="dot"></span>En disputa</span>';
  if (r) return r.estado === 'confirmada' ? `<span class="chip">${esc(fechaCorta(r.fecha))} ${esc(r.inicio)}</span>` : `<span class="chip warn">${esc(fechaCorta(r.fecha))} ${esc(r.inicio)} · seña</span>`;
  return '<span class="chip">Sin turno</span>';
}

function marcadorHTML(m) {
  const tiene = m.sets && m.sets.length;
  const lado = (pid, i) => `<div class="eq ${m.ganador === pid && m.estado !== 'pendiente' ? 'gana' : ''}">${esc(nombreP(pid))}</div>
    <div class="sets">${tiene ? m.sets.map((s, k) => `<span class="${s[i] > s[1 - i] ? 'g' : ''}${k === 2 ? ' stb' : ''}">${s[i]}</span>`).join('') : '<span>–</span>'}</div>`;
  return `<div class="marcador">${lado(m.a, 0)}${lado(m.b, 1)}</div>`;
}

function tarjetaPartido(m, conCat = true) {
  const mio = !!miParejaEn(m);
  return `<button class="partido${mio ? ' mio' : ''}" data-act="partido" data-id="${m.id}"><div class="meta"><span>${conCat ? esc(catCorta(m.categoria_id)) + ' · ' : ''}Fecha ${m.fecha}</span>${chipEstado(m)}</div>${marcadorHTML(m)}</button>`;
}

function vPartidos() {
  const org = S.x.esOrg;
  const sub = org || !S.x.miPareja ? 'fixture' : S.sub.partidos;
  let h = `<h1 class="h1">Partidos</h1>`;
  if (!org && S.x.miPareja) h += `<div class="seg" style="margin-top:14px"><button class="${sub === 'mios' ? 'on' : ''}" data-act="sub" data-k="partidos" data-v="mios">Mis partidos</button><button class="${sub === 'fixture' ? 'on' : ''}" data-act="sub" data-k="partidos" data-v="fixture">Fixture</button></div>`;
  if (sub === 'mios') {
    const ids = new Set(S.x.misParejas.map((p) => p.id));
    const ms = S.d.partidos.filter((m) => ids.has(m.a) || ids.has(m.b)).sort((a, b) => a.fecha - b.fecha);
    const prox = ms.filter((m) => m.estado !== 'confirmado'), jug = ms.filter((m) => m.estado === 'confirmado').reverse();
    h += `<div class="sec"><div class="sec-h"><h2 class="h2">Por jugar</h2><span class="chip">${prox.length}</span></div>${prox.length ? `<div class="card lista">${prox.map((m) => tarjetaPartido(m, false)).join('')}</div>` : '<div class="card vacio"><b>Nada pendiente</b>Ya jugaste todo.</div>'}</div>`;
    h += `<div class="sec"><div class="sec-h"><h2 class="h2">Jugados</h2><span class="chip">${jug.length}</span></div>${jug.length ? `<div class="card lista">${jug.map((m) => tarjetaPartido(m, false)).join('')}</div>` : '<div class="card vacio">Todavía no jugaste.</div>'}</div>`;
    return h;
  }
  const cid = S.cat;
  const ms = S.d.partidos.filter((m) => m.categoria_id === cid);
  const fechas = [...new Set(ms.map((m) => m.fecha))].sort((a, b) => a - b);
  if (!S.fecha || !fechas.includes(S.fecha)) {
    const abierta = fechas.find((f) => ms.some((m) => m.fecha === f && m.estado !== 'confirmado'));
    S.fecha = abierta || fechas[fechas.length - 1] || 1;
  }
  h += `<div class="filtros" style="margin-top:14px">${filtrosCat()}</div>`;
  if (!fechas.length) return h + `<div class="card vacio sec"><b>Sin fixture</b>${org ? 'Generalo desde Panel → Fixture.' : 'El organizador todavía no lo armó.'}</div>`;
  h += `<div class="filtros" style="margin-top:6px">${fechas.map((f) => { const n = ms.filter((m) => m.fecha === f); const ok = n.filter((m) => m.estado === 'confirmado').length; return `<button class="${f === S.fecha ? 'on' : ''}" data-act="fecha" data-v="${f}">F${f} <span class="mute" style="font-weight:600">${ok}/${n.length}</span></button>`; }).join('')}</div>`;
  const deFecha = ms.filter((m) => m.fecha === S.fecha);
  const juegan = new Set(deFecha.flatMap((m) => [m.a, m.b]));
  const libres = S.d.parejas.filter((p) => p.categoria_id === cid && p.estado === 'activa' && p.jugador2 && !juegan.has(p.id));
  h += `<div class="sec" style="margin-top:12px"><div class="card lista">${deFecha.map((m) => tarjetaPartido(m, false)).join('')}</div>${libres.length ? `<p class="ayuda">Libre: ${libres.map((p) => esc(nombreP(p.id))).join(', ')}</p>` : ''}</div>`;
  return h;
}

function filtrosCat() {
  return S.d.categorias.map((c) => `<button class="${c.id === S.cat ? 'on' : ''}" data-act="cat" data-v="${c.id}">${esc(c.nivel)}.ª ${c.genero === 'M' ? 'Masc.' : 'Fem.'}</button>`).join('');
}

// ---------------------------------------------------------------------
// TABLA
// ---------------------------------------------------------------------
function tablaHTML(filas, mia) {
  return `<table class="tabla"><thead><tr><th class="pos">#</th><th class="eq">Pareja</th><th class="n">PJ</th><th class="n">PG</th><th class="n">PP</th><th class="n">DS</th><th class="n">DG</th><th class="pts">PTS</th></tr></thead><tbody>
    ${filas.map((r) => `<tr class="${r.id === mia ? 'mia' : ''}${r.pos === 1 ? ' podio1' : ''}" data-act="pareja" data-id="${r.id}"><td class="pos">${r.pos}</td><td class="eq"><b>${esc(nombreP(r.id))}</b>${r.desempate ? `<small>por ${esc(r.desempate)}</small>` : ''}</td><td class="n">${r.pj}</td><td class="n">${r.pg}</td><td class="n">${r.pp}</td><td class="n">${r.ds > 0 ? '+' : ''}${r.ds}</td><td class="n">${r.dg > 0 ? '+' : ''}${r.dg}</td><td class="pts">${r.pts}</td></tr>`).join('')}</tbody></table>`;
}

function vTabla() {
  const cid = S.cat;
  const t = S.x.tabla(cid);
  const mia = S.x.misParejas.find((p) => p.categoria_id === cid);
  const cfg = S.d.config;
  let h = `<h1 class="h1">Tabla</h1><p class="mute small" style="margin-top:6px">${esc(S.x.cat.get(cid) ? S.x.cat.get(cid).nombre : '')} · solo cuentan resultados confirmados</p><div class="filtros" style="margin-top:14px">${filtrosCat()}</div>`;
  h += t.length ? `<div class="card sec" style="margin-top:10px">${tablaHTML(t, mia && mia.id)}</div>` : '<div class="card vacio sec"><b>Sin parejas</b></div>';
  h += `<div class="card pad sec"><h2 class="h2">Cómo se ordena</h2><ol class="small" style="margin:8px 0 0 18px;line-height:1.7">
    <li>Puntos (${cfg.puntos_victoria} por partido ganado${cfg.puntos_derrota ? `, ${cfg.puntos_derrota} por perdido` : ''})</li><li>Diferencia de sets</li><li>Diferencia de games (el súper tie-break suma sus puntos)</li><li>Enfrentamiento directo</li><li>Orden de inscripción</li></ol>
    <p class="ayuda">W.O.: se carga 6-0 6-0 para el que se presentó. Si una pareja se da de baja, lo jugado queda y lo que faltaba es W.O. para el rival.</p></div>`;
  return h;
}

// ---------------------------------------------------------------------
// RANKING
// ---------------------------------------------------------------------
function rankingFiltrado() {
  let lista = S.x.ranking.filter((r) => r.pj > 0);
  const f = S.rk;
  if (f === 'M' || f === 'F') lista = lista.filter((r) => J(r.id).genero === f);
  else if (f !== 'todos') lista = lista.filter((r) => (S.x.catsDe.get(r.id) || new Set()).has(Number(f)));
  return lista.map((r, i) => ({ ...r, puesto: i + 1 }));
}
function catsTxt(jid) { return [...(S.x.catsDe.get(jid) || [])].map(catCorta).join(' · '); }
const rachaHTML = (r) => (r.racha ? `<span class="racha ${r.racha.tipo}">${r.racha.tipo === 'G' ? 'G' : 'P'}${r.racha.n}</span>` : '');

function vRanking() {
  const lista = rankingFiltrado();
  const filtros = [['todos', 'Todos'], ['M', 'Masculino'], ['F', 'Femenino'], ...S.d.categorias.map((c) => [String(c.id), `${c.nivel}.ª ${c.genero}`])];
  let h = `<h1 class="h1">Ranking</h1><p class="mute small" style="margin-top:6px">Puntos LOB por jugador. Si cambiás de pareja, tus puntos te siguen.</p>
    <div class="filtros" style="margin-top:14px">${filtros.map(([k, n]) => `<button class="${S.rk === k ? 'on' : ''}" data-act="rk" data-v="${k}">${esc(n)}</button>`).join('')}</div>`;
  if (!lista.length) return h + '<div class="card vacio sec"><b>Todavía no hay partidos confirmados</b></div>';
  const [a, b, c] = lista;
  const pod = (r, cls) => (r ? `<button class="p ${cls}" data-act="jugador" data-id="${esc(r.id)}"><div class="lugar">${r.puesto}</div><b>${esc(r.nombre)}</b><div class="pts">${r.pts}</div><small>${r.pg}G · ${r.pp}P</small></button>` : '<div></div>');
  h += `<div class="podio sec" style="margin-top:14px">${pod(b, 'dos')}${pod(a, 'uno')}${pod(c, 'tres')}</div>`;
  const yo = S.d.yo;
  h += `<div class="card lista sec" style="margin-top:12px">${lista.slice(3).map((r) => `<button class="rk-row${r.id === yo ? ' yo' : ''}" data-act="jugador" data-id="${esc(r.id)}"><span class="pos">${r.puesto}</span><span style="min-width:0"><b>${esc(r.nombre)}</b><small>${esc(catsTxt(r.id))} · ${r.pj} PJ · ${r.pg} PG</small></span>${rachaHTML(r)}<span class="pts">${r.pts}</span></button>`).join('')}</div>`;
  h += `<div class="sec"><button class="btn ghost block" data-act="puntos">Cómo se suman los puntos</button></div>`;
  return h;
}

// ---------------------------------------------------------------------
// PERFIL
// ---------------------------------------------------------------------
function vPerfil() {
  if (!S.x.yo) return vLogin();
  const yo = S.x.yo, r = S.x.ranking.find((x) => x.id === yo.id);
  let h = `<div class="row"><div class="avatar">${esc(inicial(yo.id))}</div><div class="grow"><h1 class="h1" style="font-size:26px">${esc(nombreJ(yo.id))}</h1><p class="mute small">${S.x.esOrg ? 'Organizador' : esc(catsTxt(yo.id) || 'Sin categoría')}</p></div></div>`;
  if (r && r.pj) {
    const puesto = rankingFiltradoPara(yo.id);
    h += `<div class="hero sec"><p class="kicker">Tu temporada</p><div class="stats" style="margin-top:10px"><div class="stat"><b>${r.pts}</b><span>Puntos</span></div><div class="stat"><b>${puesto}°</b><span>Ranking</span></div><div class="stat"><b>${r.pg}/${r.pj}</b><span>Ganados</span></div><div class="stat"><b>${r.racha ? r.racha.tipo + r.racha.n : '–'}</b><span>Racha</span></div></div>
      <div class="row" style="margin-top:12px;justify-content:space-between"><span class="small" style="color:var(--hero-mute)">Últimos</span><div class="ultimos">${r.ultimos.map((x) => `<i class="${x}">${x}</i>`).join('')}</div></div></div>`;
  }
  if (!S.x.esOrg) {
    h += `<div class="sec"><div class="sec-h"><h2 class="h2">Mis parejas</h2></div>`;
    h += S.x.misParejas.length ? `<div class="card lista">${S.x.misParejas.map((p) => `<button class="partido" data-act="pareja" data-id="${p.id}"><div class="meta"><span>${esc(S.x.cat.get(p.categoria_id).nombre)}</span>${p.jugador2 ? '<span class="chip ok"><span class="dot"></span>Completa</span>' : `<span class="chip warn">Código ${esc(p.codigo || '')}</span>`}</div><b>${esc(nombrePLargo(p.id))}</b></button>`).join('')}</div>` : '';
    h += `<div style="margin-top:10px">${vSumate()}</div></div>`;
  }
  h += `<div class="card pad sec"><h2 class="h2">Mis datos</h2><div class="grid2" style="margin-top:12px"><label class="campo"><span>Nombre</span><input id="pfNombre" value="${esc(yo.nombre)}" autocomplete="given-name"></label><label class="campo"><span>Apellido</span><input id="pfApellido" value="${esc(yo.apellido)}" autocomplete="family-name"></label></div>
    <label class="campo"><span>Celular (WhatsApp)</span><input id="pfTel" type="tel" inputmode="tel" value="${esc(yo.telefono || '')}" placeholder="351 555 1234" autocomplete="tel"></label>
    <p class="ayuda">Lo ven solo tu compañero, tus rivales y el organizador, para coordinar los partidos.</p>
    <button class="btn dark block" style="margin-top:12px" data-act="guardarPerfil">Guardar</button></div>`;
  const tema = leerTema();
  h += `<div class="card pad sec"><h2 class="h2">Apariencia</h2><div class="seg" style="margin-top:12px">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([k, n]) => `<button class="${tema === k ? 'on' : ''}" data-act="tema" data-v="${k}">${n}</button>`).join('')}</div></div>`;
  h += `<div class="sec"><button class="btn ghost block" data-act="puntos">Reglas de la liga y puntos</button></div>`;
  if (S.capa.modo !== 'demo') h += `<div class="sec"><button class="btn ghost block" data-act="salir" style="color:var(--hot)">Cerrar sesión</button></div>`;
  return h;
}
function rankingFiltradoPara(jid) { const i = S.x.ranking.filter((r) => r.pj > 0).findIndex((r) => r.id === jid); return i >= 0 ? i + 1 : '–'; }

function vLogin() {
  const sub = S.sub.login;
  let h = `<h1 class="h1">Entrá a la liga</h1><p class="mute small" style="margin-top:6px">Con tu mail. Sin sesión igual podés ver la tabla y el ranking.</p>
    <div class="seg" style="margin-top:14px"><button class="${sub === 'entrar' ? 'on' : ''}" data-act="sub" data-k="login" data-v="entrar">Entrar</button><button class="${sub === 'crear' ? 'on' : ''}" data-act="sub" data-k="login" data-v="crear">Crear cuenta</button><button class="${sub === 'link' ? 'on' : ''}" data-act="sub" data-k="login" data-v="link">Link al mail</button></div><div class="card pad sec" style="margin-top:12px">`;
  if (sub === 'crear') {
    h += `<div class="grid2"><label class="campo"><span>Nombre</span><input id="lgNombre" autocomplete="given-name"></label><label class="campo"><span>Apellido</span><input id="lgApellido" autocomplete="family-name"></label></div>
      <label class="campo"><span>Celular (WhatsApp)</span><input id="lgTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="351 555 1234"></label>
      <label class="campo"><span>Juego en</span><select id="lgGenero"><option value="M">Masculino</option><option value="F">Femenino</option></select></label>`;
  }
  h += `<label class="campo"><span>Mail</span><input id="lgMail" type="email" inputmode="email" autocomplete="email" placeholder="vos@mail.com"></label>`;
  if (sub !== 'link') h += `<label class="campo"><span>Contraseña</span><input id="lgClave" type="password" autocomplete="${sub === 'crear' ? 'new-password' : 'current-password'}" minlength="6"></label>`;
  h += `<button class="btn volt block" style="margin-top:14px" data-act="login">${sub === 'entrar' ? 'Entrar' : sub === 'crear' ? 'Crear cuenta' : 'Mandame el link'}</button>`;
  if (sub === 'link') h += '<p class="ayuda">Te llega un mail con un link: lo tocás desde el celu y entrás sin contraseña.</p>';
  if (sub === 'crear') h += '<p class="ayuda">Te mandamos un mail para confirmar la cuenta.</p>';
  return h + '</div>';
}

// ---------------------------------------------------------------------
// PANEL (organizador)
// ---------------------------------------------------------------------
function vPanel() {
  const sub = S.sub.panel;
  const subs = [['parejas', 'Parejas'], ['fixture', 'Fixture'], ['ajustes', 'Ajustes'], ['actividad', 'Actividad']];
  let h = `<p class="kicker">Organización</p><h1 class="h1">Panel</h1><div class="seg" style="margin-top:14px">${subs.map(([k, n]) => `<button class="${sub === k ? 'on' : ''}" data-act="sub" data-k="panel" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (sub === 'parejas') h += panelParejas();
  if (sub === 'fixture') h += panelFixture();
  if (sub === 'ajustes') h += panelAjustes();
  if (sub === 'actividad') h += panelActividad();
  return h;
}

function panelParejas() {
  const c = S.x.cat.get(S.cat);
  const ps = S.d.parejas.filter((p) => p.categoria_id === S.cat).sort((a, b) => (a.estado === b.estado ? a.id - b.id : a.estado === 'activa' ? -1 : 1));
  let h = `<div class="filtros" style="margin-top:14px">${filtrosCat()}</div>
    <div class="card pad sec" style="margin-top:10px"><label class="switch"><span><b>Inscripción abierta</b><br><span class="mute small">Los jugadores pueden armar pareja en ${esc(c.nombre)}</span></span><input type="checkbox" data-chg="inscripcion" ${c.inscripcion_abierta ? 'checked' : ''} aria-label="Inscripción abierta"></label></div>
    <div class="sec"><div class="sec-h"><h2 class="h2">${plural(ps.filter((p) => p.estado === 'activa').length, 'pareja', 'parejas')}</h2></div><div class="card lista">`;
  h += ps.map((p) => `<div class="partido"><div class="row"><div class="grow"><b class="small">${esc(nombrePLargo(p.id))}</b><div class="mute small">${p.estado === 'baja' ? 'Dada de baja' : p.jugador2 ? `${esc(J(p.jugador1).telefono || 'sin cel')} · ${esc(J(p.jugador2).telefono || 'sin cel')}` : 'Esperando compañero'}</div></div>
    ${p.estado === 'activa' ? `<button class="btn ghost sm" data-act="orgBaja" data-id="${p.id}" style="${S.armado === 'baja' + p.id ? 'background:var(--hot);color:#fff;border-color:var(--hot)' : ''}">${S.armado === 'baja' + p.id ? '¿Seguro?' : 'Baja'}</button>` : '<span class="chip">Baja</span>'}</div></div>`).join('');
  h += `</div><p class="ayuda">Baja: lo jugado queda y los partidos que faltan pasan a W.O. 6-0 6-0 para el rival.</p></div>`;
  if (S.capa.modo === 'demo') {
    h += `<div class="card pad sec"><h2 class="h2">Agregar pareja</h2><div class="grid2" style="margin-top:12px"><label class="campo"><span>Jugador 1</span><input id="np1" placeholder="Nombre Apellido"></label><label class="campo"><span>Jugador 2</span><input id="np2" placeholder="Nombre Apellido"></label></div>
      <button class="btn dark block" style="margin-top:12px" data-act="orgAgregar">Agregar a ${esc(c.nombre)}</button><p class="ayuda">En la app real cada jugador se registra y arma su pareja con el código.</p></div>`;
  }
  return h;
}

function panelFixture() {
  let h = '<div class="sec stack">';
  for (const c of S.d.categorias) {
    const ps = S.d.parejas.filter((p) => p.categoria_id === c.id && p.estado === 'activa' && p.jugador2);
    const ms = S.d.partidos.filter((m) => m.categoria_id === c.id);
    const conRes = ms.filter((m) => m.estado !== 'pendiente').length;
    const fechas = [...new Set(ms.map((m) => m.fecha))].sort((a, b) => a - b);
    const k = 'fx' + c.id;
    h += `<div class="card pad"><div class="row" style="justify-content:space-between"><h2 class="h2">${esc(c.nombre)}</h2><span class="chip">${ms.filter((m) => m.estado === 'confirmado').length}/${ms.length}</span></div>
      <p class="mute small" style="margin-top:4px">${plural(ps.length, 'pareja completa', 'parejas completas')} · ${plural(fechas.length, 'fecha', 'fechas')}</p>
      ${fechas.length ? `<label class="campo" style="margin-top:10px"><span>Se puede reservar hasta</span><select data-chg="fej" data-id="${c.id}"><option value="">Todas las fechas</option>${fechas.map((f) => `<option value="${f}"${c.fecha_en_juego === f ? ' selected' : ''}>Fecha ${f}</option>`).join('')}</select></label>` : ''}
      <button class="btn ${conRes ? 'ghost' : 'dark'} block" style="margin-top:10px" data-act="orgFixture" data-id="${c.id}"${conRes || ps.length < 2 ? ' disabled' : ''}>${S.armado === k ? '¿Seguro? Se rearma todo' : ms.length ? 'Rearmar fixture' : 'Generar fixture'} (todos contra todos)</button>
      ${conRes ? '<p class="ayuda">Ya hay resultados: el fixture queda fijo. Para corregir, tocá el partido.</p>' : ''}</div>`;
  }
  return h + '</div>';
}

function panelAjustes() {
  const c = S.d.config;
  const campo = (k, n, tipo = 'number') => `<label class="campo"><span>${n}</span><input data-cfg="${k}" type="${tipo}" ${tipo === 'number' ? 'inputmode="numeric"' : ''} value="${esc(c[k])}"></label>`;
  let h = `<div class="card pad sec"><h2 class="h2">Resultados</h2><div style="margin-top:12px">${campo('horas_autoconfirmar', 'Horas para autoconfirmar')}</div><p class="ayuda">Si el rival no confirma ni objeta en ese tiempo, el resultado queda firme.</p></div>
    <div class="card pad sec"><h2 class="h2">Puntos de la tabla</h2><div class="grid2" style="margin-top:12px">${campo('puntos_victoria', 'Por ganar')}${campo('puntos_derrota', 'Por perder')}</div></div>
    <div class="card pad sec"><h2 class="h2">Puntos del ranking</h2><div class="grid2" style="margin-top:12px">${campo('rk_gana_2sets', 'Ganar 2-0')}${campo('rk_gana_stb', 'Ganar en súper TB')}</div><div class="grid2" style="margin-top:12px">${campo('rk_pierde_stb', 'Perder en súper TB')}${campo('rk_pierde_2sets', 'Perder 0-2')}</div><div class="grid2" style="margin-top:12px">${campo('rk_wo_favor', 'W.O. a favor')}${campo('rk_wo_contra', 'No presentarse')}</div></div>
    <div class="card pad sec"><h2 class="h2">Turnos y seña</h2><div class="grid2" style="margin-top:12px">${campo('valor_turno', 'Valor del turno')}${campo('monto_sena', 'Seña')}</div><div class="grid2" style="margin-top:12px">${campo('alias', 'Alias', 'text')}${campo('ventana_dias', 'Días para reservar')}</div><div style="margin-top:12px">${campo('whatsapp_org', 'WhatsApp de la organización', 'tel')}</div><div style="margin-top:12px">${campo('temporada', 'Temporada', 'text')}</div>
    <button class="btn volt block" style="margin-top:14px" data-act="orgConfig">Guardar ajustes</button></div>`;
  h += `<div class="card pad sec"><h2 class="h2">Grilla de turnos</h2><p class="mute small" style="margin-top:4px">Los horarios que los jugadores pueden reservar.</p><div style="margin-top:8px">`;
  for (let d = 0; d < 7; d++) {
    const ts = S.d.turnos.filter((t) => t.dia === d);
    if (!ts.length) continue;
    h += `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b class="small">${DIAS_LARGO[d]}</b><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${ts.map((t) => `<button class="chip" style="height:36px" data-act="orgBorrarTurno" data-id="${t.id}" aria-label="Borrar turno ${DIAS_LARGO[d]} ${t.inicio}">${t.inicio}–${t.fin === '24:00' ? '00:00' : t.fin} · ${t.canchas}c ${S.armado === 'tu' + t.id ? '¿borrar?' : '×'}</button>`).join('')}</div></div>`;
  }
  h += `</div><div class="grid2" style="margin-top:12px"><label class="campo"><span>Día</span><select id="ntDia">${DIAS_LARGO.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label><label class="campo"><span>Canchas</span><input id="ntCanchas" type="number" inputmode="numeric" value="2" min="1"></label></div>
    <div class="grid2" style="margin-top:12px"><label class="campo"><span>Desde</span><input id="ntInicio" type="time" value="18:00"></label><label class="campo"><span>Hasta</span><input id="ntFin" type="time" value="19:30"></label></div>
    <button class="btn dark block" style="margin-top:12px" data-act="orgTurno">Agregar turno</button></div>`;
  return h;
}

const TXT_LOG = {
  resultado_cargado: 'cargó el resultado', wo_cargado: 'cargó un W.O. a favor', resultado_confirmado: 'confirmó el resultado', resultado_autoconfirmado: 'Se autoconfirmó el resultado',
  resultado_disputado: 'objetó el resultado', resultado_fijado_org: 'definió el resultado', resultado_anulado: 'anuló el resultado', turno_reservado: 'reservó turno',
  turno_cancelado: 'canceló el turno', turno_confirmado: 'confirmó la seña', pareja_creada: 'creó una pareja', pareja_completa: 'completó su pareja',
  pareja_baja: 'dio de baja una pareja', fixture_generado: 'generó el fixture', config_cambiada: 'cambió los ajustes',
};
function panelActividad() {
  const items = S.d.actividad.slice(0, 80);
  if (!items.length) return '<div class="card vacio sec"><b>Sin movimientos</b></div>';
  return `<div class="card lista sec">${items.map((a) => {
    const m = a.partido_id ? partido(a.partido_id) : null;
    const quien = a.actor ? (a.actor === 'org' || J(a.actor).rol === 'organizador' ? 'Organización' : nombreJ(a.actor)) : '';
    const que = TXT_LOG[a.tipo] || a.tipo;
    const extra = a.detalle && a.detalle.sets ? ` <b>${esc(a.detalle.sets.map((s) => s.join('-')).join(' '))}</b>` : '';
    return `<div class="log"><time>${esc(cuando(a.at))}</time>${quien ? `<b>${esc(quien)}</b> ` : ''}${esc(que)}${extra}${m ? ` · <span class="mute">${esc(catCorta(m.categoria_id))} F${m.fecha}: ${esc(nombreP(m.a))} vs ${esc(nombreP(m.b))}</span>` : ''}</div>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------------
// Hojas (bottom sheets)
// ---------------------------------------------------------------------
function abrir(tipo, datos = {}) { S.sheet = { tipo, ...datos }; renderSheet(); }
function cerrar() { S.sheet = null; S.ed = null; S.rs = null; renderSheet(); }
function renderSheet() {
  const capa = $('#capa');
  if (!S.sheet || !S.d) { capa.innerHTML = ''; document.body.style.overflow = ''; return; }
  const f = { partido: shPartido, editor: shEditor, reservar: shReservar, pareja: shPareja, jugador: shJugador, wa: shWa, demo: shDemo, puntos: shPuntos }[S.sheet.tipo];
  const [titulo, cuerpo] = f();
  const scroll = capa.querySelector('.sheet') ? capa.querySelector('.sheet').scrollTop : 0;
  capa.innerHTML = `<div class="overlay" data-act="fondo"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="asa"></div><div class="sheet-h"><h2 class="h2">${esc(titulo)}</h2><button class="icon-btn" data-act="cerrar" aria-label="Cerrar">${ico('x')}</button></div>${cuerpo}</div></div>`;
  if (scroll && S.sheet.mantenerScroll) capa.querySelector('.sheet').scrollTop = scroll;
  document.body.style.overflow = 'hidden';
}

function shPartido() {
  const m = partido(S.sheet.id);
  const mi = miParejaEn(m), org = S.x.esOrg, cfg = S.d.config;
  const r = S.x.reservaDe.get(m.id);
  let h = `<p class="kicker">${esc(S.x.cat.get(m.categoria_id).nombre)}</p><div class="card pad" style="margin-top:8px">${marcadorHTML(m)}<div class="row" style="margin-top:12px;justify-content:space-between">${chipEstado(m)}${m.estado === 'por_confirmar' ? `<span class="small mute">Se confirma solo ${falta(m.vence_at)}</span>` : ''}</div></div>`;
  if (r) {
    h += `<div class="card pad" style="margin-top:10px"><div class="row"><div class="grow"><span class="kicker">Turno</span><b style="display:block;margin-top:2px">${esc(DIAS_LARGO[new Date(r.fecha + 'T12:00:00').getDay()])} ${esc(fechaCorta(r.fecha).split(' ')[1])} · ${esc(r.inicio)} a ${esc(r.fin === '24:00' ? '00:00' : r.fin)}</b><span class="small mute">Cancha ${r.cancha} · ${r.estado === 'confirmada' ? 'confirmado' : `seña de ${pesos(cfg.monto_sena)} pendiente`}</span></div>${r.estado === 'confirmada' ? '<span class="chip volt">OK</span>' : '<span class="chip warn">Seña</span>'}</div>
      ${r.estado === 'pendiente' && mi ? `<p class="ayuda">Transferí al alias <b>${esc(cfg.alias)}</b> y mandá el comprobante. Saldo (${pesos(cfg.valor_turno - cfg.monto_sena)}) al terminar el partido.</p>` : ''}
      ${org && r.estado === 'pendiente' ? `<div class="btns" style="margin-top:10px"><button class="btn ok sm" data-act="orgSena" data-id="${r.id}">Seña recibida</button><button class="btn ghost sm" data-act="orgCancelaTurno" data-id="${r.id}">${S.armado === 'ct' + r.id ? '¿Seguro?' : 'Cancelar turno'}</button></div>` : ''}
      ${org && r.estado === 'confirmada' ? `<div class="btns one" style="margin-top:10px"><button class="btn ghost sm" data-act="orgCancelaTurno" data-id="${r.id}">${S.armado === 'ct' + r.id ? '¿Seguro?' : 'Cancelar turno'}</button></div>` : ''}
      ${!org && mi && r.estado === 'pendiente' && m.estado === 'pendiente' ? `<div class="btns one" style="margin-top:10px"><button class="btn ghost sm" data-act="cancelarTurno" data-id="${r.id}">${S.armado === 'ct' + r.id ? '¿Seguro? Tocá de nuevo' : 'Cancelar turno'}</button></div>` : ''}</div>`;
  }
  // Línea de tiempo
  const li = [];
  if (m.cargado_at) li.push(`<li class="volt">${m.cargado_por ? esc(nombreJ(m.cargado_por)) : 'Alguien'} cargó ${esc(setsTxt(m, m.a))} · ${esc(cuando(m.cargado_at))}</li>`);
  if (m.disputa_at) li.push(`<li class="hot">${esc(nombreJ(m.disputa_por))} dijo que no es así${m.disputa_motivo ? `: “${esc(m.disputa_motivo)}”` : ''} · ${esc(cuando(m.disputa_at))}</li>`);
  if (m.estado === 'confirmado' && m.confirmado_at) li.push(`<li class="ok">${m.confirmado_via === 'auto' ? `Se autoconfirmó (${cfg.horas_autoconfirmar} h sin respuesta)` : m.confirmado_via === 'organizador' ? 'Lo definió la organización' : `${esc(nombreJ(m.confirmado_por))} lo confirmó`} · ${esc(cuando(m.confirmado_at))}</li>`);
  if (li.length) h += `<div style="margin-top:14px"><span class="kicker">Historial</span><ul class="linea" style="margin-top:8px">${li.join('')}</ul></div>`;
  // Acciones
  const acc = [];
  if (mi && !org) {
    if (m.estado === 'pendiente') {
      acc.push(`<button class="btn volt" data-act="cargar" data-id="${m.id}">Cargar resultado</button>`);
      if (!r) acc.push(`<button class="btn dark" data-act="reservar" data-id="${m.id}">Reservar turno</button>`);
      if (S.capa.demo) acc.push(`<button class="btn ghost" data-act="simCarga" data-id="${m.id}">Demo: el rival carga</button>`);
    }
    if (m.estado === 'por_confirmar' && m.cargado_pareja !== mi) acc.push(`<button class="btn volt" data-act="confirmar" data-id="${m.id}">Confirmar resultado</button>`, `<button class="btn ghost" data-act="disputar" data-id="${m.id}" style="color:var(--hot)">No es así</button>`);
    if (m.estado === 'por_confirmar' && m.cargado_pareja === mi) {
      acc.push(`<button class="btn ghost" data-act="cargar" data-id="${m.id}">Corregir lo que cargué</button>`);
      if (S.capa.demo) acc.push(`<button class="btn dark" data-act="simConfirma" data-id="${m.id}">Demo: rival confirma</button>`, `<button class="btn ghost" data-act="simRechaza" data-id="${m.id}">Demo: rival rechaza</button>`);
    }
    if (m.estado !== 'confirmado') acc.push(`<button class="btn ghost" data-act="wa" data-id="${m.id}">${ico('wa')}Escribirle al rival</button>`);
  }
  if (org) {
    if (m.estado === 'en_disputa') h += `<div style="margin-top:14px">${tarjetaDisputa(m)}</div>`;
    else acc.push(`<button class="btn dark" data-act="orgEditar" data-id="${m.id}">${m.estado === 'pendiente' ? 'Cargar resultado' : 'Editar resultado'}</button>`);
    if (m.estado !== 'pendiente') acc.push(`<button class="btn ghost" data-act="orgAnular" data-id="${m.id}" style="color:var(--hot)">${S.armado === 'an' + m.id ? '¿Seguro? Vuelve a pendiente' : 'Anular resultado'}</button>`);
    acc.push(`<button class="btn ghost" data-act="wa" data-id="${m.id}">${ico('wa')}Contactos</button>`);
  }
  if (!mi && !org) acc.push(`<button class="btn ghost" data-act="pareja" data-id="${m.a}">Ver ${esc(nombreP(m.a))}</button>`, `<button class="btn ghost" data-act="pareja" data-id="${m.b}">Ver ${esc(nombreP(m.b))}</button>`);
  if (acc.length) h += `<div class="stack" style="margin-top:16px">${acc.map((a) => a.replace('class="btn ', 'class="btn block ')).join('')}</div>`;
  return [`Fecha ${m.fecha}`, h];
}

// Editor de resultado. modo: 'jugador' (desde mi lado), 'disputa' (desde mi lado, opcional), 'org' (A/B)
function nuevoEditor(id, modo) {
  const m = partido(id);
  const desde = modo === 'org' ? m.a : miParejaEn(m);
  let sets = [[0, 0], [0, 0], [0, 0]];
  if (modo === 'org' && m.sets.length) sets = [...m.sets.map((s) => [...s]), [0, 0], [0, 0]].slice(0, 3);
  else if (modo === 'jugador' && m.estado === 'por_confirmar' && m.cargado_pareja === desde) sets = [...setsDesde(m.sets, m, desde), [0, 0], [0, 0]].slice(0, 3);
  S.ed = { id: m.id, modo, desde, sets, wo: false, ganadorWo: null, motivo: '', proponer: false };
}
const setsDesde = (sets, m, desde) => (desde === m.b ? sets.map(([a, b]) => [b, a]) : sets.map((s) => [...s]));
function setsParaGuardar(ed) {
  const m = partido(ed.id);
  const v = validarEd(ed);
  return v.ok ? setsDesde(v.sets, m, ed.desde) : null;
}
function validarEd(ed) {
  const s = ed.sets;
  const g1 = s[0][0] > s[0][1] ? 'a' : 'b', g2 = s[1][0] > s[1][1] ? 'a' : 'b';
  const usar = g1 !== g2 ? s : s.slice(0, 2);
  return validarSets(usar);
}

function shEditor() {
  const ed = S.ed, m = partido(ed.id);
  const otro = rivalDe(m, ed.desde);
  const yoCol = ed.modo === 'org' ? nombreP(m.a) : 'Nosotros', elCol = ed.modo === 'org' ? nombreP(m.b) : 'Ellos';
  const v = validarEd(ed);
  const s = ed.sets;
  const split = (s[0][0] > s[0][1]) !== (s[1][0] > s[1][1]) && s[0][0] !== s[0][1] && s[1][0] !== s[1][1];
  const fila = (i, lbl, sub) => `<div class="lbl">${lbl}${sub ? `<small>${sub}</small>` : ''}</div>${[0, 1].map((j) => `<div class="step"><button data-act="st" data-i="${i}" data-j="${j}" data-d="-1" aria-label="Restar">−</button><output aria-live="polite">${s[i][j]}</output><button data-act="st" data-i="${i}" data-j="${j}" data-d="1" aria-label="Sumar">+</button></div>`).join('')}`;
  let h = '';
  const titulo = ed.modo === 'disputa' ? 'No es así' : ed.modo === 'org' ? 'Resultado (organización)' : 'Cargar resultado';
  if (ed.modo === 'disputa') {
    h += `<p class="small">${esc(nombreP(m.cargado_pareja))} cargó <b>${esc(setsTxt(m, ed.desde))}</b> (desde tu lado). Contanos qué pasó: lo revisa el organizador.</p>
      <label class="campo" style="margin-top:12px"><span>¿Qué está mal?</span><textarea id="motivo" maxlength="300" placeholder="Ej: el súper tie-break fue 11-9 para nosotros">${esc(ed.motivo)}</textarea></label>
      <label class="switch"><span><b>Cargar el resultado correcto</b></span><input type="checkbox" data-chg="proponer" ${ed.proponer ? 'checked' : ''}></label>`;
  } else {
    h += `<p class="small mute">${esc(nombreP(ed.modo === 'org' ? m.a : ed.desde))} vs ${esc(nombreP(otro))} · Fecha ${m.fecha}</p>`;
    h += `<label class="switch" style="margin-top:6px"><span><b>${ed.modo === 'org' ? 'Fue W.O.' : 'El rival no se presentó (W.O.)'}</b><br><span class="small mute">Se carga 6-0 6-0</span></span><input type="checkbox" data-chg="wo" ${ed.wo ? 'checked' : ''}></label>`;
  }
  const verEditor = ed.modo === 'disputa' ? ed.proponer : !ed.wo;
  if (verEditor) {
    h += `<div class="score" style="margin-top:10px"><div></div><div class="hd">${esc(yoCol)}</div><div class="hd">${esc(elCol)}</div>${fila(0, 'Set 1')}${fila(1, 'Set 2')}${split ? fila(2, 'Súper TB', 'a 11') : ''}</div>`;
    const gana = v.ok ? (v.ganador === 'a' ? yoCol : elCol) : '';
    h += `<div class="veredicto ${v.ok ? 'ok' : 'mal'}">${v.ok ? (ed.modo === 'org' ? `Gana ${esc(gana)}` : v.ganador === 'a' ? '¡Ganaron ustedes!' : 'Ganaron ellos') + ` · ${v.sets.map((x) => x.join('-')).join(' ')}` : esc(v.error)}</div>`;
  } else if (ed.modo === 'org' && ed.wo) {
    h += `<div class="seg" style="margin-top:10px"><button class="${ed.ganadorWo === m.a ? 'on' : ''}" data-act="woGana" data-v="${m.a}">Gana ${esc(nombreP(m.a))}</button><button class="${ed.ganadorWo === m.b ? 'on' : ''}" data-act="woGana" data-v="${m.b}">Gana ${esc(nombreP(m.b))}</button></div>`;
  }
  let listo = ed.modo === 'disputa' ? (!ed.proponer || v.ok) : ed.wo ? (ed.modo !== 'org' || !!ed.ganadorWo) : v.ok;
  const txtBtn = ed.modo === 'disputa' ? 'Mandar al organizador' : ed.modo === 'org' ? 'Guardar resultado' : 'Cargar y avisar al rival';
  h += `<button class="btn ${ed.modo === 'disputa' ? 'hot' : 'volt'} block" style="margin-top:14px" data-act="guardarEd"${listo ? '' : ' disabled'}>${txtBtn}</button>`;
  if (ed.modo === 'jugador') h += `<p class="ayuda">Tu rival lo tiene que confirmar. Si no contesta en ${S.d.config.horas_autoconfirmar} h, queda confirmado solo.</p>`;
  return [titulo, h];
}

function shReservar() {
  const m = partido(S.sheet.id);
  const cfg = S.d.config;
  const dias = [];
  for (let i = 0; i <= cfg.ventana_dias; i++) {
    const t = Date.now() + i * DIA;
    const iso = fechaISO(t);
    const dow = new Date(iso + 'T12:00:00').getDay();
    if (S.d.turnos.some((x) => x.dia === dow)) dias.push(iso);
  }
  if (!S.rs || S.rs.id !== m.id) S.rs = { id: m.id, dia: dias[0], inicio: null };
  const dow = new Date(S.rs.dia + 'T12:00:00').getDay();
  const slots = S.d.turnos.filter((t) => t.dia === dow).map((t) => {
    const ocupadas = S.d.reservas.filter((r) => r.estado !== 'cancelada' && r.fecha === S.rs.dia && r.inicio === t.inicio).length;
    const paso = new Date(`${S.rs.dia}T${t.inicio}:00`).getTime() <= Date.now();
    return { ...t, libres: Math.max(0, t.canchas - ocupadas), paso };
  });
  let h = `<p class="small mute">Fecha ${m.fecha} · ${esc(nombreP(m.a))} vs ${esc(nombreP(m.b))}</p><p class="kicker" style="margin-top:14px">Día</p>
    <div class="dias" style="margin-top:6px">${dias.map((d) => { const x = new Date(d + 'T12:00:00'); return `<button class="${d === S.rs.dia ? 'on' : ''}" data-act="rsDia" data-v="${d}"><small>${DIAS[x.getDay()]}</small><b>${x.getDate()}</b></button>`; }).join('')}</div>
    <p class="kicker" style="margin-top:12px">Horario</p><div class="slots">${slots.map((t) => `<button class="slot${S.rs.inicio === t.inicio ? ' on' : ''}" data-act="rsHora" data-v="${t.inicio}"${!t.libres || t.paso ? ' disabled' : ''}><b>${t.inicio}</b><small>${t.paso ? 'ya pasó' : t.libres ? plural(t.libres, 'cancha libre', 'canchas libres') : 'lleno'}</small></button>`).join('') || '<p class="mute small">Ese día no hay turnos de liga.</p>'}</div>
    <div class="card pad" style="margin-top:14px"><div class="row">${ico('pesos').replace('<svg', '<svg width="22" height="22"')}<div class="grow small">Turno ${pesos(cfg.valor_turno)}. Para reservar: seña de <b>${pesos(cfg.monto_sena)}</b> al alias <b>${esc(cfg.alias)}</b>. Queda pendiente hasta que la organización vea el comprobante.</div></div></div>
    <button class="btn volt block" style="margin-top:14px" data-act="rsOk"${S.rs.inicio ? '' : ' disabled'}>Reservar${S.rs.inicio ? ` ${esc(fechaCorta(S.rs.dia))} ${esc(S.rs.inicio)}` : ''}</button>`;
  return ['Reservar turno', h];
}

function shPareja() {
  const pid = Number(S.sheet.id);
  const p = S.x.par.get(pid);
  const t = S.x.tabla(p.categoria_id).find((r) => r.id === pid);
  const ms = S.d.partidos.filter((m) => (m.a === pid || m.b === pid)).sort((a, b) => a.fecha - b.fecha);
  let h = `<p class="kicker">${esc(S.x.cat.get(p.categoria_id).nombre)}${p.estado === 'baja' ? ' · dada de baja' : ''}</p><div class="stack" style="margin-top:8px">${[p.jugador1, p.jugador2].filter(Boolean).map((j) => `<button class="card pad row" data-act="jugador" data-id="${esc(j)}" style="width:100%;text-align:left"><div class="avatar" style="width:44px;height:44px;font-size:17px">${esc(inicial(j))}</div><div class="grow"><b>${esc(nombreJ(j))}</b><div class="small mute">Ver perfil</div></div></button>`).join('')}</div>`;
  if (t) h += `<div class="stats" style="margin-top:12px"><div class="stat"><b>${t.pos}°</b><span>Puesto</span></div><div class="stat"><b>${t.pts}</b><span>Puntos</span></div><div class="stat"><b>${t.pg}-${t.pp}</b><span>G-P</span></div><div class="stat"><b>${t.ds > 0 ? '+' : ''}${t.ds}</b><span>Dif. sets</span></div></div>`;
  h += `<div class="card lista" style="margin-top:12px">${ms.map((m) => tarjetaPartido(m, false)).join('')}</div>`;
  return [nombreP(pid), h];
}

function shJugador() {
  const jid = S.sheet.id;
  const r = S.x.ranking.find((x) => x.id === jid);
  const ps = S.d.parejas.filter((p) => p.jugador1 === jid || p.jugador2 === jid);
  const ids = new Set(ps.map((p) => p.id));
  const cfg = S.d.config;
  const ms = S.d.partidos.filter((m) => m.estado === 'confirmado' && (ids.has(m.a) || ids.has(m.b))).sort((a, b) => b.fecha - a.fecha);
  let h = `<div class="row"><div class="avatar">${esc(inicial(jid))}</div><div class="grow"><b style="font-size:18px">${esc(nombreJ(jid))}</b><div class="small mute">${esc(catsTxt(jid))}</div></div></div>`;
  if (r) {
    const pct = r.pj ? Math.round((r.pg / r.pj) * 100) : 0;
    h += `<div class="stats" style="margin-top:14px"><div class="stat"><b>${r.pts}</b><span>Puntos</span></div><div class="stat"><b>${rankingFiltradoPara(jid)}°</b><span>Ranking</span></div><div class="stat"><b>${r.pj}</b><span>Jugados</span></div><div class="stat"><b>${pct}%</b><span>Ganados</span></div>
      <div class="stat"><b>${r.sf}-${r.sc}</b><span>Sets</span></div><div class="stat"><b>${r.dg > 0 ? '+' : ''}${r.dg}</b><span>Dif. games</span></div><div class="stat"><b>${r.racha ? r.racha.tipo + r.racha.n : '–'}</b><span>Racha</span></div><div class="stat"><b>${r.pg}-${r.pp}</b><span>G-P</span></div></div>
      ${r.ultimos.length ? `<div class="row" style="margin-top:12px;justify-content:space-between"><span class="kicker">Últimos partidos</span><div class="ultimos">${r.ultimos.map((x) => `<i class="${x}">${x}</i>`).join('')}</div></div>` : ''}`;
  }
  if (ms.length) {
    h += `<div class="card lista" style="margin-top:12px">${ms.map((m) => {
      const lado = ids.has(m.a) ? 'a' : 'b';
      const mi = m[lado];
      const gano = m.ganador === mi;
      const pts = m.wo ? (gano ? cfg.rk_wo_favor : cfg.rk_wo_contra) : gano ? (m.sets.length > 2 ? cfg.rk_gana_stb : cfg.rk_gana_2sets) : (m.sets.length > 2 ? cfg.rk_pierde_stb : cfg.rk_pierde_2sets);
      return `<button class="rk-row" data-act="partido" data-id="${m.id}" style="grid-template-columns:34px minmax(0,1fr) auto"><span class="racha ${gano ? 'G' : 'P'}">${gano ? 'G' : 'P'}</span><span style="min-width:0"><b>vs ${esc(nombreP(rivalDe(m, mi)))}</b><small>F${m.fecha} · ${esc(setsTxt(m, mi))}</small></span><span class="pts" style="font-size:15px">${pts > 0 ? '+' : ''}${pts}</span></button>`;
    }).join('')}</div>`;
  }
  const yo = S.d.yo;
  const tel = J(jid).telefono;
  if (tel && jid !== yo && S.x.yo) h += `<a class="btn ghost block" style="margin-top:12px" href="${esc(linkWhatsApp(tel))}" target="_blank" rel="noopener">${ico('wa')}WhatsApp</a>`;
  return ['Jugador', h];
}

function shWa() {
  const m = partido(S.sheet.id);
  const mi = miParejaEn(m);
  const cat = S.x.cat.get(m.categoria_id);
  const lados = S.x.esOrg ? [m.a, m.b] : [rivalDe(m, mi)];
  const txt = S.x.esOrg ? `Hola! Te escribo de la ${MARCA} por la fecha ${m.fecha} (${cat.nombre}).` : `Hola! Somos ${nombreP(mi)} de la ${MARCA} (${cat.nombre}). Nos toca la fecha ${m.fecha}. ¿Qué día y horario les queda bien?`;
  let h = `<p class="small mute">Se abre WhatsApp con un mensaje listo para mandar.</p><div class="stack" style="margin-top:12px">`;
  for (const pid of lados) {
    const p = S.x.par.get(pid);
    for (const j of [p.jugador1, p.jugador2].filter(Boolean)) {
      const tel = J(j).telefono;
      h += tel ? `<a class="btn ghost block" href="${esc(linkWhatsApp(tel, txt))}" target="_blank" rel="noopener" style="justify-content:space-between"><span>${esc(nombreJ(j))}</span>${ico('wa')}</a>` : `<div class="card pad small mute">${esc(nombreJ(j))}: sin celular cargado</div>`;
    }
  }
  return ['Contactos', h + '</div>'];
}

function shDemo() {
  return ['Demo', `<p class="small">Esto es una demo con datos inventados: lo que hagas queda solo en este celu.</p>
    <div class="stack" style="margin-top:14px">
    <button class="btn dark block" data-act="demoReloj">Adelantar el reloj ${S.d.config.horas_autoconfirmar} h</button>
    <p class="ayuda" style="margin-top:4px">Los resultados que nadie confirmó se confirman solos, como en la app real.</p>
    <button class="btn ghost block" data-act="demoVer" data-v="${esc(S.capa.demo && 'yo')}">Volver a ver como jugador</button>
    <button class="btn ghost block" data-act="demoVer" data-v="org">Ver como organizador</button>
    <button class="btn ghost block" data-act="demoReset" style="color:var(--hot)">${S.armado === 'reset' ? '¿Seguro? Tocá de nuevo' : 'Reiniciar la demo'}</button></div>`];
}

function shPuntos() {
  const c = S.d.config;
  return ['Cómo funciona', `<h3 class="h2" style="font-size:16px">Ranking (puntos LOB, por jugador)</h3><ul class="lineas-explica" style="margin-top:6px">
    <li><span>Ganar 2 sets a 0</span><b>${c.rk_gana_2sets}</b></li><li><span>Ganar en súper tie-break</span><b>${c.rk_gana_stb}</b></li><li><span>Perder en súper tie-break</span><b>${c.rk_pierde_stb}</b></li>
    <li><span>Perder 0 a 2</span><b>${c.rk_pierde_2sets}</b></li><li><span>W.O. a favor</span><b>${c.rk_wo_favor}</b></li><li><span>No presentarse</span><b>${c.rk_wo_contra}</b></li></ul>
    <p class="ayuda">Perder peleado suma: premia competir. Desempate: partidos ganados, dif. de sets, dif. de games.</p>
    <h3 class="h2" style="font-size:16px;margin-top:18px">Resultados</h3><ul class="lineas-explica" style="margin-top:6px">
    <li><span>Sets 1 y 2</span><b>a 6 (7-5, 7-6)</b></li><li><span>Tercer set</span><b>súper tie-break a 11</b></li><li><span>Lo carga</span><b>cualquiera de los 4</b></li><li><span>Lo confirma</span><b>la pareja rival</b></li><li><span>Sin respuesta</span><b>se confirma a las ${c.horas_autoconfirmar} h</b></li><li><span>"No es así"</span><b>decide la organización</b></li></ul>
    <h3 class="h2" style="font-size:16px;margin-top:18px">Tabla por categoría</h3><p class="small" style="margin-top:6px">${c.puntos_victoria} punto por partido ganado. Desempates: dif. de sets, dif. de games, enfrentamiento directo.</p>`];
}

// ---------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------
function armar(clave) { if (S.armado === clave) { S.armado = null; return true; } S.armado = clave; render(); return false; }

const ACC = {
  reintentar: () => recargar(),
  tab: (el) => { S.tab = el.dataset.v; S.armado = null; render(); window.scrollTo(0, 0); },
  sub: (el) => { S.sub[el.dataset.k] = el.dataset.v; S.armado = null; render(); },
  cat: (el) => { S.cat = Number(el.dataset.v); S.fecha = null; render(); },
  fecha: (el) => { S.fecha = Number(el.dataset.v); render(); },
  rk: (el) => { S.rk = el.dataset.v; render(); },
  irTabla: (el) => { S.cat = Number(el.dataset.v); S.tab = 'tabla'; render(); window.scrollTo(0, 0); },
  partido: (el) => abrir('partido', { id: Number(el.dataset.id) }),
  pareja: (el) => abrir('pareja', { id: Number(el.dataset.id) }),
  jugador: (el) => abrir('jugador', { id: el.dataset.id }),
  wa: (el) => abrir('wa', { id: Number(el.dataset.id) }),
  puntos: () => abrir('puntos'),
  menuDemo: () => abrir('demo'),
  cerrar: () => cerrar(),
  fondo: (el, ev) => { if (ev.target === el) cerrar(); },
  cargar: (el) => { nuevoEditor(el.dataset.id, 'jugador'); abrir('editor', { id: Number(el.dataset.id) }); },
  disputar: (el) => { nuevoEditor(el.dataset.id, 'disputa'); abrir('editor', { id: Number(el.dataset.id) }); },
  orgEditar: (el) => { nuevoEditor(el.dataset.id, 'org'); abrir('editor', { id: Number(el.dataset.id) }); },
  st: (el) => {
    const i = +el.dataset.i, j = +el.dataset.j, d = +el.dataset.d, max = i === 2 ? 30 : 7;
    S.ed.sets[i][j] = Math.min(max, Math.max(0, S.ed.sets[i][j] + d));
    S.sheet.mantenerScroll = true; renderSheet();
  },
  woGana: (el) => { S.ed.ganadorWo = Number(el.dataset.v); S.sheet.mantenerScroll = true; renderSheet(); },
  guardarEd: async () => {
    const ed = S.ed;
    const m = partido(ed.id);
    if (ed.modo === 'disputa') {
      const motivo = ($('#motivo') || {}).value || '';
      const sets = ed.proponer ? setsParaGuardar(ed) : null;
      const r = await hacer(() => S.capa.disputarResultado(ed.id, motivo, sets), 'Listo: lo revisa el organizador.');
      if (r !== undefined) cerrar();
      return;
    }
    if (ed.modo === 'org') {
      const r = await hacer(() => S.capa.org.fijarResultado(ed.id, ed.wo ? null : setsParaGuardar(ed), ed.wo, ed.ganadorWo), 'Resultado guardado.');
      if (r !== undefined) cerrar();
      return;
    }
    const r = await hacer(() => S.capa.cargarResultado(ed.id, ed.wo ? null : setsParaGuardar(ed), ed.wo), `Cargado. Le avisamos a ${nombreP(rivalDe(m, ed.desde))} para que confirme.`);
    if (r !== undefined) cerrar();
  },
  confirmar: async (el) => { const r = await hacer(() => S.capa.confirmarResultado(Number(el.dataset.id)), '¡Confirmado! Ya cuenta para la tabla y el ranking.'); if (r !== undefined) cerrar(); },
  reservar: (el) => { S.rs = null; abrir('reservar', { id: Number(el.dataset.id) }); },
  rsDia: (el) => { S.rs.dia = el.dataset.v; S.rs.inicio = null; S.sheet.mantenerScroll = true; renderSheet(); },
  rsHora: (el) => { S.rs.inicio = el.dataset.v; S.sheet.mantenerScroll = true; renderSheet(); },
  rsOk: async () => { const r = await hacer(() => S.capa.reservarTurno(S.rs.id, S.rs.dia, S.rs.inicio), 'Turno reservado. Falta la seña.'); if (r !== undefined) { const id = S.rs.id; cerrar(); abrir('partido', { id }); } },
  cancelarTurno: async (el) => { if (!armar('ct' + el.dataset.id)) return renderSheet(); await hacer(() => S.capa.cancelarReserva(Number(el.dataset.id)), 'Turno cancelado.'); },
  crearPareja: async () => { const c = Number($('#catNueva').value); await hacer(() => S.capa.crearPareja(c), (cod) => `Pareja creada. Pasale el código ${cod} a tu compañero.`); },
  unirme: async () => { const c = $('#codigo').value; await hacer(() => S.capa.unirmeAPareja(c), '¡Listo! Ya están inscriptos.'); },
  guardarPerfil: async () => { await hacer(() => S.capa.actualizarPerfil({ nombre: $('#pfNombre').value.trim(), apellido: $('#pfApellido').value.trim(), telefono: $('#pfTel').value.trim() }), 'Datos guardados.'); },
  tema: (el) => { guardarTema(el.dataset.v); render(); },
  salir: async () => { await S.capa.salir(); await recargar(); },
  login: async () => {
    const sub = S.sub.login, mail = $('#lgMail').value.trim(), clave = $('#lgClave') ? $('#lgClave').value : '';
    if (!mail) return toast('Escribí tu mail.', true);
    if (sub === 'entrar') await hacer(() => S.capa.entrar(mail, clave), '¡Bienvenido!');
    else if (sub === 'link') await hacer(() => S.capa.linkMagico(mail), 'Te mandamos el link. Revisá tu mail.');
    else await hacer(() => S.capa.registrarse({ email: mail, clave, nombre: $('#lgNombre').value.trim(), apellido: $('#lgApellido').value.trim(), telefono: $('#lgTel').value.trim(), genero: $('#lgGenero').value }), 'Cuenta creada. Confirmá desde tu mail.');
  },
  // demo
  simConfirma: async (el) => { await hacer(async () => S.capa.demo.simularRival(Number(el.dataset.id), 'confirmar'), 'El rival confirmó. Mirá la tabla y el ranking.'); if (S.sheet) renderSheet(); },
  simRechaza: async (el) => { await hacer(async () => S.capa.demo.simularRival(Number(el.dataset.id), 'disputar'), 'El rival dijo que no es así: pasa al organizador.'); if (S.sheet) renderSheet(); },
  simCarga: async (el) => { await hacer(async () => S.capa.demo.rivalCarga(Number(el.dataset.id)), 'Tu rival cargó el resultado: confirmalo.'); cerrar(); },
  demoReloj: async () => { const n = await hacer(async () => S.capa.demo.adelantarHoras(S.d.config.horas_autoconfirmar), (n) => (n ? `Se autoconfirmaron ${plural(n, 'resultado', 'resultados')}.` : 'No había resultados esperando.')); if (n !== undefined) cerrar(); },
  demoVer: async (el) => { const v = el.dataset.v === 'org' ? 'org' : 'j17'; await hacer(async () => S.capa.demo.verComo(v)); S.tab = 'inicio'; cerrar(); render(); },
  demoReset: async () => { if (!armar('reset')) return renderSheet(); await hacer(async () => S.capa.demo.reiniciar(), 'Demo reiniciada.'); S.tab = 'inicio'; cerrar(); },
  // organizador
  orgVale: async (el) => {
    const m = partido(el.dataset.id);
    const sets = el.dataset.v === 'rival' ? m.disputa_sets : m.sets;
    const r = await hacer(() => S.capa.org.fijarResultado(m.id, m.wo && el.dataset.v !== 'rival' ? null : sets, m.wo && el.dataset.v !== 'rival', m.ganador), 'Disputa resuelta.');
    if (r !== undefined && S.sheet) cerrar();
  },
  orgAnular: async (el) => { if (!armar('an' + el.dataset.id)) return renderSheet(); await hacer(() => S.capa.org.anularResultado(Number(el.dataset.id)), 'Resultado anulado.'); },
  orgSena: async (el) => { await hacer(() => S.capa.org.confirmarReserva(Number(el.dataset.id)), 'Turno confirmado.'); },
  orgCancelaTurno: async (el) => { if (!armar('ct' + el.dataset.id)) return renderSheet(); await hacer(() => S.capa.cancelarReserva(Number(el.dataset.id)), 'Turno cancelado.'); },
  orgBaja: async (el) => { if (!armar('baja' + el.dataset.id)) return; await hacer(() => S.capa.org.bajaPareja(Number(el.dataset.id)), (n) => `Pareja dada de baja. ${plural(n, 'partido pasó', 'partidos pasaron')} a W.O.`); },
  orgFixture: async (el) => { if (!armar('fx' + el.dataset.id)) return; await hacer(() => S.capa.org.generarFixture(Number(el.dataset.id)), (n) => `Fixture listo: ${n} partidos.`); },
  orgAgregar: async () => { await hacer(() => S.capa.org.agregarPareja(S.cat, $('#np1').value, $('#np2').value), 'Pareja agregada.'); },
  orgConfig: async () => {
    const c = {};
    document.querySelectorAll('[data-cfg]').forEach((i) => { c[i.dataset.cfg] = i.type === 'number' ? Number(i.value) : i.value.trim(); });
    await hacer(() => S.capa.org.guardarConfig(c), 'Ajustes guardados.');
  },
  orgTurno: async () => { await hacer(() => S.capa.org.guardarTurno({ dia: $('#ntDia').value, inicio: $('#ntInicio').value, fin: $('#ntFin').value, canchas: $('#ntCanchas').value }), 'Turno agregado.'); },
  orgBorrarTurno: async (el) => { if (!armar('tu' + el.dataset.id)) return; await hacer(() => S.capa.org.guardarTurno({ id: Number(el.dataset.id), borrar: true }), 'Turno borrado.'); },
};

const CHG = {
  verComo: async (el) => { await hacer(async () => S.capa.demo.verComo(el.value)); S.tab = 'inicio'; render(); window.scrollTo(0, 0); },
  wo: (el) => { S.ed.wo = el.checked; renderSheet(); },
  proponer: (el) => { S.ed.motivo = ($('#motivo') || {}).value || ''; S.ed.proponer = el.checked; S.sheet.mantenerScroll = true; renderSheet(); },
  inscripcion: (el) => hacer(() => S.capa.org.cambiarInscripcion(S.cat, el.checked), el.checked ? 'Inscripción abierta.' : 'Inscripción cerrada.'),
  fej: (el) => hacer(() => S.capa.org.cambiarFechaEnJuego(Number(el.dataset.id), el.value), 'Guardado.'),
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const f = ACC[el.dataset.act];
  if (!f) return;
  if (el.tagName === 'A' && el.getAttribute('href') === '#') ev.preventDefault();
  if (el.dataset.act !== 'fondo' || ev.target === el) ev.preventDefault();
  f(el, ev);
});
document.addEventListener('change', (ev) => { const el = ev.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el); });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && S.sheet) cerrar(); });

// ---------------------------------------------------------------------
// Tema claro/oscuro
// ---------------------------------------------------------------------
function leerTema() { try { return localStorage.getItem('lobcup-tema') || 'auto'; } catch (e) { return 'auto'; } }
function guardarTema(t) { try { localStorage.setItem('lobcup-tema', t); } catch (e) { /* sin storage */ } aplicarTema(t); }
function aplicarTema(t) { if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

// ---------------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------------
async function iniciar() {
  aplicarTema(leerTema());
  document.title = MARCA;
  render();
  try {
    S.capa = await crearCapaDatos(CFG);
    if (S.capa.onSesion) S.capa.onSesion(() => recargar());
  } catch (e) {
    S.cargando = false; S.errorCarga = 'No se pudo conectar: ' + e.message; render(); return;
  }
  await recargar();
}
window.LOB = { S, recargar, render, cerrar };
iniciar();
