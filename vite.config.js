import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

function adminRoutePlugin() {
  return {
    name: 'admin-route',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = request.url || '';

        if (url === '/admin' || url === '/admin/' || url.startsWith('/admin?')) {
          const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
          request.url = `/admin.html${query}`;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [adminRoutePlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: `${rootDir}index.html`,
        admin: `${rootDir}admin.html`,
      },
    },
  },
});
