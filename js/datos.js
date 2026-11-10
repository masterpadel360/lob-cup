// Elige la capa de datos: Supabase si config.js tiene las claves; si no, DEMO.
export async function crearCapaDatos(cfg) {
  if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
    const m = await import('./datos-supabase.js');
    return m.crearSupabase(cfg);
  }
  const m = await import('./datos-demo.js');
  return m.crearDemo();
}
