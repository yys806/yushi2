import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown>;

const TEXT_INPUT_PRICE_PER_K = 0.002;
const TEXT_OUTPUT_PRICE_PER_K = 0.003;
const TEXT_CALL_TIMEOUT_MS = 25000;

type UsageInfo = {
  inputTokens: number;
  outputTokens: number;
};

function extractUsage(raw: unknown): UsageInfo {
  const usage = (raw || {}) as Record<string, unknown>;
  const inputTokens = Number(
    usage.prompt_tokens ?? usage.input_tokens ?? usage.promptTokens ?? usage.inputTokens ?? 0
  );
  const outputTokens = Number(
    usage.completion_tokens ?? usage.output_tokens ?? usage.completionTokens ?? usage.outputTokens ?? 0
  );
  return {
    inputTokens: Number.isFinite(inputTokens) && inputTokens > 0 ? Math.floor(inputTokens) : 0,
    outputTokens: Number.isFinite(outputTokens) && outputTokens > 0 ? Math.floor(outputTokens) : 0,
  };
}

function calcTextCostCny(inputTokens: number, outputTokens: number) {
  const inputCost = (inputTokens / 1000) * TEXT_INPUT_PRICE_PER_K;
  const outputCost = (outputTokens / 1000) * TEXT_OUTPUT_PRICE_PER_K;
  return Number((inputCost + outputCost).toFixed(6));
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function safeJson(resp: Response): Promise<Record<string, unknown> | null> {
  try {
    const data = await resp.json();
    if (!data || typeof data !== "object") return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
    return { reason: "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。", usage: { inputTokens: 0, outputTokens: 0 } };
  }

  let resp: Response;
  try {
    resp = await fetchWithTimeout(
      "https://api.siliconflow.cn/v1/chat/completions",
      {
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
      },
      TEXT_CALL_TIMEOUT_MS
    );
  } catch {
    return { reason: "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。", usage: { inputTokens: 0, outputTokens: 0 } };
  }

  if (!resp.ok) {
    return { reason: "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。", usage: { inputTokens: 0, outputTokens: 0 } };
  }

  const data = await safeJson(resp);
  if (!data) {
    return { reason: "器型与纹饰呼应得当，整体观感稳重且有文化意蕴。", usage: { inputTokens: 0, outputTokens: 0 } };
  }
  return {
    reason: normalizeReason(data?.choices?.[0]?.message?.content),
    usage: extractUsage(data?.usage),
  };
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

    const ratingResult = await callAiReason(siliconflowKey, textModel, prompt);
    const reason = ratingResult.reason;

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

    const inputTokens = ratingResult.usage?.inputTokens || 0;
    const outputTokens = ratingResult.usage?.outputTokens || 0;
    const textCost = calcTextCostCny(inputTokens, outputTokens);
    const { error: usageError } = await adminClient.from("ai_usage_logs").insert({
      user_id: authData.user.id,
      work_id: work.id,
      stage: "rating_text",
      provider: "siliconflow",
      model: textModel,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      image_count: 0,
      text_cost_cny: textCost,
      image_cost_cny: 0,
      total_cost_cny: textCost,
      metadata: {
        grade,
      },
    });
    if (usageError && usageError.code !== "42P01") {
      console.error("insert ai_usage_logs failed", usageError.message);
    }

    return json({ grade, reason });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
