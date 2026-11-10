-- =====================================================================
-- LOB CUP — Base de datos (Supabase / Postgres 15+)
-- Pegar entero en Supabase → SQL Editor → Run. Se puede volver a correr:
-- usa IF NOT EXISTS / CREATE OR REPLACE donde se puede.
--
-- Idea central ("liga autónoma"):
--   * Los jugadores NO escriben directo en las tablas. Todo lo que cambia
--     algo pasa por funciones (RPC) que validan quién sos y qué podés hacer.
--   * Cualquiera (aunque no tenga sesión) puede LEER fixture, tabla y ranking.
--   * Teléfonos: solo los ve el dueño, su compañero, sus rivales y el organizador.
--   * El organizador (perfiles.rol = 'organizador') puede todo.
-- Las reglas de tabla y ranking son las mismas que js/logica.js.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------
create table if not exists public.config (
  id                  int primary key default 1 check (id = 1),
  temporada           text not null default 'Temporada 2027',
  puntos_victoria     int  not null default 1,
  puntos_derrota      int  not null default 0,
  rk_gana_2sets       int  not null default 100,
  rk_gana_stb         int  not null default 80,
  rk_pierde_stb       int  not null default 40,
  rk_pierde_2sets     int  not null default 20,
  rk_wo_favor         int  not null default 100,
  rk_wo_contra        int  not null default -30,
  horas_autoconfirmar int  not null default 24 check (horas_autoconfirmar between 1 and 168),
  valor_turno         int  not null default 36000,
  monto_sena          int  not null default 9000,
  alias               text not null default 'lobcup.liga',
  ventana_dias        int  not null default 14 check (ventana_dias between 1 and 60),
  whatsapp_org        text not null default '',
  actualizado_at      timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict (id) do nothing;

create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text not null default '' check (length(nombre) <= 60),
  apellido   text not null default '' check (length(apellido) <= 60),
  telefono   text not null default '' check (length(telefono) <= 30),
  genero     text check (genero in ('M', 'F')),
  rol        text not null default 'jugador' check (rol in ('jugador', 'organizador')),
  creado_at  timestamptz not null default now()
);

create table if not exists public.categorias (
  id                  bigint generated always as identity primary key,
  nombre              text not null unique,          -- '7.ª Masculino'
  nivel               int  not null,                 -- 6, 7, 8
  genero              text not null check (genero in ('M', 'F')),
  orden               int  not null default 0,
  inscripcion_abierta boolean not null default true,
  fecha_en_juego      int                            -- hasta qué fecha se puede reservar (null = todas)
);

create table if not exists public.parejas (
  id            bigint generated always as identity primary key,
  categoria_id  bigint not null references public.categorias (id),
  jugador1      uuid   not null references public.perfiles (id),
  jugador2      uuid   references public.perfiles (id),        -- null = esperando compañero
  estado        text   not null default 'activa' check (estado in ('activa', 'baja')),
  creado_at     timestamptz not null default now(),
  check (jugador2 is null or jugador1 <> jugador2)
);
create index if not exists parejas_cat_idx on public.parejas (categoria_id, estado);

-- Código para que el compañero se sume. Tabla aparte para que NO sea pública.
create table if not exists public.invitaciones (
  pareja_id  bigint primary key references public.parejas (id) on delete cascade,
  codigo     text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6))
);

create table if not exists public.partidos (
  id              bigint generated always as identity primary key,
  categoria_id    bigint not null references public.categorias (id),
  fecha           int    not null check (fecha > 0),
  pareja_a        bigint not null references public.parejas (id),
  pareja_b        bigint not null references public.parejas (id),
  estado          text   not null default 'pendiente'
                  check (estado in ('pendiente', 'por_confirmar', 'en_disputa', 'confirmado')),
  sets            jsonb  not null default '[]'::jsonb,       -- [[6,4],[3,6],[11,9]] visto desde la pareja A
  wo              boolean not null default false,
  ganador         bigint references public.parejas (id),
  cargado_por     uuid references public.perfiles (id),
  cargado_pareja  bigint references public.parejas (id),
  cargado_at      timestamptz,
  vence_at        timestamptz,                               -- se autoconfirma a esta hora
  confirmado_por  uuid references public.perfiles (id),
  confirmado_at   timestamptz,
  confirmado_via  text check (confirmado_via in ('rival', 'auto', 'organizador')),
  disputa_motivo  text check (length(disputa_motivo) <= 300),
  disputa_sets    jsonb,
  disputa_por     uuid references public.perfiles (id),
  disputa_at      timestamptz,
  editado_por_org boolean not null default false,
  check (pareja_a <> pareja_b),
  check (ganador is null or ganador in (pareja_a, pareja_b)),
  check (estado = 'pendiente' or ganador is not null),
  unique (categoria_id, fecha, pareja_a, pareja_b)
);
create index if not exists partidos_cat_idx on public.partidos (categoria_id, fecha);
create index if not exists partidos_a_idx on public.partidos (pareja_a);
create index if not exists partidos_b_idx on public.partidos (pareja_b);
create index if not exists partidos_vence_idx on public.partidos (vence_at) where estado = 'por_confirmar';

-- Grilla semanal de turnos de la liga. dia: 0 = domingo ... 6 = sábado
create table if not exists public.turnos (
  id       bigint generated always as identity primary key,
  dia      smallint not null check (dia between 0 and 6),
  inicio   time not null,
  fin      time not null,
  canchas  int  not null check (canchas between 1 and 20),
  unique (dia, inicio)
);

create table if not exists public.reservas (
  id          bigint generated always as identity primary key,
  partido_id  bigint not null references public.partidos (id) on delete cascade,
  fecha       date not null,
  inicio      time not null,
  fin         time not null,
  cancha      int  not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'confirmada', 'cancelada')),
  creada_por  uuid references public.perfiles (id),
  creada_at   timestamptz not null default now()
);
-- Nunca dos reservas vivas en la misma cancha y horario, ni dos para el mismo partido.
create unique index if not exists reservas_cancha_uq on public.reservas (fecha, inicio, cancha) where estado <> 'cancelada';
create unique index if not exists reservas_partido_uq on public.reservas (partido_id) where estado <> 'cancelada';

create table if not exists public.actividad (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       uuid,                 -- null = automático
  tipo        text not null,
  partido_id  bigint,
  detalle     jsonb not null default '{}'::jsonb
);
create index if not exists actividad_at_idx on public.actividad (at desc);

-- ---------------------------------------------------------------------
-- 2. Funciones auxiliares
-- ---------------------------------------------------------------------
create or replace function public.es_organizador()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'organizador');
$$;

-- Pareja del usuario actual dentro de un partido (null si no juega).
create or replace function public.mi_pareja_en(p_partido bigint)
returns bigint language sql stable security definer set search_path = public, pg_temp as $$
  select pa.id
  from public.partidos m
  join public.parejas pa on pa.id in (m.pareja_a, m.pareja_b)
  where m.id = p_partido and auth.uid() is not null and auth.uid() in (pa.jugador1, pa.jugador2)
  limit 1;
$$;

-- ¿El usuario actual puede ver el teléfono de otro? (es él, compañero o rival)
create or replace function public.puede_ver_contacto(p_otro uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    p_otro = auth.uid()
    or public.es_organizador()
    or exists (select 1 from public.parejas p
               where p.estado = 'activa' and auth.uid() in (p.jugador1, p.jugador2) and p_otro in (p.jugador1, p.jugador2))
    or exists (select 1 from public.partidos m
               join public.parejas yo on yo.id in (m.pareja_a, m.pareja_b)
               join public.parejas el on el.id in (m.pareja_a, m.pareja_b) and el.id <> yo.id
               where auth.uid() in (yo.jugador1, yo.jugador2) and p_otro in (el.jugador1, el.jugador2))
  );
$$;

create or replace function public.registrar(p_tipo text, p_partido bigint, p_detalle jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.actividad (actor, tipo, partido_id, detalle) values (auth.uid(), p_tipo, p_partido, coalesce(p_detalle, '{}'::jsonb));
$$;

-- Sets válidos: 1 y 2 de 6-0 a 6-4, 7-5, 7-6. Set 3 = súper tie-break a 11 con diferencia de 2.
create or replace function public.set_valido(a int, b int, n int)
returns boolean language sql immutable as $$
  select coalesce(a >= 0 and b >= 0 and a <> b and
    case when n = 3
      then greatest(a, b) >= 11 and abs(a - b) >= 2 and (greatest(a, b) = 11 or abs(a - b) = 2)
      else (greatest(a, b) = 6 and least(a, b) <= 4) or (greatest(a, b) = 7 and least(a, b) in (5, 6))
    end, false);
$$;

-- Devuelve 'a' o 'b' (quién ganó) o tira un error con un mensaje claro.
create or replace function public.ganador_sets(p_sets jsonb)
returns text language plpgsql immutable as $$
declare
  n int; i int; a int[] := '{}'; b int[] := '{}'; g1 text; g2 text;
begin
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then raise exception 'Resultado inválido.'; end if;
  n := jsonb_array_length(p_sets);
  if n < 2 or n > 3 then raise exception 'Cargá 2 sets (o 3 si hubo súper tie-break).'; end if;
  for i in 0 .. n - 1 loop
    if jsonb_typeof(p_sets -> i) <> 'array' or jsonb_array_length(p_sets -> i) <> 2
       or jsonb_typeof(p_sets -> i -> 0) <> 'number' or jsonb_typeof(p_sets -> i -> 1) <> 'number' then
      raise exception 'Resultado inválido.';
    end if;
    a := a || (p_sets -> i ->> 0)::int;
    b := b || (p_sets -> i ->> 1)::int;
    if not public.set_valido(a[i + 1], b[i + 1], i + 1) then
      raise exception 'El set % (%-%) no es válido.', i + 1, a[i + 1], b[i + 1];
    end if;
  end loop;
  g1 := case when a[1] > b[1] then 'a' else 'b' end;
  g2 := case when a[2] > b[2] then 'a' else 'b' end;
  if g1 = g2 then
    if n = 3 then raise exception 'Si una pareja ganó los dos primeros sets, no hay súper tie-break.'; end if;
    return g1;
  end if;
  if n < 3 then raise exception 'Van 1 set a 1: falta el súper tie-break.'; end if;
  return case when a[3] > b[3] then 'a' else 'b' end;
end;
$$;

-- 6-0 6-0 a favor de una pareja, visto desde la pareja A del partido.
create or replace function public.sets_wo(p_ganador_es_a boolean)
returns jsonb language sql immutable as $$
  select case when p_ganador_es_a then '[[6,0],[6,0]]'::jsonb else '[[0,6],[0,6]]'::jsonb end;
$$;

-- ---------------------------------------------------------------------
-- 3. Triggers
-- ---------------------------------------------------------------------
-- Perfil automático al registrarse (nombre, apellido, teléfono y género del formulario).
-- El rol SIEMPRE arranca en 'jugador': lo que mande el usuario no lo cambia.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.perfiles (id, nombre, apellido, telefono, genero)
  values (new.id,
          left(coalesce(new.raw_user_meta_data ->> 'nombre', ''), 60),
          left(coalesce(new.raw_user_meta_data ->> 'apellido', ''), 60),
          left(coalesce(new.raw_user_meta_data ->> 'telefono', ''), 30),
          case when new.raw_user_meta_data ->> 'genero' in ('M', 'F') then new.raw_user_meta_data ->> 'genero' end)
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_perfil();

-- Un jugador, una sola pareja activa por categoría.
create or replace function public.parejas_unica()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.estado = 'activa' and exists (
    select 1 from public.parejas p
    where p.id <> new.id and p.categoria_id = new.categoria_id and p.estado = 'activa'
      and (new.jugador1 in (p.jugador1, p.jugador2) or (new.jugador2 is not null and new.jugador2 in (p.jugador1, p.jugador2)))
  ) then
    raise exception 'Ese jugador ya tiene pareja en esta categoría.';
  end if;
  return new;
end;
$$;
drop trigger if exists parejas_unica on public.parejas;
create trigger parejas_unica before insert or update on public.parejas for each row execute function public.parejas_unica();

-- Un partido sólo puede ser entre parejas de su categoría.
create or replace function public.partidos_categoria()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.parejas where id in (new.pareja_a, new.pareja_b) and categoria_id = new.categoria_id) <> 2 then
    raise exception 'Las dos parejas tienen que ser de la categoría del partido.';
  end if;
  return new;
end;
$$;
drop trigger if exists partidos_categoria on public.partidos;
create trigger partidos_categoria before insert or update of pareja_a, pareja_b, categoria_id on public.partidos
  for each row execute function public.partidos_categoria();

-- ---------------------------------------------------------------------
-- 4. Tabla de posiciones y ranking (cálculo en la base)
-- ---------------------------------------------------------------------
-- Por pareja. Orden: puntos, dif. sets, dif. games, enfrentamiento directo
-- (ganados contra las empatadas en todo lo anterior), orden de inscripción.
create or replace function public.tabla_categoria(p_categoria bigint)
returns table (pos int, pareja_id bigint, pj int, pg int, pp int, pts int,
               sf int, sc int, ds int, gf int, gc int, dg int, dir int)
language sql stable security invoker set search_path = public, pg_temp as $$
  with cfg as (select puntos_victoria pv, puntos_derrota pd from public.config where id = 1),
  activas as (select id from public.parejas where categoria_id = p_categoria and estado = 'activa' and jugador2 is not null),
  tot as (
    select m.id, m.pareja_a, m.pareja_b, m.ganador,
           sum(case when (x ->> 0)::int > (x ->> 1)::int then 1 else 0 end)::int sa,
           sum(case when (x ->> 0)::int < (x ->> 1)::int then 1 else 0 end)::int sb,
           sum((x ->> 0)::int)::int ga,
           sum((x ->> 1)::int)::int gb
    from public.partidos m cross join lateral jsonb_array_elements(m.sets) x
    where m.categoria_id = p_categoria and m.estado = 'confirmado' and m.ganador is not null
    group by m.id, m.pareja_a, m.pareja_b, m.ganador
  ),
  lados as (
    select pareja_a pid, pareja_b rival, ganador = pareja_a gano, sa sf, sb sc, ga gf, gb gc from tot
    union all
    select pareja_b, pareja_a, ganador = pareja_b, sb, sa, gb, ga from tot
  ),
  agg as (
    select a.id pid,
           count(l.pid)::int pj,
           count(l.pid) filter (where l.gano)::int pg,
           count(l.pid) filter (where not l.gano)::int pp,
           coalesce(sum(l.sf), 0)::int sf, coalesce(sum(l.sc), 0)::int sc,
           coalesce(sum(l.gf), 0)::int gf, coalesce(sum(l.gc), 0)::int gc
    from activas a left join lados l on l.pid = a.id
    group by a.id
  ),
  agg2 as (
    select agg.*, (agg.pg * cfg.pv + agg.pp * cfg.pd)::int pts, agg.sf - agg.sc ds, agg.gf - agg.gc dg
    from agg cross join cfg
  ),
  dir as (
    select x.pid, count(l.pid)::int dir
    from agg2 x
    left join lados l on l.pid = x.pid and l.gano and l.rival in (
      select y.pid from agg2 y where y.pid <> x.pid and y.pts = x.pts and y.ds = x.ds and y.dg = x.dg)
    group by x.pid
  )
  select (row_number() over (order by x.pts desc, x.ds desc, x.dg desc, d.dir desc, x.pid))::int,
         x.pid, x.pj, x.pg, x.pp, x.pts, x.sf, x.sc, x.ds, x.gf, x.gc, x.dg, d.dir
  from agg2 x join dir d on d.pid = x.pid
  order by 1;
$$;

-- Nombres públicos (sin teléfono). La vista corre con permisos del dueño a propósito:
-- expone SOLO estas columnas de perfiles.
create or replace view public.jugadores_publicos as
  select id, nombre, apellido, genero from public.perfiles;

create or replace view public.v_tabla with (security_invoker = on) as
  select c.id categoria_id, t.*
  from public.categorias c cross join lateral public.tabla_categoria(c.id) t;

-- Puntos LOB por jugador. Orden: puntos, ganados, dif. sets, dif. games, nombre.
create or replace function public.ranking_jugadores()
returns table (pos int, jugador_id uuid, nombre text, genero text, pts int, pj int, pg int, pp int,
               sf int, sc int, ds int, gf int, gc int, dg int)
language sql stable security invoker set search_path = public, pg_temp as $$
  with cfg as (select * from public.config where id = 1),
  tot as (
    select m.id, m.pareja_a, m.pareja_b, m.ganador, m.wo, jsonb_array_length(m.sets) nsets,
           sum(case when (x ->> 0)::int > (x ->> 1)::int then 1 else 0 end)::int sa,
           sum(case when (x ->> 0)::int < (x ->> 1)::int then 1 else 0 end)::int sb,
           sum((x ->> 0)::int)::int ga,
           sum((x ->> 1)::int)::int gb
    from public.partidos m cross join lateral jsonb_array_elements(m.sets) x
    where m.estado = 'confirmado' and m.ganador is not null
    group by m.id
  ),
  lados as (
    select pareja_a pid, ganador = pareja_a gano, sa sf, sb sc, ga gf, gb gc, wo, nsets from tot
    union all
    select pareja_b, ganador = pareja_b, sb, sa, gb, ga, wo, nsets from tot
  ),
  pts as (
    select l.*,
      case when l.wo then (case when l.gano then c.rk_wo_favor else c.rk_wo_contra end)
           when l.gano then (case when l.nsets >= 3 then c.rk_gana_stb else c.rk_gana_2sets end)
           else (case when l.nsets >= 3 then c.rk_pierde_stb else c.rk_pierde_2sets end) end p
    from lados l cross join cfg c
  ),
  porjug as (
    select j.jid, pts.*
    from pts join public.parejas pa on pa.id = pts.pid
    cross join lateral (values (pa.jugador1), (pa.jugador2)) j(jid)
    where j.jid is not null
  ),
  agg as (
    select jid, sum(p)::int pts, count(*)::int pj, count(*) filter (where gano)::int pg, count(*) filter (where not gano)::int pp,
           sum(sf)::int sf, sum(sc)::int sc, sum(gf)::int gf, sum(gc)::int gc
    from porjug group by jid
  )
  select (row_number() over (order by a.pts desc, a.pg desc, a.sf - a.sc desc, a.gf - a.gc desc, trim(j.nombre || ' ' || j.apellido), a.jid))::int,
         a.jid, trim(j.nombre || ' ' || j.apellido), j.genero, a.pts, a.pj, a.pg, a.pp,
         a.sf, a.sc, a.sf - a.sc, a.gf, a.gc, a.gf - a.gc
  from agg a join public.jugadores_publicos j on j.id = a.jid
  order by 1;
$$;

-- ---------------------------------------------------------------------
-- 5. Acciones de los jugadores (RPC)
-- ---------------------------------------------------------------------
-- Cargar resultado (o W.O. a favor si el rival no se presentó). Queda "por confirmar".
create or replace function public.cargar_resultado(p_partido bigint, p_sets jsonb, p_wo boolean default false)
returns public.partidos language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m public.partidos; mi bigint; g text; horas int;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para cargar resultados.'; end if;
  select * into m from public.partidos where id = p_partido for update;
  if not found then raise exception 'Ese partido no existe.'; end if;
  mi := public.mi_pareja_en(p_partido);
  if mi is null then raise exception 'Solo pueden cargar el resultado los que juegan el partido.'; end if;
  if exists (select 1 from public.parejas where id in (m.pareja_a, m.pareja_b) and estado <> 'activa') then
    raise exception 'Una de las parejas está dada de baja. Lo resuelve el organizador.';
  end if;
  if m.estado = 'confirmado' then raise exception 'Este resultado ya está confirmado. Si hay un error, avisale al organizador.'; end if;
  if m.estado = 'en_disputa' then raise exception 'Este resultado está en revisión del organizador.'; end if;
  if m.estado = 'por_confirmar' and m.cargado_pareja <> mi then
    raise exception 'Tu rival ya cargó el resultado: confirmalo o marcá que no es así.';
  end if;
  if coalesce(p_wo, false) then
    p_sets := public.sets_wo(mi = m.pareja_a);
    g := case when mi = m.pareja_a then 'a' else 'b' end;
  else
    g := public.ganador_sets(p_sets);
  end if;
  select horas_autoconfirmar into horas from public.config where id = 1;
  update public.partidos set
    estado = 'por_confirmar', sets = p_sets, wo = coalesce(p_wo, false),
    ganador = case when g = 'a' then pareja_a else pareja_b end,
    cargado_por = auth.uid(), cargado_pareja = mi, cargado_at = now(),
    vence_at = now() + make_interval(hours => horas),
    confirmado_por = null, confirmado_at = null, confirmado_via = null,
    disputa_motivo = null, disputa_sets = null, disputa_por = null, disputa_at = null
  where id = p_partido returning * into m;
  perform public.registrar(case when p_wo then 'wo_cargado' else 'resultado_cargado' end, p_partido, jsonb_build_object('sets', p_sets));
  return m;
end;
$$;

-- Solo un jugador de la pareja RIVAL de la que cargó puede confirmar.
create or replace function public.confirmar_resultado(p_partido bigint)
returns public.partidos language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.partidos; mi bigint;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select * into m from public.partidos where id = p_partido for update;
  if not found then raise exception 'Ese partido no existe.'; end if;
  if m.estado <> 'por_confirmar' then raise exception 'Este resultado no está esperando confirmación.'; end if;
  mi := public.mi_pareja_en(p_partido);
  if mi is null or mi = m.cargado_pareja then raise exception 'Lo confirma la pareja rival de la que lo cargó.'; end if;
  update public.partidos set estado = 'confirmado', confirmado_por = auth.uid(), confirmado_at = now(), confirmado_via = 'rival'
  where id = p_partido returning * into m;
  perform public.registrar('resultado_confirmado', p_partido);
  return m;
end;
$$;

-- "No es así": pasa al organizador. Se puede proponer el resultado correcto.
create or replace function public.disputar_resultado(p_partido bigint, p_motivo text, p_sets jsonb default null)
returns public.partidos language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.partidos; mi bigint;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select * into m from public.partidos where id = p_partido for update;
  if not found then raise exception 'Ese partido no existe.'; end if;
  if m.estado <> 'por_confirmar' then raise exception 'Este resultado no está esperando confirmación.'; end if;
  mi := public.mi_pareja_en(p_partido);
  if mi is null or mi = m.cargado_pareja then raise exception 'Lo puede objetar la pareja rival de la que lo cargó.'; end if;
  if p_sets is not null and jsonb_typeof(p_sets) = 'array' and jsonb_array_length(p_sets) > 0 then
    perform public.ganador_sets(p_sets);      -- valida
  else
    p_sets := null;
  end if;
  update public.partidos set estado = 'en_disputa', disputa_motivo = left(coalesce(p_motivo, ''), 300),
    disputa_sets = p_sets, disputa_por = auth.uid(), disputa_at = now()
  where id = p_partido returning * into m;
  perform public.registrar('resultado_disputado', p_partido, jsonb_build_object('motivo', p_motivo, 'sets', p_sets));
  return m;
end;
$$;

-- Auto-confirmación: la puede llamar cualquiera (no hace nada que no corresponda).
-- Programala con pg_cron (ver LEEME.md) y además la app la llama al abrir.
create or replace function public.autoconfirmar_vencidos()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  with x as (
    update public.partidos set estado = 'confirmado', confirmado_at = now(), confirmado_via = 'auto', confirmado_por = null
    where estado = 'por_confirmar' and vence_at <= now()
    returning id
  ), l as (
    insert into public.actividad (actor, tipo, partido_id) select null, 'resultado_autoconfirmado', id from x returning 1
  )
  select count(*) into n from l;
  return n;
end;
$$;

-- Inscribirse: crea la pareja con vos como jugador 1 y devuelve el código para tu compañero.
create or replace function public.crear_pareja(p_categoria bigint)
returns table (pareja_id bigint, codigo text) language plpgsql security definer set search_path = public, pg_temp as $$
declare c public.categorias; g text; nueva bigint;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select * into c from public.categorias where id = p_categoria;
  if not found then raise exception 'Esa categoría no existe.'; end if;
  if not c.inscripcion_abierta then raise exception 'La inscripción de % está cerrada.', c.nombre; end if;
  select genero into g from public.perfiles where id = auth.uid();
  if g is not null and g <> c.genero then raise exception 'Esa categoría es de otro género.'; end if;
  insert into public.parejas (categoria_id, jugador1) values (p_categoria, auth.uid()) returning id into nueva;
  insert into public.invitaciones (pareja_id) values (nueva);
  perform public.registrar('pareja_creada', null, jsonb_build_object('pareja', nueva));
  return query select i.pareja_id, i.codigo from public.invitaciones i where i.pareja_id = nueva;
end;
$$;

create or replace function public.unirme_a_pareja(p_codigo text)
returns bigint language plpgsql security definer set search_path = public, pg_temp as $$
declare p public.parejas; c public.categorias; g text;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select pa.* into p from public.parejas pa join public.invitaciones i on i.pareja_id = pa.id
  where i.codigo = upper(trim(p_codigo)) for update of pa;
  if not found then raise exception 'Ese código no existe.'; end if;
  if p.estado <> 'activa' or p.jugador2 is not null then raise exception 'Esa pareja ya está completa.'; end if;
  if p.jugador1 = auth.uid() then raise exception 'No podés ser tu propio compañero.'; end if;
  select * into c from public.categorias where id = p.categoria_id;
  select genero into g from public.perfiles where id = auth.uid();
  if g is not null and g <> c.genero then raise exception 'Esa categoría es de otro género.'; end if;
  update public.parejas set jugador2 = auth.uid() where id = p.id;
  delete from public.invitaciones where pareja_id = p.id;
  perform public.registrar('pareja_completa', null, jsonb_build_object('pareja', p.id));
  return p.id;
end;
$$;

-- Reservar un turno de la grilla para un partido. Queda "pendiente" hasta que el
-- organizador ve la seña y la confirma.
create or replace function public.reservar_turno(p_partido bigint, p_fecha date, p_inicio time)
returns public.reservas language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m public.partidos; t public.turnos; cfg public.config; hoy date; libre int; r public.reservas; fej int;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select * into m from public.partidos where id = p_partido for update;
  if not found then raise exception 'Ese partido no existe.'; end if;
  if public.mi_pareja_en(p_partido) is null and not public.es_organizador() then
    raise exception 'Solo reservan los que juegan el partido.';
  end if;
  if m.estado = 'confirmado' then raise exception 'Este partido ya se jugó.'; end if;
  select fecha_en_juego into fej from public.categorias where id = m.categoria_id;
  if fej is not null and m.fecha > fej then raise exception 'Esta fecha todavía no está habilitada para reservar.'; end if;
  select * into cfg from public.config where id = 1;
  hoy := (now() at time zone 'America/Argentina/Cordoba')::date;
  if p_fecha < hoy or p_fecha > hoy + cfg.ventana_dias then raise exception 'Se reserva de hoy a % días.', cfg.ventana_dias; end if;
  if (p_fecha + p_inicio) <= (now() at time zone 'America/Argentina/Cordoba') then raise exception 'Ese horario ya pasó.'; end if;
  select * into t from public.turnos where dia = extract(dow from p_fecha)::int and inicio = p_inicio;
  if not found then raise exception 'Ese horario no está en la grilla de la liga.'; end if;
  if exists (select 1 from public.reservas where partido_id = p_partido and estado <> 'cancelada') then
    raise exception 'Este partido ya tiene un turno. Cancelalo antes de pedir otro.';
  end if;
  -- Para que dos reservas simultáneas no elijan la misma cancha.
  perform pg_advisory_xact_lock(hashtext('turno:' || p_fecha || ' ' || p_inicio));
  select min(c) into libre from generate_series(1, t.canchas) c
  where not exists (select 1 from public.reservas r2 where r2.fecha = p_fecha and r2.inicio = p_inicio and r2.cancha = c and r2.estado <> 'cancelada');
  if libre is null then raise exception 'Ese turno se llenó. Elegí otro.'; end if;
  insert into public.reservas (partido_id, fecha, inicio, fin, cancha, creada_por)
  values (p_partido, p_fecha, p_inicio, t.fin, libre, auth.uid()) returning * into r;
  perform public.registrar('turno_reservado', p_partido, jsonb_build_object('fecha', p_fecha, 'inicio', p_inicio, 'cancha', libre));
  return r;
end;
$$;

create or replace function public.cancelar_reserva(p_reserva bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r public.reservas;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión.'; end if;
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.estado = 'cancelada' then raise exception 'Esa reserva no existe.'; end if;
  if not public.es_organizador() then
    if public.mi_pareja_en(r.partido_id) is null then raise exception 'Solo la cancelan los que juegan el partido.'; end if;
    if r.estado = 'confirmada' then raise exception 'El turno ya está confirmado: para cancelarlo hablá con el organizador.'; end if;
  end if;
  update public.reservas set estado = 'cancelada' where id = p_reserva;
  perform public.registrar('turno_cancelado', r.partido_id, jsonb_build_object('reserva', p_reserva));
end;
$$;

-- Lo que el jugador tiene que hacer (base para notificaciones push o mails).
create or replace function public.mis_pendientes()
returns table (tipo text, partido_id bigint, detalle text)
language sql stable security definer set search_path = public, pg_temp as $$
  with mias as (select id from public.parejas where estado = 'activa' and auth.uid() in (jugador1, jugador2)),
  mp as (select m.*, (select id from mias where id in (m.pareja_a, m.pareja_b) limit 1) mia
         from public.partidos m where m.pareja_a in (select id from mias) or m.pareja_b in (select id from mias))
  select 'confirmar_resultado', id, 'Tu rival cargó un resultado: confirmalo antes de ' || to_char(vence_at at time zone 'America/Argentina/Cordoba', 'DD/MM HH24:MI')
    from mp where estado = 'por_confirmar' and cargado_pareja <> mia
  union all
  select 'esperando_rival', id, 'Esperando que tu rival confirme el resultado.' from mp where estado = 'por_confirmar' and cargado_pareja = mia
  union all
  select 'en_disputa', id, 'Resultado en revisión del organizador.' from mp where estado = 'en_disputa'
  union all
  select 'reservar', id, 'Fecha ' || fecha || ': coordiná con tu rival y reservá turno.'
    from mp where estado = 'pendiente' and not exists (select 1 from public.reservas r where r.partido_id = mp.id and r.estado <> 'cancelada')
     and fecha = (select min(fecha) from mp m2 where m2.estado = 'pendiente')
  union all
  select 'cargar_resultado', mp.id, 'Ya jugaste: cargá el resultado.'
    from mp join public.reservas r on r.partido_id = mp.id and r.estado <> 'cancelada'
    where mp.estado = 'pendiente' and (r.fecha + r.fin) < (now() at time zone 'America/Argentina/Cordoba');
$$;

-- ---------------------------------------------------------------------
-- 6. Acciones del organizador (RPC). Todas chequean es_organizador().
-- ---------------------------------------------------------------------
create or replace function public.org_fijar_resultado(p_partido bigint, p_sets jsonb, p_wo boolean default false, p_ganador_wo bigint default null)
returns public.partidos language plpgsql security definer set search_path = public, pg_temp as $$
declare m public.partidos; g text; antes text;
begin
  if not public.es_organizador() then raise exception 'Solo el organizador.'; end if;
  select * into m from public.partidos where id = p_partido for update;
  if not found then raise exception 'Ese partido no existe.'; end if;
  antes := m.estado;
  if coalesce(p_wo, false) then
    if p_ganador_wo is null or p_ganador_wo not in (m.pareja_a, m.pareja_b) then raise exception 'Elegí quién gana por W.O.'; end if;
    p_sets := public.sets_wo(p_ganador_wo = m.pareja_a);
    g := case when p_ganador_wo = m.pareja_a then 'a' else 'b' end;
  else
    g := public.ganador_sets(p_sets);
  end if;
  update public.partidos set estado = 'confirmado', sets = p_sets, wo = coalesce(p_wo, false),
    ganador = case when g = 'a' then pareja_a else pareja_b end,
    confirmado_por = auth.uid(), confirmado_at = now(), confirmado_via = 'organizador', editado_por_org = true,
    cargado_at = coalesce(cargado_at, now())
  where id = p_partido returning * into m;
  perform public.registrar('resultado_fijado_org', p_partido, jsonb_build_object('sets', p_sets, 'antes', antes));
  return m;
end;
$$;

create or replace function public.org_anular_resultado(p_partido bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.es_organizador() then raise exception 'Solo el organizador.'; end if;
  update public.partidos set estado = 'pendiente', sets = '[]'::jsonb, wo = false, ganador = null,
    cargado_por = null, cargado_pareja = null, cargado_at = null, vence_at = null,
    confirmado_por = null, confirmado_at = null, confirmado_via = null,
    disputa_motivo = null, disputa_sets = null, disputa_por = null, disputa_at = null
  where id = p_partido;
  perform public.registrar('resultado_anulado', p_partido);
end;
$$;

-- Baja: lo jugado queda; lo que falta pasa a W.O. 6-0 6-0 para el rival (regla de la liga).
create or replace function public.org_baja_pareja(p_pareja bigint)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  if not public.es_organizador() then raise exception 'Solo el organizador.'; end if;
  update public.parejas set estado = 'baja' where id = p_pareja;
  with x as (
    update public.partidos m set estado = 'confirmado', wo = true,
      ganador = case when m.pareja_a = p_pareja then m.pareja_b else m.pareja_a end,
      sets = public.sets_wo(m.pareja_b = p_pareja),
      confirmado_por = auth.uid(), confirmado_at = now(), confirmado_via = 'organizador', editado_por_org = true
    where p_pareja in (m.pareja_a, m.pareja_b) and m.estado <> 'confirmado'
    returning id
  ) select count(*) into n from x;
  update public.reservas set estado = 'cancelada'
  where estado <> 'cancelada' and partido_id in (select id from public.partidos where p_pareja in (pareja_a, pareja_b) and wo);
  perform public.registrar('pareja_baja', null, jsonb_build_object('pareja', p_pareja, 'wo', n));
  return n;
end;
$$;

-- Fixture todos contra todos (método del círculo, igual que logica.js).
-- Si ya hay resultados cargados no lo pisa.
create or replace function public.org_generar_fixture(p_categoria bigint)
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare ids bigint[]; arr bigint[]; n int; r int; i int; j int; ult bigint; total int := 0;
begin
  if not public.es_organizador() then raise exception 'Solo el organizador.'; end if;
  select array_agg(id order by id) into ids from public.parejas
  where categoria_id = p_categoria and estado = 'activa' and jugador2 is not null;
  if coalesce(array_length(ids, 1), 0) < 2 then raise exception 'Hacen falta al menos 2 parejas completas.'; end if;
  if exists (select 1 from public.partidos where categoria_id = p_categoria and estado <> 'pendiente') then
    raise exception 'La categoría ya tiene resultados: no se puede rearmar el fixture.';
  end if;
  delete from public.partidos where categoria_id = p_categoria;   -- sus reservas se borran en cascada
  arr := ids;
  if array_length(arr, 1) % 2 = 1 then arr := arr || null::bigint; end if;
  n := array_length(arr, 1);
  for r in 0 .. n - 2 loop
    for i in 1 .. n / 2 loop
      if arr[i] is not null and arr[n - i + 1] is not null then
        insert into public.partidos (categoria_id, fecha, pareja_a, pareja_b) values (p_categoria, r + 1, arr[i], arr[n - i + 1]);
        total := total + 1;
      end if;
    end loop;
    ult := arr[n];
    for j in reverse n .. 3 loop arr[j] := arr[j - 1]; end loop;
    arr[2] := ult;
  end loop;
  perform public.registrar('fixture_generado', null, jsonb_build_object('categoria', p_categoria, 'partidos', total));
  return total;
end;
$$;

create or replace function public.org_confirmar_reserva(p_reserva bigint)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.es_organizador() then raise exception 'Solo el organizador.'; end if;
  update public.reservas set estado = 'confirmada' where id = p_reserva and estado = 'pendiente';
  perform public.registrar('turno_confirmado', (select partido_id from public.reservas where id = p_reserva));
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Seguridad por fila (RLS)
-- ---------------------------------------------------------------------
alter table public.config       enable row level security;
alter table public.perfiles     enable row level security;
alter table public.categorias   enable row level security;
alter table public.parejas      enable row level security;
alter table public.invitaciones enable row level security;
alter table public.partidos     enable row level security;
alter table public.turnos       enable row level security;
alter table public.reservas     enable row level security;
alter table public.actividad    enable row level security;

-- Lectura pública de lo deportivo.
drop policy if exists leer on public.config;      create policy leer on public.config      for select using (true);
drop policy if exists leer on public.categorias;  create policy leer on public.categorias  for select using (true);
drop policy if exists leer on public.parejas;     create policy leer on public.parejas     for select using (true);
drop policy if exists leer on public.partidos;    create policy leer on public.partidos    for select using (true);
drop policy if exists leer on public.turnos;      create policy leer on public.turnos      for select using (true);
drop policy if exists leer on public.reservas;    create policy leer on public.reservas    for select using (true);

-- El organizador escribe directo (además de las RPC).
drop policy if exists org on public.config;     create policy org on public.config     for update using (public.es_organizador()) with check (public.es_organizador());
drop policy if exists org on public.categorias; create policy org on public.categorias for all using (public.es_organizador()) with check (public.es_organizador());
drop policy if exists org on public.parejas;    create policy org on public.parejas    for all using (public.es_organizador()) with check (public.es_organizador());
drop policy if exists org on public.partidos;   create policy org on public.partidos   for all using (public.es_organizador()) with check (public.es_organizador());
drop policy if exists org on public.turnos;     create policy org on public.turnos     for all using (public.es_organizador()) with check (public.es_organizador());
drop policy if exists org on public.reservas;   create policy org on public.reservas   for all using (public.es_organizador()) with check (public.es_organizador());
drop policy if exists org on public.actividad;  create policy org on public.actividad  for select using (public.es_organizador());

-- Invitaciones: solo el que creó la pareja (para pasarle el código al compañero) y el organizador.
drop policy if exists propia on public.invitaciones;
create policy propia on public.invitaciones for select using (
  public.es_organizador() or exists (select 1 from public.parejas p where p.id = pareja_id and p.jugador1 = auth.uid()));

-- Perfiles (con teléfono): uno mismo, compañero, rivales y organizador.
drop policy if exists ver on public.perfiles;
create policy ver on public.perfiles for select using (public.puede_ver_contacto(id));
drop policy if exists editar_propio on public.perfiles;
create policy editar_propio on public.perfiles for update using (id = auth.uid() or public.es_organizador())
  with check (id = auth.uid() or public.es_organizador());
-- Nadie cambia su rol desde la app: solo se pueden tocar estas columnas.
revoke update on public.perfiles from anon, authenticated;
grant update (nombre, apellido, telefono) on public.perfiles to authenticated;   -- el género lo cambia solo el organizador desde el SQL Editor
-- Sin sesión no se escribe nada.
revoke insert, update, delete on all tables in schema public from anon;
grant select on public.jugadores_publicos to anon, authenticated;

-- RPC: las de escritura solo con sesión.
revoke execute on function
  public.cargar_resultado(bigint, jsonb, boolean), public.confirmar_resultado(bigint), public.disputar_resultado(bigint, text, jsonb),
  public.crear_pareja(bigint), public.unirme_a_pareja(text), public.reservar_turno(bigint, date, time), public.cancelar_reserva(bigint),
  public.mis_pendientes(), public.org_fijar_resultado(bigint, jsonb, boolean, bigint), public.org_anular_resultado(bigint),
  public.org_baja_pareja(bigint), public.org_generar_fixture(bigint), public.org_confirmar_reserva(bigint),
  public.registrar(text, bigint, jsonb)
from public, anon;
grant execute on function
  public.cargar_resultado(bigint, jsonb, boolean), public.confirmar_resultado(bigint), public.disputar_resultado(bigint, text, jsonb),
  public.crear_pareja(bigint), public.unirme_a_pareja(text), public.reservar_turno(bigint, date, time), public.cancelar_reserva(bigint),
  public.mis_pendientes(), public.org_fijar_resultado(bigint, jsonb, boolean, bigint), public.org_anular_resultado(bigint),
  public.org_baja_pareja(bigint), public.org_generar_fixture(bigint), public.org_confirmar_reserva(bigint)
to authenticated;
-- registrar() solo la usan las otras funciones (corren como dueño), nadie la llama directo.
revoke execute on function public.registrar(text, bigint, jsonb) from authenticated;

-- ---------------------------------------------------------------------
-- 8. Auto-confirmación programada (opcional pero recomendado)
-- Supabase → Database → Extensions → activar "pg_cron", y después correr:
--   select cron.schedule('lobcup-autoconfirmar', '*/15 * * * *', $$select public.autoconfirmar_vencidos()$$);
-- Sin pg_cron igual funciona: la app llama a autoconfirmar_vencidos() cada vez que alguien la abre.
-- ---------------------------------------------------------------------
