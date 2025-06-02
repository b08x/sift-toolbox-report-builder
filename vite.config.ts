import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', ''); // This can be removed if no other non-VITE_ prefixed env vars are used
    return {
      // 'define' block for API_KEY is removed, Vite handles VITE_ prefixed vars automatically.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
