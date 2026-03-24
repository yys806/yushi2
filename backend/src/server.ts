import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import dotenv from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

type AppConfig = {
  server: { port: number; jwtSecret: string };
  siliconflow: {
    baseUrl: string;
    apiKey: string;
    textModel: string;
    imageModel: string;
  };
};

type LocalConfig = Partial<AppConfig>;
type AuthedRequest = Request & { userId?: string };

const prisma = new PrismaClient();
const ADMIN_EMAIL = "3492675568@qq.com";
const ADMIN_QUOTA_TOTAL = 2147483647;

const defaultRechargePackages = [
  { id: "pkg_9_9", name: "9.9 元 / 100次", amount: 9.9, times: 100 },
  { id: "pkg_19_9", name: "19.9 元 / 300次", amount: 19.9, times: 300 },
  { id: "pkg_39_9", name: "39.9 元 / 1000次", amount: 39.9, times: 1000 },
];

const materialPrompts: Record<string, string> = {
  翡翠:
    "顶级玻璃种翡翠，翠绿色，晶莹剔透，水头充足，强玻璃光泽，内部无瑕疵。Top quality Jadeite, vibrant emerald green, highly translucent, watery texture, strong glass luster.",
  和田玉:
    "极品新疆和田羊脂白玉，温润如脂，不透明至半透明，柔和油脂光泽。Hetian nephrite, mutton-fat white jade, warm oily luster, semi-translucent.",
  岫玉:
    "岫岩玉，黄绿色调，半透明，蜡状至玻璃光泽，水润清透。Xiuyan jade, yellow-green tone, translucent, waxy-vitreous luster.",
  独山玉:
    "独山玉，多色交织，白绿黑黄自然分布，适合俏色巧雕。Dushan jade, multi-color natural distribution.",
  绿松石:
    "高瓷蓝绿松石，不透明，天然铁线网纹，瓷质光泽。High-porcelain turquoise, sky-blue to green with spiderweb matrix.",
  寿山石:
    "寿山石温润细腻，微透明，蜡状光泽，适合精细雕刻。Shoushan carving stone, warm waxy luster.",
  田黄:
    "顶级田黄石，温润橘皮黄，微透明，可见萝卜丝纹。Tianhuang stone, honey-yellow, slight translucency.",
  鸡血石:
    "鸡血石灰黑地与鲜红辰砂强对比，不透明，抛光质感。Bloodstone with vivid cinnabar red patches.",
  石英质玉石:
    "石英质玉，半透明，强玻璃光泽，隐晶质结构细腻。Quartzite jade, translucent chalcedony texture.",
  欧珀:
    "欧泊具有明显变彩效应，红绿蓝光斑闪烁。Precious opal with strong play-of-color.",
};

const patternPrompts: Record<string, string> = {
  饕餮纹:
    "浅浮雕饕餮纹，商周青铜器风格，左右对称，大眼怒目，线条硬朗。Bas-relief Taotie pattern, Shang bronze style, strict symmetry.",
  龙纹:
    "高浮雕中国龙纹，鳞片清晰，龙爪锐利，腾云驾雾，动态强。High-relief Chinese dragon motif with detailed scales.",
  蝉纹:
    "汉代玉蝉风格，极简直线切面，几何化抽象。Han-style cicada pattern with minimalist sharp lines.",
  云雷纹:
    "连续云雷纹背景，方圆螺旋几何底纹，规整细密。Continuous cloud-thunder geometric background.",
  蟠螭纹:
    "蟠螭纹，小龙交织缠绕，线条灵动流畅，战汉风格。Interlaced Pan-chi pattern with intertwined dragons.",
  缠枝纹:
    "缠枝花卉纹，藤蔓花朵连续卷曲，明清宫廷风格繁复华丽。Interlocking floral scroll pattern.",
  鸟纹:
    "古代凤鸟纹，羽冠与尾羽夸张，线条流畅。Stylized ancient phoenix pattern.",
  鱼纹:
    "浮雕双鱼戏水，伴随波纹或莲花，寓意连年有余。Relief carving of paired fish with wave motifs.",
  云纹:
    "传统如意云纹，边缘柔和，层叠流动。Traditional Ruyi cloud pattern with flowing curves.",
  谷纹:
    "战国谷纹，细小凸起螺旋有序排列，颗粒饱满。Warring States grain pattern with raised spirals.",
  涡纹:
    "连续涡旋纹饰，圆形旋转有动感。Vortex pattern with circular dynamic flow.",
  绳纹:
    "绳纹，交叉缠绕刻线，类似拧紧绳索。Twisted rope texture with intersecting diagonal cuts.",
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

function readLocalConfig(): LocalConfig {
  const localPath = path.resolve(process.cwd(), "config/config.local.json");
  if (!fs.existsSync(localPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(localPath, "utf-8")) as LocalConfig;
  } catch {
    return {};
  }
}

function loadConfig(): AppConfig {
  const defaults: AppConfig = {
    server: {
      port: Number(process.env.PORT ?? 8080),
      jwtSecret: process.env.JWT_SECRET ?? "PLEASE_REPLACE_ME",
    },
    siliconflow: {
      baseUrl: process.env.SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn/v1",
      apiKey: process.env.SILICONFLOW_API_KEY ?? "",
      textModel: process.env.SILICONFLOW_TEXT_MODEL ?? "Pro/MiniMaxAI/MiniMax-M2.5",
      imageModel: process.env.SILICONFLOW_IMAGE_MODEL ?? "Qwen/Qwen-Image",
    },
  };

  const local = readLocalConfig();
  return {
    server: { ...defaults.server, ...(local.server ?? {}) },
    siliconflow: { ...defaults.siliconflow, ...(local.siliconflow ?? {}) },
  };
}

const config = loadConfig();
const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const siliconClient = axios.create({
  baseURL: config.siliconflow.baseUrl,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.siliconflow.apiKey}`,
  },
  timeout: 45000,
});

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.server.jwtSecret, { expiresIn: "7d" });
}

function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

function isAdminUser(user: { email: string }): boolean {
  return isAdminEmail(user.email);
}

function clampChars(value: string, min: number, max: number, fallback: string): string {
  const text = value.trim();
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
    if (row.material === material && row.patterns.includes(pattern)) {
      return row.warning;
    }
  }
  return null;
}

function mapUserProfile(user: {
  id: string;
  email: string;
  nickname: string;
  quotaTotal: number;
  quotaUsed: number;
}) {
  const admin = isAdminUser(user);
  return {
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    quotaTotal: user.quotaTotal,
    quotaUsed: user.quotaUsed,
    quotaRemaining: admin ? -1 : Math.max(0, user.quotaTotal - user.quotaUsed),
    isAdmin: admin,
  };
}

function mapWork(work: {
  id: string;
  title: string;
  material: string;
  pattern: string;
  productType: string;
  budget: number;
  subject: string;
  inspiration: string;
  meaning: string;
  grade: string;
  imageUrl: string;
  createdAt: Date;
}) {
  return {
    id: work.id,
    title: work.title,
    material: work.material,
    pattern: work.pattern,
    productType: work.productType,
    budget: work.budget,
    subject: work.subject,
    inspiration: work.inspiration,
    meaning: work.meaning,
    grade: work.grade,
    imageUrl: work.imageUrl,
    createdAt: work.createdAt.getTime(),
  };
}

function auth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.server.jwtSecret) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}

function parseTextJson(raw: string): { inspiration?: string; meaning?: string } | null {
  const cleaned = raw
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

function buildPromptBundle(input: {
  material: string;
  pattern: string;
  productType: string;
  styleHint: string;
  budget: number;
  subject: string;
  customInput: string;
}) {
  const materialPrompt = materialPrompts[input.material] ?? `${input.material}，强调真实玉石质感与高级光泽。`;
  const patternPrompt = patternPrompts[input.pattern] ?? `${input.pattern}，强调立体雕刻工艺，避免贴图感。`;
  const warning = comboWarning(input.material, input.pattern);

  const textBrief = [
    `材质：${input.material}`,
    `纹饰：${input.pattern}`,
    `样式：${input.styleHint || input.productType}`,
    `成品：${input.productType}`,
    `预算：${input.budget}`,
    `主题：${input.subject}`,
    input.customInput ? `用户自定义：${input.customInput}` : "",
    warning ? `组合提示：${warning}` : "",
  ]
    .filter(Boolean)
    .join("；");

  const imagePrompt = [
    "Chinese jade jewelry, premium craftsmanship, relief/intaglio carving, studio product photo, realistic gemstone texture",
    `Material: ${materialPrompt}`,
    `Pattern: ${patternPrompt}`,
    `Style: ${input.styleHint || input.productType}`,
    `Budget level: ${input.budget}`,
    `Theme: ${input.subject}`,
    input.customInput ? `Custom note: ${input.customInput}` : "",
    warning ? `Caution: ${warning}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  return { textBrief, imagePrompt, warning };
}

async function generateText(input: {
  subject: string;
  promptBrief: string;
  warning: string | null;
}): Promise<{ inspiration: string; meaning: string }> {
  const fallbackInspiration = clampChars(
    `以${input.subject}为核心，融合材质特征与雕刻语言，形成现代东方审美表达。`,
    20,
    40,
    "以主题为核心，融合材质与纹饰形成高级东方风格。"
  );
  const fallbackMeaning = clampChars(
    `${input.subject}寓意守护、成长与福泽长存。`,
    15,
    30,
    "寓意守护平安、福泽长久。"
  );

  if (!config.siliconflow.apiKey) {
    return {
      inspiration: input.warning ? `${fallbackInspiration}（${input.warning}）` : fallbackInspiration,
      meaning: fallbackMeaning,
    };
  }

  const prompt = [
    "你将基于以下参数生成珠宝文案：",
    input.promptBrief,
    "请严格输出 JSON：{\"inspiration\":\"...\",\"meaning\":\"...\"}",
    "inspiration 必须 20~40 字；meaning 必须 15~30 字；不要输出多余文本。",
  ].join("\n");

  const { data } = await siliconClient.post("/chat/completions", {
    model: config.siliconflow.textModel,
    messages: [
      { role: "system", content: "你是珠宝玉石设计文案助手，必须遵守字数和JSON格式。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const content = String(data?.choices?.[0]?.message?.content ?? "{}");
  const parsed = parseTextJson(content);
  if (!parsed) {
    return {
      inspiration: input.warning ? `${fallbackInspiration}（${input.warning}）` : fallbackInspiration,
      meaning: fallbackMeaning,
    };
  }

  const inspiration = clampChars(
    parsed.inspiration ?? "",
    20,
    40,
    "以主题为核心，融合材质与纹饰形成高级东方风格。"
  );
  const meaning = clampChars(parsed.meaning ?? "", 15, 30, "寓意守护平安、福泽长久。");

  return {
    inspiration: input.warning ? `${inspiration}（${input.warning}）` : inspiration,
    meaning,
  };
}

async function generateImage(prompt: string): Promise<string> {
  if (!config.siliconflow.apiKey) {
    return "https://picsum.photos/768/1024";
  }

  const { data } = await siliconClient.post("/images/generations", {
    model: config.siliconflow.imageModel,
    prompt,
    size: "1024x1024",
  });
  return String(data?.data?.[0]?.url ?? "");
}

async function ensureRechargePackages(): Promise<void> {
  for (const pkg of defaultRechargePackages) {
    await prisma.rechargePackage.upsert({
      where: { id: pkg.id },
      create: { id: pkg.id, name: pkg.name, amount: pkg.amount, times: pkg.times, active: true },
      update: { name: pkg.name, amount: pkg.amount, times: pkg.times, active: true },
    });
  }
}

async function ensureSchemaCompatible(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "nickname" TEXT NOT NULL,
      "quotaTotal" INTEGER NOT NULL DEFAULT 5,
      "quotaUsed" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RechargePackage" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "amount" DOUBLE PRECISION NOT NULL,
      "times" INTEGER NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Work" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL,
      "material" TEXT NOT NULL,
      "pattern" TEXT NOT NULL,
      "productType" TEXT NOT NULL,
      "budget" INTEGER NOT NULL,
      "subject" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "inspiration" TEXT NOT NULL,
      "meaning" TEXT NOT NULL,
      "grade" TEXT NOT NULL,
      "imageUrl" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Work_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Favorite" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL,
      "workId" UUID NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      CONSTRAINT "Favorite_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE,
      CONSTRAINT "Favorite_userId_workId_key" UNIQUE ("userId", "workId")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Order" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "userId" UUID NOT NULL,
      "packageId" TEXT,
      "amount" DOUBLE PRECISION NOT NULL,
      "times" INTEGER NOT NULL,
      "payChannel" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "thirdPartyOrderNo" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "paidAt" TIMESTAMP(3),
      CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
      CONSTRAINT "Order_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "RechargePackage"("id") ON DELETE SET NULL
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Work_userId_createdAt_idx" ON "Work"("userId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Order_packageId_idx" ON "Order"("packageId")`);
}

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: true });
  } catch {
    res.status(500).json({ ok: false, db: false });
  }
});

app.post("/auth/register", async (req, res) => {
  const { email, password, nickname } = req.body as {
    email?: string;
    password?: string;
    nickname?: string;
  };

  if (!email || !password || !nickname) {
    res.status(400).json({ message: "email/password/nickname required" });
    return;
  }

  const emailNorm = email.trim().toLowerCase();
  const nicknameNorm = nickname.trim();

  const emailErr = validateLength("邮箱", emailNorm, 5, 120);
  const passErr = validateLength("密码", password, 6, 64);
  const nickErr = validateLength("昵称", nicknameNorm, 2, 30);
  const message = emailErr ?? passErr ?? nickErr;
  if (message) {
    res.status(400).json({ message });
    return;
  }

  const duplicate = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (duplicate) {
    res.status(409).json({ message: "Email already exists" });
    return;
  }

  const admin = isAdminEmail(emailNorm);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: emailNorm,
      nickname: nicknameNorm,
      passwordHash,
      quotaTotal: admin ? ADMIN_QUOTA_TOTAL : 5,
      quotaUsed: 0,
    },
  });

  res.json({ accessToken: signToken(user.id) });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  res.json({ accessToken: signToken(user.id) });
});

app.get("/auth/me", auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId ?? "" } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json(mapUserProfile(user));
});

app.post("/generate/work", auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId ?? "" } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const { material, pattern, productType, budget, subject, styleHint, customInput } = req.body as {
    material?: string;
    pattern?: string;
    productType?: string;
    budget?: number;
    subject?: string;
    styleHint?: string;
    customInput?: string;
  };

  if (
    typeof material !== "string" ||
    material.trim().length === 0 ||
    typeof pattern !== "string" ||
    pattern.trim().length === 0 ||
    typeof productType !== "string" ||
    productType.trim().length === 0 ||
    typeof subject !== "string" ||
    subject.trim().length === 0 ||
    typeof budget !== "number" ||
    Number.isNaN(budget)
  ) {
    res.status(400).json({ message: "invalid generate payload" });
    return;
  }

  const customValue = typeof customInput === "string" ? customInput.trim() : "";
  const styleValue = typeof styleHint === "string" ? styleHint.trim() : "";

  const limits = [
    validateLength("材质", material, 1, 30),
    validateLength("纹饰", pattern, 1, 30),
    validateLength("成品类型", productType, 1, 30),
    validateLength("主题", subject, 2, 60),
    customValue ? validateLength("自定义要求", customValue, 2, 120) : null,
    styleValue ? validateLength("风格", styleValue, 1, 40) : null,
  ];
  const firstErr = limits.find((x) => Boolean(x));
  if (firstErr) {
    res.status(400).json({ message: firstErr });
    return;
  }

  const bundle = buildPromptBundle({
    material,
    pattern,
    productType,
    styleHint: styleValue,
    budget,
    subject,
    customInput: customValue,
  });

  const title = `${pattern}${productType} · ${styleValue || material}`;
  const text = await generateText({
    subject,
    promptBrief: bundle.textBrief,
    warning: bundle.warning,
  });
  const imageUrl = await generateImage(bundle.imagePrompt);

  try {
    const work = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const freshUser = await tx.user.findUnique({ where: { id: user.id } });
      if (!freshUser) throw new Error("USER_NOT_FOUND");

      const admin = isAdminUser(freshUser);
      if (!admin && freshUser.quotaUsed >= freshUser.quotaTotal) throw new Error("QUOTA_EXCEEDED");

      const created = await tx.work.create({
        data: {
          userId: user.id,
          title,
          material,
          pattern,
          productType,
          budget,
          subject,
          inspiration: text.inspiration,
          meaning: text.meaning,
          grade: "A 级",
          imageUrl,
        },
      });

      if (!admin) {
        await tx.user.update({
          where: { id: user.id },
          data: { quotaUsed: { increment: 1 } },
        });
      }

      return created;
    });

    res.json(mapWork(work));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg === "QUOTA_EXCEEDED") {
      res.status(403).json({ message: "Quota exceeded" });
      return;
    }
    res.status(500).json({ message: "Generate failed" });
  }
});

app.get("/works/history", auth, async (req: AuthedRequest, res) => {
  const list = await prisma.work.findMany({
    where: { userId: req.userId ?? "" },
    orderBy: { createdAt: "desc" },
  });
  res.json(list.map(mapWork));
});

app.get("/works/:id", auth, async (req: AuthedRequest, res) => {
  const work = await prisma.work.findUnique({ where: { id: req.params.id } });
  if (!work || work.userId !== req.userId) {
    res.status(404).json({ message: "Work not found" });
    return;
  }
  res.json(mapWork(work));
});

app.post("/works/:id/favorite", auth, async (req: AuthedRequest, res) => {
  const work = await prisma.work.findUnique({ where: { id: req.params.id } });
  if (!work || work.userId !== req.userId) {
    res.status(404).json({ message: "Work not found" });
    return;
  }

  await prisma.favorite.upsert({
    where: {
      userId_workId: {
        userId: req.userId ?? "",
        workId: req.params.id,
      },
    },
    create: {
      userId: req.userId ?? "",
      workId: req.params.id,
    },
    update: {},
  });
  res.json({ ok: true });
});

app.delete("/works/:id/favorite", auth, async (req: AuthedRequest, res) => {
  await prisma.favorite.deleteMany({
    where: {
      userId: req.userId ?? "",
      workId: req.params.id,
    },
  });
  res.json({ ok: true });
});

app.get("/works/favorites", auth, async (req: AuthedRequest, res) => {
  const list = await prisma.favorite.findMany({
    where: { userId: req.userId ?? "" },
    include: { work: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(list.map((x) => mapWork(x.work)));
});

app.get("/recharge/packages", auth, async (_req, res) => {
  const list = await prisma.rechargePackage.findMany({
    where: { active: true },
    orderBy: { amount: "asc" },
  });
  res.json(list.map((x) => ({ id: x.id, name: x.name, amount: x.amount, times: x.times })));
});

app.post("/recharge/order", auth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId ?? "" } });
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const { packageId, payChannel, customTimes } = req.body as {
    packageId?: string;
    payChannel?: "wechat" | "alipay";
    customTimes?: number;
  };

  if (payChannel !== "wechat" && payChannel !== "alipay") {
    res.status(400).json({ message: "payChannel must be wechat or alipay" });
    return;
  }

  let amount = 0;
  let times = 0;
  let finalPackageId: string | null = null;

  if (packageId) {
    const pkg = await prisma.rechargePackage.findFirst({ where: { id: packageId, active: true } });
    if (!pkg) {
      res.status(400).json({ message: "packageId invalid" });
      return;
    }
    finalPackageId = pkg.id;
    amount = pkg.amount;
    times = pkg.times;
  } else {
    const t = Math.max(1, Number(customTimes ?? 0));
    times = t;
    amount = Number((t * 0.1).toFixed(1));
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.order.create({
      data: {
        userId: user.id,
        packageId: finalPackageId,
        amount,
        times,
        payChannel,
        status: "paid",
        paidAt: new Date(),
      },
    });

    const admin = isAdminUser(user);
    const updatedUser = admin
      ? user
      : await tx.user.update({
          where: { id: user.id },
          data: { quotaTotal: { increment: times } },
        });

    return { order, user: updatedUser };
  });

  res.json({
    id: result.order.id,
    amount: result.order.amount,
    times: result.order.times,
    status: result.order.status,
    quotaTotal: result.user.quotaTotal,
    quotaUsed: result.user.quotaUsed,
    quotaRemaining: isAdminUser(result.user) ? -1 : Math.max(0, result.user.quotaTotal - result.user.quotaUsed),
  });
});

async function start(): Promise<void> {
  await prisma.$connect();
  await ensureSchemaCompatible();
  await ensureRechargePackages();

  app.listen(config.server.port, () => {
    console.log(`[backend] running at http://127.0.0.1:${config.server.port}`);
  });
}

start().catch((error) => {
  console.error("[backend] startup failed", error);
  process.exit(1);
});

async function shutdown(signal: string): Promise<void> {
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(signal === "SIGINT" ? 0 : 1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
