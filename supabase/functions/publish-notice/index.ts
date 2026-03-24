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
      title?: string;
      content?: string;
      active?: boolean;
    };

    const title = String(body.title || "").trim().slice(0, 80);
    const content = String(body.content || "").trim().slice(0, 500);
    const active = body.active !== false;
    if (title.length < 2) return json({ message: "标题至少 2 个字" }, 400);
    if (content.length < 2) return json({ message: "内容至少 2 个字" }, 400);

    const { data: row, error: insertError } = await adminClient
      .from("notices")
      .insert({
        title,
        content,
        active,
        created_by: authData.user.id,
      })
      .select("id,title,content,active,created_at")
      .single();
    if (insertError || !row) return json({ message: insertError?.message || "发布失败" }, 500);

    return json({ notice: row, message: "通知已发布" });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
