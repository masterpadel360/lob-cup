// =====================================================================
// Modo DEMO: la liga entera vive en memoria (y en localStorage si se puede).
// Hace las mismas validaciones que las funciones de supabase/schema.sql,
// así lo que se ve en la demo es lo que va a pasar con la base real.
// Todos los nombres y teléfonos son INVENTADOS.
// =====================================================================
import { CONFIG_BASE, validarSets, SETS_WO, roundRobin, vencidos, fechaISO } from './logica.js';

const CLAVE = 'lobcup-demo-v1';
const HORA = 3600e3, DIA = 24 * HORA;

const NOMBRES_M = ['Tomás', 'Bruno', 'Joaquín', 'Facundo', 'Nicolás', 'Matías', 'Lucas', 'Santiago', 'Franco', 'Agustín', 'Ignacio', 'Martín',
  'Gonzalo', 'Emiliano', 'Federico', 'Julián', 'Lautaro', 'Ramiro', 'Valentín', 'Iván', 'Diego', 'Pablo', 'Rodrigo', 'Leandro'];
const NOMBRES_F = ['Sofía', 'Valentina', 'Camila', 'Lucía', 'Martina', 'Julieta', 'Florencia', 'Agustina', 'Micaela', 'Carolina', 'Paula', 'Victoria',
  'Rocío', 'Belén', 'Milagros', 'Emilia', 'Daniela', 'Natalia', 'Romina', 'Celeste', 'Josefina', 'Candela', 'Pilar', 'Abril'];
const APELLIDOS = ['Arce', 'Villalba', 'Ferreyra', 'Bustamante', 'Peralta', 'Ledesma', 'Correa', 'Molina', 'Vera', 'Ojeda', 'Funes', 'Paz',
  'Godoy', 'Rivas', 'Toledo', 'Acosta', 'Maldonado', 'Herrera', 'Navarro', 'Ponce', 'Rojas', 'Benítez', 'Cáceres', 'Aguirre',
  'Luna', 'Moreno', 'Figueroa', 'Castro', 'Vega', 'Suárez', 'Juárez', 'Gallardo', 'Miranda', 'Lucero', 'Bravo', 'Cabrera',
  'Heredia', 'Ríos', 'Ortiz', 'Agüero', 'Montes', 'Salinas', 'Torres', 'Bazán', 'Campos', 'Guzmán', 'Olmos', 'Barrera'];

export const CATEGORIAS_BASE = [
  { id: 1, nombre: '6.ª Masculino', nivel: 6, genero: 'M', orden: 1 },
  { id: 2, nombre: '7.ª Masculino', nivel: 7, genero: 'M', orden: 2 },
  { id: 3, nombre: '8.ª Masculino', nivel: 8, genero: 'M', orden: 3 },
  { id: 4, nombre: '6.ª Femenino', nivel: 6, genero: 'F', orden: 4 },
  { id: 5, nombre: '7.ª Femenino', nivel: 7, genero: 'F', orden: 5 },
  { id: 6, nombre: '8.ª Femenino', nivel: 8, genero: 'F', orden: 6 },
];

// Grilla de la liga actual (sin las mañanas de martes y jueves; con sábado a la tarde y 22:30 a 00:00).
export const TURNOS_BASE = (() => {
  const t = []; let id = 0;
  for (let dia = 1; dia <= 5; dia++) {
    for (const [inicio, fin, canchas] of [['18:00', '19:30', 2], ['19:30', '21:00', 2], ['21:00', '22:30', 3], ['22:30', '24:00', 3]]) t.push({ id: ++id, dia, inicio, fin, canchas });
  }
  for (const [inicio, fin] of [['09:30', '11:00'], ['11:00', '12:30'], ['16:00', '17:30'], ['17:30', '19:00']]) t.push({ id: ++id, dia: 6, inicio, fin, canchas: 3 });
  return t;
})();

function prng(semilla) {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}


// ---------------------------------------------------------------------
// Liga de ejemplo: 6 categorías × 8 parejas = 48 parejas, fixture de 7 fechas,
// fechas 1 a 4 jugadas, la 5 a medias, el resto por jugar.
// ---------------------------------------------------------------------
export function generarLiga(ahora = Date.now()) {
  const r = prng(20270314);
  const elegir = (arr) => arr[Math.floor(r() * arr.length)];
  const jugadores = [], parejas = [], partidos = [], reservas = [], actividad = [];
  let jid = 0, pid = 0, mid = 0, rid = 0, aid = 0;
  const fuerza = new Map();
  for (const cat of CATEGORIAS_BASE) {
    const nombres = cat.genero === 'M' ? NOMBRES_M : NOMBRES_F;
    for (let k = 0; k < 8; k++) {
      const par = [];
      for (let s = 0; s < 2; s++) {
        const i = ((cat.id - 1) % 3) * 16 + k * 2 + s;         // 48 combinaciones distintas por género
        const ape = APELLIDOS[(i + (cat.genero === 'F' ? 7 : 0)) % APELLIDOS.length];
        jid++;
        jugadores.push({ id: 'j' + jid, nombre: nombres[i % nombres.length], apellido: ape, telefono: '351000' + String(1000 + jid).slice(-4), genero: cat.genero, rol: 'jugador' });
        par.push('j' + jid);
      }
      pid++;
      parejas.push({ id: pid, categoria_id: cat.id, jugador1: par[0], jugador2: par[1], estado: 'activa', creado_at: ahora - 60 * DIA + pid * 1000 });
      fuerza.set(pid, r());
    }
  }
  // Organizador
  jugadores.push({ id: 'org', nombre: 'Organización', apellido: '', telefono: '3510000000', genero: null, rol: 'organizador' });

  const YO = 'j17', MI_PAREJA = 9;                 // Lautaro Godoy · 7.ª Masculino (pareja 9 con Ramiro Rivas)
  const inicioFecha = (f) => ahora - (5 - f) * 7 * DIA - 2 * DIA;   // fecha 5 = esta semana
  const SETS_GANA = [[6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 4], [7, 5], [7, 6], [6, 3], [6, 2]];
  const setGanado = (ganaA) => { const [x, y] = elegir(SETS_GANA); return ganaA ? [x, y] : [y, x]; };
  function resultado(a, b) {
    const pa = 0.5 + (fuerza.get(a) - fuerza.get(b)) * 0.6;
    const ganaA = r() < pa;
    if (r() < 0.68) return { ganaA, sets: [setGanado(ganaA), setGanado(ganaA)] };
    const primero = r() < 0.5;
    const s3 = r() < 0.85 ? [11, Math.floor(r() * 10)] : [12, 10];
    return { ganaA, sets: [setGanado(primero ? ganaA : !ganaA), setGanado(primero ? !ganaA : ganaA), ganaA ? s3 : [s3[1], s3[0]]] };
  }

  for (const cat of CATEGORIAS_BASE) {
    const ids = parejas.filter((p) => p.categoria_id === cat.id).map((p) => p.id);
    roundRobin(ids).forEach((ronda, i) => {
      const fecha = i + 1;
      ronda.forEach(({ a, b }, j) => {
        mid++;
        const m = { id: mid, categoria_id: cat.id, fecha, a, b, estado: 'pendiente', sets: [], wo: false, ganador: null,
          cargado_por: null, cargado_pareja: null, cargado_at: null, vence_at: null, confirmado_por: null, confirmado_at: null,
          confirmado_via: null, disputa_motivo: null, disputa_sets: null, disputa_por: null, disputa_at: null, editado_por_org: false };
        const dia = inicioFecha(fecha) + j * 0.7 * DIA;
        const jugado = fecha <= 4 || (fecha === 5 && j < 2);
        if (jugado) {
          const res = resultado(a, b);
          const cargo = res.ganaA ? a : b;
          Object.assign(m, { estado: 'confirmado', sets: res.sets, ganador: res.ganaA ? a : b, cargado_pareja: cargo,
            cargado_por: parejas.find((p) => p.id === cargo).jugador1, cargado_at: dia + 2 * HORA, vence_at: dia + 26 * HORA,
            confirmado_at: dia + (r() < 0.8 ? 5 : 26) * HORA, confirmado_via: 'rival' });
          m.confirmado_via = m.confirmado_at - m.cargado_at >= 24 * HORA ? 'auto' : 'rival';
          const rival = cargo === a ? b : a;
          m.confirmado_por = m.confirmado_via === 'rival' ? parejas.find((p) => p.id === rival).jugador2 : null;
        }
        if (fecha >= 5 && fecha <= 6 && !jugado) {
          // Algunas reservas hechas para esta semana y la que viene
          if (r() < 0.55 && !(m.a === MI_PAREJA || m.b === MI_PAREJA)) {
            const base = new Date(ahora + (fecha === 5 ? 1 : 6) * DIA + j * DIA);
            const dow = base.getDay();
            const opciones = TURNOS_BASE.filter((t) => t.dia === dow);
            if (opciones.length) {
              const t = opciones[j % opciones.length];
              rid++;
              reservas.push({ id: rid, partido_id: mid, fecha: fechaISO(base.getTime()), inicio: t.inicio, fin: t.fin, cancha: 1 + (rid % t.canchas),
                estado: r() < 0.5 ? 'confirmada' : 'pendiente', creada_por: parejas.find((p) => p.id === a).jugador1, creada_at: ahora - DIA });
            }
          }
        }
        partidos.push(m);
      });
    });
  }

  // Escenas armadas para mostrar el flujo:
  const enCat = (c) => partidos.filter((m) => m.categoria_id === c);
  const mios = partidos.filter((m) => m.a === MI_PAREJA || m.b === MI_PAREJA);
  const rivalDe = (m) => (m.a === MI_PAREJA ? m.b : m.a);
  // 1) Mi fecha 5: el rival cargó el resultado y me toca confirmar.
  const m5 = mios.find((m) => m.fecha === 5);
  if (m5) {
    const res = resultado(m5.a, m5.b);
    const riv = rivalDe(m5);
    Object.assign(m5, { estado: 'por_confirmar', sets: res.sets, ganador: res.ganaA ? m5.a : m5.b, cargado_pareja: riv,
      cargado_por: parejas.find((p) => p.id === riv).jugador1, cargado_at: ahora - 3 * HORA, vence_at: ahora + 21 * HORA,
      confirmado_at: null, confirmado_via: null, confirmado_por: null });
  }
  // 2) Una disputa en mi categoría para que la resuelva el organizador.
  const disp = enCat(2).find((m) => m.fecha === 5 && m.estado === 'pendiente' && m !== m5);
  if (disp) for (let i = reservas.length - 1; i >= 0; i--) if (reservas[i].partido_id === disp.id) reservas.splice(i, 1);
  if (disp) {
    const quien = disp.a;
    Object.assign(disp, { estado: 'en_disputa', sets: [[6, 4], [3, 6], [11, 8]], ganador: disp.a, cargado_pareja: quien,
      cargado_por: parejas.find((p) => p.id === quien).jugador1, cargado_at: ahora - 20 * HORA, vence_at: ahora + 4 * HORA,
      disputa_motivo: 'El súper tie-break terminó 11-9 para nosotros, no 11-8 para ellos.', disputa_sets: [[6, 4], [3, 6], [9, 11]],
      disputa_por: parejas.find((p) => p.id === disp.b).jugador1, disputa_at: ahora - 18 * HORA });
  }
  // 3) Otros resultados esperando confirmación en otras categorías.
  for (const c of [1, 4, 6]) {
    const m = enCat(c).find((x) => x.fecha === 5 && x.estado === 'pendiente');
    if (m) {
      const res = resultado(m.a, m.b); const cargo = res.ganaA ? m.a : m.b;
      Object.assign(m, { estado: 'por_confirmar', sets: res.sets, ganador: cargo, cargado_pareja: cargo,
        cargado_por: parejas.find((p) => p.id === cargo).jugador1, cargado_at: ahora - 10 * HORA, vence_at: ahora + 14 * HORA });
    }
  }
  // 4) Una pareja esperando compañero (inscripción abierta) en 8.ª Femenino.
  jid++;
  jugadores.push({ id: 'j' + jid, nombre: 'Clara', apellido: 'Sarmiento', telefono: '351000' + String(1000 + jid).slice(-4), genero: 'F', rol: 'jugador' });
  pid++;
  parejas.push({ id: pid, categoria_id: 6, jugador1: 'j' + jid, jugador2: null, estado: 'activa', codigo: 'LOB7K2', creado_at: ahora - DIA });

  for (const m of partidos.filter((x) => x.estado !== 'pendiente').sort((x, y) => (x.cargado_at || 0) - (y.cargado_at || 0)).slice(-25)) {
    actividad.push({ id: ++aid, at: m.cargado_at, actor: m.cargado_por, tipo: 'resultado_cargado', partido_id: m.id, detalle: { sets: m.sets } });
    if (m.estado === 'confirmado') actividad.push({ id: ++aid, at: m.confirmado_at, actor: m.confirmado_por, tipo: m.confirmado_via === 'auto' ? 'resultado_autoconfirmado' : 'resultado_confirmado', partido_id: m.id, detalle: {} });
    if (m.estado === 'en_disputa') actividad.push({ id: ++aid, at: m.disputa_at, actor: m.disputa_por, tipo: 'resultado_disputado', partido_id: m.id, detalle: { motivo: m.disputa_motivo } });
  }
  actividad.sort((x, y) => y.at - x.at);

  return {
    version: 1,
    config: { ...CONFIG_BASE, whatsapp_org: '3510000000' },
    categorias: CATEGORIAS_BASE.map((c) => ({ ...c, inscripcion_abierta: true, fecha_en_juego: null })),
    jugadores, parejas, partidos, turnos: TURNOS_BASE.map((t) => ({ ...t })), reservas, actividad,
    yo: YO, ids: { jid, pid, mid, rid, aid },
  };
}

// ---------------------------------------------------------------------
// Capa de datos DEMO (misma interfaz que datos-supabase.js)
// ---------------------------------------------------------------------
function leerGuardado() {
  try { const t = localStorage.getItem(CLAVE); if (t) { const d = JSON.parse(t); if (d && d.version === 1) return d; } } catch (e) { /* sin localStorage */ }
  return null;
}
function guardar(db) { try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch (e) { /* sin localStorage: queda en memoria */ } }

export function crearDemo() {
  let db = leerGuardado() || generarLiga();
  const fallar = (msg) => { throw new Error(msg); };
  const ahora = () => Date.now();
  const yo = () => db.yo;
  const esOrg = () => (db.jugadores.find((j) => j.id === db.yo) || {}).rol === 'organizador';
  const partido = (id) => db.partidos.find((m) => m.id === Number(id)) || fallar('Ese partido no existe.');
  const pareja = (id) => db.parejas.find((p) => p.id === id);
  const miParejaEn = (m, uid = yo()) => [m.a, m.b].find((id) => { const p = pareja(id); return p && (p.jugador1 === uid || p.jugador2 === uid); }) || null;
  const log = (tipo, partido_id, detalle = {}, actor = yo()) => { db.actividad.unshift({ id: ++db.ids.aid, at: ahora(), actor, tipo, partido_id, detalle }); db.actividad = db.actividad.slice(0, 300); };
  const soloOrg = () => { if (!esOrg()) fallar('Solo el organizador.'); };
  const fin = () => { guardar(db); return true; };

  function autoconfirmar() {
    const v = vencidos(db.partidos, ahora());
    for (const m of v) { Object.assign(m, { estado: 'confirmado', confirmado_at: ahora(), confirmado_via: 'auto', confirmado_por: null }); log('resultado_autoconfirmado', m.id, {}, null); }
    if (v.length) guardar(db);
    return v.length;
  }

  function cargarResultado(id, sets, wo = false, uid = yo()) {
    const m = partido(id);
    const mi = miParejaEn(m, uid);
    if (!mi) fallar('Solo pueden cargar el resultado los que juegan el partido.');
    if ([m.a, m.b].some((p) => pareja(p).estado !== 'activa')) fallar('Una de las parejas está dada de baja. Lo resuelve el organizador.');
    if (m.estado === 'confirmado') fallar('Este resultado ya está confirmado. Si hay un error, avisale al organizador.');
    if (m.estado === 'en_disputa') fallar('Este resultado está en revisión del organizador.');
    if (m.estado === 'por_confirmar' && m.cargado_pareja !== mi) fallar('Tu rival ya cargó el resultado: confirmalo o marcá que no es así.');
    let ganador;
    if (wo) { sets = mi === m.a ? SETS_WO.map((s) => [...s]) : SETS_WO.map(([x, y]) => [y, x]); ganador = mi; }
    else { const v = validarSets(sets); if (!v.ok) fallar(v.error); sets = v.sets; ganador = v.ganador === 'a' ? m.a : m.b; }
    Object.assign(m, { estado: 'por_confirmar', sets, wo: !!wo, ganador, cargado_por: uid, cargado_pareja: mi, cargado_at: ahora(),
      vence_at: ahora() + db.config.horas_autoconfirmar * HORA, confirmado_por: null, confirmado_at: null, confirmado_via: null,
      disputa_motivo: null, disputa_sets: null, disputa_por: null, disputa_at: null });
    log(wo ? 'wo_cargado' : 'resultado_cargado', m.id, { sets }, uid);
    return fin();
  }
  function confirmarResultado(id, uid = yo()) {
    const m = partido(id);
    if (m.estado !== 'por_confirmar') fallar('Este resultado no está esperando confirmación.');
    const mi = miParejaEn(m, uid);
    if (!mi || mi === m.cargado_pareja) fallar('Lo confirma la pareja rival de la que lo cargó.');
    Object.assign(m, { estado: 'confirmado', confirmado_por: uid, confirmado_at: ahora(), confirmado_via: 'rival' });
    log('resultado_confirmado', m.id, {}, uid);
    return fin();
  }
  function disputarResultado(id, motivo, sets = null, uid = yo()) {
    const m = partido(id);
    if (m.estado !== 'por_confirmar') fallar('Este resultado no está esperando confirmación.');
    const mi = miParejaEn(m, uid);
    if (!mi || mi === m.cargado_pareja) fallar('Lo puede objetar la pareja rival de la que lo cargó.');
    let propuesta = null;
    if (sets && sets.some((s) => s && s[0] !== '' && s[0] != null)) { const v = validarSets(sets); if (!v.ok) fallar(v.error); propuesta = v.sets; }
    Object.assign(m, { estado: 'en_disputa', disputa_motivo: String(motivo || '').slice(0, 300), disputa_sets: propuesta, disputa_por: uid, disputa_at: ahora() });
    log('resultado_disputado', m.id, { motivo }, uid);
    return fin();
  }
  function reservarTurno(id, fecha, inicio, uid = yo()) {
    const m = partido(id);
    if (!miParejaEn(m, uid) && !esOrg()) fallar('Solo reservan los que juegan el partido.');
    if (m.estado === 'confirmado') fallar('Este partido ya se jugó.');
    const hoy = fechaISO(ahora());
    const max = fechaISO(ahora() + db.config.ventana_dias * DIA);
    if (fecha < hoy || fecha > max) fallar(`Se reserva de hoy a ${db.config.ventana_dias} días.`);
    if (new Date(`${fecha}T${inicio}:00`).getTime() <= ahora()) fallar('Ese horario ya pasó.');
    const dow = new Date(`${fecha}T12:00:00`).getDay();
    const t = db.turnos.find((x) => x.dia === dow && x.inicio === inicio) || fallar('Ese horario no está en la grilla de la liga.');
    if (db.reservas.some((x) => x.partido_id === m.id && x.estado !== 'cancelada')) fallar('Este partido ya tiene un turno. Cancelalo antes de pedir otro.');
    let libre = null;
    for (let c = 1; c <= t.canchas; c++) if (!db.reservas.some((x) => x.fecha === fecha && x.inicio === inicio && x.cancha === c && x.estado !== 'cancelada')) { libre = c; break; }
    if (!libre) fallar('Ese turno se llenó. Elegí otro.');
    db.reservas.push({ id: ++db.ids.rid, partido_id: m.id, fecha, inicio, fin: t.fin, cancha: libre, estado: 'pendiente', creada_por: uid, creada_at: ahora() });
    log('turno_reservado', m.id, { fecha, inicio, cancha: libre }, uid);
    return fin();
  }
  function cancelarReserva(rid) {
    const r = db.reservas.find((x) => x.id === Number(rid) && x.estado !== 'cancelada') || fallar('Esa reserva no existe.');
    if (!esOrg()) {
      if (!miParejaEn(partido(r.partido_id))) fallar('Solo la cancelan los que juegan el partido.');
      if (r.estado === 'confirmada') fallar('El turno ya está confirmado: para cancelarlo hablá con el organizador.');
    }
    r.estado = 'cancelada';
    log('turno_cancelado', r.partido_id, { reserva: r.id });
    return fin();
  }
  function crearPareja(categoriaId) {
    const c = db.categorias.find((x) => x.id === Number(categoriaId)) || fallar('Esa categoría no existe.');
    if (!c.inscripcion_abierta) fallar(`La inscripción de ${c.nombre} está cerrada.`);
    const j = db.jugadores.find((x) => x.id === yo());
    if (j.genero && j.genero !== c.genero) fallar('Esa categoría es de otro género.');
    if (db.parejas.some((p) => p.categoria_id === c.id && p.estado === 'activa' && (p.jugador1 === yo() || p.jugador2 === yo()))) fallar('Ese jugador ya tiene pareja en esta categoría.');
    const codigo = Math.random().toString(36).slice(2, 8).toUpperCase();
    db.parejas.push({ id: ++db.ids.pid, categoria_id: c.id, jugador1: yo(), jugador2: null, estado: 'activa', codigo, creado_at: ahora() });
    log('pareja_creada', null, { pareja: db.ids.pid });
    fin();
    return codigo;
  }
  function unirmeAPareja(codigo) {
    const p = db.parejas.find((x) => x.codigo && x.codigo === String(codigo || '').trim().toUpperCase()) || fallar('Ese código no existe.');
    if (p.estado !== 'activa' || p.jugador2) fallar('Esa pareja ya está completa.');
    if (p.jugador1 === yo()) fallar('No podés ser tu propio compañero.');
    const c = db.categorias.find((x) => x.id === p.categoria_id);
    const j = db.jugadores.find((x) => x.id === yo());
    if (j.genero && j.genero !== c.genero) fallar('Esa categoría es de otro género.');
    if (db.parejas.some((x) => x.categoria_id === c.id && x.estado === 'activa' && (x.jugador1 === yo() || x.jugador2 === yo()))) fallar('Ese jugador ya tiene pareja en esta categoría.');
    p.jugador2 = yo(); delete p.codigo;
    log('pareja_completa', null, { pareja: p.id });
    return fin();
  }
  function actualizarPerfil(datos) {
    const j = db.jugadores.find((x) => x.id === yo());
    for (const k of ['nombre', 'apellido', 'telefono']) if (datos[k] != null) j[k] = String(datos[k]).slice(0, k === 'telefono' ? 30 : 60);
    return fin();
  }
  // --- organizador
  function fijarResultado(id, sets, wo = false, ganadorWo = null) {
    soloOrg();
    const m = partido(id);
    const antes = m.estado;
    let ganador;
    if (wo) {
      if (![m.a, m.b].includes(Number(ganadorWo))) fallar('Elegí quién gana por W.O.');
      ganador = Number(ganadorWo); sets = ganador === m.a ? SETS_WO.map((s) => [...s]) : SETS_WO.map(([x, y]) => [y, x]);
    } else { const v = validarSets(sets); if (!v.ok) fallar(v.error); sets = v.sets; ganador = v.ganador === 'a' ? m.a : m.b; }
    Object.assign(m, { estado: 'confirmado', sets, wo: !!wo, ganador, confirmado_por: yo(), confirmado_at: ahora(), confirmado_via: 'organizador', editado_por_org: true, cargado_at: m.cargado_at || ahora() });
    log('resultado_fijado_org', m.id, { sets, antes });
    return fin();
  }
  function anularResultado(id) {
    soloOrg();
    const m = partido(id);
    Object.assign(m, { estado: 'pendiente', sets: [], wo: false, ganador: null, cargado_por: null, cargado_pareja: null, cargado_at: null, vence_at: null,
      confirmado_por: null, confirmado_at: null, confirmado_via: null, disputa_motivo: null, disputa_sets: null, disputa_por: null, disputa_at: null });
    log('resultado_anulado', m.id);
    return fin();
  }
  function bajaPareja(pid) {
    soloOrg();
    const p = pareja(Number(pid)) || fallar('Esa pareja no existe.');
    p.estado = 'baja';
    let n = 0;
    for (const m of db.partidos) {
      if ((m.a === p.id || m.b === p.id) && m.estado !== 'confirmado') {
        const gana = m.a === p.id ? m.b : m.a;
        Object.assign(m, { estado: 'confirmado', wo: true, ganador: gana, sets: gana === m.a ? SETS_WO.map((s) => [...s]) : SETS_WO.map(([x, y]) => [y, x]),
          confirmado_por: yo(), confirmado_at: ahora(), confirmado_via: 'organizador', editado_por_org: true });
        for (const r of db.reservas) if (r.partido_id === m.id && r.estado !== 'cancelada') r.estado = 'cancelada';
        n++;
      }
    }
    log('pareja_baja', null, { pareja: p.id, wo: n });
    fin();
    return n;
  }
  function generarFixture(catId) {
    soloOrg();
    const c = Number(catId);
    const ids = db.parejas.filter((p) => p.categoria_id === c && p.estado === 'activa' && p.jugador2).map((p) => p.id).sort((x, y) => x - y);
    if (ids.length < 2) fallar('Hacen falta al menos 2 parejas completas.');
    if (db.partidos.some((m) => m.categoria_id === c && m.estado !== 'pendiente')) fallar('La categoría ya tiene resultados: no se puede rearmar el fixture.');
    const viejos = new Set(db.partidos.filter((m) => m.categoria_id === c).map((m) => m.id));
    db.partidos = db.partidos.filter((m) => !viejos.has(m.id));
    db.reservas = db.reservas.filter((r) => !viejos.has(r.partido_id));
    let total = 0;
    roundRobin(ids).forEach((ronda, i) => ronda.forEach(({ a, b }) => {
      db.partidos.push({ id: ++db.ids.mid, categoria_id: c, fecha: i + 1, a, b, estado: 'pendiente', sets: [], wo: false, ganador: null, cargado_por: null, cargado_pareja: null,
        cargado_at: null, vence_at: null, confirmado_por: null, confirmado_at: null, confirmado_via: null, disputa_motivo: null, disputa_sets: null, disputa_por: null, disputa_at: null, editado_por_org: false });
      total++;
    }));
    log('fixture_generado', null, { categoria: c, partidos: total });
    fin();
    return total;
  }
  function confirmarReserva(rid) {
    soloOrg();
    const r = db.reservas.find((x) => x.id === Number(rid) && x.estado === 'pendiente') || fallar('Esa reserva no está pendiente.');
    r.estado = 'confirmada';
    log('turno_confirmado', r.partido_id);
    return fin();
  }
  function guardarConfig(cambios) {
    soloOrg();
    for (const k of Object.keys(CONFIG_BASE)) {
      if (cambios[k] === undefined) continue;
      db.config[k] = typeof CONFIG_BASE[k] === 'number' ? Number(cambios[k]) : String(cambios[k]);
    }
    if (!(db.config.horas_autoconfirmar >= 1 && db.config.horas_autoconfirmar <= 168)) { db.config.horas_autoconfirmar = 24; fallar('Las horas para autoconfirmar van de 1 a 168.'); }
    log('config_cambiada', null, cambios);
    return fin();
  }
  function guardarTurno(t) {
    soloOrg();
    if (t.borrar) { db.turnos = db.turnos.filter((x) => x.id !== t.id); return fin(); }
    if (!/^\d\d:\d\d$/.test(t.inicio) || !/^\d\d:\d\d$/.test(t.fin)) fallar('Horario inválido (HH:MM).');
    if (db.turnos.some((x) => x.dia === Number(t.dia) && x.inicio === t.inicio && x.id !== t.id)) fallar('Ya hay un turno ese día a esa hora.');
    db.turnos.push({ id: Math.max(0, ...db.turnos.map((x) => x.id)) + 1, dia: Number(t.dia), inicio: t.inicio, fin: t.fin, canchas: Math.max(1, Number(t.canchas) || 1) });
    db.turnos.sort((x, y) => x.dia - y.dia || x.inicio.localeCompare(y.inicio));
    return fin();
  }
  function agregarPareja(catId, n1, n2) {
    soloOrg();
    const c = db.categorias.find((x) => x.id === Number(catId)) || fallar('Esa categoría no existe.');
    const nuevo = (txt) => {
      const [nombre, ...resto] = String(txt || '').trim().split(/\s+/);
      if (!nombre) fallar('Escribí nombre y apellido de los dos.');
      const id = 'j' + (++db.ids.jid);
      db.jugadores.push({ id, nombre, apellido: resto.join(' '), telefono: '', genero: c.genero, rol: 'jugador' });
      return id;
    };
    db.parejas.push({ id: ++db.ids.pid, categoria_id: c.id, jugador1: nuevo(n1), jugador2: nuevo(n2), estado: 'activa', creado_at: ahora() });
    log('pareja_creada', null, { pareja: db.ids.pid });
    return fin();
  }
  function cambiarInscripcion(catId, abierta) { soloOrg(); db.categorias.find((x) => x.id === Number(catId)).inscripcion_abierta = !!abierta; return fin(); }
  function cambiarFechaEnJuego(catId, f) { soloOrg(); db.categorias.find((x) => x.id === Number(catId)).fecha_en_juego = f ? Number(f) : null; return fin(); }

  return {
    modo: 'demo',
    async cargar() { autoconfirmar(); return structuredClone({ ...db, ahora: ahora() }); },
    async sesion() { return { id: db.yo }; },
    async entrar() { return true; }, async registrarse() { return true; }, async linkMagico() { return true; }, async salir() { return true; },
    async cargarResultado(id, sets, wo) { return cargarResultado(id, sets, wo); },
    async confirmarResultado(id) { return confirmarResultado(id); },
    async disputarResultado(id, motivo, sets) { return disputarResultado(id, motivo, sets); },
    async reservarTurno(id, fecha, inicio) { return reservarTurno(id, fecha, inicio); },
    async cancelarReserva(rid) { return cancelarReserva(rid); },
    async crearPareja(c) { return crearPareja(c); },
    async unirmeAPareja(c) { return unirmeAPareja(c); },
    async actualizarPerfil(d) { return actualizarPerfil(d); },
    org: {
      async fijarResultado(id, sets, wo, g) { return fijarResultado(id, sets, wo, g); },
      async anularResultado(id) { return anularResultado(id); },
      async bajaPareja(p) { return bajaPareja(p); },
      async generarFixture(c) { return generarFixture(c); },
      async confirmarReserva(r) { return confirmarReserva(r); },
      async guardarConfig(c) { return guardarConfig(c); },
      async guardarTurno(t) { return guardarTurno(t); },
      async agregarPareja(c, a, b) { return agregarPareja(c, a, b); },
      async cambiarInscripcion(c, v) { return cambiarInscripcion(c, v); },
      async cambiarFechaEnJuego(c, f) { return cambiarFechaEnJuego(c, f); },
    },
    demo: {
      verComo(id) { if (!db.jugadores.some((j) => j.id === id)) fallar('No existe ese jugador.'); db.yo = id; fin(); },
      // Hace de cuenta que un jugador de la pareja rival responde.
      simularRival(id, accion) {
        const m = partido(id);
        const riv = pareja(m.cargado_pareja === m.a ? m.b : m.a);
        if (accion === 'confirmar') return confirmarResultado(id, riv.jugador1);
        return disputarResultado(id, 'No fue así: el segundo set lo ganamos nosotros.', null, riv.jugador1);
      },
      // El rival carga el resultado de mi partido (para probar "confirmar").
      rivalCarga(id) {
        const m = partido(id);
        const mi = miParejaEn(m);
        const riv = pareja(mi === m.a ? m.b : m.a);
        const sets = riv.id === m.a ? [[6, 3], [4, 6], [11, 7]] : [[3, 6], [6, 4], [7, 11]];
        return cargarResultado(id, sets, false, riv.jugador1);
      },
      // Adelanta el reloj: todo lo que vence en ese lapso se autoconfirma.
      adelantarHoras(h) {
        for (const m of db.partidos) if (m.estado === 'por_confirmar' && m.vence_at) m.vence_at -= h * HORA;
        return autoconfirmar();
      },
      reiniciar() { db = generarLiga(); try { localStorage.removeItem(CLAVE); } catch (e) { /* nada */ } fin(); },
    },
  };
}
