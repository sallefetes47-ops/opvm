import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
    },
    // CORS Proxy for Fadaa El Djazair cadastral server
    // Bypasses browser CORS restrictions for government server requests
    proxy: {
      '/api/cadastral-proxy': {
        target: 'https://fadaeldjazair.mf.gov.dz',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => {
          // Extract targetUrl from query parameter
          const url = new URL(path, 'http://localhost');
          const targetUrl = url.searchParams.get('targetUrl');
          if (targetUrl) {
            try {
              const parsed = new URL(targetUrl);
              return parsed.pathname + parsed.search;
            } catch {
              return path;
            }
          }
          return path;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Set proper headers for GIS data and UTF-8 encoding
            proxyReq.setHeader('Accept', 'application/json, application/xml, text/plain');
            proxyReq.setHeader('Accept-Language', 'ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.7');
            proxyReq.setHeader('Accept-Charset', 'UTF-8');
            console.log(`[Fadaa Proxy] Proxying to: ${proxyReq.path}`);
          });
          
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add CORS headers to allow browser access
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
            
            // Ensure UTF-8 encoding for Arabic text
            const contentType = proxyRes.headers['content-type'] || 'application/json';
            res.setHeader('Content-Type', contentType + '; charset=utf-8');
            
            console.log(`[Fadaa Proxy] Response: ${proxyRes.statusCode}`);
          });
          
          proxy.on('error', (err, req, res) => {
            console.error('[Fadaa Proxy] Error:', err.message);
            res.writeHead(500, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(JSON.stringify({
              error: 'Proxy error',
              message: err.message,
            }));
          });
        },
      },
    },
  },
});
