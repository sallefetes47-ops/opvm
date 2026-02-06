import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const documentType = formData.get("documentType") as string || "general";

    if (!file) {
      return new Response(
        JSON.stringify({ error: "No file provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = file.type || "image/png";

    // Determine prompt based on document type
    let systemPrompt = "";
    switch (documentType) {
      case "meeting_minutes":
        systemPrompt = `أنت مساعد متخصص في استخراج المعلومات من محاضر الاجتماعات. 
        استخرج المعلومات التالية من الوثيقة:
        - رقم الجلسة (session_number)
        - تاريخ الجلسة (session_date) بصيغة YYYY-MM-DD
        - الحاضرون (attendees) كقائمة مفصولة بفاصلة
        - جدول الأعمال (agenda)
        - القرارات (decisions)
        - ملاحظات (notes)
        
        أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي.`;
        break;
      case "summons":
        systemPrompt = `أنت مساعد متخصص في استخراج المعلومات من الاستدعاءات.
        استخرج المعلومات التالية من الوثيقة:
        - رقم الاستدعاء (summons_number)
        - تاريخ الاستدعاء (summons_date) بصيغة YYYY-MM-DD
        - أعضاء اللجنة (committee_members) كقائمة مفصولة بفاصلة
        - مكان الاجتماع (venue)
        - ملاحظات (notes)
        
        أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي.`;
        break;
      case "legal_document":
        systemPrompt = `أنت مساعد متخصص في استخراج المعلومات من المراسيم والتعليمات القانونية.
        استخرج المعلومات التالية من الوثيقة:
        - العنوان بالعربية (title_ar)
        - العنوان بالفرنسية (title_fr) إن وجد
        - نوع الوثيقة (document_type): مرسوم / تعليمة / قرار / أمر
        - رقم الوثيقة (document_number)
        - تاريخ الوثيقة (document_date) بصيغة YYYY-MM-DD
        - الوصف (description)
        - الكلمات المفتاحية (keywords) كقائمة مفصولة بفاصلة
        - النص الكامل (content_text)
        
        أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي.`;
        break;
      default:
        systemPrompt = `استخرج جميع النصوص والمعلومات من هذه الوثيقة وأرجعها بصيغة JSON منظمة.`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Lovable AI Gateway with vision model
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: systemPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let extractedData = {};
    try {
      // Find JSON in the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      extractedData = { raw_text: content };
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        raw_response: content 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
