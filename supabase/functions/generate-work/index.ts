import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Json = Record<string, unknown>;

const materialPrompts: Record<string, string> = {
  翡翠:
    "顶级玻璃种翡翠，翠绿色，晶莹剔透，水头充足，强玻璃光泽，内部无瑕疵。Top quality Jadeite, vibrant emerald green, highly translucent, watery texture, strong glass luster.",
  和田玉:
    "极品新疆和田羊脂白玉，温润如脂，不透明至半透明，柔和油脂光泽。Hetian nephrite, mutton-fat white jade, warm oily luster, semi-translucent.",
  岫玉:
    "岫岩玉，黄绿色调，半透明，蜡状至玻璃光泽，水润清透。Xiuyan jade, yellow-green tone, translucent, waxy-vitreous luster.",
  独山玉: "独山玉，多色交织，白绿黑黄自然分布，适合俏色巧雕。Dushan jade, multi-color natural distribution.",
  绿松石:
    "高瓷蓝绿松石，不透明，天然铁线网纹，瓷质光泽。High-porcelain turquoise, sky-blue to green with spiderweb matrix.",
  寿山石: "寿山石温润细腻，微透明，蜡状光泽，适合精细雕刻。Shoushan carving stone, warm waxy luster.",
  田黄: "顶级田黄石，温润橘皮黄，微透明，可见萝卜丝纹。Tianhuang stone, honey-yellow, slight translucency.",
  鸡血石: "鸡血石灰黑地与鲜红辰砂强对比，不透明，抛光质感。Bloodstone with vivid cinnabar red patches.",
  石英质玉石: "石英质玉，半透明，强玻璃光泽，隐晶质结构细腻。Quartzite jade, translucent chalcedony texture.",
  欧珀: "欧泊具有明显变彩效应，红绿蓝光斑闪烁。Precious opal with strong play-of-color.",
};

const patternPrompts: Record<string, string> = {
  饕餮纹: "浅浮雕饕餮纹，商周青铜器风格，左右对称，大眼怒目，线条硬朗。Bas-relief Taotie pattern, Shang bronze style, strict symmetry.",
  龙纹: "高浮雕中国龙纹，鳞片清晰，龙爪锐利，腾云驾雾，动态强。High-relief Chinese dragon motif with detailed scales.",
  蝉纹: "汉代玉蝉风格，极简直线切面，几何化抽象。Han-style cicada pattern with minimalist sharp lines.",
  云雷纹: "连续云雷纹背景，方圆螺旋几何底纹，规整细密。Continuous cloud-thunder geometric background.",
  蟠螭纹: "蟠螭纹，小龙交织缠绕，线条灵动流畅，战汉风格。Interlaced Pan-chi pattern with intertwined dragons.",
  缠枝纹: "缠枝花卉纹，藤蔓花朵连续卷曲，明清宫廷风格繁复华丽。Interlocking floral scroll pattern.",
  鸟纹: "古代凤鸟纹，羽冠与尾羽夸张，线条流畅。Stylized ancient phoenix pattern.",
  鱼纹: "浮雕双鱼戏水，伴随波纹或莲花，寓意连年有余。Relief carving of paired fish with wave motifs.",
  云纹: "传统如意云纹，边缘柔和，层叠流动。Traditional Ruyi cloud pattern with flowing curves.",
  谷纹: "战国谷纹，细小凸起螺旋有序排列，颗粒饱满。Warring States grain pattern with raised spirals.",
  涡纹: "连续涡旋纹饰，圆形旋转有动感。Vortex pattern with circular dynamic flow.",
  绳纹: "绳纹，交叉缠绕刻线，类似拧紧绳索。Twisted rope texture with intersecting diagonal cuts.",
};

const disasterCombos = [
  {
    material: "欧珀",
    patterns: ["饕餮纹", "蟠螭纹", "云雷纹", "缠枝纹", "谷纹", "蝉纹", "龙纹"],
    warning: "欧珀更适合素面或简洁纹饰，复杂纹饰会破坏变彩效果。",
  },
  {
    material: "鸡血石",
    patterns: ["缠枝纹", "谷纹", "蝉纹"],
    warning: "鸡血石建议薄意雕或简约纹饰，避免细碎纹理与天然血色冲突。",
  },
  {
    material: "独山玉",
    patterns: ["蝉纹", "云雷纹"],
    warning: "独山玉多色明显，极简几何纹饰容易显脏乱。",
  },
];

const recommendedCombos = [
  {
    material: "和田玉",
    patterns: ["饕餮纹", "蟠螭纹", "谷纹", "蝉纹"],
    tip: "和田玉与高古纹饰契合度高，优先做古雅、克制、博物馆级的雕刻表达。",
  },
  {
    material: "翡翠",
    patterns: ["龙纹", "缠枝纹", "云纹", "鱼纹"],
    tip: "翡翠适合层次丰富的细节雕刻，强调通透与贵气。",
  },
  {
    material: "绿松石",
    patterns: ["饕餮纹", "云雷纹"],
    tip: "绿松石与古青铜风纹样组合更有神秘文明感。",
  },
  {
    material: "田黄",
    patterns: ["龙纹", "云纹"],
    tip: "田黄更适合印章或把件风格，强调温润与文人气质。",
  },
  {
    material: "寿山石",
    patterns: ["龙纹", "云纹"],
    tip: "寿山石适合印章向构图和浅浮雕表达，突出石性温润。",
  },
];

function json(data: Json, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function clampChars(value: string, min: number, max: number, fallback: string): string {
  const text = (value || "").trim();
  if (!text) return fallback.slice(0, max);
  if (text.length > max) return text.slice(0, max);
  if (text.length < min) return fallback.slice(0, max);
  return text;
}

function validateLength(name: string, value: string, min: number, max: number): string | null {
  if (value.length < min) return `${name}长度不能少于${min}`;
  if (value.length > max) return `${name}长度不能超过${max}`;
  return null;
}

function comboWarning(material: string, pattern: string): string | null {
  for (const row of disasterCombos) {
    if (row.material === material && row.patterns.includes(pattern)) return row.warning;
  }
  return null;
}

function comboRecommendation(material: string, pattern: string): string | null {
  for (const row of recommendedCombos) {
    if (row.material === material && row.patterns.includes(pattern)) return row.tip;
  }
  return null;
}

function parseTextJson(raw: string): { inspiration?: string; meaning?: string } | null {
  const cleaned = (raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as { inspiration?: string; meaning?: string };
  } catch {
    return null;
  }
}

function parsePromptJson(raw: string): { prompt?: string; negative?: string } | null {
  const cleaned = (raw || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as { prompt?: string; negative?: string };
  } catch {
    return null;
  }
}

function buildPromptBundle(input: {
  material: string;
  pattern: string;
  productType: string;
  styleHint: string;
  budget: number;
  subject: string;
  recipient: string;
  customInput: string;
}) {
  const materialPrompt = materialPrompts[input.material] ?? `${input.material}，强调真实玉石质感与高级光泽。`;
  const patternPrompt = patternPrompts[input.pattern] ?? `${input.pattern}，强调立体雕刻工艺，避免贴图感。`;
  const warning = comboWarning(input.material, input.pattern);
  const recommendation = comboRecommendation(input.material, input.pattern);
  const styleLabel = input.styleHint || input.productType;

  const strictSubject = [
    `A single Chinese jade ${input.productType} as the only subject`,
    "close-up product photography",
    "clean studio background",
    "center composition",
    "high detail macro texture",
    "real carved jade craftsmanship",
    "museum-quality object shot",
  ].join(", ");

  const strictNegative = [
    "NO landscape",
    "NO scenery",
    "NO mountains",
    "NO rivers",
    "NO forest",
    "NO architecture",
    "NO city",
    "NO people",
    "NO animals",
    "NO sky",
    "NO poster",
    "NO text watermark",
  ].join(", ");

  const textBrief = [
    `材质：${input.material}`,
    `纹饰：${input.pattern}`,
    `样式：${styleLabel}`,
    `成品：${input.productType}`,
    `送给：${input.recipient}`,
    `预算：${input.budget}`,
    `主题：${input.subject}`,
    input.customInput ? `用户自定义：${input.customInput}` : "",
    recommendation ? `推荐提示：${recommendation}` : "",
    warning ? `组合提示：${warning}` : "",
  ]
    .filter(Boolean)
    .join("；");

  const imagePrompt = [
    strictSubject,
    "Chinese jade jewelry, premium craftsmanship, relief/intaglio carving, realistic gemstone texture",
    `Material: ${materialPrompt}`,
    `Pattern: ${patternPrompt}`,
    `Style: ${styleLabel}`,
    `Recipient: ${input.recipient}`,
    "Camera: product close-up, 85mm lens look, neutral background, softbox light",
    `Budget level: ${input.budget}`,
    `Theme detail only as symbolic carving meaning: ${input.subject}`,
    input.customInput ? `Custom note: ${input.customInput}` : "",
    recommendation ? `Craft direction: ${recommendation}` : "",
    warning ? `Caution: ${warning}` : "",
    `Hard negative constraints: ${strictNegative}`,
  ]
    .filter(Boolean)
    .join(". ");

  return { textBrief, imagePrompt, warning, recommendation, negativePrompt: strictNegative };
}

async function callSiliconPromptComposer(
  apiKey: string,
  model: string,
  bundle: { textBrief: string; imagePrompt: string; warning: string | null; recommendation: string | null; negativePrompt: string },
  input: { material: string; pattern: string; productType: string; styleHint: string; budget: number; subject: string; recipient: string; customInput: string }
) {
  if (!apiKey) {
    return { prompt: bundle.imagePrompt, negative: bundle.negativePrompt };
  }

  const promptTask = [
    "你是玉石产品生图提示词工程师。",
    "任务：把用户参数和提示词库整理成最终生图提示词。",
    "硬规则：画面里必须只有单个玉石成品（手镯/摆件/吊坠等），产品居中，棚拍背景。",
    "硬规则：禁止风景、山川、建筑、人物、动物、天空、大场景叙事。",
    "请只输出 JSON：{\"prompt\":\"...\",\"negative\":\"...\"}",
    "prompt 用英文组织，negative 用英文短语列表。",
    `材质：${input.material}`,
    `纹饰：${input.pattern}`,
    `成品类型：${input.productType}`,
    `风格：${input.styleHint || input.productType}`,
    `预算：${input.budget}`,
    `送礼对象：${input.recipient}`,
    `主题：${input.subject}`,
    input.customInput ? `自定义要求：${input.customInput}` : "",
    `纹饰+材质结构化提示：${bundle.textBrief}`,
    `推荐提示：${bundle.recommendation || "无"}`,
    `风险提示：${bundle.warning || "无"}`,
    `基础安全提示：${bundle.imagePrompt}`,
  ]
    .filter(Boolean)
    .join("\n");

  const resp = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "你是高约束生图提示词工程师，只输出JSON，不输出其他内容。" },
        { role: "user", content: promptTask },
      ],
    }),
  });

  if (!resp.ok) {
    return { prompt: bundle.imagePrompt, negative: bundle.negativePrompt };
  }

  const data = await resp.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "{}");
  const parsed = parsePromptJson(content);

  const prompt = String(parsed?.prompt || "").trim() || bundle.imagePrompt;
  const negative = String(parsed?.negative || "").trim() || bundle.negativePrompt;
  return { prompt, negative };
}

async function callSiliconText(apiKey: string, model: string, promptBrief: string, subject: string, warning: string | null) {
  const fallbackInspiration = clampChars(
    `以${subject}为核心，融合材质特征与雕刻语言，形成现代东方审美表达。`,
    20,
    40,
    "以主题为核心，融合材质与纹饰形成高级东方风格。"
  );
  const fallbackMeaning = clampChars(`${subject}寓意守护、成长与福泽长存。`, 15, 30, "寓意守护平安、福泽长久。");

  if (!apiKey) {
    return {
      inspiration: warning ? `${fallbackInspiration}（${warning}）` : fallbackInspiration,
      meaning: fallbackMeaning,
    };
  }

  const prompt = [
    "你将基于以下参数生成珠宝文案：",
    promptBrief,
    "请严格输出 JSON：{\"inspiration\":\"...\",\"meaning\":\"...\"}",
    "inspiration 必须 20~40 字；meaning 必须 15~30 字；不要输出多余文本。",
  ].join("\n");

  const resp = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是珠宝玉石设计文案助手，必须遵守字数和JSON格式。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    return {
      inspiration: warning ? `${fallbackInspiration}（${warning}）` : fallbackInspiration,
      meaning: fallbackMeaning,
    };
  }

  const data = await resp.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "{}");
  const parsed = parseTextJson(content);
  if (!parsed) {
    return {
      inspiration: warning ? `${fallbackInspiration}（${warning}）` : fallbackInspiration,
      meaning: fallbackMeaning,
    };
  }

  const inspiration = clampChars(parsed.inspiration ?? "", 20, 40, "以主题为核心，融合材质与纹饰形成高级东方风格。");
  const meaning = clampChars(parsed.meaning ?? "", 15, 30, "寓意守护平安、福泽长久。");
  return {
    inspiration: warning ? `${inspiration}（${warning}）` : inspiration,
    meaning,
  };
}

async function callSiliconImage(apiKey: string, model: string, prompt: string, negativePrompt: string) {
  if (!apiKey) return "https://picsum.photos/768/1024";

  const finalPrompt = [prompt, `Negative constraints: ${negativePrompt}`].filter(Boolean).join(". ");

  const resp = await fetch("https://api.siliconflow.cn/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: finalPrompt,
      size: "1024x1024",
    }),
  });

  if (!resp.ok) return "https://picsum.photos/768/1024";
  const data = await resp.json();
  return String(data?.data?.[0]?.url ?? "https://picsum.photos/768/1024");
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
    const promptModel = Deno.env.get("SILICONFLOW_PROMPT_MODEL") || "Qwen/Qwen2.5-7B-Instruct";
    const imageModel = Deno.env.get("SILICONFLOW_IMAGE_MODEL") || "Qwen/Qwen-Image";

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ message: "Unauthorized" }, 401);

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: auth, error: authError } = await authedClient.auth.getUser();
    if (authError || !auth?.user) return json({ message: "Unauthorized" }, 401);

    const body = (await req.json()) as {
      material?: string;
      pattern?: string;
      productType?: string;
      styleHint?: string;
      budget?: number;
      subject?: string;
      recipient?: string;
      customInput?: string;
    };

    const material = (body.material || "").trim();
    const pattern = (body.pattern || "").trim();
    const productType = (body.productType || "").trim();
    const styleHint = (body.styleHint || "").trim();
    const subject = (body.subject || "").trim();
    const recipient = (body.recipient || "").trim() || "收礼人";
    const customInput = (body.customInput || "").trim();
    const budget = Number(body.budget || 0);

    const checks = [
      validateLength("材质", material, 1, 30),
      validateLength("纹饰", pattern, 1, 30),
      validateLength("成品类型", productType, 1, 30),
      validateLength("主题", subject, 2, 60),
      validateLength("送礼对象", recipient, 2, 30),
      customInput ? validateLength("自定义要求", customInput, 2, 120) : null,
      styleHint ? validateLength("风格", styleHint, 1, 40) : null,
      Number.isFinite(budget) && budget > 0 ? null : "预算不合法",
    ];
    const bad = checks.find((x) => Boolean(x));
    if (bad) return json({ message: bad }, 400);

    const { data: profile, error: profileError } = await authedClient
      .from("user_profiles")
      .select("id,email,nickname,quota_total,quota_used,is_admin")
      .eq("id", auth.user.id)
      .maybeSingle();

    if (profileError || !profile) return json({ message: "Profile not found" }, 404);

    if (!profile.is_admin && profile.quota_used >= profile.quota_total) {
      return json({ message: "Quota exceeded" }, 403);
    }

    const bundle = buildPromptBundle({ material, pattern, productType, styleHint, budget, subject, recipient, customInput });
    const text = await callSiliconText(siliconflowKey, textModel, bundle.textBrief, subject, bundle.warning);
    const composed = await callSiliconPromptComposer(
      siliconflowKey,
      promptModel,
      bundle,
      { material, pattern, productType, styleHint, budget, subject, recipient, customInput }
    );
    const imageUrl = await callSiliconImage(siliconflowKey, imageModel, composed.prompt, composed.negative);

    const title = `${pattern}${productType} · ${styleHint || material}`;

    const { data: inserted, error: insertError } = await adminClient
      .from("works")
      .insert({
        user_id: auth.user.id,
        material,
        pattern,
        product_type: productType,
        budget,
        subject,
        title,
        inspiration: text.inspiration,
        meaning: text.meaning,
        grade: "评级中...",
        grade_reason: "正在由AI进行评分",
        image_url: imageUrl,
      })
      .select("*")
      .single();

    if (insertError || !inserted) return json({ message: insertError?.message || "Insert failed" }, 500);

    if (!profile.is_admin) {
      const { error: updateError } = await adminClient
        .from("user_profiles")
        .update({ quota_used: profile.quota_used + 1, updated_at: new Date().toISOString() })
        .eq("id", auth.user.id);
      if (updateError) return json({ message: updateError.message }, 500);
    }

    return json({
      work: {
        id: inserted.id,
        title: inserted.title,
        material: inserted.material,
        pattern: inserted.pattern,
        productType: inserted.product_type,
        budget: inserted.budget,
        subject: inserted.subject,
        inspiration: inserted.inspiration,
        meaning: inserted.meaning,
        grade: inserted.grade,
        gradeReason: inserted.grade_reason,
        imageUrl: inserted.image_url,
        createdAt: new Date(inserted.created_at).getTime(),
      },
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
