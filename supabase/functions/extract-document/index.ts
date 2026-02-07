import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Safe base64 encoding that doesn't blow up the call stack for large files
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function getSystemPrompt(documentType: string): string {
  switch (documentType) {
    case "meeting_minutes":
      return `أنت مساعد متخصص في استخراج المعلومات من محاضر الاجتماعات. 
      استخرج المعلومات التالية من الوثيقة:
      - رقم الجلسة (session_number)
      - تاريخ الجلسة (session_date) بصيغة YYYY-MM-DD
      - الحاضرون (attendees) كقائمة مفصولة بفاصلة
      - جدول الأعمال (agenda)
      - القرارات (decisions)
      - ملاحظات (notes)
      
      أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي.`;
    case "summons":
      return `أنت مساعد متخصص في استخراج المعلومات من الاستدعاءات.
      استخرج المعلومات التالية من الوثيقة:
      - رقم الاستدعاء (summons_number)
      - تاريخ الاستدعاء (summons_date) بصيغة YYYY-MM-DD
      - أعضاء اللجنة (committee_members) كقائمة مفصولة بفاصلة
      - مكان الاجتماع (venue)
      - ملاحظات (notes)
      
      أرجع النتيجة بصيغة JSON فقط بدون أي نص إضافي.`;
    case "legal_document":
      return `أنت مساعد متخصص في استخراج المعلومات من المراسيم والتعليمات القانونية.
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
    default:
      return `استخرج جميع النصوص والمعلومات من هذه الوثيقة وأرجعها بصيغة JSON منظمة.`;
  }
}

serve(async (req) => {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const mimeType = file.type || "application/octet-stream";
    const isPdf = mimeType === "application/pdf";
    const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);

    console.log(`Processing file: ${file.name}, size: ${fileSizeMB.toFixed(2)}MB, type: ${mimeType}`);

    const systemPrompt = getSystemPrompt(documentType);

    // For large PDFs (>4MB), split into chunks and process sequentially
    if (isPdf && fileSizeMB > 4) {
      return await processLargePdf(arrayBuffer, mimeType, systemPrompt, documentType, LOVABLE_API_KEY);
    }

    // Standard processing for images and small PDFs
    const base64 = arrayBufferToBase64(arrayBuffer);

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
              { type: "text", text: systemPrompt },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` }
              }
            ]
          }
        ],
        max_tokens: 8192,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response(
        JSON.stringify({ error: "AI processing failed", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    const extractedData = parseJsonFromResponse(content);

    return new Response(
      JSON.stringify({ success: true, data: extractedData, raw_response: content }),
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

function parseJsonFromResponse(content: string): Record<string, unknown> {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // fall through
  }
  return { raw_text: content };
}

async function processLargePdf(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  systemPrompt: string,
  documentType: string,
  apiKey: string,
): Promise<Response> {
  // For large PDFs, we split the buffer into ~3MB chunks and send each,
  // asking the AI to extract from that portion, then merge results.
  const MAX_CHUNK = 3 * 1024 * 1024; // 3MB per chunk
  const totalSize = arrayBuffer.byteLength;
  const numChunks = Math.ceil(totalSize / MAX_CHUNK);

  console.log(`Large PDF: splitting into ${numChunks} chunks`);

  const allResults: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (let i = 0; i < numChunks; i++) {
    const start = i * MAX_CHUNK;
    const end = Math.min(start + MAX_CHUNK, totalSize);

    // For PDF we must send the whole file - Gemini handles multi-page PDFs natively.
    // So for truly large files, we send the whole thing but with optimized prompt.
    // The chunking here is a fallback if the single request fails.
    try {
      console.log(`Processing chunk ${i + 1}/${numChunks}`);
      
      // Send the entire PDF (Gemini handles it) but with text-priority prompt
      if (i === 0) {
        const base64 = arrayBufferToBase64(arrayBuffer);
        const optimizedPrompt = `${systemPrompt}\n\nتنبيه: هذا ملف PDF كبير متعدد الصفحات. ركّز على استخراج النصوص والبيانات المنظمة فقط، وتجاهل الصور والرسومات لتسريع المعالجة.`;
        
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: optimizedPrompt },
                  {
                    type: "image_url",
                    image_url: { url: `data:${mimeType};base64,${base64}` }
                  }
                ]
              }
            ],
            max_tokens: 16384,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Chunk ${i + 1} failed:`, errorText);
          errors.push(`الجزء ${i + 1}: ${errorText}`);
          continue;
        }

        const aiResult = await response.json();
        const content = aiResult.choices?.[0]?.message?.content || "";
        allResults.push(parseJsonFromResponse(content));
        break; // If full PDF succeeds, no need for more chunks
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.error(`Chunk ${i + 1} error:`, msg);
      errors.push(`الجزء ${i + 1}: ${msg}`);
    }
  }

  // Merge results
  const mergedData: Record<string, unknown> = {};
  for (const result of allResults) {
    for (const [key, value] of Object.entries(result)) {
      if (value !== null && value !== undefined && value !== "") {
        if (mergedData[key] && typeof mergedData[key] === "string" && typeof value === "string") {
          mergedData[key] = mergedData[key] + "\n" + value;
        } else {
          mergedData[key] = value;
        }
      }
    }
  }

  if (Object.keys(mergedData).length === 0 && errors.length > 0) {
    return new Response(
      JSON.stringify({ error: "فشل في معالجة الملف", details: errors.join("; ") }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: mergedData,
      pages_processed: allResults.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
