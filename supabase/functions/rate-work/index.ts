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

function parseJsonSafe(raw: string): { score?: unknown; reason?: unknown } {
  const cleaned = (raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as { score?: unknown; reason?: unknown };
  } catch {
    return {};
  }
}

function scoreToGrade(score: number) {
  if (score >= 92) return "S 级";
  if (score >= 82) return "A 级";
  if (score >= 70) return "B 级";
  return "C 级";
}

async function callRater(apiKey: string, model: string, prompt: string) {
  if (!apiKey) {
    return {
      score: 80,
      reason: "整体设计较协调，材质与纹饰搭配自然。",
    };
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
          content: "你是玉石设计评审专家。你必须输出 JSON，不允许输出其他内容。",
        },
        {
          role: "user",
          content: [
            "请根据以下玉石作品信息，给出 0-100 分评分与一句简短评语。",
            prompt,
            "仅输出 JSON：{\"score\":88,\"reason\":\"...\"}",
            "reason 限制 12-40 字。",
          ].join("\n"),
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!resp.ok) {
    return {
      score: 80,
      reason: "整体设计较协调，材质与纹饰搭配自然。",
    };
  }

  const data = await resp.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "{}");
  const parsed = parseJsonSafe(content);
  const scoreRaw = Number(parsed.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 80;
  const reasonText = String(parsed.reason ?? "").trim();
  const reason = reasonText.length >= 12 ? reasonText.slice(0, 40) : "整体设计较协调，材质与纹饰搭配自然。";
  return { score, reason };
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
    const siliconflowKey = Deno.env.get("SILICONFLOW_API_KEY") || "";
    const textModel = Deno.env.get("SILICONFLOW_TEXT_MODEL") || "Pro/MiniMaxAI/MiniMax-M2.5";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ message: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) return json({ message: "Unauthorized" }, 401);

    const body = (await req.json()) as { workId?: string };
    const workId = String(body.workId || "").trim();
    if (!workId) return json({ message: "workId is required" }, 400);

    const { data: work, error: workError } = await supabase
      .from("works")
      .select("id,user_id,material,pattern,product_type,budget,subject,title,inspiration,meaning")
      .eq("id", workId)
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (workError) return json({ message: workError.message }, 500);
    if (!work) return json({ message: "Work not found" }, 404);

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

    const rated = await callRater(siliconflowKey, textModel, prompt);
    const grade = `${scoreToGrade(rated.score)}（${rated.score}分）`;

    const { error: updateError } = await supabase
      .from("works")
      .update({
        grade,
        grade_score: rated.score,
        grade_reason: rated.reason,
      })
      .eq("id", work.id)
      .eq("user_id", authData.user.id);

    if (updateError) return json({ message: updateError.message }, 500);

    return json({
      grade,
      score: rated.score,
      reason: rated.reason,
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
