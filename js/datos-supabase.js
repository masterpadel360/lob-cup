// =====================================================================
// Capa de datos REAL (Supabase). Misma interfaz que datos-demo.js.
// Las escrituras de los jugadores van por las funciones (RPC) de schema.sql,
// que son las que validan permisos. Esta capa no "confía" en la pantalla.
// =====================================================================
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const ms = (t) => (t ? new Date(t).getTime() : null);
const hhmm = (t) => (t ? String(t).slice(0, 5) : t);

export async function crearSupabase(cfg) {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const ok = ({ data, error }) => { if (error) throw new Error(limpiar(error.message)); return data; };
  const rpc = async (fn, args) => ok(await sb.rpc(fn, args));

  async function cargar() {
    try { await sb.rpc('autoconfirmar_vencidos'); } catch (e) { /* no frena la carga */ }
    const { data: { session } } = await sb.auth.getSession();
    const uid = session ? session.user.id : null;
    const [config, categorias, publicos, perfiles, parejas, invit, partidos, turnos, reservas, actividad] = await Promise.all([
      sb.from('config').select('*').eq('id', 1).single().then(ok),
      sb.from('categorias').select('*').order('orden').then(ok),
      sb.from('jugadores_publicos').select('*').then(ok),
      uid ? sb.from('perfiles').select('*').then(ok) : [],
      sb.from('parejas').select('id,categoria_id,jugador1,jugador2,estado,creado_at').order('id').then(ok),
      uid ? sb.from('invitaciones').select('*').then(ok) : [],
      sb.from('partidos').select('*').order('id').then(ok),
      sb.from('turnos').select('*').order('dia').order('inicio').then(ok),
      sb.from('reservas').select('*').neq('estado', 'cancelada').then(ok),
      uid ? sb.from('actividad').select('*').order('at', { ascending: false }).limit(200).then(ok) : [],
    ]);
    const priv = new Map(perfiles.map((p) => [p.id, p]));
    const codigos = new Map(invit.map((i) => [i.pareja_id, i.codigo]));
    return {
      config,
      categorias,
      jugadores: publicos.map((j) => ({ id: j.id, nombre: j.nombre, apellido: j.apellido, genero: j.genero, telefono: (priv.get(j.id) || {}).telefono || '', rol: (priv.get(j.id) || {}).rol || 'jugador' })),
      parejas: parejas.map((p) => ({ ...p, creado_at: ms(p.creado_at), codigo: codigos.get(p.id) })),
      partidos: partidos.map((m) => ({ ...m, a: m.pareja_a, b: m.pareja_b, cargado_at: ms(m.cargado_at), vence_at: ms(m.vence_at), confirmado_at: ms(m.confirmado_at), disputa_at: ms(m.disputa_at) })),
      turnos: turnos.map((t) => ({ ...t, inicio: hhmm(t.inicio), fin: hhmm(t.fin) === '00:00' ? '24:00' : hhmm(t.fin) })),
      reservas: reservas.map((r) => ({ ...r, inicio: hhmm(r.inicio), fin: hhmm(r.fin), creada_at: ms(r.creada_at) })),
      actividad: actividad.map((a) => ({ ...a, at: ms(a.at) })),
      yo: uid,
      ahora: Date.now(),
    };
  }

  return {
    modo: 'supabase',
    cargar,
    async sesion() { const { data } = await sb.auth.getSession(); return data.session ? { id: data.session.user.id, email: data.session.user.email } : null; },
    onSesion(cb) { sb.auth.onAuthStateChange(() => cb()); },
    async entrar(email, clave) { ok(await sb.auth.signInWithPassword({ email, password: clave })); return true; },
    async registrarse({ email, clave, nombre, apellido, telefono, genero }) {
      ok(await sb.auth.signUp({ email, password: clave, options: { data: { nombre, apellido, telefono, genero }, emailRedirectTo: location.origin + location.pathname } }));
      return true;
    },
    async linkMagico(email) { ok(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } })); return true; },
    async salir() { await sb.auth.signOut(); return true; },
    cargarResultado: (id, sets, wo) => rpc('cargar_resultado', { p_partido: id, p_sets: sets, p_wo: !!wo }),
    confirmarResultado: (id) => rpc('confirmar_resultado', { p_partido: id }),
    disputarResultado: (id, motivo, sets) => rpc('disputar_resultado', { p_partido: id, p_motivo: motivo, p_sets: sets && sets.length ? sets : null }),
    reservarTurno: (id, fecha, inicio) => rpc('reservar_turno', { p_partido: id, p_fecha: fecha, p_inicio: inicio }),
    cancelarReserva: (rid) => rpc('cancelar_reserva', { p_reserva: rid }),
    async crearPareja(cat) { const d = await rpc('crear_pareja', { p_categoria: cat }); return d && d[0] ? d[0].codigo : ''; },
    unirmeAPareja: (codigo) => rpc('unirme_a_pareja', { p_codigo: codigo }),
    async actualizarPerfil(d) {
      const { data } = await sb.auth.getSession();
      ok(await sb.from('perfiles').update({ nombre: d.nombre, apellido: d.apellido, telefono: d.telefono }).eq('id', data.session.user.id));
      return true;
    },
    org: {
      fijarResultado: (id, sets, wo, g) => rpc('org_fijar_resultado', { p_partido: id, p_sets: wo ? null : sets, p_wo: !!wo, p_ganador_wo: wo ? g : null }),
      anularResultado: (id) => rpc('org_anular_resultado', { p_partido: id }),
      bajaPareja: (p) => rpc('org_baja_pareja', { p_pareja: p }),
      generarFixture: (c) => rpc('org_generar_fixture', { p_categoria: c }),
      confirmarReserva: (r) => rpc('org_confirmar_reserva', { p_reserva: r }),
      async guardarConfig(c) { ok(await sb.from('config').update({ ...c, actualizado_at: new Date().toISOString() }).eq('id', 1)); return true; },
      async guardarTurno(t) {
        if (t.borrar) ok(await sb.from('turnos').delete().eq('id', t.id));
        else ok(await sb.from('turnos').insert({ dia: Number(t.dia), inicio: t.inicio, fin: t.fin === '24:00' ? '24:00:00' : t.fin, canchas: Number(t.canchas) }));
        return true;
      },
      async agregarPareja() { throw new Error('En la app real cada jugador se registra y arma su pareja con el código de invitación.'); },
      async cambiarInscripcion(c, v) { ok(await sb.from('categorias').update({ inscripcion_abierta: !!v }).eq('id', c)); return true; },
      async cambiarFechaEnJuego(c, f) { ok(await sb.from('categorias').update({ fecha_en_juego: f ? Number(f) : null }).eq('id', c)); return true; },
    },
    demo: null,
  };
}

// Mensajes de Postgres/Supabase más amables.
function limpiar(msg) {
  const m = String(msg || 'Algo salió mal.');
  if (/Invalid login credentials/i.test(m)) return 'Mail o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'Confirmá tu mail con el link que te mandamos.';
  if (/User already registered/i.test(m)) return 'Ese mail ya tiene cuenta. Entrá con tu contraseña.';
  if (/Password should be/i.test(m)) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Muchos intentos seguidos. Esperá un minuto.';
  if (/duplicate key.*reservas_cancha/i.test(m)) return 'Ese turno se acaba de ocupar. Elegí otro.';
  return m;
}
