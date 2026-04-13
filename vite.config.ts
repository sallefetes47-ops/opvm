import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import https from 'https';
import http from 'http';

// ============================================================================
// TLS/SSL Agent Configuration - Fixes ECONNRESET and TLS handshake failures
// ============================================================================

/**
 * HTTPS Agent with relaxed TLS settings
 * - rejectUnauthorized: false - bypasses strict SSL certificate validation
 * - keepAlive: false - prevents stale connection ECONNRESET errors
 * - maxSockets: 10 - limits concurrent connections to avoid server overload
 * - timeout: 60000 - 60s timeout for slow government servers
 */
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
  // Additional TLS stability options
  secureProtocol: 'TLSv1_2_method',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'AES128-GCM-SHA256',
    'RC4',
    'HIGH',
    '!aNULL',
    '!MD5',
  ].join(':'),
});

/**
 * HTTP Agent for non-SSL fallback
 */
const httpAgent = new http.Agent({
  keepAlive: false,
  maxSockets: 10,
  maxFreeSockets: 5,
  timeout: 60000,
});

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
    // FIXES: ECONNRESET, TLS handshake failures, certificate validation errors
    proxy: {
      '/api/cadastral-proxy': {
        target: 'https://fadaeldjazair.mf.gov.dz',
        changeOrigin: true,
        secure: false, // Bypass SSL/TLS certificate validation
        ws: false, // Disable WebSocket to prevent connection pooling issues

        // Timeout settings - increased for slow government servers
        timeout: 60000,
        proxyTimeout: 60000,

        // ========================================================================
        // PROXY AGENT CONFIGURATION - CRITICAL for TLS stability
        // ========================================================================
        agent: httpsAgent,

        rewrite: (path) => {
          // Extract targetUrl from query parameter
          const url = new URL(path, 'http://localhost');
          const targetUrl = url.searchParams.get('targetUrl');
          if (targetUrl) {
            try {
              const parsed = new URL(targetUrl);
              // Allow both HTTP and HTTPS (some endpoints may only support HTTP)
              if (!parsed.protocol.startsWith('http')) {
                console.warn('[Fadaa Proxy] Warning: Non-HTTP target URL:', targetUrl);
              }
              return parsed.pathname + parsed.search;
            } catch {
              return path;
            }
          }
          return path;
        },
        configure: (proxy) => {
          // ========================================================================
          // OUTGOING REQUEST - Set headers and attach TLS agent
          // ========================================================================
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Header injection to mimic real browser and bypass WAF
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            proxyReq.setHeader('Referer', 'https://fadaeldjazair.mf.gov.dz/');
            proxyReq.setHeader('Accept', 'application/json, application/xml, text/plain, */*');
            proxyReq.setHeader('Accept-Language', 'ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.7');
            proxyReq.setHeader('Accept-Charset', 'UTF-8');
            proxyReq.setHeader('Cache-Control', 'no-cache');

            // Attach the pre-configured TLS agent with relaxed settings
            (proxyReq as any).agent = httpsAgent;

            console.log(`[Fadaa Proxy] → Request: ${req.method} ${proxyReq.path}`);
          });

          // ========================================================================
          // INCOMING RESPONSE - Add CORS headers and handle encoding
          // ========================================================================
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add CORS headers to allow browser access
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
            res.setHeader('Access-Control-Max-Age', '86400');

            // Ensure UTF-8 encoding for Arabic text
            const contentType = proxyRes.headers['content-type'] || 'application/json';
            if (!contentType.includes('charset')) {
              res.setHeader('Content-Type', contentType + '; charset=utf-8');
            }

            console.log(`[Fadaa Proxy] ← Response: ${proxyRes.statusCode} (${proxyRes.headers['content-length'] || 'unknown'} bytes)`);
          });

          // ========================================================================
          // ERROR HANDLING - Graceful fallback for TLS/network failures
          // ========================================================================
          proxy.on('error', (err, req, res) => {
            const errorCode = (err as any).code || 'UNKNOWN';
            const errorMsg = err.message || 'Unknown proxy error';

            console.error('[Fadaa Proxy] ❌ Error:', errorCode);
            console.error('[Fadaa Proxy] Message:', errorMsg);
            console.error('[Fadaa Proxy] URL:', req.url);

            // Handle specific TLS/network errors
            const errorHints: Record<string, string> = {
              'ECONNRESET': 'Connection reset by server - server closed the connection abruptly',
              'ERR_TLS_CERT_ALTNAME_INVALID': 'TLS certificate hostname mismatch',
              'DEPTH_ZERO_SELF_SIGNED_CERT': 'Self-signed certificate detected',
              'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'Certificate chain verification failed',
              'ECONNREFUSED': 'Connection refused - server may be down',
              'ETIMEDOUT': 'Connection timed out - server too slow or unreachable',
              'ENOTFOUND': 'DNS resolution failed - hostname not found',
            };

            const hint = errorHints[errorCode] || 'Unknown network/TLS error';
            console.warn(`[Fadaa Proxy] Hint: ${hint}`);

            // Return graceful error response to client
            res.writeHead(502, {
              'Content-Type': 'application/json; charset=utf-8',
              'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({
              error: 'Proxy connection error',
              message: errorMsg,
              code: errorCode,
              hint,
              timestamp: new Date().toISOString(),
            }));
          });

          proxy.on('close', (req, res) => {
            console.log(`[Fadaa Proxy] ✓ Connection closed: ${res.statusCode}`);
          });
        },
      },
      // ========================================================================
      // Direct /geoserver shortcut route — bypasses CORS & TLS for GeoServer
      // Usage: fetch('/geoserver/wfs?SERVICE=WFS&REQUEST=GetFeature&...')
      // ========================================================================
      '/geoserver': {
        target: 'https://fadaeldjazair.mf.gov.dz',
        changeOrigin: true,
        secure: false, // Bypass local SSL/TLS certificate validation
        ws: false,
        timeout: 60000,
        proxyTimeout: 60000,
        agent: httpsAgent,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            proxyReq.setHeader('Referer', 'https://fadaeldjazair.mf.gov.dz/');
            proxyReq.setHeader('Accept', 'application/json, application/xml, text/plain, */*');
            proxyReq.setHeader('Accept-Language', 'ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.7');
            (proxyReq as any).agent = httpsAgent;
            console.log(`[GeoServer Proxy] → ${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            const contentType = proxyRes.headers['content-type'] || 'application/json';
            if (!contentType.includes('charset')) {
              res.setHeader('Content-Type', contentType + '; charset=utf-8');
            }
            console.log(`[GeoServer Proxy] ← ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req, res) => {
            const code = (err as any).code || 'UNKNOWN';
            console.error('[GeoServer Proxy] Error:', code, err.message);
            res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'GeoServer proxy error', code, message: err.message }));
          });
        },
      },
    },
  },
});
