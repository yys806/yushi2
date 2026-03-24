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

    const body = (await req.json()) as {
      applicationId?: string;
      decision?: "approved" | "rejected";
      reviewNote?: string;
    };

    const applicationId = String(body.applicationId || "").trim();
    const decision = body.decision;
    const reviewNote = String(body.reviewNote || "").trim().slice(0, 200);
    if (!applicationId) return json({ message: "applicationId required" }, 400);
    if (decision !== "approved" && decision !== "rejected") {
      return json({ message: "decision must be approved or rejected" }, 400);
    }

    const { data: app, error: appError } = await adminClient
      .from("quota_applications")
      .select("id,user_id,requested_times,status")
      .eq("id", applicationId)
      .single();
    if (appError || !app) return json({ message: "Application not found" }, 404);
    if (app.status !== "pending") return json({ message: "Application already reviewed" }, 409);

    const nowIso = new Date().toISOString();
    const { error: updateAppError } = await adminClient
      .from("quota_applications")
      .update({
        status: decision,
        review_note: reviewNote || null,
        reviewed_by: authData.user.id,
        reviewed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", app.id);
    if (updateAppError) return json({ message: updateAppError.message }, 500);

    if (decision === "approved") {
      const { data: userRow, error: userError } = await adminClient
        .from("user_profiles")
        .select("id,quota_total")
        .eq("id", app.user_id)
        .single();
      if (userError || !userRow) return json({ message: "User profile not found" }, 404);

      const { error: quotaError } = await adminClient
        .from("user_profiles")
        .update({
          quota_total: Number(userRow.quota_total) + Number(app.requested_times),
          updated_at: nowIso,
        })
        .eq("id", app.user_id);
      if (quotaError) return json({ message: quotaError.message }, 500);
    }

    return json({
      id: app.id,
      status: decision,
      message: decision === "approved" ? "申请已批准" : "申请已驳回",
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
