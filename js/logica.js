// =====================================================================
// Reglas de la liga (funciones puras, sin pantalla ni base de datos).
// Son LAS MISMAS reglas que calcula Postgres en supabase/schema.sql
// (tabla_categoria, ranking_jugadores). Si cambiás una, cambiá la otra
// y corré: node tests/logica.test.mjs
// =====================================================================

export const CONFIG_BASE = {
  temporada: 'Temporada 2027',
  puntos_victoria: 1,          // tabla por pareja: 1 punto por partido ganado (como la liga actual)
  puntos_derrota: 0,
  rk_gana_2sets: 100,          // ranking individual (Puntos LOB)
  rk_gana_stb: 80,
  rk_pierde_stb: 40,
  rk_pierde_2sets: 20,
  rk_wo_favor: 100,
  rk_wo_contra: -30,
  horas_autoconfirmar: 24,
  valor_turno: 36000,
  monto_sena: 9000,
  alias: 'lobcup.liga',
  ventana_dias: 14,
};

// --------------------------------------------------------------------
// Sets
// --------------------------------------------------------------------
// Sets 1 y 2: 6-0 a 6-4, 7-5 o 7-6. Set 3: súper tie-break a 11, diferencia de 2
// (11-9, 12-10, 13-11...).
export function setValido(a, b, n) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return false;
  const g = Math.max(a, b), p = Math.min(a, b);
  if (n === 3) return g >= 11 && g - p >= 2 && (g === 11 || g - p === 2);
  return (g === 6 && p <= 4) || (g === 7 && (p === 5 || p === 6));
}

// sets: [[a,b],[a,b],[a,b]?] desde el punto de vista de la pareja A.
// Devuelve { ok, error, ganador: 'a'|'b', stb }
export function validarSets(sets) {
  const s = (sets || []).filter((x) => x && x[0] !== '' && x[0] != null && x[1] !== '' && x[1] != null)
    .map((x) => [Number(x[0]), Number(x[1])]);
  if (s.length < 2) return { ok: false, error: 'Cargá al menos los dos primeros sets.' };
  for (let i = 0; i < 2; i++) {
    if (!setValido(s[i][0], s[i][1], i + 1)) return { ok: false, error: `El set ${i + 1} (${s[i][0]}-${s[i][1]}) no es válido. Va de 6-0 a 6-4, 7-5 o 7-6.` };
  }
  const g1 = s[0][0] > s[0][1] ? 'a' : 'b', g2 = s[1][0] > s[1][1] ? 'a' : 'b';
  if (g1 === g2) {
    if (s.length > 2) return { ok: false, error: 'Si una pareja ganó los dos primeros sets, no hay súper tie-break.' };
    return { ok: true, ganador: g1, stb: false, sets: s };
  }
  if (s.length < 3) return { ok: false, error: 'Van 1 set a 1: falta el súper tie-break.' };
  if (!setValido(s[2][0], s[2][1], 3)) return { ok: false, error: `El súper tie-break (${s[2][0]}-${s[2][1]}) no es válido. Es a 11 con diferencia de 2 (11-9, 12-10...).` };
  return { ok: true, ganador: s[2][0] > s[2][1] ? 'a' : 'b', stb: true, sets: s.slice(0, 3) };
}

export const SETS_WO = [[6, 0], [6, 0]];

// Sets y games de un partido para la pareja A y la B.
// Igual que la liga actual: los puntos del súper tie-break suman como games.
export function contarSets(sets) {
  let sa = 0, sb = 0, ga = 0, gb = 0;
  for (const [a, b] of sets || []) { ga += a; gb += b; if (a > b) sa++; else sb++; }
  return { sa, sb, ga, gb };
}

// Sets dados vuelta (para mostrarlos desde el lado de la pareja B).
export const invertirSets = (sets) => (sets || []).map(([a, b]) => [b, a]);
export const textoSets = (sets) => (sets || []).map(([a, b]) => `${a}-${b}`).join('  ');

// --------------------------------------------------------------------
// Tabla de posiciones por categoría (por pareja)
// Orden: 1) puntos 2) dif. sets 3) dif. games 4) enfrentamiento directo
//        (partidos ganados entre las empatadas) 5) orden de inscripción (id)
// Solo cuentan partidos CONFIRMADOS. Parejas dadas de baja no aparecen,
// pero lo que jugaron contra las demás sigue contando.
// --------------------------------------------------------------------
export function calcularTabla(parejas, partidos, cfg = CONFIG_BASE) {
  const st = new Map();
  for (const p of parejas) {
    if (p.estado !== 'activa') continue;
    st.set(p.id, { id: p.id, pj: 0, pg: 0, pp: 0, pts: 0, sf: 0, sc: 0, gf: 0, gc: 0, h2h: new Map() });
  }
  for (const m of partidos) {
    if (m.estado !== 'confirmado' || !m.ganador) continue;
    const { sa, sb, ga, gb } = contarSets(m.sets);
    const A = st.get(m.a), B = st.get(m.b);
    const ganoA = m.ganador === m.a;
    if (A) {
      A.pj++; A.sf += sa; A.sc += sb; A.gf += ga; A.gc += gb;
      if (ganoA) { A.pg++; A.pts += cfg.puntos_victoria; A.h2h.set(m.b, (A.h2h.get(m.b) || 0) + 1); } else { A.pp++; A.pts += cfg.puntos_derrota; }
    }
    if (B) {
      B.pj++; B.sf += sb; B.sc += sa; B.gf += gb; B.gc += ga;
      if (!ganoA) { B.pg++; B.pts += cfg.puntos_victoria; B.h2h.set(m.a, (B.h2h.get(m.a) || 0) + 1); } else { B.pp++; B.pts += cfg.puntos_derrota; }
    }
  }
  const filas = [...st.values()].map((r) => ({ ...r, ds: r.sf - r.sc, dg: r.gf - r.gc }));
  const clave = (r) => `${r.pts}|${r.ds}|${r.dg}`;
  // Enfrentamiento directo: partidos ganados contra las otras del mismo grupo de empate.
  for (const r of filas) {
    const grupo = filas.filter((o) => o !== r && clave(o) === clave(r));
    r.dir = grupo.reduce((n, o) => n + (r.h2h.get(o.id) || 0), 0);
  }
  filas.sort((x, y) => y.pts - x.pts || y.ds - x.ds || y.dg - x.dg || y.dir - x.dir || cmpId(x.id, y.id));
  return filas.map((r, i) => {
    const prev = filas[i - 1];
    let desempate = null;
    if (prev && prev.pts === r.pts) {
      desempate = prev.ds !== r.ds ? 'dif. de sets' : prev.dg !== r.dg ? 'dif. de games' : prev.dir !== r.dir ? 'enfrentamiento directo' : 'orden de inscripción';
    }
    const { h2h, ...resto } = r;
    return { pos: i + 1, ...resto, desempate };
  });
}

function cmpId(a, b) {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

// --------------------------------------------------------------------
// Puntos LOB (ranking individual)
// --------------------------------------------------------------------
export function puntosPartido(m, lado, cfg = CONFIG_BASE) {
  const gano = m.ganador === (lado === 'a' ? m.a : m.b);
  if (m.wo) return gano ? cfg.rk_wo_favor : cfg.rk_wo_contra;
  const stb = (m.sets || []).length >= 3;
  if (gano) return stb ? cfg.rk_gana_stb : cfg.rk_gana_2sets;
  return stb ? cfg.rk_pierde_stb : cfg.rk_pierde_2sets;
}

// Orden cronológico de un partido confirmado (fecha del fixture y después cuándo se confirmó).
const ordenCrono = (x, y) => x.fecha - y.fecha || (x.confirmado_at || 0) - (y.confirmado_at || 0) || cmpId(x.id, y.id);

// Ranking de jugadores. Orden: puntos, ganados, dif. sets, dif. games, nombre.
export function calcularRanking(jugadores, parejas, partidos, cfg = CONFIG_BASE) {
  const parejaDe = new Map(parejas.map((p) => [p.id, p]));
  const st = new Map(jugadores.map((j) => [j.id, { id: j.id, nombre: j.nombre, pts: 0, pj: 0, pg: 0, pp: 0, sf: 0, sc: 0, gf: 0, gc: 0, historial: [] }]));
  const conf = partidos.filter((m) => m.estado === 'confirmado' && m.ganador).sort(ordenCrono);
  for (const m of conf) {
    const { sa, sb, ga, gb } = contarSets(m.sets);
    for (const lado of ['a', 'b']) {
      const p = parejaDe.get(m[lado]);
      if (!p) continue;
      const gano = m.ganador === m[lado];
      const pts = puntosPartido(m, lado, cfg);
      for (const jid of [p.jugador1, p.jugador2]) {
        const r = jid && st.get(jid);
        if (!r) continue;
        r.pj++; if (gano) r.pg++; else r.pp++;
        r.pts += pts;
        r.sf += lado === 'a' ? sa : sb; r.sc += lado === 'a' ? sb : sa;
        r.gf += lado === 'a' ? ga : gb; r.gc += lado === 'a' ? gb : ga;
        r.historial.push(gano ? 'G' : 'P');
      }
    }
  }
  const filas = [...st.values()].map((r) => ({ ...r, ds: r.sf - r.sc, dg: r.gf - r.gc, racha: racha(r.historial), ultimos: r.historial.slice(-5) }));
  filas.sort((x, y) => y.pts - x.pts || y.pg - x.pg || y.ds - x.ds || y.dg - x.dg || x.nombre.localeCompare(y.nombre, 'es'));
  return filas.map((r, i) => ({ pos: i + 1, ...r }));
}

// Racha actual: { tipo: 'G'|'P', n } o null.
export function racha(historial) {
  if (!historial.length) return null;
  const tipo = historial[historial.length - 1];
  let n = 0;
  for (let i = historial.length - 1; i >= 0 && historial[i] === tipo; i--) n++;
  return { tipo, n };
}

// --------------------------------------------------------------------
// Fixture: todos contra todos, método del círculo (igual que la liga actual).
// Devuelve [[{a,b},...], ...] (una lista por fecha). Si son impares, una queda libre.
// --------------------------------------------------------------------
export function roundRobin(ids) {
  const arr = ids.slice();
  if (arr.length % 2) arr.push(null);
  const n = arr.length, rondas = [];
  for (let r = 0; r < n - 1; r++) {
    const ronda = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a != null && b != null) ronda.push({ a, b });
    }
    rondas.push(ronda);
    const ultimo = arr[n - 1];
    for (let j = n - 1; j > 1; j--) arr[j] = arr[j - 1];
    arr[1] = ultimo;
  }
  return rondas;
}

// --------------------------------------------------------------------
// Auto-confirmación: resultados "por confirmar" vencidos pasan a confirmados.
// --------------------------------------------------------------------
export function vencidos(partidos, ahora = Date.now()) {
  return partidos.filter((m) => m.estado === 'por_confirmar' && m.vence_at && m.vence_at <= ahora);
}

// --------------------------------------------------------------------
// WhatsApp: celular argentino → link wa.me
// --------------------------------------------------------------------
export function numeroWhatsApp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) return '549' + d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  d = d.replace(/^(\d{2,4})15(\d{6,8})$/, '$1$2'); // 0351 15 xxxxxxx
  if (d.length === 7) d = '351' + d;               // sin característica → Córdoba
  return '549' + d;
}
export function linkWhatsApp(tel, texto = '') {
  const n = numeroWhatsApp(tel);
  return n ? `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}` : '';
}

// --------------------------------------------------------------------
// Resumen de una fecha: lo más destacado.
// --------------------------------------------------------------------
export function resumenFecha(partidos, fecha) {
  const conf = partidos.filter((m) => m.fecha === fecha && m.estado === 'confirmado' && !m.wo);
  const total = partidos.filter((m) => m.fecha === fecha).length;
  let paliza = null, partidazo = null;
  for (const m of conf) {
    const { ga, gb } = contarSets(m.sets);
    const dif = Math.abs(ga - gb);
    const stb = m.sets.length >= 3;
    if (!stb && (!paliza || dif > paliza.dif)) paliza = { partido: m, dif };
    if (stb) {
      const [x, y] = m.sets[2];
      const ajuste = Math.abs(x - y);
      if (!partidazo || ajuste < partidazo.ajuste) partidazo = { partido: m, ajuste };
    }
  }
  return { fecha, jugados: partidos.filter((m) => m.fecha === fecha && m.estado === 'confirmado').length, total, paliza, partidazo, stbs: conf.filter((m) => m.sets.length >= 3).length };
}
