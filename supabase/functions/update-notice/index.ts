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
      noticeId?: string;
      title?: string;
      content?: string;
      kind?: string;
      targetUserId?: string | null;
    };
    const noticeId = String(body.noticeId || "").trim();
    const title = String(body.title || "").trim().slice(0, 80);
    const content = String(body.content || "").trim().slice(0, 500);
    const kind = String(body.kind || "normal").trim() === "announcement" ? "announcement" : "normal";
    const targetUserId = body.targetUserId ? String(body.targetUserId).trim() : null;
    if (!noticeId) return json({ message: "noticeId required" }, 400);
    if (title.length < 2) return json({ message: "标题至少 2 个字" }, 400);
    if (content.length < 2) return json({ message: "内容至少 2 个字" }, 400);

    if (targetUserId) {
      const { data: userExists, error: userErr } = await adminClient
        .from("user_profiles")
        .select("id")
        .eq("id", targetUserId)
        .maybeSingle();
      if (userErr) return json({ message: userErr.message }, 500);
      if (!userExists) return json({ message: "目标用户不存在" }, 400);
    }

    const { data: row, error: updateError } = await adminClient
      .from("notices")
      .update({ title, content, kind, target_user_id: targetUserId })
      .eq("id", noticeId)
      .select("id,title,content,kind,target_user_id,active,created_at")
      .single();

    if (updateError || !row) return json({ message: updateError?.message || "更新失败" }, 500);

    return json({ notice: row, message: "公告已更新" });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
