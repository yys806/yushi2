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

    const { data: users, error: usersError } = await adminClient
      .from("user_profiles")
      .select("id,email,nickname,quota_total,quota_used,created_at")
      .order("created_at", { ascending: false });
    if (usersError) return json({ message: usersError.message }, 500);

    const { data: apps, error: appsError } = await adminClient
      .from("quota_applications")
      .select("id,user_id,applicant_name,apply_reason,requested_times,status,review_note,reviewed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (appsError) return json({ message: appsError.message }, 500);

    const { data: notices, error: noticesError } = await adminClient
      .from("notices")
      .select("id,title,content,kind,target_user_id,active,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (noticesError) return json({ message: noticesError.message }, 500);

    const { data: museumItems, error: museumError } = await adminClient
      .from("museum_items")
      .select("id,category,title,description,image_url,active,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (museumError && museumError.code !== "42P01") return json({ message: museumError.message }, 500);

    const usersWithRemaining = (users || []).map((u) => ({
      ...u,
      quota_remaining: Math.max(0, Number(u.quota_total) - Number(u.quota_used)),
    }));

    return json({
      users: usersWithRemaining,
      applications: apps || [],
      notices: notices || [],
      museumItems: museumError ? [] : museumItems || [],
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
