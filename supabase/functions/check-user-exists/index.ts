import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown>;

const LIST_PAGE_SIZE = 200;
const LIST_MAX_PAGES = 1000;
const LIST_TIMEOUT_MS = 25000;

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = (await req.json()) as { email?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return json({ exists: false });

    const startedAt = Date.now();
    let page = 1;

    while (page <= LIST_MAX_PAGES) {
      if (Date.now() - startedAt > LIST_TIMEOUT_MS) break;

      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LIST_PAGE_SIZE });
      if (error) return json({ exists: false });

      const users = data?.users || [];
      const exists = users.some((u) => String(u.email || "").trim().toLowerCase() === email);
      if (exists) return json({ exists: true });

      if (users.length < LIST_PAGE_SIZE) break;
      page += 1;
    }

    return json({ exists: false });
  } catch {
    return json({ exists: false });
  }
});
