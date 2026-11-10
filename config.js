// =====================================================================
// Configuración de la app. Es lo único que hay que tocar para salir en vivo.
// - marca: el nombre de la liga (cambialo acá y cambia en toda la app).
// - supabaseUrl / supabaseAnonKey: de Supabase → Project Settings → API.
//   Si quedan vacías, la app arranca en MODO DEMO con datos inventados.
// La "anon key" es pública por diseño: la seguridad la ponen las reglas (RLS)
// de supabase/schema.sql. NUNCA pegues acá la "service_role" key.
// =====================================================================
window.LOB_CONFIG = {
  marca: 'LOB CUP',
  lema: 'Liga amateur de pádel · Córdoba',
  supabaseUrl: '',
  supabaseAnonKey: '',
};
