// Arma supabase/seed.sql con la MISMA liga de ejemplo que la demo.
// Uso: node herramientas/armar-seed.mjs
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarLiga, CATEGORIAS_BASE, TURNOS_BASE } from '../js/datos-demo.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = Date.now();
const d = generarLiga(AHORA);
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const uuid = (jid) => `'00000000-0000-4000-8000-${String(jid).replace(/\D/g, '').padStart(12, '0')}'`;
// Las fechas quedan relativas al momento en que se corre el seed (así "por confirmar" sigue vigente).
const ts = (ms) => (ms == null ? 'null' : `now() + interval '${Math.round((ms - AHORA) / 1000)} seconds'`);
const js = (v) => (v == null ? 'null' : `'${JSON.stringify(v)}'::jsonb`);

let s = `-- =====================================================================
-- LOB CUP — Datos iniciales. Correr DESPUÉS de schema.sql (SQL Editor → Run).
-- Generado con: node herramientas/armar-seed.mjs  (no editar a mano)
--
-- PARTE 1: categorías y grilla de turnos (esto sí va en la liga real).
-- PARTE 2: liga de PRUEBA con ${d.parejas.length} parejas y nombres INVENTADOS
--          (usuarios demoN@lobcup.test, contraseña demo1234). Borrala antes de
--          arrancar la temporada con el bloque del final.
-- =====================================================================

-- PARTE 1 --------------------------------------------------------------
insert into public.categorias (id, nombre, nivel, genero, orden) overriding system value values
${CATEGORIAS_BASE.map((c) => `  (${c.id}, ${q(c.nombre)}, ${c.nivel}, ${q(c.genero)}, ${c.orden})`).join(',\n')}
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.categorias', 'id'), greatest((select max(id) from public.categorias), 1));

insert into public.turnos (dia, inicio, fin, canchas) values
${TURNOS_BASE.map((t) => `  (${t.dia}, '${t.inicio}', '${t.fin === '24:00' ? '24:00:00' : t.fin}', ${t.canchas})`).join(',\n')}
on conflict (dia, inicio) do nothing;

-- PARTE 2 (prueba) -----------------------------------------------------
`;

const jugadores = d.jugadores.filter((j) => j.rol !== 'organizador');
s += `-- Usuarios de prueba (el perfil lo crea solo el trigger al_crear_usuario)
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) values
${jugadores.map((j) => `  ('00000000-0000-0000-0000-000000000000', ${uuid(j.id)}, 'authenticated', 'authenticated', 'demo${j.id.slice(1)}@lobcup.test', extensions.crypt('demo1234', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', ${q(JSON.stringify({ nombre: j.nombre, apellido: j.apellido, telefono: j.telefono, genero: j.genero }))}, now(), now(), '', '', '', '')`).join(',\n')}
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
from auth.users u where u.email like 'demo%@lobcup.test'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.parejas (id, categoria_id, jugador1, jugador2, estado) overriding system value values
${d.parejas.map((p) => `  (${p.id}, ${p.categoria_id}, ${uuid(p.jugador1)}, ${p.jugador2 ? uuid(p.jugador2) : 'null'}, ${q(p.estado)})`).join(',\n')}
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.parejas', 'id'), (select max(id) from public.parejas));
${d.parejas.filter((p) => p.codigo).map((p) => `insert into public.invitaciones (pareja_id, codigo) values (${p.id}, ${q(p.codigo)}) on conflict do nothing;`).join('\n')}

insert into public.partidos (id, categoria_id, fecha, pareja_a, pareja_b, estado, sets, wo, ganador, cargado_por, cargado_pareja, cargado_at, vence_at,
  confirmado_por, confirmado_at, confirmado_via, disputa_motivo, disputa_sets, disputa_por, disputa_at) overriding system value values
${d.partidos.map((m) => `  (${m.id}, ${m.categoria_id}, ${m.fecha}, ${m.a}, ${m.b}, ${q(m.estado)}, ${js(m.sets)}, ${m.wo}, ${m.ganador ?? 'null'}, ${m.cargado_por ? uuid(m.cargado_por) : 'null'}, ${m.cargado_pareja ?? 'null'}, ${ts(m.cargado_at)}, ${ts(m.vence_at)}, ${m.confirmado_por ? uuid(m.confirmado_por) : 'null'}, ${ts(m.confirmado_at)}, ${q(m.confirmado_via)}, ${q(m.disputa_motivo)}, ${js(m.disputa_sets)}, ${m.disputa_por ? uuid(m.disputa_por) : 'null'}, ${ts(m.disputa_at)})`).join(',\n')}
on conflict (id) do nothing;
select setval(pg_get_serial_sequence('public.partidos', 'id'), (select max(id) from public.partidos));

-- Reservas: se corren los días para que caigan desde hoy en adelante.
insert into public.reservas (partido_id, fecha, inicio, fin, cancha, estado, creada_por)
select x.partido_id, x.fecha, x.inicio, x.fin, x.cancha, x.estado, x.creada_por from (values
${d.reservas.map((r) => `  (${r.partido_id}, current_date + ${Math.round((new Date(r.fecha + 'T12:00:00') - new Date(new Date(AHORA).toDateString() + ' 12:00')) / 864e5)}, '${r.inicio}'::time, '${r.fin === '24:00' ? '24:00:00' : r.fin}'::time, ${r.cancha}, ${q(r.estado)}, ${uuid(r.creada_por)}::uuid)`).join(',\n')}
) as x(partido_id, fecha, inicio, fin, cancha, estado, creada_por)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- BORRAR LA LIGA DE PRUEBA (antes de arrancar en serio). Descomentá y corré:
-- delete from public.partidos;  delete from public.parejas;  delete from public.actividad;
-- delete from auth.users where email like 'demo%@lobcup.test';
-- ---------------------------------------------------------------------
`;
writeFileSync(join(raiz, 'supabase', 'seed.sql'), s);
console.log('supabase/seed.sql', Math.round(s.length / 1024) + ' KB', d.parejas.length, 'parejas', d.partidos.length, 'partidos');
