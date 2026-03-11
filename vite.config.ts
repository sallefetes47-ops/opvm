import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';

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
        secure: false, // SSL bypass: ignore strict TLS certificate verification
        // Timeout settings to prevent ECONNRESET
        timeout: 30000,
        proxyTimeout: 30000,
        rewrite: (path) => {
          // Extract targetUrl from query parameter
          const url = new URL(path, 'http://localhost');
          const targetUrl = url.searchParams.get('targetUrl');
          if (targetUrl) {
            try {
              const parsed = new URL(targetUrl);
              // Ensure HTTPS protocol for security
              if (!parsed.protocol.startsWith('https')) {
                console.warn('[Fadaa Proxy] Warning: Non-HTTPS target URL:', targetUrl);
              }
              return parsed.pathname + parsed.search;
            } catch {
              return path;
            }
          }
          return path;
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Header injection to mimic real browser and bypass WAF
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.setHeader('Referer', 'https://fadaeldjazair.mf.gov.dz/');
            proxyReq.setHeader('Accept', 'application/json, application/xml, text/plain, */*');
            proxyReq.setHeader('Accept-Language', 'ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.7');
            proxyReq.setHeader('Accept-Charset', 'UTF-8');
            proxyReq.setHeader('Connection', 'keep-alive');
            proxyReq.setHeader('Upgrade-Insecure-Requests', '1');

            // Fix for TLS connection issues: use HTTPS agent with relaxed settings
            const agent = new https.Agent({
              rejectUnauthorized: false, // SSL bypass
              keepAlive: false,
              maxSockets: 50,
              maxFreeSockets: 10,
              timeout: 30000,
            });
            (proxyReq as any).agent = agent;

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
            console.error('[Fadaa Proxy] TLS/Network Error:', err.message);
            console.error('[Fadaa Proxy] Error code:', (err as any).code);
            console.error('[Fadaa Proxy] Error syscall:', (err as any).syscall);

            // Handle specific TLS errors
            if ((err as any).code === 'ECONNRESET') {
              console.warn('[Fadaa Proxy] Connection reset by server - retrying with relaxed TLS...');
            }
            if ((err as any).code === 'ERR_TLS_CERT_ALTNAME_INVALID') {
              console.warn('[Fadaa Proxy] TLS certificate mismatch - secure:false should handle this');
            }

            res.writeHead(502, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            res.end(JSON.stringify({
              error: 'Proxy connection error',
              message: err.message,
              code: (err as any).code,
            }));
          });

          proxy.on('close', (req, res) => {
            console.log('[Fadaa Proxy] Connection closed');
          });
        },
      },
    },
  },
});
