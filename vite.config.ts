import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // Define global constants that can be used at runtime
    define: {
      // Preserve the placeholder for Docker runtime replacement
      __RUNTIME_CONFIG_ENABLED__: JSON.stringify(true),
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    
    // Environment variable configuration
    envPrefix: ['VITE_'],
    
    // Build configuration
    build: {
      // Ensure the build doesn't optimize away our placeholder
      minify: mode === 'production' ? 'esbuild' : false,
      rollupOptions: {
        output: {
          // Ensure environment variables are preserved in build
          manualChunks: undefined,
        }
      }
    },
    
    // Development server configuration
    server: {
      port: 5173,
      host: true, // Needed for Docker
    },
    
    // Preview server configuration (for testing production builds)
    preview: {
      port: 4173,
      host: true,
    }
  };
});