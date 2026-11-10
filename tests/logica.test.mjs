// Pruebas de las reglas. Correr: node tests/logica.test.mjs
import { setValido, validarSets, calcularTabla, calcularRanking, roundRobin, puntosPartido, racha, numeroWhatsApp, vencidos, resumenFecha, CONFIG_BASE, contarSets } from '../js/logica.js';

let ok = 0, mal = 0;
function prueba(nombre, cond, extra) { if (cond) ok++; else { mal++; console.log('FALLA:', nombre, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ---- Sets
prueba('6-4 válido', setValido(6, 4, 1));
prueba('6-5 inválido', !setValido(6, 5, 1));
prueba('7-6 válido', setValido(7, 6, 2));
prueba('7-4 inválido', !setValido(7, 4, 1));
prueba('8-6 inválido', !setValido(8, 6, 1));
prueba('stb 11-9', setValido(11, 9, 3));
prueba('stb 11-10 inválido', !setValido(11, 10, 3));
prueba('stb 13-11', setValido(13, 11, 3));
prueba('stb 14-11 inválido', !setValido(14, 11, 3));
prueba('stb 10-8 inválido (es a 11)', !setValido(10, 8, 3));
prueba('stb 11-0', setValido(11, 0, 3));
prueba('set 1 no admite 11-9', !setValido(11, 9, 1));

let v = validarSets([[6, 4], [6, 3]]);
prueba('2-0 gana A', v.ok && v.ganador === 'a' && !v.stb, v);
v = validarSets([[4, 6], [6, 7], ['', '']]);
prueba('0-2 gana B, tercer set vacío ignorado', v.ok && v.ganador === 'b', v);
v = validarSets([[6, 4], [3, 6]]);
prueba('1-1 sin stb = error', !v.ok, v);
v = validarSets([[6, 4], [3, 6], [9, 11]]);
prueba('1-1 + stb gana B', v.ok && v.ganador === 'b' && v.stb, v);
v = validarSets([[6, 4], [6, 4], [11, 3]]);
prueba('2-0 + stb = error', !v.ok, v);
v = validarSets([[6, 4]]);
prueba('un solo set = error', !v.ok, v);

// ---- Fixture
const rr = roundRobin([1, 2, 3, 4, 5, 6]);
prueba('6 parejas → 5 fechas', rr.length === 5);
prueba('3 partidos por fecha', rr.every((f) => f.length === 3));
const cruces = new Set(rr.flat().map(({ a, b }) => [a, b].sort().join('-')));
prueba('15 cruces distintos', cruces.size === 15);
const rr5 = roundRobin([1, 2, 3, 4, 5]);
prueba('5 parejas → 5 fechas con 2 partidos (una libre)', rr5.length === 5 && rr5.every((f) => f.length === 2));
prueba('cada pareja libre una vez', [1, 2, 3, 4, 5].every((id) => rr5.filter((f) => !f.some((m) => m.a === id || m.b === id)).length === 1));

// ---- Tabla
const P = (id, j1, j2, estado = 'activa') => ({ id, jugador1: j1, jugador2: j2, estado });
const M = (id, fecha, a, b, sets, extra = {}) => {
  const v = validarSets(sets);
  return { id, fecha, a, b, sets, estado: 'confirmado', ganador: v.ganador === 'a' ? a : b, wo: false, confirmado_at: fecha * 1000, ...extra };
};
const parejas = [P(1, 'j1', 'j2'), P(2, 'j3', 'j4'), P(3, 'j5', 'j6'), P(4, 'j7', 'j8')];
const partidos = [
  M(1, 1, 1, 2, [[6, 4], [6, 4]]),
  M(2, 1, 3, 4, [[6, 0], [6, 0]]),
  M(3, 2, 1, 3, [[4, 6], [6, 4], [11, 9]]),
  M(4, 2, 2, 4, [[6, 2], [6, 2]]),
  M(5, 3, 1, 4, [[6, 7], [4, 6]]),
  M(6, 3, 2, 3, [[6, 3], [6, 3]]),
  { id: 7, fecha: 4, a: 1, b: 2, sets: [[6, 0], [6, 0]], estado: 'por_confirmar', ganador: 1 },
];
const t = calcularTabla(parejas, partidos);
prueba('solo confirmados: PJ de 1 = 3', t.find((r) => r.id === 1).pj === 3, t);
// 1: G G P → 2 pts. 2: P G G → 2 pts. 3: G P P → 1. 4: P P G → 1
// 1: sets 2-0, 2-1, 0-2 → 4-3 (+1). 2: 0-2, 2-0, 2-0 → 4-2 (+2) → 2 arriba de 1.
prueba('orden por dif. de sets', t[0].id === 2 && t[1].id === 1, t.map((r) => [r.id, r.pts, r.ds, r.dg]));
prueba('motivo de desempate', t[1].desempate === 'dif. de sets', t[1]);
// 3: 2-0(12-0), 1-2(4+6+9=19 vs 6+4+11=21), 0-2(6-12) → sets 3-4 (-1). 4: 0-2, 0-2, 2-0 → 2-4 (-2)
prueba('3 arriba de 4', t[2].id === 3 && t[3].id === 4, t.map((r) => [r.id, r.pts, r.ds, r.dg]));
const f3 = t.find((r) => r.id === 3);
prueba('games con stb sumados como en la liga actual', f3.gf === 12 + 19 + 6 && f3.gc === 0 + 21 + 12, f3);

// Empate total entre dos → enfrentamiento directo (como la app actual)
const pe = [P(1, 'a', 'b'), P(2, 'c', 'd'), P(3, 'e', 'f')];
const me = [
  M(1, 1, 2, 1, [[6, 4], [6, 4]]),   // 2 le gana a 1
  M(2, 2, 1, 3, [[6, 4], [6, 4]]),
  M(3, 3, 3, 2, [[6, 4], [6, 4]]),
];
// Los tres: 1 pt, 2-2 sets, 24-24 games → empate triple. Cada uno ganó 1 contra el grupo → id.
const te = calcularTabla(pe, me);
prueba('empate triple circular → orden de inscripción', te.map((r) => r.id).join() === '1,2,3', te);
const pe2 = [P(1, 'a', 'b'), P(2, 'c', 'd')];
const me2 = [M(1, 1, 2, 1, [[6, 4], [4, 6], [11, 9]]), M(2, 2, 1, 2, [[6, 4], [4, 6], [9, 11]])];
// 2 le ganó a 1 en el primero, y en el segundo también (B=2 ganó) → 2 tiene 2 pts. Armamos un empate real:
const me3 = [M(1, 1, 2, 1, [[6, 4], [4, 6], [11, 9]]), M(2, 2, 1, 2, [[6, 4], [4, 6], [11, 9]])];
const t3 = calcularTabla(pe2, me3);
prueba('empate 1-1 sin diferencia → por id', t3[0].id === 1 && t3[1].desempate === 'enfrentamiento directo' ? true : t3[0].id === 1, t3);
void me2;
// Comparación con la regla de la app vieja para empates de dos: igual pts/ds/dg, decide el directo.
const pd = [P(1, 'a', 'b'), P(2, 'c', 'd'), P(3, 'e', 'f'), P(4, 'g', 'h')];
const md = [
  M(1, 1, 2, 1, [[6, 3], [6, 3]]),   // 2 gana a 1
  M(2, 1, 3, 4, [[6, 3], [6, 3]]),
  M(3, 2, 1, 3, [[6, 3], [6, 3]]),   // 1 gana a 3
  M(4, 2, 2, 4, [[6, 3], [6, 3]]),   // 2 gana a 4
  M(5, 3, 1, 4, [[6, 3], [6, 3]]),   // 1 gana a 4
  M(6, 3, 3, 2, [[6, 3], [6, 3]]),   // 3 gana a 2
];
// 1: 2 pts (+2 sets, +6 games); 2: 2 pts; 3: 2 pts; 4: 0. Tres empatados igual... 1 ganó a 3, 2 a 1, 3 a 2 → circular.
const td = calcularTabla(pd, md);
prueba('pareja sin puntos última', td[3].id === 4, td);
const pd2 = [P(1, 'a', 'b'), P(2, 'c', 'd'), P(3, 'e', 'f')];
const md2 = [
  M(1, 1, 1, 3, [[6, 3], [6, 3]]),
  M(2, 1, 2, 3, [[6, 3], [6, 3]]),
  M(3, 2, 2, 1, [[6, 3], [6, 3]]),   // 2 le gana a 1 → empatan 1 y 2 (1 pt? no: 1 tiene 1, 2 tiene 2)
];
const td2 = calcularTabla(pd2, md2);
prueba('2 primero con 2 pts', td2[0].id === 2 && td2[0].pts === 2, td2);
// Empate de dos con mismos números: 1 y 2 juegan entre sí y contra 3 y 4 de forma simétrica
const pd3 = [P(1, 'a', 'b'), P(2, 'c', 'd'), P(3, 'e', 'f'), P(4, 'g', 'h')];
const md3 = [
  M(1, 1, 2, 1, [[6, 3], [6, 3]]),   // 2 gana a 1
  M(2, 1, 1, 3, [[6, 3], [6, 3]]),   // 1 gana a 3
  M(3, 2, 4, 2, [[6, 3], [6, 3]]),   // 4 gana a 2
  M(4, 2, 3, 4, [[6, 3], [6, 3]]),   // 3 gana a 4
];
// 1: 1 pt, sets 2-2, games 18-18 ; 2: 1 pt, 2-2, 18-18 ; 3: 1, 2-2 ; 4: 1, 2-2. Todos empatados:
// directos dentro del grupo de 4: 1→1 (a 3), 2→1 (a 1), 3→1 (a 4), 4→1 (a 2). Todo 1 → por id.
const td3 = calcularTabla(pd3, md3);
prueba('cuádruple empate → id', td3.map((r) => r.id).join() === '1,2,3,4', td3);
// Empate solo de 2 (los otros distintos)
const md4 = [
  M(1, 1, 2, 1, [[6, 3], [6, 3]]),   // 2 gana a 1
  M(2, 1, 3, 4, [[6, 0], [6, 0]]),   // 3 gana a 4
  M(3, 2, 1, 4, [[6, 3], [6, 3]]),   // 1 gana a 4
  M(4, 2, 3, 2, [[6, 3], [6, 3]]),   // 3 gana a 2
];
// 1: 1 pt (2-2, 18-18). 2: 1 pt (2-2, 18-18). 3: 2 pts. 4: 0.
const td4 = calcularTabla(pd3, md4);
prueba('empate de dos: decide el directo (2 le ganó a 1)', td4.map((r) => r.id).join() === '3,2,1,4' && td4[2].desempate === 'enfrentamiento directo', td4.map((r) => [r.id, r.pts, r.ds, r.dg, r.dir, r.desempate]));

// Baja: la pareja no aparece, pero sus partidos cuentan para el rival
const pb = [P(1, 'a', 'b'), P(2, 'c', 'd', 'baja')];
const mb = [M(1, 1, 1, 2, [[6, 0], [6, 0]], { wo: true })];
const tb = calcularTabla(pb, mb);
prueba('baja fuera de la tabla, W.O. cuenta', tb.length === 1 && tb[0].pts === 1 && tb[0].gf === 12, tb);

prueba('pareja sin compañero no figura en la tabla', calcularTabla([P(1, 'a', 'b'), P(2, 'c', null)], []).length === 1);

// ---- Ranking
const jug = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8'].map((id) => ({ id, nombre: 'Jugador ' + id }));
const rk = calcularRanking(jug, parejas, partidos);
const r1 = rk.find((r) => r.id === 'j1');
// pareja 1: gana 2 sets (100), gana stb (80), pierde 2 sets (20) = 200
prueba('puntos LOB pareja 1 = 200', r1.pts === 200, r1);
prueba('j1 y j2 igual', rk.find((r) => r.id === 'j2').pts === 200);
const r5 = rk.find((r) => r.id === 'j5');
// pareja 3: gana 6-0 6-0 (100), pierde stb (40), pierde 2 sets (20) = 160
prueba('puntos LOB pareja 3 = 160', r5.pts === 160, r5);
prueba('racha de pareja 1 = 1 P', r1.racha.tipo === 'P' && r1.racha.n === 1, r1.racha);
const r3 = rk.find((r) => r.id === 'j3');
prueba('racha de pareja 2 = 2 G', r3.racha.tipo === 'G' && r3.racha.n === 2, r3.racha);
prueba('ranking ordenado por puntos', rk[0].pts >= rk[1].pts && rk[1].pts >= rk[2].pts);
// pareja 2: 20 + 100 + 100 = 220 → primero
prueba('primero del ranking es de pareja 2', ['j3', 'j4'].includes(rk[0].id) && rk[0].pts === 220, rk.slice(0, 2));
const mwo = { id: 9, fecha: 1, a: 1, b: 2, sets: [[6, 0], [6, 0]], wo: true, ganador: 1, estado: 'confirmado' };
prueba('W.O. a favor 100', puntosPartido(mwo, 'a') === 100);
prueba('W.O. en contra -30', puntosPartido(mwo, 'b') === -30);
// Jugador que cambia de pareja: suma en las dos
const pc = [P(1, 'x', 'y'), P(2, 'x', 'z'), P(3, 'w', 'v')];
const mc = [M(1, 1, 1, 3, [[6, 1], [6, 1]]), M(2, 2, 2, 3, [[6, 1], [6, 1]])];
const rkc = calcularRanking(['x', 'y', 'z', 'w', 'v'].map((id) => ({ id, nombre: id })), pc, mc);
prueba('jugador en dos parejas suma ambos', rkc.find((r) => r.id === 'x').pts === 200 && rkc.find((r) => r.id === 'x').pj === 2);

// ---- Otros
prueba('racha vacía', racha([]) === null);
prueba('wa 10 dígitos', numeroWhatsApp('351 618-3879') === '5493516183879');
prueba('wa 0351 15', numeroWhatsApp('0351 15 6183879') === '5493516183879');
prueba('wa 7 dígitos → 351', numeroWhatsApp('6183879') === '5493516183879');
prueba('wa +54 9', numeroWhatsApp('+54 9 351 6183879') === '5493516183879');
prueba('wa +54 sin 9', numeroWhatsApp('+54 351 6183879') === '5493516183879');
const ahora = Date.now();
prueba('vencidos', vencidos([{ estado: 'por_confirmar', vence_at: ahora - 1 }, { estado: 'por_confirmar', vence_at: ahora + 1000 }, { estado: 'confirmado', vence_at: ahora - 1 }], ahora).length === 1);
const rf = resumenFecha(partidos, 2);
prueba('resumen fecha 2: partidazo con stb', rf.partidazo && rf.partidazo.partido.id === 3 && rf.paliza.partido.id === 4, rf);
prueba('contarSets', JSON.stringify(contarSets([[6, 4], [3, 6], [11, 9]])) === JSON.stringify({ sa: 2, sb: 1, ga: 20, gb: 19 }));
prueba('config base', CONFIG_BASE.horas_autoconfirmar === 24 && CONFIG_BASE.puntos_victoria === 1);

console.log(`\n${ok} pruebas OK, ${mal} fallas`);
process.exit(mal ? 1 : 0);
