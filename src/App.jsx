import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

const jadeImages = [
  new URL("../images/generated-1774269443226.png", import.meta.url).href,
  new URL("../images/generated-1774269461267.png", import.meta.url).href,
  new URL("../images/generated-1774269499822.png", import.meta.url).href,
  new URL("../images/generated-1774269529367.png", import.meta.url).href,
  new URL("../images/generated-1774269555178.png", import.meta.url).href,
  new URL("../images/generated-1774269588658.png", import.meta.url).href,
  new URL("../images/generated-1774269623134.png", import.meta.url).href,
];

const options = {
  material: ["翡翠", "和田玉", "岫玉", "独山玉", "绿松石", "寿山石", "欧珀"],
  pattern: ["龙纹", "饕餮纹", "云纹", "鸟纹", "鱼纹", "绳纹", "蝉纹", "云雷纹", "蟠螭纹", "缠枝纹"],
  form: ["吊坠", "手镯", "戒指", "摆件", "印章"],
};

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const ADMIN_TOKEN_STORAGE_KEY = "shenyu_admin_token";

function parseJsonSafe(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isAuthFailure(message) {
  const msg = String(message || "").toLowerCase();
  return msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("登录");
}

function formatBudget(v) {
  return v >= 10000 ? "¥10000+" : `¥${v}`;
}

function formatTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

function mapWork(item) {
  return {
    id: item.id,
    name: item.title,
    summary: `材质：${item.material}，纹饰：${item.pattern}`,
    detailInspo: item.inspiration,
    detailMeaning: item.meaning,
    image: item.image_url || item.imageUrl || jadeImages[0],
    grade: item.grade || "评级中...",
    gradeReason: item.grade_reason || item.gradeReason || "",
  };
}

function ProductCard({ work }) {
  if (!work) return null;

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <div className="badge-row">
          <span className="chip">{work.name?.split(" · ")[0] || "作品名称"}</span>
          <span className="chip">{work.grade || "A 级"}</span>
        </div>
        <div className="image-stage">
          <img src={work.image} alt={work.name} />
        </div>
      </div>
      <section className="product-block">
        <h4>设计灵感</h4>
        <p>{work.detailInspo}</p>
      </section>
      <section className="product-block">
        <h4>寓意</h4>
        <p>{work.detailMeaning}</p>
      </section>
    </article>
  );
}

function AuthPage({ loading, error, mode, form, onChange, onMode, onSubmit }) {
  return (
    <>
      <header className="top-bar">
        <h1 className="title-lg">珅玉定制</h1>
      </header>
      <p className="muted">使用前请先注册或登录</p>

      <section className="card form-table">
        <label className="row-field">
          邮箱
          <input value={form.email} onChange={(e) => onChange("email", e.target.value)} placeholder="请输入邮箱" />
        </label>
        <label className="row-field">
          密码
          <input
            type="password"
            value={form.password}
            onChange={(e) => onChange("password", e.target.value)}
            placeholder="请输入密码"
          />
        </label>
        {mode === "register" && (
          <label className="row-field">
            确认密码
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(e) => onChange("confirmPassword", e.target.value)}
              placeholder="请再次输入密码"
            />
          </label>
        )}
        {mode === "register" && (
          <label className="row-field">
            昵称
            <input
              value={form.nickname}
              onChange={(e) => onChange("nickname", e.target.value)}
              placeholder="请输入昵称"
            />
          </label>
        )}
        {mode === "register" && (
          <p className="muted tiny">密码至少 8 位，且必须包含：大写字母、小写字母、数字、符号。</p>
        )}
      </section>

      <button type="button" className="btn btn-primary" disabled={loading} onClick={onSubmit}>
        {loading ? "提交中..." : mode === "register" ? "注册并进入" : "登录并进入"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onMode}>
        {mode === "register" ? "已有账号？去登录" : "没有账号？去注册"}
      </button>
      {error ? (
        <p className="muted" style={{ color: "#dc2626" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}

function Tabbar({ page, onNav, unreadCount }) {
  const tabs = [
    { key: "home", label: "首页" },
    { key: "custom", label: "定制" },
    { key: "product", label: "成品" },
    { key: "museum", label: "玉苑" },
    { key: "profile", label: "我的" },
  ];

  return (
    <div className="tabbar-wrap">
      <div className="tabbar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`tab-btn ${page === tab.key ? "active" : ""}`}
            onClick={() => onNav(tab.key)}
          >
            {tab.label}
            {tab.key === "profile" && unreadCount > 0 ? <span className="tab-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const isAdminRoute = pathname.startsWith("/admin");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const [page, setPage] = useState("home");
  const [stack, setStack] = useState([]);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState("register");
  const [authForm, setAuthForm] = useState({ email: "", password: "", confirmPassword: "", nickname: "" });

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [currentWork, setCurrentWork] = useState(null);
  const [applications, setApplications] = useState([]);
  const [notices, setNotices] = useState([]);
  const [messageReads, setMessageReads] = useState([]);
  const [activeMessage, setActiveMessage] = useState(null);
  const [rewardClaims, setRewardClaims] = useState([]);
  const [museumItems, setMuseumItems] = useState([]);
  const [selectedMuseumId, setSelectedMuseumId] = useState("");

  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [generatePhase, setGeneratePhase] = useState("idle");
  const [generateProgress, setGenerateProgress] = useState({ plan: 0, image: 0, rating: 0 });
  const [loadingData, setLoadingData] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [error, setError] = useState("");
  const [island, setIsland] = useState({ visible: false, message: "" });
  const [applyTimes, setApplyTimes] = useState(100);
  const [applyCustomTimes, setApplyCustomTimes] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ applicantName: "", reason: "" });
  const [adminPayload, setAdminPayload] = useState({ users: [], applications: [], notices: [], museumItems: [] });
  const [reviewNote, setReviewNote] = useState("");
  const [noticeDraft, setNoticeDraft] = useState({ title: "", content: "", kind: "normal", targetUserId: "" });
  const [activityDraft, setActivityDraft] = useState({ title: "", content: "", rewardTimes: 10, targetUserId: "" });
  const [quotaAdjustMap, setQuotaAdjustMap] = useState({});
  const [adminForm, setAdminForm] = useState({ email: "", password: "" });
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === "undefined") return "";
    if (!pathname.startsWith("/admin")) return "";
    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || "";
  });
  const [adminMenu, setAdminMenu] = useState("approvals");
  const [adminLoginLoading, setAdminLoginLoading] = useState(false);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [applyLoading, setApplyLoading] = useState(false);
  const [noticeRefreshing, setNoticeRefreshing] = useState(false);
  const [museumRefreshing, setMuseumRefreshing] = useState(false);
  const [museumForm, setMuseumForm] = useState({ category: "natural", title: "", description: "" });
  const [museumFile, setMuseumFile] = useState(null);

  const [custom, setCustom] = useState({
    material: "翡翠",
    pattern: "龙纹",
    form: "吊坠",
    budget: 3000,
    recipient: "送给妈妈",
    customInput: "",
  });

  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState("");
  const carouselRef = useRef(null);
  const islandTimerRef = useRef(null);
  const [profileEdit, setProfileEdit] = useState({
    nickname: "",
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });

  const showIsland = useCallback((message) => {
    if (islandTimerRef.current) {
      window.clearTimeout(islandTimerRef.current);
    }
    setIsland({ visible: true, message });
    islandTimerRef.current = window.setTimeout(() => {
      setIsland({ visible: false, message: "" });
      islandTimerRef.current = null;
    }, 1800);
  }, []);

  const navTo = (next) => {
    setStack((s) => [...s, page]);
    setPage(next);
  };

  const navBack = () => {
    setStack((s) => {
      const cp = [...s];
      const prev = cp.pop();
      setPage(prev || "home");
      return cp;
    });
  };

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const animateProgressBar = async (key, target, step = 1, delay = 130) => {
    while (true) {
      let done = false;
      setGenerateProgress((prev) => {
        const current = prev[key];
        if (current >= target) {
          done = true;
          return prev;
        }
        const next = Math.min(target, current + step);
        return {
          ...prev,
          [key]: next,
        };
      });
      if (done) return;
      await sleep(delay);
    }
  };

  const adminInvoke = useCallback(async (functionName, body = {}) => {
    if (!adminToken) throw new Error("请先登录管理员账户");
    const resp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const raw = await resp.text();
    const parsed = parseJsonSafe(raw);
    if (!resp.ok) throw new Error(parsed?.message || `请求失败(${resp.status})`);
    return parsed;
  }, [adminToken]);

  const handleAdminLogin = async () => {
    setAdminError("");
    setAdminLoginLoading(true);
    try {
      const email = adminForm.email.trim();
      const password = adminForm.password;
      const resp = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      const raw = await resp.text();
      const parsed = parseJsonSafe(raw);
      if (!resp.ok || !parsed?.access_token) {
        throw new Error(parsed?.msg || parsed?.error_description || "管理员登录失败");
      }

      const token = parsed.access_token;
      const dashResp = await fetch(`${supabaseUrl}/functions/v1/admin-dashboard`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const dashRaw = await dashResp.text();
      const dashData = parseJsonSafe(dashRaw);
      if (!dashResp.ok) {
        throw new Error(dashData?.message || "你不是管理员或后台不可用");
      }

      setAdminToken(token);
      setAdminPayload({
        users: dashData?.users || [],
        applications: dashData?.applications || [],
        notices: dashData?.notices || [],
        museumItems: dashData?.museumItems || [],
      });
      setAdminForm((prev) => ({ ...prev, password: "" }));
      showIsland("管理员登录成功");
    } catch (e) {
      setAdminError(e?.message || "管理员登录失败");
    } finally {
      setAdminLoginLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken("");
    setAdminPayload({ users: [], applications: [], notices: [], museumItems: [] });
    setReviewNote("");
    setNoticeDraft({ title: "", content: "", kind: "normal", targetUserId: "" });
    setActivityDraft({ title: "", content: "", rewardTimes: 10, targetUserId: "" });
    setQuotaAdjustMap({});
    setMuseumForm({ category: "natural", title: "", description: "" });
    setMuseumFile(null);
    setAdminForm((prev) => ({ ...prev, password: "" }));
  };

  const loadUserData = useCallback(async (u) => {
    if (!u) return;
    setLoadingData(true);
    setError("");

    try {
      const { data: profileRow, error: profileErr } = await supabase
        .from("user_profiles")
        .select("id,email,nickname,quota_total,quota_used,is_admin")
        .eq("id", u.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      setProfile({
        id: profileRow?.id,
        email: profileRow?.email || u.email || "",
        nickname: profileRow?.nickname || u.user_metadata?.nickname || "用户",
        quotaTotal: profileRow?.quota_total ?? 5,
        quotaUsed: profileRow?.quota_used ?? 0,
        quotaRemaining: profileRow?.is_admin ? -1 : Math.max(0, (profileRow?.quota_total ?? 5) - (profileRow?.quota_used ?? 0)),
        isAdmin: Boolean(profileRow?.is_admin),
      });

      const [worksRes, favRes, appRes, noticeRes, readRes, claimRes, museumRes] = await Promise.all([
        supabase
          .from("works")
          .select("*")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("favorites")
          .select("work_id, works(*)")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("quota_applications")
          .select("id,applicant_name,apply_reason,requested_times,status,review_note,created_at,reviewed_at")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notices")
          .select("id,title,content,kind,reward_times,target_user_id,created_at")
          .eq("active", true)
          .or(`target_user_id.is.null,target_user_id.eq.${u.id}`)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("message_reads")
          .select("message_type,message_id,read_at")
          .eq("user_id", u.id),
        supabase
          .from("reward_claims")
          .select("notice_id,claimed_at,reward_times")
          .eq("user_id", u.id),
        supabase
          .from("museum_items")
          .select("id,category,title,description,image_url,created_at")
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (worksRes.error) throw worksRes.error;
      if (favRes.error) throw favRes.error;
      if (appRes.error) throw appRes.error;
      if (noticeRes.error) throw noticeRes.error;
      if (readRes.error && readRes.error.code !== "42P01") throw readRes.error;
      if (claimRes.error && claimRes.error.code !== "42P01") throw claimRes.error;
      if (museumRes.error && museumRes.error.code !== "42P01") throw museumRes.error;

      const mappedHistory = (worksRes.data || []).map(mapWork);
      setHistory(mappedHistory);

      const mappedFav = (favRes.data || []).map((row) => mapWork(row.works));
      setFavorites(mappedFav);

      setApplications(appRes.data || []);
      setNotices(noticeRes.data || []);
      setMessageReads(readRes.error ? [] : readRes.data || []);
      setRewardClaims(claimRes.error ? [] : claimRes.data || []);
      setMuseumItems(museumRes.error ? [] : museumRes.data || []);
      if (mappedHistory.length && !currentWork) setCurrentWork(mappedHistory[0]);
    } catch (e) {
      setError(e?.message || "加载失败");
    } finally {
      setLoadingData(false);
    }
  }, [currentWork]);

  useEffect(() => {
    if (!isAdminRoute || typeof window === "undefined") return;
    if (adminToken) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, adminToken);
      return;
    }
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }, [isAdminRoute, adminToken]);

  useEffect(() => {
    return () => {
      if (islandTimerRef.current) {
        window.clearTimeout(islandTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setProfileEdit((prev) => ({
      ...prev,
      nickname: profile?.nickname || "",
    }));
  }, [profile?.nickname]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
        setHistory([]);
        setFavorites([]);
        setApplications([]);
        setNotices([]);
        setMessageReads([]);
        setRewardClaims([]);
        setActiveMessage(null);
        setMuseumItems([]);
        setSelectedMuseumId("");
        setAdminPayload({ users: [], applications: [], notices: [], museumItems: [] });
        setCurrentWork(null);
        setPage("home");
        setStack([]);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadUserData(user);
  }, [user, loadUserData]);

  useEffect(() => {
    if (page !== "home") return undefined;
    const el = carouselRef.current;
    if (!el) return undefined;
    const timer = window.setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + 162;
      if (next >= maxScroll - 4) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollTo({ left: next, behavior: "smooth" });
    }, 2200);
    return () => window.clearInterval(timer);
  }, [page]);

  const handleAuth = async () => {
    setLoadingAuth(true);
    setError("");
    try {
      if (authMode === "register") {
        if (!PASSWORD_RULE.test(authForm.password)) {
          throw new Error("密码至少 8 位，且必须包含大小写字母、数字和符号");
        }
        if (authForm.password !== authForm.confirmPassword) {
          throw new Error("两次输入的密码不一致");
        }

        const email = authForm.email.trim();
        const password = authForm.password;
        const nickname = authForm.nickname.trim();
        if (nickname.length < 2) {
          throw new Error("昵称至少 2 个字，且不能重复");
        }

        const { error: registerError } = await supabase.functions.invoke("signup-user", {
          body: { email, password, nickname },
        });
        if (registerError) throw registerError;

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: authForm.email.trim(),
          password: authForm.password,
        });
        if (signInError) throw signInError;
      }

      setPage("home");
      setStack([]);
    } catch (e) {
      setError(e?.message || "登录/注册失败");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleGenerate = async () => {
    if (!session?.access_token || loadingGenerate) return;
    const recipient = custom.recipient.trim();
    if (recipient.length < 2) {
      setError("请填写送给的对象（至少 2 个字）");
      return;
    }

    setLoadingGenerate(true);
    setGeneratePhase("plan");
    setGenerateProgress({ plan: 0, image: 0, rating: 0 });
    setError("");
    if (page !== "product") navTo("product");
    try {
      const invokePromise = supabase.functions.invoke("generate-work", {
        body: {
          material: custom.material,
          pattern: custom.pattern,
          productType: custom.form,
          budget: custom.budget,
          subject: `送给${recipient}的专属祝福`,
          styleHint: "",
          customInput: custom.customInput,
        },
      });

      await animateProgressBar("plan", 100, 1, 95);
      showIsland("设计思路已完成");

      setGeneratePhase("image");
      const stageTwoCapPromise = animateProgressBar("image", 86, 1, 120);
      const { data, error: invokeError } = await invokePromise;
      await stageTwoCapPromise;
      if (invokeError) throw invokeError;

      await animateProgressBar("image", 100, 2, 70);
      showIsland("设计图已完成");

      const mapped = mapWork(data?.work ?? data);
      setGeneratePhase("rating");
      const ratingCapPromise = animateProgressBar("rating", 90, 1, 110);
      const ratingResp = await supabase.functions.invoke("rate-work", {
        body: { workId: mapped.id },
      });
      await ratingCapPromise;

      if (!ratingResp.error && ratingResp.data?.grade) {
        mapped.grade = ratingResp.data.grade;
        mapped.gradeReason = ratingResp.data.reason || "";
      }

      await animateProgressBar("rating", 100, 2, 65);
      showIsland("AI评级已完成");

      setCurrentWork(mapped);
      setHistory((h) => [mapped, ...h]);
      await loadUserData(user);
    } catch (e) {
      setError(e?.message || "生成失败");
    } finally {
      window.setTimeout(() => {
        setLoadingGenerate(false);
        setGeneratePhase("idle");
        setGenerateProgress({ plan: 0, image: 0, rating: 0 });
      }, 320);
    }
  };

  const handleFavorite = async () => {
    if (!currentWork || !user) return;
    setError("");
    try {
      const exists = favorites.some((x) => x.id === currentWork.id);
      if (exists) {
        const { error: delErr } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("work_id", currentWork.id);
        if (delErr) throw delErr;
        showIsland("已取消收藏");
      } else {
        const { error: insertErr } = await supabase.from("favorites").insert({
          user_id: user.id,
          work_id: currentWork.id,
        });
        if (insertErr) throw insertErr;
        showIsland("收藏成功");
      }

      await loadUserData(user);
    } catch (e) {
      setError(e?.message || "收藏失败");
    }
  };

  const handleDeleteHistory = async (workId) => {
    if (!user || !workId) return;
    if (!window.confirm("确定删除这条历史记录吗？")) return;
    setError("");
    try {
      const { error: delErr } = await supabase.from("works").delete().eq("user_id", user.id).eq("id", workId);
      if (delErr) throw delErr;
      if (currentWork?.id === workId) setCurrentWork(null);
      await loadUserData(user);
      showIsland("历史已删除");
    } catch (e) {
      setError(e?.message || "删除失败");
    }
  };

  const handleDeleteFavorite = async (workId) => {
    if (!user || !workId) return;
    if (!window.confirm("确定删除这条收藏吗？")) return;
    setError("");
    try {
      const { error: delErr } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("work_id", workId);
      if (delErr) throw delErr;
      await loadUserData(user);
      showIsland("收藏已删除");
    } catch (e) {
      setError(e?.message || "删除失败");
    }
  };

  const handleUpdateNickname = async () => {
    if (!user) return;
    const nickname = profileEdit.nickname.trim();
    if (nickname.length < 2) {
      setError("昵称至少 2 个字");
      return;
    }
    setError("");
    try {
      const { data: dupRow, error: dupErr } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("nickname", nickname)
        .neq("id", user.id)
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (dupRow?.id) {
        throw new Error("昵称已被占用，请换一个");
      }

      const { error: updateErr } = await supabase.from("user_profiles").update({ nickname }).eq("id", user.id);
      if (updateErr) throw updateErr;
      await supabase.auth.updateUser({ data: { ...user.user_metadata, nickname } });
      await loadUserData(user);
      showIsland("昵称已更新");
    } catch (e) {
      setError(e?.message || "昵称更新失败");
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;
    if (!profileEdit.oldPassword || !profileEdit.newPassword || !profileEdit.confirmNewPassword) {
      setError("请完整填写密码修改表单");
      return;
    }
    if (!PASSWORD_RULE.test(profileEdit.newPassword)) {
      setError("新密码至少 8 位，且必须包含大小写字母、数字和符号");
      return;
    }
    if (profileEdit.newPassword !== profileEdit.confirmNewPassword) {
      setError("两次新密码不一致");
      return;
    }

    setError("");
    try {
      const { error: checkErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: profileEdit.oldPassword,
      });
      if (checkErr) throw new Error("旧密码不正确");

      const { error: changeErr } = await supabase.auth.updateUser({
        password: profileEdit.newPassword,
      });
      if (changeErr) throw changeErr;

      setProfileEdit((prev) => ({
        ...prev,
        oldPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      showIsland("密码修改成功");
    } catch (e) {
      setError(e?.message || "密码修改失败");
    }
  };

  const handleApplyQuota = async () => {
    if (!user) return;
    const times = Number(applyTimes);
    const applicantName = applyForm.applicantName.trim();
    const applyReason = applyForm.reason.trim();
    if (!Number.isInteger(times) || times <= 0 || times > 10000) {
      setError("申请额度需为 1~10000 的整数");
      return;
    }
    if (applicantName.length < 2) {
      setError("申请人名称至少 2 个字");
      return;
    }
    setError("");
    setApplyLoading(true);
    try {
      const { error: insertErr } = await supabase.from("quota_applications").insert({
        user_id: user.id,
        applicant_name: applicantName,
        apply_reason: applyReason || null,
        requested_times: times,
        status: "pending",
      });
      if (insertErr) throw insertErr;
      setApplyMessage("申请已提交，请等待管理员审批");
      setApplyDialogOpen(false);
      setApplyForm({ applicantName: "", reason: "" });
      showIsland("申请提交成功");
      await loadUserData(user);
    } catch (e) {
      setError(e?.message || "申请提交失败");
    } finally {
      setApplyLoading(false);
    }
  };

  const loadAdminDashboard = useCallback(async () => {
    if (!adminToken) return;
    setLoadingAdmin(true);
    setAdminError("");
    try {
      const data = await adminInvoke("admin-dashboard", {});
      setAdminPayload({
        users: data?.users || [],
        applications: data?.applications || [],
        notices: data?.notices || [],
        museumItems: data?.museumItems || [],
      });
    } catch (e) {
      const message = e?.message || "后台数据加载失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setLoadingAdmin(false);
    }
  }, [adminInvoke, adminToken]);

  const refreshNoticesAndApplications = useCallback(async () => {
    if (!user) return;
    setNoticeRefreshing(true);
    setError("");
    try {
      const [profileRes, appRes, noticeRes, readRes, claimRes] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("id,email,nickname,quota_total,quota_used,is_admin")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("quota_applications")
          .select("id,applicant_name,apply_reason,requested_times,status,review_note,created_at,reviewed_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notices")
          .select("id,title,content,kind,reward_times,target_user_id,created_at")
          .eq("active", true)
          .or(`target_user_id.is.null,target_user_id.eq.${user.id}`)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("message_reads")
          .select("message_type,message_id,read_at")
          .eq("user_id", user.id),
        supabase
          .from("reward_claims")
          .select("notice_id,claimed_at,reward_times")
          .eq("user_id", user.id),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (appRes.error) throw appRes.error;
      if (noticeRes.error) throw noticeRes.error;
      if (readRes.error && readRes.error.code !== "42P01") throw readRes.error;
      if (claimRes.error && claimRes.error.code !== "42P01") throw claimRes.error;

      const profileRow = profileRes.data;
      if (profileRow) {
        setProfile({
          id: profileRow.id,
          email: profileRow.email || user.email || "",
          nickname: profileRow.nickname || user.user_metadata?.nickname || "用户",
          quotaTotal: profileRow.quota_total ?? 5,
          quotaUsed: profileRow.quota_used ?? 0,
          quotaRemaining: profileRow.is_admin ? -1 : Math.max(0, (profileRow.quota_total ?? 5) - (profileRow.quota_used ?? 0)),
          isAdmin: Boolean(profileRow.is_admin),
        });
      }

      setApplications(appRes.data || []);
      setNotices(noticeRes.data || []);
      setMessageReads(readRes.error ? [] : readRes.data || []);
      setRewardClaims(claimRes.error ? [] : claimRes.data || []);
      showIsland("消息已刷新");
    } catch (e) {
      setError(e?.message || "消息刷新失败");
    } finally {
      setNoticeRefreshing(false);
    }
  }, [user, showIsland]);

  const refreshMuseum = useCallback(async () => {
    setMuseumRefreshing(true);
    setError("");
    try {
      const { data, error: museumErr } = await supabase
        .from("museum_items")
        .select("id,category,title,description,image_url,created_at")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(100);
      if (museumErr && museumErr.code !== "42P01") throw museumErr;
      setMuseumItems(museumErr ? [] : data || []);
      showIsland("玉苑已刷新");
    } catch (e) {
      setError(e?.message || "玉苑刷新失败");
    } finally {
      setMuseumRefreshing(false);
    }
  }, [showIsland]);

  useEffect(() => {
    if (!isAdminRoute || !adminToken) return;
    void loadAdminDashboard();
  }, [isAdminRoute, adminToken, loadAdminDashboard]);

  const handleReviewApplication = async (applicationId, decision) => {
    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("review-application", {
        applicationId,
        decision,
        reviewNote,
      });
      setReviewNote("");
      showIsland(decision === "approved" ? "审批已通过" : "审批已驳回");
      await Promise.all([loadAdminDashboard(), user ? loadUserData(user) : Promise.resolve()]);
    } catch (e) {
      const message = e?.message || "审批失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handlePublishNotice = async () => {
    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("publish-notice", {
        title: noticeDraft.title,
        content: noticeDraft.content,
        kind: noticeDraft.kind,
        rewardTimes: 0,
        targetUserId: noticeDraft.targetUserId || null,
        active: true,
      });
      setNoticeDraft({ title: "", content: "", kind: "normal", targetUserId: "" });
      showIsland("通知已发布");
      await Promise.all([loadAdminDashboard(), user ? loadUserData(user) : Promise.resolve()]);
    } catch (e) {
      const message = e?.message || "通知发布失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handlePublishActivity = async () => {
    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("publish-notice", {
        title: activityDraft.title,
        content: activityDraft.content,
        kind: "activity",
        rewardTimes: Number(activityDraft.rewardTimes) || 0,
        targetUserId: activityDraft.targetUserId || null,
        active: true,
      });
      setActivityDraft({ title: "", content: "", rewardTimes: 10, targetUserId: "" });
      showIsland("活动已发布");
      await Promise.all([loadAdminDashboard(), user ? refreshNoticesAndApplications() : Promise.resolve()]);
    } catch (e) {
      const message = e?.message || "活动发布失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handlePublishMuseumItem = async () => {
    if (!museumFile || !museumForm.title.trim() || !museumForm.description.trim()) {
      setAdminError("发布前必须填写图片、标题、说明");
      return;
    }

    setAdminError("");
    setAdminActionLoading(true);
    try {
      const fileName = museumFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const objectPath = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${fileName}`;
      const uploadResp = await fetch(`${supabaseUrl}/storage/v1/object/museum-assets/${objectPath}`, {
        method: "POST",
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${adminToken}`,
          "x-upsert": "false",
          "Content-Type": museumFile.type || "application/octet-stream",
        },
        body: museumFile,
      });

      const uploadRaw = await uploadResp.text();
      const uploadParsed = parseJsonSafe(uploadRaw);
      if (!uploadResp.ok) {
        throw new Error(uploadParsed?.message || uploadParsed?.error || `图片上传失败(${uploadResp.status})`);
      }

      const imageUrl = `${supabaseUrl}/storage/v1/object/public/museum-assets/${objectPath}`;
      await adminInvoke("publish-museum-item", {
        category: museumForm.category,
        title: museumForm.title.trim(),
        description: museumForm.description.trim(),
        imageUrl,
        active: true,
      });

      setMuseumForm({ category: "natural", title: "", description: "" });
      setMuseumFile(null);
      showIsland("玉苑内容已发布");
      await Promise.all([loadAdminDashboard(), refreshMuseum()]);
    } catch (e) {
      const message = e?.message || "玉苑发布失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminDeleteUser = async (targetUserId) => {
    if (!window.confirm("确定删除该用户吗？删除后不可恢复。")) return;
    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("admin-delete-user", { targetUserId });
      showIsland("用户已删除");
      await loadAdminDashboard();
    } catch (e) {
      const message = e?.message || "删除用户失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminDeleteNotice = async (noticeId) => {
    if (!window.confirm("确定删除这条公告吗？")) return;
    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("admin-delete-notice", { noticeId });
      showIsland("公告已删除");
      await Promise.all([loadAdminDashboard(), user ? loadUserData(user) : Promise.resolve()]);
    } catch (e) {
      const message = e?.message || "删除公告失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminEditNotice = async (notice) => {
    const title = window.prompt("编辑公告标题", notice.title || "");
    if (title === null) return;
    const content = window.prompt("编辑公告内容", notice.content || "");
    if (content === null) return;
    const titleTrimmed = title.trim();
    const contentTrimmed = content.trim();
    const kindInput = window.prompt("通知类型（announcement=公告橙色，normal=普通白色，activity=活动奖励）", notice.kind || "normal");
    if (kindInput === null) return;
    const rewardInput = window.prompt("奖励额度（仅 activity 生效）", String(notice.reward_times || 0));
    if (rewardInput === null) return;
    const targetUserInput = window.prompt("目标用户ID（留空表示全体用户）", notice.target_user_id || "");
    if (targetUserInput === null) return;
    const kindRaw = kindInput.trim();
    const kind = kindRaw === "announcement" || kindRaw === "activity" ? kindRaw : "normal";
    const rewardTimes = Math.max(0, Math.floor(Number(rewardInput || 0)));
    const targetUserId = targetUserInput.trim() || null;
    if (!titleTrimmed || !contentTrimmed) {
      setAdminError("标题和内容不能为空");
      return;
    }

    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("update-notice", {
        noticeId: notice.id,
        title: titleTrimmed,
        content: contentTrimmed,
        kind,
        rewardTimes,
        targetUserId,
      });
      showIsland("公告已更新");
      await Promise.all([loadAdminDashboard(), user ? refreshNoticesAndApplications() : Promise.resolve()]);
    } catch (e) {
      const message = e?.message || "更新公告失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminEditMuseumItem = async (item) => {
    const categoryInput = window.prompt("编辑分类（natural=自然玉石，carving=玉雕作品）", item.category || "natural");
    if (categoryInput === null) return;
    const title = window.prompt("编辑玉苑标题", item.title || "");
    if (title === null) return;
    const description = window.prompt("编辑玉苑说明", item.description || "");
    if (description === null) return;
    const category = categoryInput.trim() === "carving" ? "carving" : "natural";
    const titleTrimmed = title.trim();
    const descriptionTrimmed = description.trim();
    if (!titleTrimmed || !descriptionTrimmed) {
      setAdminError("标题和说明不能为空");
      return;
    }

    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("update-museum-item", {
        itemId: item.id,
        category,
        title: titleTrimmed,
        description: descriptionTrimmed,
      });
      showIsland("玉苑内容已更新");
      await Promise.all([loadAdminDashboard(), refreshMuseum()]);
    } catch (e) {
      const message = e?.message || "更新玉苑内容失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdminDeleteMuseumItem = async (itemId) => {
    if (!window.confirm("确定删除这条玉苑内容吗？")) return;
    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("admin-delete-museum-item", { itemId });
      showIsland("玉苑内容已删除");
      await Promise.all([loadAdminDashboard(), refreshMuseum()]);
    } catch (e) {
      const message = e?.message || "删除玉苑内容失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handleAdjustUserQuota = async (targetUserId) => {
    const raw = quotaAdjustMap[targetUserId];
    const quotaTotal = Math.max(0, Math.floor(Number(raw)));
    if (!Number.isFinite(quotaTotal)) {
      setAdminError("请输入有效的额度数值");
      return;
    }

    setAdminError("");
    setAdminActionLoading(true);
    try {
      await adminInvoke("adjust-user-quota", { targetUserId, quotaTotal });
      showIsland("用户额度已调整");
      await Promise.all([loadAdminDashboard(), user ? loadUserData(user) : Promise.resolve()]);
    } catch (e) {
      const message = e?.message || "调整额度失败";
      setAdminError(message);
      if (isAuthFailure(message)) {
        setAdminToken("");
      }
    } finally {
      setAdminActionLoading(false);
    }
  };

  const handlePay = async () => {
    setError("");
    setApplyMessage("");
    setApplyDialogOpen(true);
  };

  const quotaText = useMemo(() => {
    if (!profile) return "免费总计 5 次（剩余 5 次）";
    if (profile.isAdmin) return "管理员账号：无限额度";
    return `免费总计 ${profile.quotaTotal} 次（剩余 ${profile.quotaRemaining} 次）`;
  }, [profile]);

  const quotaProgress = useMemo(() => {
    if (!profile) {
      return { percent: 100, primary: "5 / 5 次", secondary: "剩余额度 5 次" };
    }
    if (profile.isAdmin) {
      return { percent: 100, primary: "无限额度", secondary: "管理员账号" };
    }
    const total = Math.max(1, Number(profile.quotaTotal) || 0);
    const remaining = Math.max(0, Number(profile.quotaRemaining) || 0);
    const used = Math.max(0, Number(profile.quotaUsed) || 0);
    const percent = Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
    return {
      percent,
      primary: `${remaining} / ${total} 次`,
      secondary: `已使用 ${used} 次`,
    };
  }, [profile]);

  const messageReadMap = useMemo(() => {
    const map = new Map();
    (messageReads || []).forEach((row) => {
      const key = `${row.message_type}:${row.message_id}`;
      map.set(key, row.read_at || "");
    });
    return map;
  }, [messageReads]);

  const rewardClaimMap = useMemo(() => {
    const map = new Map();
    (rewardClaims || []).forEach((row) => {
      map.set(String(row.notice_id), row);
    });
    return map;
  }, [rewardClaims]);

  const messageItems = useMemo(() => {
    const noticeItems = (notices || []).map((n) => {
      const key = `notice:${n.id}`;
      const readAt = messageReadMap.get(key);
      const claim = rewardClaimMap.get(String(n.id));
      const isActivity = n.kind === "activity";
      return {
        key,
        messageType: "notice",
        messageId: n.id,
        title: n.title,
        content: n.content,
        createdAt: n.created_at,
        kind: isActivity ? "activity" : n.kind === "announcement" ? "announcement" : "normal",
        rewardTimes: Number(n.reward_times || 0),
        isClaimed: Boolean(claim),
        claimedAt: claim?.claimed_at || "",
        targetUserId: n.target_user_id || null,
        isRead: Boolean(readAt),
        readAt,
      };
    });

    const appItems = (applications || []).map((a) => {
      const key = `application:${a.id}`;
      const readAt = messageReadMap.get(key);
      const statusText = a.status === "pending" ? "待审批" : a.status === "approved" ? "已批准" : "已驳回";
      const content = `你的额度申请 ${a.requested_times} 次，当前状态：${statusText}${a.review_note ? `（${a.review_note}）` : ""}`;
      return {
        key,
        messageType: "application",
        messageId: a.id,
        title: `额度申请通知 · ${a.requested_times} 次`,
        content,
        createdAt: a.reviewed_at || a.created_at,
        kind: "normal",
        isRead: Boolean(readAt),
        readAt,
      };
    });

    return [...noticeItems, ...appItems].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [notices, applications, messageReadMap, rewardClaimMap]);

  const unreadCount = useMemo(() => messageItems.filter((m) => !m.isRead).length, [messageItems]);

  const markMessageAsRead = useCallback(async (item) => {
    if (!user || !item || item.isRead) return;
    try {
      const { error: upsertErr } = await supabase.from("message_reads").upsert(
        {
          user_id: user.id,
          message_type: item.messageType,
          message_id: item.messageId,
          read_at: new Date().toISOString(),
        },
        { onConflict: "user_id,message_type,message_id" }
      );
      if (upsertErr && upsertErr.code !== "42P01") throw upsertErr;
      setMessageReads((prev) => {
        const exists = prev.some((r) => r.message_type === item.messageType && r.message_id === item.messageId);
        if (exists) {
          return prev.map((r) =>
            r.message_type === item.messageType && r.message_id === item.messageId
              ? { ...r, read_at: new Date().toISOString() }
              : r
          );
        }
        return [...prev, { message_type: item.messageType, message_id: item.messageId, read_at: new Date().toISOString() }];
      });
    } catch (e) {
      setError(e?.message || "标记已读失败");
    }
  }, [user]);

  const handleOpenMessage = async (item) => {
    setActiveMessage(item);
    await markMessageAsRead(item);
  };

  const handleClaimReward = async (item) => {
    if (!item || item.kind !== "activity" || item.isClaimed) return;
    setNoticeRefreshing(true);
    setError("");
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("claim-reward", {
        body: { noticeId: item.messageId },
      });
      if (invokeErr) throw invokeErr;
      if (data?.message) {
        showIsland(data.message);
      }
      await refreshNoticesAndApplications();
      if (activeMessage?.messageId === item.messageId) {
        setActiveMessage((prev) => (prev ? { ...prev, isClaimed: true } : prev));
      }
    } catch (e) {
      setError(e?.message || "领取失败");
    } finally {
      setNoticeRefreshing(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    const unreadItems = messageItems.filter((m) => !m.isRead);
    if (!unreadItems.length) {
      showIsland("没有未读消息");
      return;
    }

    setNoticeRefreshing(true);
    setError("");
    try {
      const payload = unreadItems.map((item) => ({
        user_id: user.id,
        message_type: item.messageType,
        message_id: item.messageId,
        read_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabase.from("message_reads").upsert(payload, {
        onConflict: "user_id,message_type,message_id",
      });
      if (upsertErr && upsertErr.code !== "42P01") throw upsertErr;
      await refreshNoticesAndApplications();
      showIsland("已全部标记为已读");
    } catch (e) {
      setError(e?.message || "一键已读失败");
    } finally {
      setNoticeRefreshing(false);
    }
  };

  if (!isAdminRoute && !user) {
    return (
      <main className="app-shell">
        <section className="app">
          <section className="screen">
            <AuthPage
              loading={loadingAuth}
              error={error}
              mode={authMode}
              form={authForm}
              onChange={(key, value) => setAuthForm((s) => ({ ...s, [key]: value }))}
              onMode={() => setAuthMode((m) => (m === "register" ? "login" : "register"))}
              onSubmit={handleAuth}
            />
          </section>
        </section>
      </main>
    );
  }

  const renderHome = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">珅玉定制</h1>
      </header>

      <section className="hero-card">
        <p className="hero-sub">今日灵感</p>
        <h2>一键定制你的专属玉石作品</h2>
        <button type="button" className="btn btn-primary" onClick={() => navTo("custom")}>
          进入定制
        </button>
      </section>

      <section>
        <h3 className="section-title">热门玉石</h3>
        <div ref={carouselRef} className="jade-carousel">
          {jadeImages.slice(0, 6).map((src, i) => (
            <div key={src} className="jade-item">
              <img src={src} alt={`玉石图 ${i + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      <section className="card intro-card">
        <h3 className="section-title">我的课程大作业作品说明</h3>
        <p>本作品是课程《中国玉石与玉文化鉴赏》的大作业，主题为“珅玉定制”交互系统。</p>
        <p>系统支持用户注册登录、专属参数定制、AI 生成设计思路与设计图，并展示成品卡片。</p>
        <p>作品还提供历史记录与收藏管理、额度申请与审批通知、账号设置等完整交互流程。</p>
        <p>学号：2352396 ｜ 姓名：禹尧珅。</p>
      </section>
    </>
  );

  const renderCustom = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">珅玉定制</h1>
      </header>
      <p className="muted">参数将进入大模型提示词，影响最终效果</p>

      <section className="card form-table">
        <label className="row-field">
          材质
          <select value={custom.material} onChange={(e) => setCustom((c) => ({ ...c, material: e.target.value }))}>
            {options.material.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="row-field">
          纹饰
          <select value={custom.pattern} onChange={(e) => setCustom((c) => ({ ...c, pattern: e.target.value }))}>
            {options.pattern.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="row-field">
          样式
          <select value={custom.form} onChange={(e) => setCustom((c) => ({ ...c, form: e.target.value }))}>
            {options.form.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <div className="row-between">
          <span className="label">预算</span>
          <span className="value-mono">{formatBudget(custom.budget)}</span>
        </div>
        <input
          type="range"
          min="500"
          max="10000"
          step="100"
          value={custom.budget}
          onChange={(e) => setCustom((c) => ({ ...c, budget: Number(e.target.value) }))}
        />
      </section>

      <section className="card">
        <label className="row-field">
          送给的对象
          <input
            value={custom.recipient}
            onChange={(e) => setCustom((c) => ({ ...c, recipient: e.target.value }))}
            placeholder="如：妈妈、男朋友、导师"
          />
        </label>
        <label className="row-field">
          自定义要求
          <input
            value={custom.customInput}
            onChange={(e) => setCustom((c) => ({ ...c, customInput: e.target.value }))}
            placeholder="补充细节（如工艺、构图）"
          />
        </label>
      </section>

      <button type="button" className="btn btn-primary" onClick={handleGenerate} disabled={loadingGenerate}>
        {loadingGenerate ? "生成中，请稍候..." : "立即生成成品"}
      </button>
    </>
  );

  const renderProduct = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">成品</h1>
      </header>
      <p className="muted">生成结果与账号绑定，历史与收藏隔离</p>
      <section className="product-wrap">
        <ProductCard
          work={
            currentWork || {
              id: "pending",
              name: "作品生成中",
              detailInspo: "正在生成设计灵感...",
              detailMeaning: "正在生成寓意说明...",
              image: jadeImages[0],
              grade: "--",
            }
          }
        />
      </section>
      {currentWork?.gradeReason ? (
        <section className="card form-table">
          <h3 className="section-title">AI评级说明</h3>
          <p className="muted">{currentWork.gradeReason}</p>
        </section>
      ) : null}
      <button type="button" className="btn btn-primary" onClick={handleFavorite}>
        {favorites.some((x) => x.id === currentWork?.id) ? "取消收藏" : "收藏"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => navTo("custom")}>
        再次编辑
      </button>
    </>
  );

  const renderMuseum = () => (
    (() => {
      const naturalItems = museumItems.filter((item) => item.category !== "carving");
      const carvingItems = museumItems.filter((item) => item.category === "carving");
      return (
    <>
      <header className="top-bar">
        <h1 className="title-lg">玉苑</h1>
        <button type="button" className="btn btn-ghost" disabled={museumRefreshing} onClick={() => void refreshMuseum()}>
          {museumRefreshing ? "刷新中..." : "刷新"}
        </button>
      </header>
      <p className="muted">玉石图鉴与文化说明，点击卡片查看详情。</p>

      <section className="card form-table">
        <h3 className="section-title">自然玉石</h3>
        <div className="museum-grid">
        {naturalItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="museum-card"
            onClick={() => {
              setSelectedMuseumId(item.id);
              navTo("museum-detail");
            }}
          >
            <img src={item.image_url} alt={item.title} loading="lazy" />
            <div className="museum-card-body">
              <h4>{item.title}</h4>
            </div>
          </button>
        ))}
        {!naturalItems.length ? <p className="muted">暂无自然玉石内容</p> : null}
        </div>
      </section>

      <section className="card form-table">
        <h3 className="section-title">玉雕作品</h3>
        <div className="museum-grid">
        {carvingItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="museum-card"
            onClick={() => {
              setSelectedMuseumId(item.id);
              navTo("museum-detail");
            }}
          >
            <img src={item.image_url} alt={item.title} loading="lazy" />
            <div className="museum-card-body">
              <h4>{item.title}</h4>
            </div>
          </button>
        ))}
        {!carvingItems.length ? <p className="muted">暂无玉雕作品内容</p> : null}
        </div>
      </section>

      {!museumItems.length ? <p className="muted">暂无馆藏内容，稍后刷新查看。</p> : null}
    </>
      );
    })()
  );

  const renderProfile = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">我的</h1>
        <div className="top-actions">
          <button type="button" className="gear-btn" onClick={() => navTo("settings")} aria-label="打开设置">
            ⚙
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              await supabase.auth.signOut();
            }}
          >
            退出
          </button>
        </div>
      </header>

      <section className="card profile-card">
        <div className="avatar">{(profile?.nickname || "玉").slice(0, 1).toUpperCase()}</div>
        <div>
          <p>
            <strong>昵称：</strong>
            {profile?.nickname || "-"}
          </p>
          <p>
            <strong>邮箱：</strong>
            {profile?.email || user.email || "-"}
          </p>
          <p>
            <strong>额度：</strong>
          </p>
          <div className="quota-progress-card">
            <div className="row-between">
              <span className="value-mono">{quotaProgress.primary}</span>
              <span className="muted tiny">{quotaProgress.percent}%</span>
            </div>
            <div className="progress-track quota-progress-track">
              <div className="progress-fill" style={{ width: `${quotaProgress.percent}%` }} />
            </div>
            <p className="muted tiny">{quotaProgress.secondary}</p>
            <p className="muted tiny">{quotaText}</p>
          </div>
        </div>
      </section>

      <section className="profile-grid">
        <button type="button" className="quick-card" onClick={() => navTo("apply-quota")}>
          <span className="icon">+</span>
          <span>申请额度</span>
          <small>点击进入</small>
        </button>
        <button type="button" className="quick-card" onClick={() => navTo("history-list")}>
          <span className="icon">◷</span>
          <span>历史记录</span>
          <small>点击进入</small>
        </button>
        <button type="button" className="quick-card" onClick={() => navTo("favorites-list")}>
          <span className="icon">★</span>
          <span>收藏</span>
          <small>点击进入</small>
        </button>
      </section>

      <section className="card form-table">
        <div className="row-between">
          <h3 className="section-title">消息通知</h3>
          <div className="admin-actions-inline">
            <button type="button" className="btn btn-ghost" disabled={noticeRefreshing} onClick={() => void refreshNoticesAndApplications()}>
              {noticeRefreshing ? "刷新中..." : "刷新消息"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={noticeRefreshing || unreadCount === 0} onClick={() => void handleMarkAllRead()}>
              一键已读
            </button>
          </div>
        </div>
        {messageItems.slice(0, 10).map((item) => (
          <button key={item.key} type="button" className={`notice-item message-item ${item.kind === "announcement" || item.kind === "activity" ? "notice-announcement" : "notice-normal"} ${item.isRead ? "is-read" : "is-unread"}`} onClick={() => void handleOpenMessage(item)}>
            {!item.isRead ? <span className="message-dot" /> : null}
            <h4>{item.title}</h4>
            <p>{item.content}</p>
            {item.kind === "activity" ? <p className="muted tiny">奖励额度：{item.rewardTimes || 0} 次 ｜ {item.isClaimed ? "已领取" : "待领取"}</p> : null}
            <p className="muted tiny">时间：{formatTime(item.createdAt)}</p>
          </button>
        ))}
        {!messageItems.length ? <p className="muted">暂无通知</p> : null}
      </section>
    </>
  );

  const renderSettings = () => (
    <>
      <header className="sub-top">
        <button type="button" className="back" onClick={navBack}>
          ← 返回
        </button>
        <h1>账号设置</h1>
      </header>

      <section className="card form-table">
        <h3 className="section-title">修改昵称</h3>
        <label className="row-field">
          新昵称
          <input
            value={profileEdit.nickname}
            onChange={(e) => setProfileEdit((s) => ({ ...s, nickname: e.target.value }))}
            placeholder="昵称不能重复"
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={handleUpdateNickname}>
          保存昵称
        </button>
      </section>

      <section className="card form-table">
        <h3 className="section-title">修改密码</h3>
        <label className="row-field">
          旧密码
          <input
            type="password"
            value={profileEdit.oldPassword}
            onChange={(e) => setProfileEdit((s) => ({ ...s, oldPassword: e.target.value }))}
            placeholder="请输入旧密码"
          />
        </label>
        <label className="row-field">
          新密码
          <input
            type="password"
            value={profileEdit.newPassword}
            onChange={(e) => setProfileEdit((s) => ({ ...s, newPassword: e.target.value }))}
            placeholder="请输入新密码"
          />
        </label>
        <label className="row-field">
          确认新密码
          <input
            type="password"
            value={profileEdit.confirmNewPassword}
            onChange={(e) => setProfileEdit((s) => ({ ...s, confirmNewPassword: e.target.value }))}
            placeholder="请再次输入新密码"
          />
        </label>
        <p className="muted tiny">新密码至少 8 位，且必须包含大小写字母、数字和符号。</p>
        <button type="button" className="btn btn-primary" onClick={handleChangePassword}>
          提交密码修改
        </button>
      </section>
    </>
  );

  const renderApplyQuota = () => (
    <>
      <header className="sub-top">
        <button type="button" className="back" onClick={navBack}>
          ← 返回
        </button>
        <h1>申请额度</h1>
      </header>

      <section className="card form-table">
        <h4>申请额度</h4>
        <div className="quota-option-grid">
          {[10, 100, 1000].map((n) => (
            <button
              key={n}
              type="button"
              className={`quota-option ${applyTimes === n ? "active" : ""}`}
              onClick={() => {
                setApplyTimes(n);
                setApplyCustomTimes("");
              }}
            >
              <span className="price">{n}</span>
              <span className="times">次</span>
              <span className="quota-fee">{n === 10 ? "¥5" : n === 100 ? "¥40" : "¥350"}</span>
            </button>
          ))}
        </div>
        <label className="row-field">
          自定义额度
          <input
            type="number"
            min="1"
            max="10000"
            step="1"
            value={applyCustomTimes}
            onChange={(e) => {
              const v = e.target.value;
              setApplyCustomTimes(v);
              const n = Number(v);
              if (Number.isInteger(n) && n > 0) setApplyTimes(n);
            }}
            placeholder="输入 1-10000 的整数"
          />
        </label>
        <p className="muted">自定义额度按 1 元/次计费。提交后将进入管理员审批队列，审批通过后自动增加可用额度。</p>
        <p className="muted">申请说明：请先添加微信 yys08060910，购买后在 APP 内提交申请，我会及时审批。</p>
      </section>

      <button type="button" className="btn btn-primary" onClick={handlePay} disabled={applyLoading}>
        {applyLoading ? "提交中..." : "提交申请"}
      </button>
      {applyMessage ? <p className="muted accent">{applyMessage}</p> : null}

      <section className="card form-table">
        <h3 className="section-title">我的审批状态</h3>
        {applications.slice(0, 8).map((a) => (
          <article key={a.id} className="notice-item">
            <h4>{a.requested_times} 次额度申请</h4>
            <p>
              状态：
              {a.status === "pending" ? "待审批" : a.status === "approved" ? "已批准" : "已驳回"}
              {a.review_note ? `（${a.review_note}）` : ""}
            </p>
            <p className="muted tiny">申请时间：{formatTime(a.created_at)} ｜ 审批时间：{formatTime(a.reviewed_at)}</p>
          </article>
        ))}
      </section>
    </>
  );

  const renderAdmin = () => {
    if (!adminToken) {
      return (
        <main className="admin-shell">
          <section className="admin-login-card card form-table">
            <h1 className="title-lg">管理员登录</h1>
            <p className="muted">管理后台与用户系统分离，仅支持管理员账号登录。</p>
            <label className="row-field">
              管理员邮箱
              <input
                value={adminForm.email}
                onChange={(e) => setAdminForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="请输入管理员邮箱"
              />
            </label>
            <label className="row-field">
              密码
              <input
                type="password"
                value={adminForm.password}
                onChange={(e) => setAdminForm((s) => ({ ...s, password: e.target.value }))}
                placeholder="请输入密码"
              />
            </label>
            <button type="button" className="btn btn-primary" disabled={adminLoginLoading} onClick={handleAdminLogin}>
              {adminLoginLoading ? "登录中..." : "登录后台"}
            </button>
            {adminError ? <p className="muted" style={{ color: "#dc2626" }}>{adminError}</p> : null}
          </section>
        </main>
      );
    }

    const pendingApps = (adminPayload.applications || []).filter((a) => a.status === "pending");
    const adminUserMap = new Map((adminPayload.users || []).map((u) => [u.id, u]));

    return (
      <main className="admin-shell">
        <section className="admin-layout">
          <aside className="admin-sidebar">
            <h2>珅玉管理后台</h2>
            <button type="button" className={`admin-menu-btn ${adminMenu === "approvals" ? "active" : ""}`} onClick={() => setAdminMenu("approvals")}>事项审批</button>
            <button type="button" className={`admin-menu-btn ${adminMenu === "users" ? "active" : ""}`} onClick={() => setAdminMenu("users")}>用户管理</button>
            <button type="button" className={`admin-menu-btn ${adminMenu === "notices" ? "active" : ""}`} onClick={() => setAdminMenu("notices")}>公告发布</button>
            <button type="button" className={`admin-menu-btn ${adminMenu === "activities" ? "active" : ""}`} onClick={() => setAdminMenu("activities")}>活动发布</button>
            <button type="button" className={`admin-menu-btn ${adminMenu === "museum" ? "active" : ""}`} onClick={() => setAdminMenu("museum")}>玉苑管理</button>
            <button type="button" className="btn btn-ghost" onClick={handleAdminLogout}>退出后台</button>
          </aside>

          <section className="admin-main">
            <header className="admin-topbar">
            <h1>{adminMenu === "approvals" ? "事项审批" : adminMenu === "users" ? "用户管理" : adminMenu === "notices" ? "公告发布" : adminMenu === "activities" ? "活动发布" : "玉苑管理"}</h1>
            <button type="button" className="btn btn-ghost" onClick={() => void loadAdminDashboard()} disabled={loadingAdmin || adminActionLoading}>刷新数据</button>
          </header>
            {loadingAdmin ? <p className="muted">加载中...</p> : null}
            {adminActionLoading ? <p className="muted">处理中，请稍候...</p> : null}
            {adminError ? <p className="muted" style={{ color: "#dc2626" }}>{adminError}</p> : null}

            {adminMenu === "approvals" ? (
              <section className="card form-table">
                <h3 className="section-title">待审批申请</h3>
                <label className="row-field">
                  审批备注（可选）
                  <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="如：请补充用途说明" />
                </label>
                {pendingApps.map((a) => (
                  <article key={a.id} className="record-item">
                    <div>
                      <h4>{adminUserMap.get(a.user_id)?.nickname || "用户"}（{adminUserMap.get(a.user_id)?.email || "-"}）</h4>
                      <p>申请人：{a.applicant_name || "-"}</p>
                      <p>申请理由：{a.apply_reason || "未填写"}</p>
                      <p>申请额度：{a.requested_times} 次</p>
                      <p className="muted tiny">申请时间：{formatTime(a.created_at)} ｜ 审批时间：{formatTime(a.reviewed_at)}</p>
                    </div>
                    <div className="admin-actions-inline">
                       <button type="button" className="btn btn-primary" disabled={adminActionLoading} onClick={() => handleReviewApplication(a.id, "approved")}>批准</button>
                       <button type="button" className="btn btn-ghost" disabled={adminActionLoading} onClick={() => handleReviewApplication(a.id, "rejected")}>驳回</button>
                    </div>
                  </article>
                ))}
                {!pendingApps.length ? <p className="muted">暂无待审批申请</p> : null}
              </section>
            ) : null}

            {adminMenu === "users" ? (
              <section className="card form-table">
                <h3 className="section-title">用户管理（可删除）</h3>
                {(adminPayload.users || []).map((u) => (
                  <article key={u.id} className="record-item">
                    <div>
                      <h4>{u.nickname}（{u.email}）</h4>
                      <p>剩余额度：{u.quota_remaining} 次（总 {u.quota_total} / 已用 {u.quota_used}）</p>
                      <div className="admin-actions-inline" style={{ marginTop: 8 }}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={quotaAdjustMap[u.id] ?? u.quota_total}
                          onChange={(e) => setQuotaAdjustMap((prev) => ({ ...prev, [u.id]: e.target.value }))}
                          placeholder="调整后的总额度"
                          style={{ maxWidth: 170 }}
                        />
                        <button type="button" className="btn btn-ghost" disabled={adminActionLoading} onClick={() => handleAdjustUserQuota(u.id)}>
                          调整额度
                        </button>
                      </div>
                    </div>
                    <button type="button" className="record-delete" disabled={adminActionLoading} onClick={() => handleAdminDeleteUser(u.id)}>删除用户</button>
                  </article>
                ))}
              </section>
            ) : null}

            {adminMenu === "notices" ? (
              <section className="card form-table">
                <h3 className="section-title">发布公告</h3>
                <label className="row-field">
                  标题
                  <input value={noticeDraft.title} onChange={(e) => setNoticeDraft((s) => ({ ...s, title: e.target.value }))} placeholder="请输入通知标题" />
                </label>
                <label className="row-field">
                  内容
                  <input value={noticeDraft.content} onChange={(e) => setNoticeDraft((s) => ({ ...s, content: e.target.value }))} placeholder="请输入通知内容" />
                </label>
                <label className="row-field">
                  通知类型
                  <select value={noticeDraft.kind} onChange={(e) => setNoticeDraft((s) => ({ ...s, kind: e.target.value }))}>
                    <option value="normal">普通通知（白色）</option>
                    <option value="announcement">公告通知（橙色）</option>
                  </select>
                </label>
                <label className="row-field">
                  发送对象
                  <select value={noticeDraft.targetUserId} onChange={(e) => setNoticeDraft((s) => ({ ...s, targetUserId: e.target.value }))}>
                    <option value="">全体用户</option>
                    {(adminPayload.users || []).map((u) => (
                      <option key={u.id} value={u.id}>{u.nickname}（{u.email}）</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-primary" disabled={adminActionLoading} onClick={handlePublishNotice}>发布通知</button>
                <h3 className="section-title">已发布公告</h3>
                {(adminPayload.notices || []).filter((n) => n.kind !== "activity").slice(0, 20).map((n) => (
                  <article key={n.id} className="notice-item">
                    <h4>{n.title}</h4>
                    <p>{n.content}</p>
                    <p className="muted tiny">类型：{n.kind === "announcement" ? "公告" : "普通通知"} ｜ 对象：{n.target_user_id ? (adminUserMap.get(n.target_user_id)?.nickname || n.target_user_id) : "全体用户"}</p>
                    <p className="muted tiny">发布时间：{formatTime(n.created_at)}</p>
                    <div className="admin-actions-inline">
                      <button type="button" className="btn btn-ghost" disabled={adminActionLoading} onClick={() => handleAdminEditNotice(n)}>编辑公告</button>
                      <button type="button" className="record-delete" disabled={adminActionLoading} onClick={() => handleAdminDeleteNotice(n.id)}>删除公告</button>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {adminMenu === "activities" ? (
              <section className="card form-table">
                <h3 className="section-title">发布活动奖励</h3>
                <label className="row-field">
                  标题
                  <input value={activityDraft.title} onChange={(e) => setActivityDraft((s) => ({ ...s, title: e.target.value }))} placeholder="请输入活动标题" />
                </label>
                <label className="row-field">
                  内容
                  <textarea value={activityDraft.content} onChange={(e) => setActivityDraft((s) => ({ ...s, content: e.target.value }))} placeholder="请输入活动内容" rows={4} />
                </label>
                <label className="row-field">
                  奖励额度
                  <input type="number" min="1" max="10000" step="1" value={activityDraft.rewardTimes} onChange={(e) => setActivityDraft((s) => ({ ...s, rewardTimes: e.target.value }))} placeholder="输入奖励额度" />
                </label>
                <label className="row-field">
                  发送对象
                  <select value={activityDraft.targetUserId} onChange={(e) => setActivityDraft((s) => ({ ...s, targetUserId: e.target.value }))}>
                    <option value="">全体用户</option>
                    {(adminPayload.users || []).map((u) => (
                      <option key={u.id} value={u.id}>{u.nickname}（{u.email}）</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn btn-primary" disabled={adminActionLoading} onClick={handlePublishActivity}>发布活动</button>

                <h3 className="section-title">已发布活动</h3>
                {(adminPayload.notices || []).filter((n) => n.kind === "activity").slice(0, 30).map((n) => (
                  <article key={n.id} className="notice-item notice-announcement">
                    <h4>{n.title}</h4>
                    <p>{n.content}</p>
                    <p className="muted tiny">奖励额度：{n.reward_times || 0} 次 ｜ 对象：{n.target_user_id ? (adminUserMap.get(n.target_user_id)?.nickname || n.target_user_id) : "全体用户"}</p>
                    <p className="muted tiny">发布时间：{formatTime(n.created_at)}</p>
                    <div className="admin-actions-inline">
                      <button type="button" className="btn btn-ghost" disabled={adminActionLoading} onClick={() => handleAdminEditNotice(n)}>编辑活动</button>
                      <button type="button" className="record-delete" disabled={adminActionLoading} onClick={() => handleAdminDeleteNotice(n.id)}>删除活动</button>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            {adminMenu === "museum" ? (
              <section className="card form-table">
                <h3 className="section-title">发布玉苑内容</h3>
                <p className="muted">发布必须包含图片、标题、说明三项。</p>
                <label className="row-field">
                  图片（本地上传）
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setMuseumFile(e.target.files?.[0] || null)}
                  />
                </label>
                <label className="row-field">
                  分类
                  <select value={museumForm.category} onChange={(e) => setMuseumForm((s) => ({ ...s, category: e.target.value }))}>
                    <option value="natural">自然玉石</option>
                    <option value="carving">玉雕作品</option>
                  </select>
                </label>
                <label className="row-field">
                  标题
                  <input
                    value={museumForm.title}
                    onChange={(e) => setMuseumForm((s) => ({ ...s, title: e.target.value }))}
                    placeholder="请输入标题"
                  />
                </label>
                <label className="row-field">
                  说明
                  <textarea
                    value={museumForm.description}
                    onChange={(e) => setMuseumForm((s) => ({ ...s, description: e.target.value }))}
                    placeholder="请输入说明"
                    rows={4}
                  />
                </label>
                <button type="button" className="btn btn-primary" disabled={adminActionLoading} onClick={handlePublishMuseumItem}>
                  发布到玉苑
                </button>

                <h3 className="section-title">已发布内容</h3>
                {(adminPayload.museumItems || []).slice(0, 30).map((m) => (
                  <article key={m.id} className="notice-item">
                    <h4>{m.title}</h4>
                    <p className="muted tiny">分类：{m.category === "carving" ? "玉雕作品" : "自然玉石"}</p>
                    <p className="muted tiny">发布时间：{formatTime(m.created_at)}</p>
                    <p>{m.description}</p>
                    <div className="admin-actions-inline">
                      <button type="button" className="btn btn-ghost" disabled={adminActionLoading} onClick={() => handleAdminEditMuseumItem(m)}>编辑</button>
                      <button type="button" className="record-delete" disabled={adminActionLoading} onClick={() => handleAdminDeleteMuseumItem(m.id)}>删除</button>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}
          </section>
        </section>
      </main>
    );
  };

  const renderListPage = (title, tip, list, onOpen, onDelete) => (
    <>
      <header className="sub-top">
        <button type="button" className="back" onClick={navBack}>
          ← 返回
        </button>
        <h1>{title}</h1>
      </header>

      <p className="muted">{tip}</p>
      <section className="list-stack">
        {list.map((item) => (
          <article key={item.id} className="record-item">
            <button type="button" className="record-open" onClick={() => onOpen(item.id)}>
              <div className="thumb">
                <img src={item.image} alt={item.name} />
              </div>
              <div>
                <h4>{item.name}</h4>
                <p>寓意：{item.detailMeaning}</p>
              </div>
            </button>
            <button type="button" className="record-delete" onClick={() => onDelete(item.id)}>
              删除
            </button>
          </article>
        ))}
      </section>
    </>
  );

  const renderGeneratingOverlay = () => (
    <section className="generate-overlay" aria-live="polite">
      <div className="overlay-panel">
        <h3>正在生成成品</h3>
        <p>{generatePhase === "plan" ? "正在生成设计思路..." : generatePhase === "image" ? "正在生成设计图..." : "正在进行AI评级..."}</p>

        <div className="progress-item">
          <div className="row-between">
            <span>设计方案生成中</span>
            <strong>{Math.round(generateProgress.plan)}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(generateProgress.plan)}%` }} />
          </div>
        </div>

        <div className="progress-item">
          <div className="row-between">
            <span>设计图生成中</span>
            <strong>{Math.round(generateProgress.image)}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(generateProgress.image)}%` }} />
          </div>
        </div>

        <div className="progress-item">
          <div className="row-between">
            <span>AI评级中</span>
            <strong>{Math.round(generateProgress.rating)}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${Math.round(generateProgress.rating)}%` }} />
          </div>
        </div>
      </div>
    </section>
  );

  const historyDetail = history.find((x) => x.id === selectedHistoryId) || history[0];
  const favoriteDetail = favorites.find((x) => x.id === selectedFavoriteId) || favorites[0];
  const museumDetail = museumItems.find((x) => x.id === selectedMuseumId) || museumItems[0];

  if (isAdminRoute) {
    return (
      <>
        {renderAdmin()}
        {island.visible ? (
          <div className="island-toast" role="status" aria-live="polite">
            <span className="island-check">✓</span>
            <span>{island.message}</span>
          </div>
        ) : null}
      </>
    );
  }

  let content = null;
  if (loadingData && !profile) {
    content = <p className="muted">加载账号数据中...</p>;
  } else {
    if (page === "home") content = renderHome();
    if (page === "custom") content = renderCustom();
    if (page === "product") content = renderProduct();
    if (page === "museum") content = renderMuseum();
    if (page === "profile") content = renderProfile();
    if (page === "settings") content = renderSettings();
    if (page === "apply-quota") content = renderApplyQuota();
    if (page === "history-list") {
      content = renderListPage("历史记录", "点击条目查看详情", history, (id) => {
        setSelectedHistoryId(id);
        navTo("history-detail");
      }, handleDeleteHistory);
    }
    if (page === "history-detail") {
      content = (
        <>
          <header className="sub-top">
            <button type="button" className="back" onClick={navBack}>
              ← 返回
            </button>
            <h1>历史记录详情</h1>
          </header>
          <section className="product-wrap">
            <ProductCard work={historyDetail} />
          </section>
          {historyDetail ? (
            <button type="button" className="btn btn-ghost" onClick={() => handleDeleteHistory(historyDetail.id)}>
              删除这条历史
            </button>
          ) : null}
        </>
      );
    }
    if (page === "favorites-list") {
      content = renderListPage("我的收藏", "点击收藏条目查看详情", favorites, (id) => {
        setSelectedFavoriteId(id);
        navTo("favorites-detail");
      }, handleDeleteFavorite);
    }
    if (page === "favorites-detail") {
      content = (
        <>
          <header className="sub-top">
            <button type="button" className="back" onClick={navBack}>
              ← 返回
            </button>
            <h1>收藏详情</h1>
          </header>
          <section className="product-wrap">
            <ProductCard work={favoriteDetail} />
          </section>
          {favoriteDetail ? (
            <button type="button" className="btn btn-ghost" onClick={() => handleDeleteFavorite(favoriteDetail.id)}>
              删除这条收藏
            </button>
          ) : null}
        </>
      );
    }
    if (page === "museum-detail") {
      content = (
        <>
          <header className="sub-top">
            <button type="button" className="back" onClick={navBack}>
              ← 返回
            </button>
            <h1>玉苑详情</h1>
          </header>
          {museumDetail ? (
            <article className="museum-detail-card">
              <img src={museumDetail.image_url} alt={museumDetail.title} />
              <h3>{museumDetail.title}</h3>
              <p className="muted tiny">发布时间：{formatTime(museumDetail.created_at)}</p>
              <p>{museumDetail.description}</p>
            </article>
          ) : (
            <p className="muted">暂无详情内容</p>
          )}
        </>
      );
    }
  }

  return (
    <main className="app-shell">
      <section className="app">
        <section className={`screen ${loadingGenerate && page === "product" ? "is-generating" : ""}`}>
          {error ? (
            <p className="muted" style={{ color: "#dc2626" }}>
              {error}
            </p>
          ) : null}
          {content}
          {loadingGenerate && page === "product" ? renderGeneratingOverlay() : null}
        </section>
        {["home", "custom", "product", "museum", "profile"].includes(page) && <Tabbar page={page} onNav={setPage} unreadCount={unreadCount} />}
        {island.visible ? (
          <div className="island-toast" role="status" aria-live="polite">
            <span className="island-check">✓</span>
            <span>{island.message}</span>
          </div>
        ) : null}
        {applyDialogOpen ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <section className="modal-card card form-table">
              <h3 className="section-title">提交额度申请</h3>
              <p className="muted">请填写申请人名称，申请理由可选。</p>
              <label className="row-field">
                申请人名称（必填）
                <input
                  value={applyForm.applicantName}
                  onChange={(e) => setApplyForm((s) => ({ ...s, applicantName: e.target.value }))}
                  placeholder="请输入申请人名称"
                />
              </label>
              <label className="row-field">
                申请理由（选填）
                <textarea
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm((s) => ({ ...s, reason: e.target.value }))}
                  placeholder="可填写用途或补充信息"
                  rows={4}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" disabled={applyLoading} onClick={() => setApplyDialogOpen(false)}>
                  取消
                </button>
                <button type="button" className="btn btn-primary" disabled={applyLoading} onClick={() => void handleApplyQuota()}>
                  {applyLoading ? "提交中..." : "发送申请"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {activeMessage ? (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <section className={`modal-card card form-table message-detail ${activeMessage.kind === "announcement" || activeMessage.kind === "activity" ? "message-detail-announcement" : "message-detail-normal"}`}>
              <div className="row-between">
                <h3 className="section-title">{activeMessage.title}</h3>
                <button type="button" className="btn btn-ghost" onClick={() => setActiveMessage(null)}>
                  关闭
                </button>
              </div>
              <p className="muted tiny">消息时间：{formatTime(activeMessage.createdAt)}</p>
              {activeMessage.kind === "activity" ? (
                <p className="muted tiny">活动奖励：{activeMessage.rewardTimes || 0} 次 ｜ {activeMessage.isClaimed ? `已领取（${formatTime(activeMessage.claimedAt)}）` : "待领取"}</p>
              ) : null}
              <article className="message-detail-body">
                {String(activeMessage.content || "")
                  .split(/\n+/)
                  .filter(Boolean)
                  .map((line) => (
                    <p key={`${activeMessage.key}-${line}`}>{line}</p>
                  ))}
              </article>
              {activeMessage.kind === "activity" ? (
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" disabled={noticeRefreshing || activeMessage.isClaimed} onClick={() => void handleClaimReward(activeMessage)}>
                    {activeMessage.isClaimed ? "已领取" : noticeRefreshing ? "领取中..." : "领取奖励"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
