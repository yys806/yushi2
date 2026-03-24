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
      category?: string;
      title?: string;
      description?: string;
      imageUrl?: string;
      active?: boolean;
    };

    const category = String(body.category || "natural").trim() === "carving" ? "carving" : "natural";
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const active = body.active !== false;

    if (!title || !description || !imageUrl) {
      return json({ message: "title/description/imageUrl are required" }, 400);
    }
    if (title.length > 80) return json({ message: "标题不能超过80字" }, 400);
    if (description.length > 2000) return json({ message: "说明不能超过2000字" }, 400);

    const { data: inserted, error: insertError } = await adminClient
      .from("museum_items")
      .insert({
        category,
        title,
        description,
        image_url: imageUrl,
        active,
        created_by: authData.user.id,
      })
      .select("id,category,title,description,image_url,active,created_at")
      .single();

    if (insertError) return json({ message: insertError.message }, 500);
    return json({ item: inserted });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
