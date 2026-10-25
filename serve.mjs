// Starts the Vite dev server for the website at http://localhost:3000.
// Same as `npm run dev`; kept so `node serve.mjs` keeps working.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./apps/web/', import.meta.url));
const server = await createServer({
  root,
  configFile: fileURLToPath(new URL('./apps/web/vite.config.js', import.meta.url)),
  server: { port: Number(process.env.PORT) || 3000, strictPort: true },
});
await server.listen();
server.printUrls();
