// Usa lo stesso esbuild già disponibile per le suite; nessuna installazione/configurazione app.
const fs = require('fs');
const path = require('path');
const cache = path.join(require('os').homedir(), '.npm/_npx');
const modulePath = fs.readdirSync(cache).map(p => path.join(cache, p, 'node_modules/esbuild')).find(p => fs.existsSync(path.join(p, 'package.json')));
if (!modulePath) throw new Error('esbuild delle suite non trovato');
require(modulePath).build({
  entryPoints: [path.join(__dirname, 'reminder-harness.tsx')], outfile: path.join(__dirname, 'reminder-harness.js'),
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  nodePaths: [path.resolve(__dirname, '../../frontend/node_modules')],
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js', '.json'],
  alias: { 'react-native': 'react-native-web' }, loader: { '.ttf': 'dataurl', '.js': 'jsx' },
  banner: { js: 'var process = { env: { NODE_ENV: "production", EXPO_OS: "web" } };' },
  define: { 'process.env.NODE_ENV': '"production"', '__DEV__': 'false' },
}).then(() => console.log('REMINDER HARNESS READY: componente e AsyncStorage reali, nessuna API CRM')).catch(() => process.exit(1));