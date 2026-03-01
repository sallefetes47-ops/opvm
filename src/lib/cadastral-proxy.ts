/**
 * Cadastral Proxy Server
 * 
 * CORS proxy for Fadaa El Djazair government server requests.
 * This bypasses browser CORS restrictions when accessing official
 * Algerian Land Registry data.
 * 
 * Usage:
 *   GET /api/cadastral-proxy?targetUrl=<encoded-url>
 * 
 * Example:
 *   /api/cadastral-proxy?targetUrl=https%3A%2F%2Ffadaeldjazair.mf.gov.dz%2Fgeoserver%2Fwfs
 */

import { defineProxyConfig } from 'http-proxy-middleware';

// Official Fadaa El Djazair domains
const ALLOWED_DOMAINS = [
  'fadaeldjazair.mf.gov.dz',
  '*.fadaeldjazair.mf.gov.dz',
  'mf.gov.dz',
  '*.mf.gov.dz',
];

/**
 * Validates if a URL is from an allowed government domain
 */
function isAllowedDomain(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    return ALLOWED_DOMAINS.some(domain => {
      if (domain.startsWith('*.')) {
        const baseDomain = domain.slice(2);
        return hostname === baseDomain || hostname.endsWith('.' + baseDomain);
      }
      return hostname === domain;
    });
  } catch {
    return false;
  }
}

/**
 * Proxy configuration for Vite dev server
 */
export const cadastralProxyConfig = {
  '/api/cadastral-proxy': {
    target: 'https://fadaeldjazair.mf.gov.dz',
    changeOrigin: true,
    secure: false,
    ws: true,
    
    // Custom router to extract target URL from query parameter
    router: async (req: any) => {
      const url = req.url as string;
      const parsedUrl = new URL(url, 'http://localhost');
      const targetUrl = parsedUrl.searchParams.get('targetUrl');
      
      if (!targetUrl) {
        throw new Error('Missing targetUrl parameter');
      }
      
      if (!isAllowedDomain(targetUrl)) {
        throw new Error(`Domain not allowed: ${new URL(targetUrl).hostname}`);
      }
      
      return targetUrl;
    },
    
    // Add custom headers for government server compatibility
    onProxyReq: (proxyReq: any, req: any, res: any) => {
      // Set proper Accept headers for GIS data
      proxyReq.setHeader('Accept', 'application/json, application/xml, text/plain');
      proxyReq.setHeader('Accept-Language', 'ar-DZ,ar;q=0.9,fr;q=0.8,en;q=0.7');
      proxyReq.setHeader('Accept-Charset', 'UTF-8');
      
      // Remove any existing CORS headers that might conflict
      proxyReq.removeHeader('Origin');
      
      console.log(`[Cadastral Proxy] Proxying to: ${proxyReq.path}`);
    },
    
    // Handle proxy response
    onProxyRes: (proxyRes: any, req: any, res: any) => {
      // Add CORS headers to allow browser access
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
      res.setHeader('Access-Control-Max-Age', '86400');
      
      // Ensure UTF-8 encoding
      res.setHeader('Content-Type', (proxyRes.headers['content-type'] || 'application/json') + '; charset=utf-8');
      
      console.log(`[Cadastral Proxy] Response status: ${proxyRes.statusCode}`);
    },
    
    // Handle errors
    onError: (err: any, req: any, res: any) => {
      console.error('[Cadastral Proxy] Error:', err.message);
      res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
      });
      res.end(JSON.stringify({
        error: 'Proxy error',
        message: err.message,
      }));
    },
  },
};

export default cadastralProxyConfig;
