import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ALLOWED_HOSTS = ['fadaeldjazair.mf.gov.dz', 'mf.gov.dz'];

function isAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const target = new URL(req.url).searchParams.get('url');
    if (!target || !isAllowed(target)) {
      return new Response(
        JSON.stringify({ error: 'رابط غير مسموح به' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const upstream = await fetch(target, {
      headers: {
        Accept: 'application/json, application/xml, text/xml, */*',
        'Accept-Language': 'ar-DZ,ar;q=0.9,fr;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; OPVM/1.0)',
      },
      signal: AbortSignal.timeout(55_000),
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          (upstream.headers.get('content-type') ?? 'text/plain') + '; charset=utf-8',
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? 'فشل الاتصال بالخدمة' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
