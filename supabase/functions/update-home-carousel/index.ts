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
      .maybeSingle();

    if (profileError || !profile?.is_admin) return json({ message: "Forbidden" }, 403);

    const body = (await req.json()) as { images?: string[] };
    const images = Array.isArray(body.images)
      ? body.images
          .map((x) => String(x || "").trim())
          .filter((x) => /^https?:\/\//i.test(x))
          .slice(0, 6)
      : [];

    if (images.length > 6) return json({ message: "轮播图最多6张" }, 400);

    const payload = JSON.stringify(images);
    const { error: upsertError } = await adminClient
      .from("app_settings")
      .upsert({ key: "home_carousel_images", value: payload, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (upsertError) return json({ message: upsertError.message }, 500);
    return json({ images, message: "轮播图已更新" });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
