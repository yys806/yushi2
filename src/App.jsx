import React, { useEffect, useMemo, useRef, useState } from "react";

const jadeImages = [
  "./images/generated-1774269443226.png",
  "./images/generated-1774269461267.png",
  "./images/generated-1774269499822.png",
  "./images/generated-1774269529367.png",
  "./images/generated-1774269555178.png",
  "./images/generated-1774269588658.png",
  "./images/generated-1774269623134.png",
];

const initialRecords = [
  {
    id: "r1",
    name: "龙纹吊坠 · 破空蓝",
    summary: "守护与进阶，线条刚柔并济。",
    detailInspo: "取龙跃云海之势，线条刚柔并济。",
    detailMeaning: "守护、进阶与福泽长存。",
    image: jadeImages[0],
    grade: "A 级",
  },
  {
    id: "r2",
    name: "饕餮摆件 · 中国红",
    summary: "镇宅纳福，厚重有力。",
    detailInspo: "参考青铜器神兽意象，体量感更强。",
    detailMeaning: "护宅纳祥，福气旺宅，长久守护。",
    image: jadeImages[1],
    grade: "A 级",
  },
  {
    id: "r3",
    name: "云纹手镯 · 远山青",
    summary: "清雅平和，福泽绵长。",
    detailInspo: "以云纹环绕，强调流动感与层次。",
    detailMeaning: "温润守心，安宁顺遂。",
    image: jadeImages[2],
    grade: "A 级",
  },
];

const options = {
  material: ["翡翠", "和田玉", "岫玉", "独山玉", "绿松石", "寿山石", "欧珀"],
  pattern: ["龙纹", "饕餮纹", "云纹", "鸟纹", "鱼纹", "绳纹"],
  form: ["吊坠", "手镯", "戒指", "摆件"],
  color: ["破空蓝", "中国红", "远山青", "王者金", "霸道紫"],
};

const packageOptions = [
  { id: "p1", price: 9.9, times: 100 },
  { id: "p2", price: 19.9, times: 300 },
  { id: "p3", price: 39.9, times: 1000 },
];

function formatBudget(v) {
  return v >= 10000 ? "¥10000+" : `¥${v}`;
}

function ProductCard({ work }) {
  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <div className="badge-row">
          <span className="chip">{work.name.split(" · ")[0] || "作品名称"}</span>
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
  const [payMethod, setPayMethod] = useState("wechat");
  const [selectedPackage, setSelectedPackage] = useState("p1");
  const [customTimes, setCustomTimes] = useState(200);

  const [custom, setCustom] = useState({
    material: "翡翠",
    pattern: "龙纹",
    form: "吊坠",
    color: "破空蓝",
    budget: 3000,
    subject: "山海神龙守护",
  });

  const [quota, setQuota] = useState({ total: 5, used: 2 });
  const [history, setHistory] = useState(initialRecords);
  const [favorites, setFavorites] = useState([initialRecords[0], initialRecords[2]]);
  const [currentWork, setCurrentWork] = useState(initialRecords[0]);
  const [selectedHistoryId, setSelectedHistoryId] = useState(initialRecords[0].id);
  const [selectedFavoriteId, setSelectedFavoriteId] = useState(initialRecords[0].id);
  const carouselRef = useRef(null);

  useEffect(() => {
    if (page !== "home") return undefined;
    const el = carouselRef.current;
    if (!el) return undefined;

    const step = 162;
    const timer = window.setInterval(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const next = el.scrollLeft + step;

      if (next >= maxScroll - 4) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollTo({ left: next, behavior: "smooth" });
      }
    }, 2200);

    return () => window.clearInterval(timer);
  }, [page]);

  const quotaText = useMemo(
    () => `免费总计 ${quota.total} 次（剩余 ${Math.max(0, quota.total - quota.used)} 次）`,
    [quota]
  );

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

  const onGenerate = () => {
    const newWork = {
      id: `work-${Date.now()}`,
      name: `${custom.pattern}${custom.form} · ${custom.color}`,
      summary: `材质：${custom.material}，预算：${formatBudget(custom.budget)}。`,
      detailInspo: `以${custom.pattern}为核心纹样，结合${custom.form}形态进行现代化表达。`,
      detailMeaning: custom.subject || "守护、进阶与福泽长存。",
      image: jadeImages[Math.floor(Math.random() * jadeImages.length)],
      grade: ["A 级", "B 级", "S 级", "C 级"][Math.floor(Math.random() * 4)],
    };

    setCurrentWork(newWork);
    setHistory((h) => [newWork, ...h]);
    setQuota((q) => ({ ...q, used: Math.min(q.total, q.used + 1) }));
    navTo("product");
  };

  const onFavorite = () => {
    setFavorites((f) => {
      if (f.some((x) => x.id === currentWork.id)) return f;
      return [currentWork, ...f];
    });
  };

  const onPay = () => {
    const pkg = packageOptions.find((p) => p.id === selectedPackage);
    if (pkg) {
      setQuota((q) => ({ ...q, used: Math.max(0, q.used - Math.floor(pkg.times / 100)) }));
    }
    navBack();
  };

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
          <p>
            这是我的课程作品，APP 名称为“珅玉定制”。命名缘由是我的名字里有“珅”，而“珅”本身也是一种玉石。
          </p>
          <p>
            <strong>学号：</strong>2352396
            <br />
            <strong>姓名：</strong>禹尧珅
          </p>
          <p>
            本应用支持玉石材质、纹饰、成品形态与预算配置，生成个性化成品卡片，并提供历史记录、收藏与充值管理等功能。
          </p>
        </article>
      </section>
    </>
  );

  const renderCustom = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">珅玉定制</h1>
      </header>

      <p className="muted">按步骤选择参数，展开下拉表格进行配置</p>

      <section className="card form-table">
        <label className="row-field">
          材质
          <select
            value={custom.material}
            onChange={(e) => setCustom((c) => ({ ...c, material: e.target.value }))}
          >
            {options.material.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="row-field">
          纹饰
          <select
            value={custom.pattern}
            onChange={(e) => setCustom((c) => ({ ...c, pattern: e.target.value }))}
          >
            {options.pattern.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="row-field">
          成品
          <select value={custom.form} onChange={(e) => setCustom((c) => ({ ...c, form: e.target.value }))}>
            {options.form.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="row-field">
          卡片色
          <select value={custom.color} onChange={(e) => setCustom((c) => ({ ...c, color: e.target.value }))}>
            {options.color.map((v) => (
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
        <div className="row-between muted tiny">
          <span>¥500</span>
          <span>¥10000+</span>
        </div>
      </section>

      <section className="card">
        <label className="label" htmlFor="subject-input">
          定制主体
        </label>
        <input
          id="subject-input"
          placeholder="输入主体，如：山海神龙守护"
          value={custom.subject}
          onChange={(e) => setCustom((c) => ({ ...c, subject: e.target.value }))}
        />
      </section>

      <button type="button" className="btn btn-primary" onClick={onGenerate}>
        生成成品卡片
      </button>
    </>
  );

  const renderProduct = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">成品</h1>
      </header>

      <p className="muted">你的定制成品已生成，可收藏与分享</p>
      <section className="product-wrap">
        <ProductCard work={currentWork} />
      </section>

      <button type="button" className="btn btn-primary" onClick={onFavorite}>
        收藏
      </button>
      <button type="button" className="btn btn-ghost" onClick={() => navTo("custom")}>
        再次编辑
      </button>
    </>
  );

  const renderProfile = () => (
    <>
      <header className="top-bar">
        <h1 className="title-lg">我的</h1>
      </header>

      <section className="card profile-card">
        <div className="avatar">YS</div>
        <div>
          <p>
            <strong>昵称：</strong>珅玉客
          </p>
          <p>
            <strong>邮箱：</strong>yushi_user_001@ymail.com
          </p>
          <p>
            <strong>额度：</strong>
            <span className="value-mono">{quotaText}</span>
          </p>
        </div>
      </section>

      <section className="profile-grid">
        <button type="button" className="quick-card" onClick={() => navTo("recharge")}>
          <span className="icon">¥</span>
          <span>充值</span>
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
    </>
  );

  const renderRecharge = () => (
    <>
      <header className="sub-top">
        <button type="button" className="back" onClick={navBack}>
          ← 返回
        </button>
        <h1>充值</h1>
      </header>

      <p className="muted">选择支付方式与套餐</p>

      <section className="pay-methods">
        <button
          type="button"
          className={`pay-method wechat ${payMethod === "wechat" ? "active" : ""}`}
          onClick={() => setPayMethod("wechat")}
        >
          <span className="icon">微</span>
          <span>微信支付</span>
        </button>
        <button
          type="button"
          className={`pay-method alipay ${payMethod === "alipay" ? "active" : ""}`}
          onClick={() => setPayMethod("alipay")}
        >
          <span className="icon">支</span>
          <span>支付宝</span>
        </button>
      </section>

      <h3 className="section-title">套餐</h3>
      <section className="package-row">
        {packageOptions.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`package-card ${selectedPackage === item.id ? "active" : ""}`}
            onClick={() => setSelectedPackage(item.id)}
          >
            <span className="price">¥{item.price}</span>
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
        <div className="row-between">
          <span>应付金额</span>
          <strong className="accent value-mono">¥{(customTimes * 0.1).toFixed(1)}</strong>
        </div>
      </section>

      <button type="button" className="btn btn-primary" onClick={onPay}>
        立即支付
      </button>
    </>
  );

  const renderListPage = (title, tip, list, onOpen) => (
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
          <button key={item.id} type="button" className="record-item" onClick={() => onOpen(item.id)}>
            <div className="thumb">
              <img src={item.image} alt={item.name} />
            </div>
            <div>
              <h4>{item.name}</h4>
              <p>寓意：{item.summary}</p>
            </div>
          </button>
        ))}
      </section>
    </>
  );

  const historyDetail = history.find((x) => x.id === selectedHistoryId) || history[0];
  const favoriteDetail = favorites.find((x) => x.id === selectedFavoriteId) || currentWork;

  let content = null;
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
          <button type="button" className="back" onClick={navBack}>
            ← 返回
          </button>
          <h1>历史记录详情</h1>
        </header>
        <section className="product-wrap">
          <ProductCard work={historyDetail} />
        </section>
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
          <button type="button" className="back" onClick={navBack}>
            ← 返回
          </button>
          <h1>收藏详情</h1>
        </header>
        <section className="product-wrap">
          <ProductCard work={favoriteDetail} />
        </section>
      </>
    );
  }

  return (
    <main className="app-shell">
      <section className="app">
        <section className="screen">{content}</section>
        {["home", "custom", "product", "profile"].includes(page) && (
          <Tabbar page={page} onNav={(p) => setPage(p)} />
        )}
      </section>
    </main>
  );
}
