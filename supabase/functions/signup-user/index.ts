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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(value: string): boolean {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(value);
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
    if (!supabaseUrl || !serviceRoleKey) return json({ message: "Server not configured" }, 500);

    const body = (await req.json()) as {
      email?: string;
      password?: string;
      nickname?: string;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const nickname = String(body.nickname || "").trim();

    if (!isValidEmail(email)) return json({ message: "邮箱格式不正确" }, 400);
    if (nickname.length < 2) return json({ message: "昵称至少 2 个字，且不能重复" }, 400);
    if (!isStrongPassword(password)) {
      return json({ message: "密码至少 8 位，且必须包含大小写字母、数字和符号" }, 400);
    }
    if (password.length > 128) return json({ message: "密码长度不能超过 128 位" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existingNickname, error: nicknameErr } = await admin
      .from("user_profiles")
      .select("id")
      .eq("nickname", nickname)
      .maybeSingle();
    if (nicknameErr) return json({ message: nicknameErr.message }, 500);
    if (existingNickname?.id) return json({ message: "昵称已被占用，请更换" }, 409);

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nickname,
      },
    });

    if (error) {
      const msg = error.message || "注册失败";
      if (msg.toLowerCase().includes("already") || msg.includes("exists")) {
        return json({ message: "该邮箱已注册，请直接登录" }, 409);
      }
      return json({ message: msg }, 400);
    }

    return json({
      id: data.user?.id,
      email: data.user?.email,
      message: "注册成功",
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
