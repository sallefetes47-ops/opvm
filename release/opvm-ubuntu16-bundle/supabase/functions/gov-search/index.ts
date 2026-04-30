import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOV_DOMAINS = [
  "mhuv.gov.dz",
  "m-culture.gov.dz",
  "interieur.gov.dz",
  "joradp.dz",
];

async function authenticateRequest(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return { userId: data.claims.sub as string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (authResult instanceof Response) return authResult;

    const { query } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate query length
    if (query.length > 500) {
      return new Response(
        JSON.stringify({ error: "Query too long" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainList = GOV_DOMAINS.join(", ");

    const systemPrompt = `أنت محرك بحث قانوني متخصص في التشريعات والمراسيم الجزائرية المتعلقة بالتعمير والبناء والتراث.

مهمتك: عندما يبحث المستخدم عن موضوع معين، قدم قائمة بالنتائج ذات الصلة من المواقع الحكومية الجزائرية التالية: ${domainList}

لكل نتيجة، قدم:
1. title: عنوان الوثيقة أو القانون
2. link: رابط URL حقيقي من أحد النطاقات الحكومية المذكورة (إذا كنت تعرفه)، أو اتركه فارغاً
3. snippet: ملخص قصير (2-3 جمل) عن المحتوى
4. source: اسم النطاق المصدر (مثلاً mhuv.gov.dz)

قدم بين 5 و 10 نتائج. ركز على الدقة والمعلومات الموثوقة.
إذا لم تجد نتائج مرتبطة، قل ذلك بوضوح.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_search_results",
              description: "Return structured search results from Algerian government domains",
              parameters: {
                type: "object",
                properties: {
                  results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "عنوان الوثيقة" },
                        link: { type: "string", description: "رابط URL من النطاق الحكومي" },
                        snippet: { type: "string", description: "ملخص قصير" },
                        source: { type: "string", description: "النطاق المصدر مثل mhuv.gov.dz" },
                      },
                      required: ["title", "snippet", "source"],
                      additionalProperties: false,
                    },
                  },
                  total_count: { type: "number", description: "العدد التقديري للنتائج" },
                },
                required: ["results", "total_count"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_search_results" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      console.error("AI gateway error:", status);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات. يرجى المحاولة بعد قليل.", statusCode: 429 }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "يرجى شحن رصيد الذكاء الاصطناعي.", statusCode: 402 }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "خطأ في خدمة البحث الذكي", statusCode: status }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract tool call results
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return new Response(
        JSON.stringify(parsed),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: return the content as-is
    const content = data.choices?.[0]?.message?.content || "";
    return new Response(
      JSON.stringify({ results: [], total_count: 0, raw_content: content }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("gov-search error");
    return new Response(
      JSON.stringify({ error: "خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
