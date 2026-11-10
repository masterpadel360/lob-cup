# LOB CUP — app de la liga

App nueva de la liga, aparte de la actual (la de Cloudflare no se toca). Los jugadores cargan y confirman los resultados, reservan turno y ven tabla y ranking. Vos solo supervisás desde el panel.

- **Sin claves de Supabase** arranca en **modo demo**, con una liga inventada que vive en el celular. Sirve para mostrarla.
- **Con claves** usa la base real.
- Para cambiar el nombre de la liga, editá `marca` en `config.js`.

## Probar la demo

- **Un solo archivo:** `demo/lob-cup-demo.html`. Lo abrís con doble clic o lo publicás como página.
- **La app completa:** necesita un servidor, porque usa módulos. Lo más fácil es GitHub Pages (paso 4).

Arriba hay una barra amarilla que dice **DEMO**:
- **Ver como:** cambiás de jugador o entrás como organizador.
- **⋯ (los tres puntos):** adelanta el reloj para que los resultados se confirmen solos, o reinicia la demo.
- En cada partido aparecen botones **"Demo: rival confirma / rechaza / carga"**, para ver el circuito completo sin otro celular.

## Salir en vivo (unos 20 minutos)

### 1. Crear el proyecto en Supabase
1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta (con GitHub o con tu mail).
2. Tocá **New project**:
   - Nombre: `lob-cup`.
   - Contraseña de la base: generá una y guardala.
   - Región: **South America (São Paulo)**.
   - Plan: **Free**.
3. Esperá unos 2 minutos a que termine de crearse.

### 2. Cargar la base
1. En el menú de la izquierda andá a **SQL Editor** y después a **New query**.
2. Abrí `supabase/schema.sql`, copiá todo, pegalo y tocá **Run**. Tiene que decir "Success".
3. Hacé otra query nueva con `supabase/seed.sql` y tocá **Run**.
   - Ese archivo carga las 6 categorías, la grilla de turnos y una **liga de prueba** con 48 parejas inventadas.
   - Los usuarios de prueba son `demo1@lobcup.test` a `demo97@lobcup.test`, con la contraseña `demo1234`.
   - Antes de arrancar la temporada de verdad, borrá esa liga de prueba con el bloque que está al final del archivo.
4. **Autoconfirmación** (recomendado):
   1. Andá a **Database**, después a **Extensions**, y activá `pg_cron`.
   2. En el SQL Editor corré:
      ```sql
      select cron.schedule('lobcup-autoconfirmar', '*/15 * * * *', $$select public.autoconfirmar_vencidos()$$);
      ```
   - Sin este paso igual funciona: la app confirma los vencidos cada vez que alguien la abre.

### 3. Conectar la app
1. En Supabase andá a **Project Settings** y después a **API**. Copiá:
   - **Project URL**
   - **anon public key**
2. Pegalas en `config.js`, en `supabaseUrl` y `supabaseAnonKey`.
3. **Nunca pegues la `service_role` key.** La anon key puede ser pública: lo que protege los datos son las reglas de la base.
4. Andá a **Authentication**, después a **URL Configuration**, y en **Site URL** poné la dirección de GitHub Pages del paso 4.
5. Hacete organizador:
   1. Creá tu cuenta desde la app (Perfil → Crear cuenta) y confirmá el mail.
   2. En el SQL Editor corré esto, con tu mail:
      ```sql
      update public.perfiles set rol = 'organizador'
      where id = (select id from auth.users where email = 'TU_MAIL');
      ```

### 4. Publicar en GitHub Pages
1. Creá un repositorio nuevo en GitHub (por ejemplo `lob-cup`).
2. Subí el contenido de esta carpeta. La carpeta `capturas/` no hace falta.
3. Andá a **Settings**, después a **Pages**. En **Source** elegí "Deploy from a branch", la rama `main` y la carpeta `/ (root)`.
4. En un minuto queda en `https://TU-USUARIO.github.io/lob-cup/`. Ese es el link para los jugadores.

## Cómo la usan los jugadores

1. **Crear cuenta:** mail y contraseña, o un link que les llega al mail.
2. **Armar la pareja:** uno la crea en su categoría y le pasa el código al compañero por WhatsApp. El compañero lo pone y quedan inscriptos.
3. **Fixture:** con las parejas listas, vos tocás **Panel → Fixture → Generar** y se arma todos contra todos.
4. **Cada fecha:**
   1. Escriben al rival desde la app.
   2. Reservan un turno libre. Queda pendiente hasta que vos marcás **Seña recibida**.
   3. Juegan y uno carga el resultado.
   4. El rival lo confirma o toca **No es así**. Si no responde en 24 h, se confirma solo.
5. **Disputas:** te aparecen en **Inicio** con las dos versiones, y elegís cuál vale.

## Archivos

| Archivo | Qué es |
|---|---|
| `config.js` | Nombre de la liga y claves de Supabase |
| `index.html`, `css/`, `js/` | La app (sin instalar nada) |
| `js/logica.js` | Reglas: sets válidos, tabla, ranking, fixture |
| `supabase/schema.sql` | Base de datos, permisos y funciones |
| `supabase/seed.sql` | Categorías, turnos y liga de prueba |
| `demo/lob-cup-demo.html` | La demo en un solo archivo |
| `tests/` | Pruebas: `node tests/logica.test.mjs` y `node tests/demo.test.mjs` |
| `herramientas/` | Arman la demo, el seed y las capturas |

Si cambiás algo de `js/` o `css/`, regenerá la demo y el seed:

```
node herramientas/armar-demo.mjs
node herramientas/armar-seed.mjs
```
