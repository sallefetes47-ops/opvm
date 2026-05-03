import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface FileData {
  file_number?: string;
  full_name?: string;
  municipality?: string;
  address?: string;
  permit_type?: string | null;
  ownership_type?: string;
  plot_area?: number | null;
  built_area?: number | null;
  floors_count?: number | null;
  property_group?: string | null;
  subdivision_name?: string | null;
  lot_number?: string | null;
  property_reference?: string | null;
  engineer_name?: string | null;
  work_duration?: string | null;
  demolition_reason?: string | null;
  notes?: string;
  studies?: Array<{
    study_date: string;
    committee_opinion: string;
    rejection_reason?: string | null;
    notes?: string | null;
  }>;
}

const SYSTEM_PROMPT = `أنت مساعد ذكي متخصص في دراسة ملفات التعمير حسب المرسوم التنفيذي 15-19 الجزائري المتعلق برخص التعمير.

مهمتك تحليل ملفات طلبات رخص البناء/التجزئة/الهدم وتقديم:
1. **ملخص تنفيذي** موجز للملف (3-4 أسطر).
2. **النقاط القوية** التي تدعم القبول.
3. **النقاط الضعيفة / المخاطر القانونية** (مخالفات محتملة، نقص في الوثائق، تجاوزات COS/CES).
4. **اقتراح القرار**: قبول / قبول مع تحفظات / رفض — مع التبرير القانوني.
5. **توصيات للجنة** (إن وجدت).

استخدم لغة عربية فصحى رسمية ومنسقة بـ Markdown. كن موضوعياً ومستنداً للوقائع.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { fileData, mode = "analyze" } = await req.json() as {
      fileData: FileData;
      mode?: "analyze" | "compare";
    };

    if (!fileData) {
      return new Response(
        JSON.stringify({ error: "fileData مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "مفتاح Lovable AI غير مهيأ" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build user prompt from file data
    const studiesText = (fileData.studies || [])
      .map((s, i) => `  - دراسة ${i + 1} (${s.study_date}): ${s.committee_opinion}${s.rejection_reason ? ` — السبب: ${s.rejection_reason}` : ""}${s.notes ? ` — ملاحظات: ${s.notes}` : ""}`)
      .join("\n") || "لا توجد دراسات سابقة.";

    const userPrompt = `حلّل الملف التالي:

**المعلومات الأساسية:**
- رقم الملف: ${fileData.file_number || "—"}
- صاحب الملف: ${fileData.full_name || "—"}
- البلدية: ${fileData.municipality || "—"}
- العنوان: ${fileData.address || "—"}

**نوع الرخصة:** ${fileData.permit_type || "غير محدد"}
**نوع الملكية:** ${fileData.ownership_type || "—"}
**مرجع الملكية:** ${fileData.property_reference || "—"}

**البيانات التقنية:**
- مساحة القطعة: ${fileData.plot_area ?? "—"} م²
- المساحة المبنية: ${fileData.built_area ?? "—"} م²
- عدد الطوابق: ${fileData.floors_count ?? "—"}
- مجموعة سكنية: ${fileData.property_group || "—"}
- اسم التجزئة: ${fileData.subdivision_name || "—"} / رقم القطعة: ${fileData.lot_number || "—"}
- اسم المهندس: ${fileData.engineer_name || "—"}
- مدة الأشغال: ${fileData.work_duration || "—"}
- سبب الهدم (إن وجد): ${fileData.demolition_reason || "—"}

**ملاحظات:** ${fileData.notes || "لا توجد"}

**سجل الدراسات السابقة:**
${studiesText}

قدّم تحليلاً شاملاً وفق التعليمات.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز حد الطلبات. يرجى المحاولة بعد قليل." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "نفدت أرصدة Lovable AI. يرجى إضافة رصيد." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const txt = await response.text();
      console.error("AI gateway error:", response.status, txt);
      return new Response(
        JSON.stringify({ error: "فشل الاتصال بمحرك الذكاء الاصطناعي" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ analysis, mode }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-file-assistant error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
