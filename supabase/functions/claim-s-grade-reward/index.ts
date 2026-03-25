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

function isSchemaNotReady(err: { code?: string; message?: string }) {
  const code = String(err?.code || "").toUpperCase();
  const msg = String(err?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST202" || code === "PGRST205" || msg.includes("schema cache");
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

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ message: "Unauthorized" }, 401);

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await authedClient.auth.getUser();
    if (authError || !authData?.user) return json({ message: "Unauthorized" }, 401);

    const body = (await req.json()) as { workId?: string };
    const workId = String(body.workId || "").trim();
    if (!workId) return json({ message: "workId required" }, 400);

    const { data, error: claimErr } = await authedClient.rpc("claim_s_grade_reward", {
      p_work_id: workId,
      p_reward_times: 10,
    });
    if (claimErr) {
      if (isSchemaNotReady(claimErr)) {
        return json({ message: "S级兑换功能正在初始化，请稍后重试", code: "SCHEMA_NOT_READY" }, 503);
      }
      const msg = claimErr.message || "兑换失败";
      if (msg.includes("仅S级神卡可兑换")) return json({ message: "仅S级神卡可兑换" }, 400);
      if (msg.toLowerCase().includes("unauthorized")) return json({ message: "Unauthorized" }, 401);
      return json({ message: msg }, 500);
    }

    const row = Array.isArray(data) ? data[0] : null;
    const alreadyClaimed = Boolean(row?.already_claimed);
    const rewardTimes = Number(row?.reward_times || 10);
    const quotaTotal = Number(row?.quota_total || 0);
    if (alreadyClaimed) {
      return json({ message: "该S级神卡已兑换", alreadyClaimed: true, rewardTimes, quotaTotal });
    }

    return json({ message: "兑换成功，已到账10次额度", rewardTimes, quotaTotal });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
