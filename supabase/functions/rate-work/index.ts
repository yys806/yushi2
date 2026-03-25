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

function normalizeReason(text: unknown) {
  const raw = String(text ?? "").trim();
  if (!raw) return "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。";
  return raw.replace(/^"|"$/g, "").slice(0, 60);
}

function pickGrade(weights: { s: number; a: number; b: number; c: number }) {
  const s = Math.max(0, Math.floor(weights.s));
  const a = Math.max(0, Math.floor(weights.a));
  const b = Math.max(0, Math.floor(weights.b));
  const c = Math.max(0, Math.floor(weights.c));
  const total = s + a + b + c;
  if (total <= 0) return "C级";

  const hit = Math.floor(Math.random() * total) + 1;
  if (hit <= s) return "S级";
  if (hit <= s + a) return "A级";
  if (hit <= s + a + b) return "B级";
  return "C级";
}

async function callAiReason(apiKey: string, model: string, prompt: string) {
  if (!apiKey) {
    return "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。";
  }

  const resp = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是玉石设计评审专家。请仅输出一句中文评语，不要分点。",
        },
        {
          role: "user",
          content: [
            "请根据以下作品信息给出一句12-40字的中文评语。",
            prompt,
            "不要输出分数、不要输出等级。",
          ].join("\n"),
        },
      ],
      temperature: 0.5,
    }),
  });

  if (!resp.ok) {
    return "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。";
  }

  const data = await resp.json();
  return normalizeReason(data?.choices?.[0]?.message?.content);
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
    const siliconflowKey = Deno.env.get("SILICONFLOW_API_KEY") || "";
    const textModel = Deno.env.get("SILICONFLOW_TEXT_MODEL") || "Pro/deepseek-ai/DeepSeek-V3.2";

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

    const body = (await req.json()) as { workId?: string };
    const workId = String(body.workId || "").trim();
    if (!workId) return json({ message: "workId is required" }, 400);

    const { data: work, error: workError } = await authedClient
      .from("works")
      .select("id,user_id,material,pattern,product_type,budget,subject,title,inspiration,meaning")
      .eq("id", workId)
      .eq("user_id", authData.user.id)
      .maybeSingle();
    if (workError) return json({ message: workError.message }, 500);
    if (!work) return json({ message: "Work not found" }, 404);

    const { data: conf } = await authedClient
      .from("grade_probabilities")
      .select("s_weight,a_weight,b_weight,c_weight")
      .eq("id", "default")
      .maybeSingle();

    const weights = {
      s: Number(conf?.s_weight ?? 1),
      a: Number(conf?.a_weight ?? 10),
      b: Number(conf?.b_weight ?? 30),
      c: Number(conf?.c_weight ?? 50),
    };

    const grade = pickGrade(weights);
    const prompt = [
      `标题：${work.title}`,
      `材质：${work.material}`,
      `纹饰：${work.pattern}`,
      `成品类型：${work.product_type}`,
      `预算：${work.budget}`,
      `主题：${work.subject}`,
      `设计灵感：${work.inspiration}`,
      `寓意：${work.meaning}`,
    ].join("\n");

    const reason = await callAiReason(siliconflowKey, textModel, prompt);

    const { error: updateError } = await adminClient
      .from("works")
      .update({
        grade,
        grade_score: null,
        grade_reason: reason,
      })
      .eq("id", work.id)
      .eq("user_id", authData.user.id);
    if (updateError) return json({ message: updateError.message }, 500);

    return json({ grade, reason });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
