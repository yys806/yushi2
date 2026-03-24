import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");

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
  color: ["破空蓝", "中国红", "远山青", "王者金", "霸道紫"],
};

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || `请求失败(${response.status})`);
  }
  return data;
}

function formatBudget(v) {
  return v >= 10000 ? "¥10000+" : `¥${v}`;
}

function mapWork(item) {
  return {
    id: item.id,
    name: item.title,
    summary: `材质：${item.material}，纹饰：${item.pattern}`,
    detailInspo: item.inspiration,
    detailMeaning: item.meaning,
    image: item.imageUrl || jadeImages[0],
    grade: item.grade || "A 级",
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
          <input
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="请输入邮箱"
          />
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
            昵称
            <input
              value={form.nickname}
              onChange={(e) => onChange("nickname", e.target.value)}
              placeholder="请输入昵称"
            />
          </label>
        )}
      </section>

      <button type="button" className="btn btn-primary" disabled={loading} onClick={onSubmit}>
        {loading ? "提交中..." : mode === "register" ? "注册并进入" : "登录并进入"}
      </button>

      <button type="button" className="btn btn-ghost" onClick={onMode}>
        {mode === "register" ? "已有账号？去登录" : "没有账号？去注册"}
      </button>

      {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}
    </>
  );
}

function Tabbar({ page, onNav }) {
  const tabs = [
    { key: "home", label: "首页" },
    { key: "custom", label: "定制" },
    { key: "product", label: "成品" },
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
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [stack, setStack] = useState([]);
  const [token, setToken] = useState(localStorage.getItem("yushi_token") || "");

  const [authMode, setAuthMode] = useState("register");
  const [authForm, setAuthForm] = useState({ email: "", password: "", nickname: "" });

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [currentWork, setCurrentWork] = useState(null);
  const [packages, setPackages] = useState([]);

  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");
  const [payMethod, setPayMethod] = useState("wechat");
  const [selectedPackage, setSelectedPackage] = useState("pkg_9_9");
  const [customTimes, setCustomTimes] = useState(100);

  const [custom, setCustom] = useState({
    material: "翡翠",
    pattern: "龙纹",
    form: "吊坠",
    color: "破空蓝",
    budget: 3000,
    subject: "山海神龙守护",
    customInput: "",
  });

  const [selectedHistoryId, setSelectedHistoryId] = useState("");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState("");
  const carouselRef = useRef(null);

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

  const loadUserData = useCallback(async (t) => {
    setLoadingData(true);
    setError("");
    try {
      const [me, works, favs, pkgs] = await Promise.all([
        api("/auth/me", { token: t }),
        api("/works/history", { token: t }),
        api("/works/favorites", { token: t }),
        api("/recharge/packages", { token: t }),
      ]);
      setProfile(me);
      setHistory((works || []).map(mapWork));
      setFavorites((favs || []).map(mapWork));
      setPackages(pkgs || []);
    } catch (e) {
      setError(e.message || "加载失败");
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadUserData(token);
  }, [token, loadUserData]);

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
      const body =
        authMode === "register"
          ? { email: authForm.email, password: authForm.password, nickname: authForm.nickname }
          : { email: authForm.email, password: authForm.password };
      const path = authMode === "register" ? "/auth/register" : "/auth/login";
      const result = await api(path, { method: "POST", body });
      localStorage.setItem("yushi_token", result.accessToken);
      setToken(result.accessToken);
      setPage("home");
      setStack([]);
    } catch (e) {
      setError(e.message || "登录/注册失败");
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleGenerate = async () => {
    setLoadingGenerate(true);
    setError("");
    try {
      const work = await api("/generate/work", {
        method: "POST",
        token,
        body: {
          material: custom.material,
          pattern: custom.pattern,
          productType: custom.form,
          budget: custom.budget,
          subject: custom.subject,
          styleHint: custom.color,
          customInput: custom.customInput,
        },
      });
      const mapped = mapWork(work);
      setCurrentWork(mapped);
      setHistory((h) => [mapped, ...h]);
      navTo("product");
      await loadUserData(token);
    } catch (e) {
      setError(e.message || "生成失败");
    } finally {
      setLoadingGenerate(false);
    }
  };

  const handleFavorite = async () => {
    if (!currentWork) return;
    setError("");
    try {
      const exists = favorites.some((x) => x.id === currentWork.id);
      await api(`/works/${currentWork.id}/favorite`, {
        method: exists ? "DELETE" : "POST",
        token,
      });
      await loadUserData(token);
    } catch (e) {
      setError(e.message || "收藏失败");
    }
  };

  const handlePay = async () => {
    setError("");
    try {
      await api("/recharge/order", {
        method: "POST",
        token,
        body: {
          packageId: selectedPackage || undefined,
          payChannel: payMethod,
          customTimes,
        },
      });
      await loadUserData(token);
      navBack();
    } catch (e) {
      setError(e.message || "充值失败");
    }
  };

  const quotaText = useMemo(() => {
    if (!profile) return "免费总计 5 次（剩余 5 次）";
    if (profile.isAdmin) return "管理员账号：无限额度";
    return `免费总计 ${profile.quotaTotal} 次（剩余 ${profile.quotaRemaining} 次）`;
  }, [profile]);

  if (!token) {
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

      <section>
        <h3 className="section-title">课程作品说明</h3>
        <article className="card intro-card">
          <p>这是我的课程作品，APP 名称为“珅玉定制”。命名缘由是名字中“珅”本身也是一种玉石。</p>
          <p>
            <strong>学号：</strong>2352396
            <br />
            <strong>姓名：</strong>禹尧珅
          </p>
          <p>本应用支持参数化定制、生图、灵感寓意生成、历史记录与收藏管理。</p>
        </article>
      </section>
    </>
  );

  const renderCustom = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">珅玉定制</h1>
      </header>
      <p className="muted">参数将进入大模型提示词，影响最终设计效果</p>

      <section className="card form-table">
        <label className="row-field">
          材质
          <select value={custom.material} onChange={(e) => setCustom((c) => ({ ...c, material: e.target.value }))}>
            {options.material.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="row-field">
          纹饰
          <select value={custom.pattern} onChange={(e) => setCustom((c) => ({ ...c, pattern: e.target.value }))}>
            {options.pattern.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="row-field">
          样式
          <select value={custom.form} onChange={(e) => setCustom((c) => ({ ...c, form: e.target.value }))}>
            {options.form.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>
        <label className="row-field">
          色系/风格
          <select value={custom.color} onChange={(e) => setCustom((c) => ({ ...c, color: e.target.value }))}>
            {options.color.map((v) => (
              <option key={v} value={v}>{v}</option>
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
        <div className="row-between muted tiny">
          <span>¥500</span>
          <span>¥10000+</span>
        </div>
      </section>

      <section className="card">
        <label className="row-field">
          定制主体
          <input
            value={custom.subject}
            onChange={(e) => setCustom((c) => ({ ...c, subject: e.target.value }))}
            placeholder="如：山海神龙守护"
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
        {loadingGenerate ? "生成中，请稍候..." : "生成成品卡片"}
      </button>
    </>
  );

  const renderProduct = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">成品</h1>
      </header>
      <p className="muted">生成结果与账号绑定，历史记录与收藏互通</p>
      <section className="product-wrap">
        <ProductCard work={currentWork} />
      </section>
      <button type="button" className="btn btn-primary" onClick={handleFavorite}>
        {favorites.some((x) => x.id === currentWork?.id) ? "取消收藏" : "收藏"}
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => navTo("custom")}>再次编辑</button>
    </>
  );

  const renderProfile = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">我的</h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            localStorage.removeItem("yushi_token");
            setToken("");
            setProfile(null);
          }}
        >
          退出
        </button>
      </header>

      <section className="card profile-card">
        <div className="avatar">YS</div>
        <div>
          <p><strong>昵称：</strong>{profile?.nickname || "-"}</p>
          <p><strong>邮箱：</strong>{profile?.email || "-"}</p>
          <p><strong>额度：</strong><span className="value-mono">{quotaText}</span></p>
        </div>
      </section>

      <section className="profile-grid">
        <button type="button" className="quick-card" onClick={() => navTo("recharge")}>
          <span className="icon">¥</span><span>充值</span><small>点击进入</small>
        </button>
        <button type="button" className="quick-card" onClick={() => navTo("history-list")}>
          <span className="icon">◷</span><span>历史记录</span><small>点击进入</small>
        </button>
        <button type="button" className="quick-card" onClick={() => navTo("favorites-list")}>
          <span className="icon">★</span><span>收藏</span><small>点击进入</small>
        </button>
      </section>
    </>
  );

  const renderRecharge = () => (
    <>
      <header className="sub-top">
        <button type="button" className="back" onClick={navBack}>← 返回</button>
        <h1>充值</h1>
      </header>
      <p className="muted">选择支付方式与套餐（当前为模拟支付流程）</p>

      <section className="pay-methods">
        <button
          type="button"
          className={`pay-method wechat ${payMethod === "wechat" ? "active" : ""}`}
          onClick={() => setPayMethod("wechat")}
        >
          <span className="icon">微</span><span>微信支付</span>
        </button>
        <button
          type="button"
          className={`pay-method alipay ${payMethod === "alipay" ? "active" : ""}`}
          onClick={() => setPayMethod("alipay")}
        >
          <span className="icon">支</span><span>支付宝</span>
        </button>
      </section>

      <h3 className="section-title">套餐</h3>
      <section className="package-row">
        {packages.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`package-card ${selectedPackage === item.id ? "active" : ""}`}
            onClick={() => setSelectedPackage(item.id)}
          >
            <span className="price">¥{item.amount}</span>
            <span className="times">{item.times} 次</span>
          </button>
        ))}
      </section>

      <section className="card">
        <h4>自定义续费（¥0.1 / 次）</h4>
        <label className="row-field">
          续费次数
          <input
            type="number"
            min="1"
            step="1"
            value={customTimes}
            onChange={(e) => setCustomTimes(Math.max(1, Number(e.target.value || 1)))}
          />
        </label>
      </section>

      <button type="button" className="btn btn-primary" onClick={handlePay}>立即支付</button>
    </>
  );

  const renderListPage = (title, tip, list, onOpen) => (
    <>
      <header className="sub-top">
        <button type="button" className="back" onClick={navBack}>← 返回</button>
        <h1>{title}</h1>
      </header>

      <p className="muted">{tip}</p>
      <section className="list-stack">
        {list.map((item) => (
          <button key={item.id} type="button" className="record-item" onClick={() => onOpen(item.id)}>
            <div className="thumb"><img src={item.image} alt={item.name} /></div>
            <div>
              <h4>{item.name}</h4>
              <p>寓意：{item.detailMeaning}</p>
            </div>
          </button>
        ))}
      </section>
    </>
  );

  const historyDetail = history.find((x) => x.id === selectedHistoryId) || history[0];
  const favoriteDetail = favorites.find((x) => x.id === selectedFavoriteId) || favorites[0];

  let content = null;
  if (loadingData && !profile) {
    content = <p className="muted">加载账号数据中...</p>;
  } else {
    if (page === "home") content = renderHome();
    if (page === "custom") content = renderCustom();
    if (page === "product") content = renderProduct();
    if (page === "profile") content = renderProfile();
    if (page === "recharge") content = renderRecharge();
    if (page === "history-list") {
      content = renderListPage("历史记录", "点击条目查看详情", history, (id) => {
        setSelectedHistoryId(id);
        navTo("history-detail");
      });
    }
    if (page === "history-detail") {
      content = (
        <>
          <header className="sub-top">
            <button type="button" className="back" onClick={navBack}>← 返回</button>
            <h1>历史记录详情</h1>
          </header>
          <section className="product-wrap"><ProductCard work={historyDetail} /></section>
        </>
      );
    }
    if (page === "favorites-list") {
      content = renderListPage("我的收藏", "点击收藏条目查看详情", favorites, (id) => {
        setSelectedFavoriteId(id);
        navTo("favorites-detail");
      });
    }
    if (page === "favorites-detail") {
      content = (
        <>
          <header className="sub-top">
            <button type="button" className="back" onClick={navBack}>← 返回</button>
            <h1>收藏详情</h1>
          </header>
          <section className="product-wrap"><ProductCard work={favoriteDetail} /></section>
        </>
      );
    }
  }

  return (
    <main className="app-shell">
      <section className="app">
        <section className="screen">
          {error ? <p className="muted" style={{ color: "#dc2626" }}>{error}</p> : null}
          {content}
        </section>
        {["home", "custom", "product", "profile"].includes(page) && <Tabbar page={page} onNav={setPage} />}
      </section>
    </main>
  );
}
