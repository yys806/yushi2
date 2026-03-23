import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import * as dotenv from "dotenv";

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

type User = {
  id: string;
  email: string;
  nickname: string;
  passwordHash: string;
  quotaTotal: number;
  quotaUsed: number;
};

type Work = {
  id: string;
  userId: string;
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
  createdAt: number;
};

type RechargePackage = {
  id: string;
  name: string;
  amount: number;
  times: number;
};

type Order = {
  id: string;
  userId: string;
  packageId: string;
  amount: number;
  times: number;
  payChannel: "wechat" | "alipay";
  status: "paid";
  createdAt: number;
};

const users = new Map<string, User>();
const works = new Map<string, Work>();
const favorites = new Map<string, Set<string>>();
const orders = new Map<string, Order>();

const rechargePackages: RechargePackage[] = [
  { id: "pkg_9_9", name: "9.9 元 / 100次", amount: 9.9, times: 100 },
  { id: "pkg_19_9", name: "19.9 元 / 300次", amount: 19.9, times: 300 },
  { id: "pkg_39_9", name: "39.9 元 / 1000次", amount: 39.9, times: 1000 },
];

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

  const localPath = path.resolve(process.cwd(), "config/config.local.json");
  if (fs.existsSync(localPath)) {
    const raw = JSON.parse(fs.readFileSync(localPath, "utf-8")) as Partial<AppConfig>;
    return {
      server: {
        ...defaults.server,
        ...(raw.server ?? {}),
      },
      siliconflow: {
        ...defaults.siliconflow,
        ...(raw.siliconflow ?? {}),
      },
    };
  }

  return defaults;
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

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.server.jwtSecret, { expiresIn: "7d" });
}

function auth(req: Request & { userId?: string }, res: Response, next: NextFunction): void {
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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
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

  const duplicate = Array.from(users.values()).find((x) => x.email === email);
  if (duplicate) {
    res.status(409).json({ message: "Email already exists" });
    return;
  }

  const userId = uid("u");
  const passwordHash = await bcrypt.hash(password, 10);
  users.set(userId, {
    id: userId,
    email,
    nickname,
    passwordHash,
    quotaTotal: 5,
    quotaUsed: 0,
  });

  res.json({ accessToken: signToken(userId) });
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const user = Array.from(users.values()).find((x) => x.email === email);
  if (!user || !password) {
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

app.get("/auth/me", auth, (req: Request & { userId?: string }, res) => {
  const user = users.get(req.userId ?? "");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    quotaTotal: user.quotaTotal,
    quotaUsed: user.quotaUsed,
    quotaRemaining: Math.max(0, user.quotaTotal - user.quotaUsed),
  });
});

async function generateText(subject: string): Promise<{ inspiration: string; meaning: string }> {
  if (!config.siliconflow.apiKey) {
    return {
      inspiration: `以${subject}为核心，结合器型比例与线条节奏，形成现代东方风格。`,
      meaning: `${subject}寓意守护、进阶与福泽长存。`,
    };
  }

  const prompt = `请基于主题“${subject}”输出两段中文：1) 设计灵感（20~40字）2) 寓意（15~30字），JSON格式: {"inspiration":"...","meaning":"..."}`;
  const { data } = await siliconClient.post("/chat/completions", {
    model: config.siliconflow.textModel,
    messages: [
      { role: "system", content: "你是珠宝玉石设计文案助手。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.7,
  });

  const text = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(text) as { inspiration?: string; meaning?: string };
    return {
      inspiration: parsed.inspiration ?? "设计灵感生成成功。",
      meaning: parsed.meaning ?? "寓意生成成功。",
    };
  } catch {
    return {
      inspiration: text.slice(0, 80),
      meaning: "寓意生成成功。",
    };
  }
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

  return data?.data?.[0]?.url ?? "";
}

app.post("/generate/work", auth, async (req: Request & { userId?: string }, res) => {
  const user = users.get(req.userId ?? "");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  if (user.quotaUsed >= user.quotaTotal) {
    res.status(403).json({ message: "Quota exceeded" });
    return;
  }

  const {
    material,
    pattern,
    productType,
    budget,
    subject,
  } = req.body as {
    material: string;
    pattern: string;
    productType: string;
    budget: number;
    subject: string;
  };

  const title = `${pattern}${productType} · ${material}`;
  const text = await generateText(subject);
  const imagePrompt = `${material} ${pattern} ${productType}, Chinese jade jewelry, premium product shot`;
  const imageUrl = await generateImage(imagePrompt);

  const work: Work = {
    id: uid("w"),
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
    createdAt: Date.now(),
  };
  works.set(work.id, work);
  user.quotaUsed += 1;

  res.json(work);
});

app.get("/works/history", auth, (req: Request & { userId?: string }, res) => {
  const list = Array.from(works.values())
    .filter((x) => x.userId === req.userId)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(list);
});

app.get("/works/:id", auth, (req: Request & { userId?: string }, res) => {
  const work = works.get(req.params.id);
  if (!work || work.userId !== req.userId) {
    res.status(404).json({ message: "Work not found" });
    return;
  }
  res.json(work);
});

app.post("/works/:id/favorite", auth, (req: Request & { userId?: string }, res) => {
  const work = works.get(req.params.id);
  if (!work || work.userId !== req.userId) {
    res.status(404).json({ message: "Work not found" });
    return;
  }
  const userFav = favorites.get(req.userId ?? "") ?? new Set<string>();
  userFav.add(req.params.id);
  favorites.set(req.userId ?? "", userFav);
  res.json({ ok: true });
});

app.delete("/works/:id/favorite", auth, (req: Request & { userId?: string }, res) => {
  const userFav = favorites.get(req.userId ?? "") ?? new Set<string>();
  userFav.delete(req.params.id);
  favorites.set(req.userId ?? "", userFav);
  res.json({ ok: true });
});

app.get("/works/favorites", auth, (req: Request & { userId?: string }, res) => {
  const favIds = favorites.get(req.userId ?? "") ?? new Set<string>();
  const list = Array.from(favIds)
    .map((id) => works.get(id))
    .filter((x): x is Work => Boolean(x));
  res.json(list);
});

app.get("/recharge/packages", auth, (_req, res) => {
  res.json(rechargePackages);
});

app.post("/recharge/order", auth, (req: Request & { userId?: string }, res) => {
  const user = users.get(req.userId ?? "");
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

  if (packageId) {
    const pkg = rechargePackages.find((x) => x.id === packageId);
    if (!pkg) {
      res.status(400).json({ message: "packageId invalid" });
      return;
    }
    amount = pkg.amount;
    times = pkg.times;
  } else {
    const t = Math.max(1, Number(customTimes ?? 0));
    times = t;
    amount = Number((t * 0.1).toFixed(1));
  }

  const orderId = uid("o");
  orders.set(orderId, {
    id: orderId,
    userId: user.id,
    packageId: packageId ?? "custom",
    amount,
    times,
    payChannel,
    status: "paid",
    createdAt: Date.now(),
  });

  user.quotaTotal += times;

  res.json({
    id: orderId,
    amount,
    times,
    status: "paid",
    quotaTotal: user.quotaTotal,
    quotaUsed: user.quotaUsed,
    quotaRemaining: Math.max(0, user.quotaTotal - user.quotaUsed),
  });
});

app.listen(config.server.port, () => {
  console.log(`[backend] running at http://127.0.0.1:${config.server.port}`);
});
