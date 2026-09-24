import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    root: 'client',
    server: {
      proxy: {
        '/api': `http://127.0.0.1:${process.env.PORT || env.PORT || 3000}`,
        '/socket.io': { target: `http://127.0.0.1:${process.env.PORT || env.PORT || 3000}`, ws: true },
      },
    },
    build: { outDir: '../public', emptyOutDir: true },
  };
});
