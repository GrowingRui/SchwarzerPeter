import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const page = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000 },
  preview: { port: 3000 },
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
        deck: page('deck.html'),
        play: page('play.html'),
      },
    },
  },
});
