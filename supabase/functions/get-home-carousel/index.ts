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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "home_carousel_images")
      .maybeSingle();

    if (error) return json({ images: [] });

    let images: string[] = [];
    try {
      const parsed = JSON.parse(String(data?.value || "[]"));
      if (Array.isArray(parsed)) {
        images = parsed
          .map((x) => String(x || "").trim())
          .filter((x) => /^https?:\/\//i.test(x))
          .slice(0, 6);
      }
    } catch {
      images = [];
    }

    return json({ images });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error", images: [] }, 200);
  }
});
