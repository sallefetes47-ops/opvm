// Bootstraps the default OPVM user on first login.
// Idempotent: if the user already exists, returns ok without changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_EMAIL = "opvm@opvm.local";
const DEFAULT_PASSWORD = "OPVM2026";
const DEFAULT_FULL_NAME = "OPVM";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to find an existing user by listing (small projects only). If it exists, just succeed.
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === DEFAULT_EMAIL);

    if (existing) {
      return new Response(JSON.stringify({ ok: true, created: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: DEFAULT_EMAIL,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEFAULT_FULL_NAME },
    });

    if (createErr) throw createErr;

    // Promote to admin role so the OPVM user has full access.
    if (created?.user?.id) {
      await admin
        .from("user_roles")
        .upsert(
          { user_id: created.user.id, role: "admin" },
          { onConflict: "user_id,role" }
        );
    }

    return new Response(JSON.stringify({ ok: true, created: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
