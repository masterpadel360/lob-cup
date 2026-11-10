// Arma demo/lob-cup-demo.html: un solo archivo con todo adentro (modo demo, sin Supabase).
// Uso: node herramientas/armar-demo.mjs
// Mini "empaquetador": cada módulo queda en su propia función y se conectan por nombre.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(join(raiz, p), 'utf8');

function modulo(nombre, codigo) {
  const exportados = [];
  codigo = codigo.replace(/^export\s+(async\s+function|function|const|let)\s+([A-Za-z_$][\w$]*)/gm, (_, tipo, n) => { exportados.push(n); return `${tipo} ${n}`; });
  codigo = codigo.replace(/^import\s*\{([^}]+)\}\s*from\s*'\.\/([\w-]+)\.js';\s*$/gm, (_, nombres, mod) => `const {${nombres}} = __${mod.replace(/-/g, '_')};`);
  if (/^\s*(import|export)\s/m.test(codigo)) throw new Error('Quedó un import/export sin resolver en ' + nombre);
  return `const __${nombre} = (() => {\n${codigo}\nreturn { ${exportados.join(', ')} };\n})();\n`;
}

let app = leer('js/app.js').replace("import { crearCapaDatos } from './datos.js';", 'const crearCapaDatos = async () => __datos_demo.crearDemo();');
const js = [
  modulo('logica', leer('js/logica.js')),
  modulo('datos_demo', leer('js/datos-demo.js')),
  modulo('app', app),
].join('\n');

// config.js sin claves (la demo nunca se conecta a nada)
const config = leer('config.js').replace(/supabaseUrl:\s*'[^']*'/, "supabaseUrl: ''").replace(/supabaseAnonKey:\s*'[^']*'/, "supabaseAnonKey: ''");
const css = leer('css/app.css');
let html = leer('index.html')
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script src="config.js"></script>', () => `<script>\n${config}\n</script>`)
  .replace('<script type="module" src="js/app.js"></script>', () => `<script>\n"use strict";\n${js}\n</script>`);
if (/src="(?!data:)/.test(html.replace(/<link[^>]+fonts\.googleapis[^>]+>/g, ''))) throw new Error('Quedó un archivo externo');
mkdirSync(join(raiz, 'demo'), { recursive: true });
writeFileSync(join(raiz, 'demo', 'lob-cup-demo.html'), html);
console.log('demo/lob-cup-demo.html', Math.round(html.length / 1024) + ' KB');
