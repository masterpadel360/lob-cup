// Pruebas del modo demo (mismo flujo que la base real). Correr: node tests/demo.test.mjs
import { crearDemo } from '../js/datos-demo.js';
import { calcularTabla, calcularRanking } from '../js/logica.js';
let ok = 0, mal = 0;
const prueba = (n, c, x) => { if (c) ok++; else { mal++; console.log('FALLA:', n, x !== undefined ? JSON.stringify(x) : ''); } };
const falla = async (n, fn, txt) => { try { await fn(); prueba(n + ' (debía fallar)', false); } catch (e) { prueba(n, !txt || e.message.includes(txt), e.message); } };

const d = crearDemo();
let s = await d.cargar();
prueba('48 parejas completas + 1 esperando', s.parejas.filter((p) => p.jugador2).length === 48 && s.parejas.length === 49);
prueba('96+ jugadores', s.jugadores.length >= 97);
prueba('168 partidos', s.partidos.length === 168, s.partidos.length);
const nombres = s.jugadores.map((j) => j.nombre + ' ' + j.apellido);
prueba('nombres únicos', new Set(nombres).size === nombres.length);
const yo = s.yo;
const miPar = s.parejas.find((p) => p.jugador1 === yo || p.jugador2 === yo);
const mios = s.partidos.filter((m) => m.a === miPar.id || m.b === miPar.id);
const aConfirmar = mios.find((m) => m.estado === 'por_confirmar');
prueba('tengo un resultado para confirmar', aConfirmar && aConfirmar.cargado_pareja !== miPar.id);
prueba('hay una disputa', s.partidos.some((m) => m.estado === 'en_disputa'));

// No puedo confirmar algo que cargué yo / no puedo cargar partido ajeno
const ajeno = s.partidos.find((m) => m.a !== miPar.id && m.b !== miPar.id && m.estado === 'pendiente');
await falla('cargar partido ajeno', () => d.cargarResultado(ajeno.id, [[6, 4], [6, 4]]), 'Solo pueden');
await falla('set inválido', () => d.cargarResultado(mios.find((m) => m.estado === 'pendiente').id, [[6, 5], [6, 4]]), 'no es válido');

// Confirmo → la tabla cambia
const cat = miPar.categoria_id;
const pj0 = calcularTabla(s.parejas.filter((p) => p.categoria_id === cat), s.partidos.filter((m) => m.categoria_id === cat)).find((r) => r.id === miPar.id).pj;
await d.confirmarResultado(aConfirmar.id);
s = await d.cargar();
const pj1 = calcularTabla(s.parejas.filter((p) => p.categoria_id === cat), s.partidos.filter((m) => m.categoria_id === cat)).find((r) => r.id === miPar.id).pj;
prueba('confirmar suma un PJ en la tabla', pj1 === pj0 + 1, [pj0, pj1]);
await falla('confirmar dos veces', () => d.confirmarResultado(aConfirmar.id), 'no está esperando');

// Cargo mi próximo partido → no lo puedo confirmar yo → el rival confirma
const prox = s.partidos.filter((m) => (m.a === miPar.id || m.b === miPar.id) && m.estado === 'pendiente').sort((x, y) => x.fecha - y.fecha)[0];
const rk0 = calcularRanking(s.jugadores, s.parejas, s.partidos, s.config).find((r) => r.id === yo).pts;
const mioA = prox.a === miPar.id;
await d.cargarResultado(prox.id, mioA ? [[6, 2], [6, 3]] : [[2, 6], [3, 6]]);
await falla('auto-confirmar lo propio', () => d.confirmarResultado(prox.id), 'pareja rival');
d.demo.simularRival(prox.id, 'confirmar');
s = await d.cargar();
const rk1 = calcularRanking(s.jugadores, s.parejas, s.partidos, s.config).find((r) => r.id === yo).pts;
prueba('ganar 2 sets suma 100 en el ranking', rk1 === rk0 + 100, [rk0, rk1]);

// Disputa → organizador resuelve
const sig = s.partidos.filter((m) => (m.a === miPar.id || m.b === miPar.id) && m.estado === 'pendiente').sort((x, y) => x.fecha - y.fecha)[0];
await d.cargarResultado(sig.id, [[6, 4], [6, 4]]);
d.demo.simularRival(sig.id, 'disputar');
s = await d.cargarResultado; s = await d.cargar();
prueba('queda en disputa', s.partidos.find((m) => m.id === sig.id).estado === 'en_disputa');
await falla('jugador no resuelve', () => d.org.fijarResultado(sig.id, [[6, 4], [6, 4]]), 'Solo el organizador');
d.demo.verComo('org');
await d.org.fijarResultado(sig.id, [[4, 6], [6, 4], [11, 9]]);
s = await d.cargar();
const res = s.partidos.find((m) => m.id === sig.id);
prueba('organizador resolvió', res.estado === 'confirmado' && res.confirmado_via === 'organizador' && res.sets.length === 3);

// Auto-confirmación (con otra pareja que todavía tiene partidos)
const otro = s.partidos.find((m) => m.estado === 'pendiente' && m.a !== miPar.id && m.b !== miPar.id && m.categoria_id === 1);
const pa = s.parejas.find((p) => p.id === otro.a);
d.demo.verComo(pa.jugador1);
await d.cargarResultado(otro.id, [[6, 1], [6, 1]]);
const n = d.demo.adelantarHoras(25);
s = await d.cargar();
prueba('autoconfirmado a las 24 h', n >= 1 && s.partidos.find((m) => m.id === otro.id).confirmado_via === 'auto');
d.demo.verComo(yo);

// Reservas
const conTurno = s.partidos.find((m) => m.estado === 'pendiente' && m.categoria_id === 4 && !s.reservas.some((r) => r.partido_id === m.id && r.estado !== 'cancelada'));
d.demo.verComo(s.parejas.find((p) => p.id === conTurno.b).jugador2);
const hoy = new Date(); let f = null, t = null;
for (let i = 1; i < 8 && !t; i++) { const dd = new Date(hoy.getTime() + i * 864e5); t = s.turnos.find((x) => x.dia === dd.getDay()); if (t) f = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`; }
await d.reservarTurno(conTurno.id, f, t.inicio);
await falla('dos turnos para el mismo partido', () => d.reservarTurno(conTurno.id, f, t.inicio), 'ya tiene un turno');
s = await d.cargar();
prueba('reserva pendiente', s.reservas.some((r) => r.partido_id === conTurno.id && r.estado === 'pendiente'));

// Baja → W.O.
d.demo.verComo('org');
const victima = s.parejas.find((p) => p.categoria_id === 3 && p.jugador2);
const n2 = await d.org.bajaPareja(victima.id);
s = await d.cargar();
prueba('baja pasa pendientes a W.O.', n2 > 0 && s.partidos.filter((m) => (m.a === victima.id || m.b === victima.id)).every((m) => m.estado === 'confirmado'));
await falla('no rearma fixture con resultados', () => d.org.generarFixture(3), 'ya tiene resultados');

// Inscripción con código
d.demo.verComo(yo);
const libre = s.parejas.find((p) => !p.jugador2);
await falla('unirse a categoría de otro género', () => d.unirmeAPareja(libre.codigo), 'otro género');

console.log(`\n${ok} pruebas OK, ${mal} fallas`);
process.exit(mal ? 1 : 0);
