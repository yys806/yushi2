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

function toWeight(value: unknown) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
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

    const { data: profile, error: profileErr } = await authedClient
      .from("user_profiles")
      .select("is_admin")
      .eq("id", authData.user.id)
      .single();
    if (profileErr || !profile?.is_admin) return json({ message: "Forbidden" }, 403);

    const body = (await req.json()) as {
      sWeight?: number;
      aWeight?: number;
      bWeight?: number;
      cWeight?: number;
    };

    const sWeight = toWeight(body.sWeight);
    const aWeight = toWeight(body.aWeight);
    const bWeight = toWeight(body.bWeight);
    const cWeight = toWeight(body.cWeight);
    const total = sWeight + aWeight + bWeight + cWeight;
    if (total <= 0) return json({ message: "概率总和必须大于 0" }, 400);

    const { data: updated, error: updateErr } = await adminClient
      .from("grade_probabilities")
      .upsert(
        {
          id: "default",
          s_weight: sWeight,
          a_weight: aWeight,
          b_weight: bWeight,
          c_weight: cWeight,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id,s_weight,a_weight,b_weight,c_weight,updated_at")
      .single();

    if (updateErr || !updated) return json({ message: updateErr?.message || "更新失败" }, 500);

    return json({ message: "评级概率已更新", config: updated });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
