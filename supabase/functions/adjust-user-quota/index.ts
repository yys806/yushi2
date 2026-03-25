import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown>;

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") return json({ message: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ message: "Unauthorized" }, 401);

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await authedClient.auth.getUser();
    if (authError || !authData?.user) return json({ message: "Unauthorized" }, 401);

    const { data: profile, error: profileError } = await authedClient
      .from("user_profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .single();
    if (profileError || !profile?.is_admin) return json({ message: "Forbidden" }, 403);

    const body = (await req.json()) as { targetUserId?: string; quotaTotal?: number };
    const targetUserId = String(body.targetUserId || "").trim();
    const quotaTotal = Math.max(0, Math.floor(Number(body.quotaTotal ?? -1)));

    if (!targetUserId) return json({ message: "targetUserId required" }, 400);
    if (!Number.isFinite(quotaTotal)) return json({ message: "quotaTotal invalid" }, 400);

    const { data: target, error: targetErr } = await adminClient
      .from("user_profiles")
      .select("id,quota_used")
      .eq("id", targetUserId)
      .maybeSingle();
    if (targetErr) return json({ message: targetErr.message }, 500);
    if (!target) return json({ message: "用户不存在" }, 404);

    const quotaUsed = Math.max(0, Math.floor(Number(target.quota_used || 0)));
    const nextUsed = Math.min(quotaUsed, quotaTotal);

    const { data: updated, error: updateErr } = await adminClient
      .from("user_profiles")
      .update({ quota_total: quotaTotal, quota_used: nextUsed })
      .eq("id", targetUserId)
      .select("id,email,nickname,quota_total,quota_used")
      .single();

    if (updateErr || !updated) return json({ message: updateErr?.message || "调整额度失败" }, 500);

    return json({ message: "额度已调整", user: updated });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
