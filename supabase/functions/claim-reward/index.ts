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

    const body = (await req.json()) as { noticeId?: string };
    const noticeId = String(body.noticeId || "").trim();
    if (!noticeId) return json({ message: "noticeId required" }, 400);

    const { data: notice, error: noticeErr } = await adminClient
      .from("notices")
      .select("id,kind,reward_times,target_user_id,active")
      .eq("id", noticeId)
      .maybeSingle();

    if (noticeErr) return json({ message: noticeErr.message }, 500);
    if (!notice || !notice.active) return json({ message: "活动不存在或已关闭" }, 404);
    if (notice.kind !== "activity") return json({ message: "该消息不是可领取活动" }, 400);
    if ((notice.reward_times || 0) <= 0) return json({ message: "活动奖励无效" }, 400);
    if (notice.target_user_id && notice.target_user_id !== authData.user.id) {
      return json({ message: "该活动不属于当前用户" }, 403);
    }

    const { data: existing, error: existingErr } = await adminClient
      .from("reward_claims")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("notice_id", notice.id)
      .maybeSingle();
    if (existingErr) return json({ message: existingErr.message }, 500);
    if (existing) return json({ message: "该活动已领取", alreadyClaimed: true, rewardTimes: notice.reward_times });

    const rewardTimes = Number(notice.reward_times) || 0;
    const { error: claimErr } = await adminClient.from("reward_claims").insert({
      user_id: authData.user.id,
      notice_id: notice.id,
      reward_times: rewardTimes,
    });
    if (claimErr) {
      if (claimErr.code === "23505") {
        return json({ message: "该活动已领取", alreadyClaimed: true, rewardTimes });
      }
      return json({ message: claimErr.message }, 500);
    }

    const { data: profile, error: profileErr } = await adminClient
      .from("user_profiles")
      .select("quota_total")
      .eq("id", authData.user.id)
      .single();
    if (profileErr) return json({ message: profileErr.message }, 500);

    const nextTotal = Math.max(0, Number(profile.quota_total || 0) + rewardTimes);
    const { error: updateErr } = await adminClient
      .from("user_profiles")
      .update({ quota_total: nextTotal })
      .eq("id", authData.user.id);
    if (updateErr) return json({ message: updateErr.message }, 500);

    return json({ message: "领取成功", rewardTimes, quotaTotal: nextTotal });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
