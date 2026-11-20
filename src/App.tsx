import {
  useState,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import {
  Routes,
  Route,
  Link,
  useNavigate,
  useParams,
  useLocation,
  Navigate,
} from "react-router-dom";
import {
  Sparkles,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Home,
  Users,
  Clock,
  User,
  Settings,
  Sun,
  Moon,
  Globe,
  Utensils,
  Coffee,
  Plane,
  MoreHorizontal,
  Check,
  Copy,
  Send,
  RefreshCw,
  Trash2,
  ArrowLeft,
  Receipt,
  Wallet,
  ShieldCheck,
  X,
  Equal,
  ArrowRight,
  CheckCheck,
  Heart,
  Layers,
} from "lucide-react";
import { en, fa, type Key } from "./i18n";
import {
  calculate,
  expenseShares,
  minor,
  precision,
  type Hangout,
  type Currency,
  type Expense,
  type Member,
} from "../shared/engine";
declare global {
  interface Window {
    Telegram?: { WebApp: any };
  }
}
type Context = {
  t: (k: Key) => string;
  lang: string;
  setLang: (s: string) => void;
  theme: string;
  setTheme: (s: string) => void;
  me: { id: string; name: string; demo: boolean };
  hangouts: Hangout[];
  reload: () => Promise<void>;
  api: <T = any>(path: string, method?: string, body?: any) => Promise<T>;
  toast: (s: string) => void;
  money: (n: number, c: Currency) => string;
  demoUser: string;
  setDemoUser: (s: string) => void;
};
const C = createContext<Context>(null!);
const useApp = () => useContext(C);
const icons: Record<string, typeof Utensils> = {
  dinner: Utensils,
  coffee: Coffee,
  trip: Plane,
  other: Sparkles,
};
function Vibe({
  type = "dinner",
  large = false,
}: {
  type?: string;
  large?: boolean;
}) {
  const Icon = icons[type] || Sparkles;
  return (
    <span className={`vibe ${large ? "large" : ""} ${type}`}>
      <Icon size={large ? 30 : 22} />
    </span>
  );
}
function Avatar({
  member,
  size = "",
}: {
  member: Pick<Member, "name">;
  size?: string;
}) {
  const n = member.name;
  const color = [...n].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  return (
    <span className={`avatar color-${color} ${size}`} aria-label={n}>
      {n
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
function Button({
  children,
  onClick,
  type = "button",
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`button ${secondary ? "secondary" : ""}`}
    >
      {children}
    </button>
  );
}
function Empty({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sparkles size={28} />
      </span>
      <h3>{title}</h3>
      {sub && <p>{sub}</p>}
      {children}
    </div>
  );
}
function PageHead({
  title,
  sub,
  children,
  back = false,
}: {
  title: string;
  sub?: string;
  children?: ReactNode;
  back?: boolean;
}) {
  const { t } = useApp();
  const navigate = useNavigate();
  return (
    <div className="page-heading">
      <div>
        {back && (
          <button className="back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
            {t("back")}
          </button>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
function Controls() {
  const { lang, setLang, theme, setTheme, t } = useApp();
  return (
    <div className="controls">
      <button
        aria-label={t("language")}
        onClick={() => setLang(lang === "en" ? "fa" : "en")}
      >
        <Globe size={17} />
        <span>{lang === "en" ? "EN" : "فا"}</span>
      </button>
      <button
        aria-label={t("theme")}
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    </div>
  );
}
function App() {
  const [lang, setLang] = useState(
    localStorage.getItem("dong-language") || "en",
  );
  const [theme, setTheme] = useState(
    localStorage.getItem("dong-theme") ||
      window.Telegram?.WebApp?.colorScheme ||
      "light",
  );
  const [demoUser, setDemoUser] = useState(
    localStorage.getItem("dong-user") || "ali",
  );
  const [me, setMe] = useState({ id: "", name: "", demo: false });
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const t = (key: Key) => (lang === "fa" ? fa : en)[key] || key;
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    localStorage.setItem("dong-language", lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);
  useEffect(() => {
    localStorage.setItem("dong-theme", theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const api = async <T = any,>(
    path: string,
    method = "GET",
    body?: any,
  ): Promise<T> => {
    const tg = window.Telegram?.WebApp;
    const auth = tg?.initData ? `tma ${tg.initData}` : `Demo ${demoUser}`;
    const res = await fetch(`/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
        ...(method === "POST"
          ? { "Idempotency-Key": crypto.randomUUID() }
          : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw Error(data.error || "server");
    return data;
  };
  const reload = async () => setHangouts(await api<Hangout[]>("/hangouts"));
  useEffect(() => {
    let alive = true;
    localStorage.setItem("dong-user", demoUser);
    setLoading(true);
    (async () => {
      try {
        const config = await api("/config");
        const identity = await api("/me");
        if (config.demo && demoUser === "ali")
          await api("/demo/seed", "POST", {});
        const hs = await api<Hangout[]>("/hangouts");
        if (alive) {
          setMe(identity);
          setHangouts(hs);
          setError("");
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [demoUser]);
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    const back = () => navigate(-1);
    if (location.pathname !== "/") {
      tg?.BackButton?.show();
      tg?.BackButton?.onClick(back);
    } else tg?.BackButton?.hide();
    return () => tg?.BackButton?.offClick(back);
  }, [location.pathname]);
  useEffect(() => {
    const start = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (start?.startsWith("join_"))
      navigate(`/join/${encodeURIComponent(start.slice(5))}`);
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const money = (n: number, c: Currency) =>
    new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US", {
      minimumFractionDigits: precision(c),
      maximumFractionDigits: precision(c),
    }).format(n / 10 ** precision(c)) +
    " " +
    c;
  const value: Context = {
    t,
    lang,
    setLang,
    theme,
    setTheme,
    me,
    hangouts,
    reload,
    api,
    toast: setNotice,
    money,
    demoUser,
    setDemoUser,
  };
  return (
    <C.Provider value={value}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link className="brand" to="/">
            <span className="brand-symbol">✦</span>DONG
            <span className="brand-dot" />
          </Link>
          <p className="brand-tagline">{t("tagline")}</p>
          <nav>
            {(
              [
                [Home, "home", "/"],
                [Users, "hangouts", "/history"],
                [Clock, "activity", "/activity"],
                [User, "profile", "/profile"],
              ] as const
            ).map(([Icon, label, path]) => (
              <Link
                key={path}
                className={location.pathname === path ? "selected" : ""}
                to={path}
              >
                <Icon size={21} />
                {t(label)}
                {path === "/" && <span className="nav-pip" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="mini-orb">
              <Heart size={22} />
            </span>
            <strong>{t("about")}</strong>
            <p>{t("safe")}</p>
            <Link to="/welcome">
              {t("welcomeLink")}
              <ChevronRight size={15} />
            </Link>
          </div>
          <Link className="settings-link" to="/settings">
            <Settings size={20} />
            {t("settings")}
          </Link>
          <div className="sidebar-user">
            <Avatar member={{ name: me.name || "Ali" }} />
            <div>
              <strong>{me.name || "DONG"}</strong>
              <small>{t(me.demo ? "demo" : "telegramIdentity")}</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <Link className="mobile-brand brand" to="/">
              <span className="brand-symbol">✦</span>DONG
            </Link>
            <div className="breadcrumb">{t("tagline")}</div>
            <div className="topbar-right">
              <Controls />
              <span className="top-divider" />
              <Link to="/profile">
                <Avatar member={{ name: me.name || "Ali" }} />
              </Link>
            </div>
          </header>
          <main>
            {loading ? (
              <div className="loading">
                <div className="skeleton" />
                <p>{t("loading")}</p>
              </div>
            ) : error ? (
              <Empty title={t((error in en ? error : "server") as Key)}>
                <Button onClick={() => window.location.reload()}>
                  {t("retry")}
                </Button>
              </Empty>
            ) : (
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/create" element={<Create />} />
                <Route path="/history" element={<History />} />
                <Route path="/activity" element={<Activity />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/join/:token" element={<Join />} />
                <Route path="/hangout/:id/*" element={<HangoutPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            )}
          </main>
          <footer className="page-footer">
            <span>✦ DONG</span>
            <span>{t("safe")}</span>
            <span>{t("tagline")}</span>
          </footer>
        </div>
        <nav className="bottom-nav">
          {(
            [
              [Home, "home", "/"],
              [Users, "hangouts", "/history"],
              [Plus, "create", "/create"],
              [Clock, "activity", "/activity"],
              [User, "profile", "/profile"],
            ] as const
          ).map(([Icon, label, path]) => (
            <Link
              key={path}
              className={`${location.pathname === path ? "selected" : ""} ${path === "/create" ? "nav-create" : ""}`}
              to={path}
            >
              <Icon size={22} />
              <span>{t(label)}</span>
            </Link>
          ))}
        </nav>
        {notice && (
          <div role="status" className="toast">
            <Check size={18} />
            {notice}
            <button onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
      </div>
    </C.Provider>
  );
}
function HomePage() {
  const { t, me, hangouts, money } = useApp();
  const navigate = useNavigate();
  const currencies = [...new Set(hangouts.map((h) => h.currency))];
  const summaries = currencies.map((currency) => {
    let owed = 0,
      receivable = 0;
    for (const h of hangouts.filter((h) => h.currency === currency)) {
      const mid = h.members.find((m) => m.userId === me.id)?.id;
      if (mid) {
        const n = calculate(h).balances[mid].net;
        if (n > 0) receivable += n;
        else owed -= n;
      }
    }
    return { currency, owed, receivable };
  });
  const s = summaries[0] || {
    currency: "AMD" as Currency,
    owed: 0,
    receivable: 0,
  };
  return (
    <>
      <div className="greeting-row">
        <div>
          <span className="eyebrow">
            {t("morning")} {me.name} <span className="wave">✳</span>
          </span>
          <p>{t("greeting")}</p>
        </div>
        <span className="demo-badge">
          <span />
          {t(me.demo ? "demo" : "telegramIdentity")}
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <div className="pill">
            <Sparkles size={14} />
            {t("tagline")}
          </div>
          <h1>
            {t("headline")}
            <br />
            <span>{t("headline2")}</span>
          </h1>
          <p>{t("heroText")}</p>
          <Button onClick={() => navigate("/create")}>
            <Plus size={19} />
            {t("create")}
          </Button>
          <div className="hero-proof">
            <div className="avatar-stack">
              {["Ali", "Sara", "Reza", "Nima"].map((name) => (
                <Avatar key={name} member={{ name }} size="small" />
              ))}
            </div>
            <span>{t("about")}</span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orb">
            <span className="orb-symbol">÷</span>
            <span className="orb-spark">✦</span>
          </div>
          <span className="art-spark s1">✧</span>
          <span className="art-spark s2">✦</span>
          <div className="floating-label label-one">
            <Check size={17} />
            {t("safe")}
          </div>
          <div className="floating-label label-two">
            <Users size={16} />
            {t("tagline")}
          </div>
        </div>
      </section>
      <div className="summary-grid">
        <Summary
          label={t("owed")}
          value={money(s.owed, s.currency)}
          icon={<ArrowUpRight size={23} />}
          sub={t("outstanding")}
        />
        <Summary
          label={t("receivable")}
          value={money(s.receivable, s.currency)}
          icon={<ArrowDownLeft size={23} />}
          sub={t("outstanding")}
          green
        />
        <Summary
          label={t("balance")}
          value={money(s.receivable - s.owed, s.currency)}
          icon={<Wallet size={23} />}
          sub={t(s.owed + s.receivable ? "active" : "settled")}
          purple
        />
      </div>
      {summaries.length > 1 && (
        <div className="other-currencies">
          {summaries.slice(1).map((s) => (
            <span key={s.currency}>
              {t("owed")}: {money(s.owed, s.currency)} · {t("receivable")}:{" "}
              {money(s.receivable, s.currency)}
            </span>
          ))}
          <small>{t("allCurrencies")}</small>
        </div>
      )}
      <div className="section-heading">
        <div>
          <span className="eyebrow small-text">{t("recent")}</span>
          <h2>{t("about")}</h2>
        </div>
        <Link to="/history">
          {t("viewAll")}
          <ChevronRight size={17} />
        </Link>
      </div>
      <div className="home-bottom">
        <div className="hangout-list">
          {hangouts.slice(0, 3).map((h) => (
            <HangoutCard key={h.id} h={h} />
          ))}
          <button
            className="new-hangout-card"
            onClick={() => navigate("/create")}
          >
            <span>
              <Plus size={22} />
            </span>
            <div>
              <strong>{t("create")}</strong>
              <p>{t("noHangouts")}</p>
            </div>
            <Plus size={19} />
          </button>
        </div>
        <div className="flow-preview">
          <div className="flow-preview-head">
            <span className="mini-label">
              <span />
              {t("flow")}
            </span>
            <Sparkles size={19} />
          </div>
          <h3>{t("flowTitle")}</h3>
          <p>{t("flowSub")}</p>
          {hangouts[0] && calculate(hangouts[0]).transfers.length > 0 ? (
            <>
              <MiniFlow h={hangouts[0]} />
              <Link to={`/hangout/${hangouts[0].id}/flow`}>
                {t("check")}
                <ArrowUpRight size={17} />
              </Link>
            </>
          ) : (
            <div className="flow-empty">
              ✦<p>{t("noDebt")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
function Summary({
  label,
  value,
  icon,
  sub,
  green,
  purple,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  sub: string;
  green?: boolean;
  purple?: boolean;
}) {
  return (
    <div
      className={`summary-card ${green ? "green" : ""} ${purple ? "purple" : ""}`}
    >
      <div className="summary-top">
        <span>{label}</span>
        <span className="summary-icon">{icon}</span>
      </div>
      <strong dir="auto">{value}</strong>
      <small>
        <span />
        {sub}
      </small>
    </div>
  );
}
function HangoutCard({ h }: { h: Hangout }) {
  const { t, money, me, lang } = useApp();
  const c = calculate(h);
  const mid = h.members.find((m) => m.userId === me.id)?.id;
  const net = mid ? c.balances[mid].net : 0;
  return (
    <Link className="hangout-card" to={`/hangout/${h.id}`}>
      <Vibe type={h.icon} />
      <div className="hangout-info">
        <h3>{h.title}</h3>
        <p>
          {new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : "en-US", {
            month: "short",
            day: "numeric",
          }).format(new Date(h.date + "T12:00:00"))}
          <span>·</span>
          {h.members.length} {t("friends")}
          <span>·</span>
          {h.expenses.length} {t("expenses")}
        </p>
        <div className="avatar-stack">
          {h.members.slice(0, 4).map((m) => (
            <Avatar key={m.id} member={m} size="tiny" />
          ))}
        </div>
      </div>
      <div className="hangout-amount">
        <strong dir="auto">{money(c.total, h.currency)}</strong>
        <small className={net > 0 ? "positive" : net < 0 ? "negative" : ""}>
          {net === 0
            ? t("settled")
            : `${t(net > 0 ? "receivable" : "owed")} ${money(Math.abs(net), h.currency)}`}
        </small>
      </div>
      <ChevronRight size={18} className="muted" />
    </Link>
  );
}
function MiniFlow({ h }: { h: Hangout }) {
  const { money, t } = useApp();
  const tr = calculate(h).transfers[0];
  if (!tr) return null;
  const from = h.members.find((m) => m.id === tr.fromId)!;
  const to = h.members.find((m) => m.id === tr.toId)!;
  return (
    <div className="mini-flow">
      <div className="glass-person debtor">
        <Avatar member={from} />
        <div>
          <strong>{from.name}</strong>
          <small>{t("owes")}</small>
        </div>
      </div>
      <svg viewBox="0 0 300 100" preserveAspectRatio="none">
        <path d="M70 0 V35 Q70 50 100 50 H210 Q235 50 235 70 V100" />
      </svg>
      <span className="mini-amount" dir="auto">
        {money(tr.amount, h.currency)}
      </span>
      <div className="glass-person creditor">
        <Avatar member={to} />
        <div>
          <strong>{to.name}</strong>
          <small>{t("receivable")}</small>
        </div>
        <span className="glow-point" />
      </div>
    </div>
  );
}
function Create() {
  const { t, api, reload, toast } = useApp();
  const navigate = useNavigate();
  const [icon, setIcon] = useState("dinner");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const d = new FormData(e.currentTarget);
    try {
      const h = await api("/hangouts", "POST", {
        title: d.get("title"),
        description: d.get("description"),
        currency: d.get("currency"),
        date: d.get("date"),
        icon,
      });
      await reload();
      navigate(`/hangout/${h.id}`);
    } catch (e) {
      toast(t((e as Error).message as Key));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="narrow">
      <PageHead title={t("newHangout")} sub={t("createSub")} back />
      <form className="panel form" onSubmit={submit}>
        <Vibe type={icon} large />
        <label>
          {t("title")}
          <input
            name="title"
            required
            maxLength={100}
            placeholder={t("dinner")}
          />
        </label>
        <label>
          {t("description")}
          <textarea name="description" maxLength={500} rows={3} />
        </label>
        <div className="form-row">
          <label>
            {t("currency")}
            <CurrencySelect />
          </label>
          <label>
            {t("date")}
            <input
              name="date"
              type="date"
              required
              defaultValue={new Date().toLocaleDateString("en-CA")}
            />
          </label>
        </div>
        <label>{t("cover")}</label>
        <div className="vibe-picker">
          {Object.keys(icons).map((k) => (
            <button
              type="button"
              className={icon === k ? "chosen" : ""}
              key={k}
              onClick={() => setIcon(k)}
            >
              <Vibe type={k} />
              {t(k as Key)}
            </button>
          ))}
        </div>
        <Button type="submit" disabled={busy}>
          <Plus size={18} />
          {t("create")}
        </Button>
      </form>
    </div>
  );
}
function CurrencySelect() {
  return (
    <select name="currency" defaultValue="AMD">
      {["AMD", "USD", "EUR", "USDT"].map((c) => (
        <option key={c}>{c}</option>
      ))}
    </select>
  );
}
function History() {
  const { t, hangouts } = useApp();
  return (
    <>
      <PageHead title={t("history")} sub={t("historySub")}>
        <Link className="button" to="/create">
          <Plus size={18} />
          {t("create")}
        </Link>
      </PageHead>
      <div className="hangout-list">
        {hangouts.map((h) => (
          <HangoutCard key={h.id} h={h} />
        ))}
        {!hangouts.length && <Empty title={t("noHangouts")} />}
      </div>
    </>
  );
}
function Activity() {
  const { t, hangouts, money } = useApp();
  return (
    <>
      <PageHead title={t("activity")} sub={t("historySub")} />
      <div className="panel">
        {hangouts
          .flatMap((h) => h.expenses.map((e) => ({ h, e })))
          .sort((a, b) => b.e.createdAt.localeCompare(a.e.createdAt))
          .map(({ h, e }) => (
            <Link
              className="expense-row"
              key={e.id}
              to={`/hangout/${h.id}/expense/${e.id}`}
            >
              <Vibe type={h.icon} />
              <div>
                <h3>{e.title}</h3>
                <p>
                  {h.title} · {t("paidBy")}{" "}
                  {h.members.find((m) => m.id === e.payerId)?.name}
                </p>
              </div>
              <strong>{money(expenseShares(e).total, h.currency)}</strong>
              <ChevronRight size={18} />
            </Link>
          ))}
        {!hangouts.some((h) => h.expenses.length) && (
          <Empty title={t("emptyActivity")} />
        )}
      </div>
    </>
  );
}
function HangoutPage() {
  const { id } = useParams();
  const { hangouts, t } = useApp();
  const h = hangouts.find((h) => h.id === id);
  if (!h) return <Empty title={t("forbidden")} />;
  return (
    <Routes>
      <Route index element={<Dashboard h={h} />} />
      <Route path="invite" element={<Invite h={h} />} />
      <Route path="members" element={<Members h={h} />} />
      <Route path="add" element={<OrderForm h={h} />} />
      <Route path="expense/:expenseId" element={<ExpenseDetails h={h} />} />
      <Route path="expense/:expenseId/edit" element={<OrderForm h={h} />} />
      <Route path="split" element={<Split h={h} />} />
      <Route path="flow" element={<Split h={h} visual />} />
      <Route path="settle" element={<Settle h={h} />} />
    </Routes>
  );
}
function Dashboard({ h }: { h: Hangout }) {
  const { t, money } = useApp();
  const c = calculate(h);
  return (
    <>
      <PageHead title={h.title} sub={h.description} back>
        <Link className="button secondary" to="invite">
          <Users size={18} />
          {t("invite")}
        </Link>
        <Link className="button" to="add">
          <Plus size={18} />
          {t("addOrder")}
        </Link>
      </PageHead>
      <div className="group-banner">
        <Vibe type={h.icon} large />
        <div>
          <span className="eyebrow">{t("groupTotal")}</span>
          <h2>{money(c.total, h.currency)}</h2>
          <p>
            {h.members.length} {t("memberCount")}
          </p>
        </div>
        <Link to="members" className="avatar-stack">
          {h.members.map((m) => (
            <Avatar key={m.id} member={m} />
          ))}
        </Link>
      </div>
      <div className="group-tabs">
        <Link className="selected" to=".">
          {t("expenses")}
        </Link>
        <Link to="split">{t("split")}</Link>
        <Link to="flow">{t("flow")}</Link>
        <Link to="settle">{t("record")}</Link>
        <Link to="members">{t("members")}</Link>
      </div>
      <div className="detail-columns">
        <section>
          <div className="section-heading">
            <h2>{t("expenses")}</h2>
            <span className="count-badge">{h.expenses.length}</span>
          </div>
          <div className="panel">
            {h.expenses.map((e) => (
              <Link className="expense-row" key={e.id} to={`expense/${e.id}`}>
                <Vibe type={e.items.length > 1 ? "dinner" : "trip"} />
                <div>
                  <h3>{e.title}</h3>
                  <p>
                    {t("paidBy")}{" "}
                    {h.members.find((m) => m.id === e.payerId)?.name} ·{" "}
                    {e.items.length} {t("items")}
                  </p>
                </div>
                <strong>{money(expenseShares(e).total, h.currency)}</strong>
                <ChevronRight size={18} />
              </Link>
            ))}
            {!h.expenses.length && (
              <Empty title={t("noExpenses")} sub={t("noExpensesSub")}>
                <Link className="button" to="add">
                  {t("addOrder")}
                </Link>
              </Empty>
            )}
          </div>
        </section>
        <aside className="flow-preview">
          <div className="flow-preview-head">
            <span>{t("flow")}</span>
            <Layers size={18} />
          </div>
          <h3>{t("flowTitle")}</h3>
          {c.transfers.length ? (
            <MiniFlow h={h} />
          ) : (
            <Empty title={t("noDebt")} />
          )}
          <Link to="flow">
            {t("viewFlow")}
            <ChevronRight size={18} />
          </Link>
        </aside>
      </div>
    </>
  );
}
function Invite({ h }: { h: Hangout }) {
  const { t, api, reload, toast } = useApp();
  const [url, setUrl] = useState("");
  useEffect(() => {
    api("/config").then((c) =>
      setUrl(
        c.botUsername && c.appShortName
          ? `https://t.me/${c.botUsername}/${c.appShortName}?startapp=join_${h.inviteToken}`
          : `${location.origin}/join/${h.inviteToken}`,
      ),
    );
  }, [h.inviteToken]);
  return (
    <div className="narrow">
      <PageHead title={t("inviteTitle")} sub={t("inviteSub")} back />
      <div className="panel invite-panel">
        <div className="invite-art">
          <Users size={44} />
          <span>✦</span>
        </div>
        <h2>{h.title}</h2>
        <p>
          {h.members.length} {t("friends")}
        </p>
        <div className="invite-url" dir="ltr">
          {url}
        </div>
        <Button
          onClick={() =>
            navigator.clipboard
              .writeText(url)
              .then(() => toast(t("copied")))
              .catch(() => toast(t("server")))
          }
        >
          <Copy size={18} />
          {t("copy")}
        </Button>
        <Button
          secondary
          onClick={() => {
            const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t("inviteSub"))}`;
            if (window.Telegram?.WebApp?.openTelegramLink)
              window.Telegram.WebApp.openTelegramLink(share);
            else window.open(share, "_blank", "noopener");
          }}
        >
          <Send size={18} />
          {t("share")}
        </Button>
        <button
          className="text-button"
          onClick={async () => {
            try {
              await api(`/hangouts/${h.id}/invite`, "POST", {});
              await reload();
              toast(t("saved"));
            } catch (e) {
              toast(t((e as Error).message as Key));
            }
          }}
        >
          <RefreshCw size={16} />
          {t("regenerate")}
        </button>
        <small>{t("revokeNote")}</small>
      </div>
    </div>
  );
}
function Join() {
  const { token } = useParams();
  const { t, api, reload, toast } = useApp();
  const [info, setInfo] = useState<any>();
  const [error, setError] = useState(false);
  const nav = useNavigate();
  useEffect(() => {
    api(`/invites/${token}`)
      .then(setInfo)
      .catch(() => setError(true));
  }, [token]);
  return (
    <div className="narrow">
      <PageHead
        title={error ? t("invalidInvite") : info?.title || t("loading")}
        sub={t("inviteSub")}
      />
      {!error && (
        <div className="panel invite-panel">
          <Users size={45} />
          <Button
            onClick={async () => {
              try {
                const h = await api(`/invites/${token}/join`, "POST", {});
                await reload();
                toast(t("joined"));
                nav(`/hangout/${h.id}`);
              } catch {
                setError(true);
              }
            }}
          >
            {t("join")}
          </Button>
        </div>
      )}
    </div>
  );
}
function Members({ h }: { h: Hangout }) {
  const { t, api, reload, toast, me } = useApp();
  const [name, setName] = useState("");
  const mutate = async (path: string, method: string, body?: any) => {
    try {
      await api(`/hangouts/${h.id}${path}`, method, body);
      await reload();
      setName("");
    } catch (e) {
      toast(t((e as Error).message as Key));
    }
  };
  return (
    <div className="narrow">
      <PageHead
        title={t("memberTitle")}
        sub={`${h.members.length} ${t("friends")}`}
        back
      />
      <div className="panel member-list">
        {h.members.map((m) => (
          <div className="member-row" key={m.id}>
            <Avatar member={m} />
            <strong>
              {m.name}
              {m.userId === me.id && <small> · {t("you")}</small>}
            </strong>
            {h.ownerId === me.id && m.userId !== h.ownerId && (
              <button
                className="icon-button"
                aria-label={t("remove")}
                onClick={() => mutate(`/members/${m.id}`, "DELETE")}
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
      </div>
      {me.demo && h.ownerId === me.id && (
        <form
          className="panel form"
          onSubmit={(e) => {
            e.preventDefault();
            mutate("/members", "POST", { name });
          }}
        >
          <label>
            {t("name")}
            <input
              required
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <Button type="submit">
            <Plus size={18} />
            {t("addMember")}
          </Button>
        </form>
      )}
      <Link className="button secondary full" to={`../invite`}>
        {t("invite")}
      </Link>
    </div>
  );
}
type DraftItem = {
  title: string;
  quantity: string;
  unitPrice: string;
  selected: string[];
  weights: Record<string, string>;
  custom: boolean;
};
function OrderForm({ h }: { h: Hangout }) {
  const { expenseId } = useParams();
  const old = h.expenses.find((e) => e.id === expenseId);
  const { t, api, reload, toast, money } = useApp();
  const nav = useNavigate();
  const value = (n: number) => String(n / 10 ** precision(h.currency));
  const empty = (): DraftItem => ({
    title: "",
    quantity: "1",
    unitPrice: "",
    selected: h.members.map((m) => m.id),
    weights: {},
    custom: false,
  });
  const [items, setItems] = useState<DraftItem[]>(
    old
      ? old.items.map((i) => ({
          title: i.title,
          quantity: String(i.quantity),
          unitPrice: value(i.unitPrice),
          selected: i.allocations.map((a) => a.memberId),
          weights: Object.fromEntries(
            i.allocations.map((a) => [a.memberId, String(a.weight)]),
          ),
          custom: i.allocations.some((a) => a.weight !== 1),
        }))
      : [empty()],
  );
  const [title, setTitle] = useState(old?.title || "");
  const [payer, setPayer] = useState(old?.payerId || h.members[0].id);
  const [adjust, setAdjust] = useState<Record<string, string>>({
    tax: value(old?.tax || 0),
    service: value(old?.service || 0),
    tip: value(old?.tip || 0),
    discount: value(old?.discount || 0),
  });
  const [busy, setBusy] = useState(false);
  const update = (i: number, patch: Partial<DraftItem>) =>
    setItems(items.map((item, n) => (n === i ? { ...item, ...patch } : item)));
  const draft = (): Omit<Expense, "id" | "createdAt"> => ({
    title,
    payerId: payer,
    currency: h.currency,
    items: items.map((i) => ({
      title: i.title,
      quantity: Number(i.quantity),
      unitPrice: minor(i.unitPrice || "0", h.currency),
      allocations: i.selected.map((memberId) => ({
        memberId,
        weight: i.custom ? Number(i.weights[memberId] || 1) : 1,
      })),
    })),
    tax: minor(adjust.tax, h.currency),
    service: minor(adjust.service, h.currency),
    tip: minor(adjust.tip, h.currency),
    discount: minor(adjust.discount, h.currency),
  });
  let total = 0;
  try {
    total = expenseShares({ ...draft(), id: "", createdAt: "" }).total;
  } catch {}
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        `/hangouts/${h.id}/expenses${old ? `/${old.id}` : ""}`,
        old ? "PUT" : "POST",
        draft(),
      );
      await reload();
      nav(`/hangout/${h.id}`);
      toast(t("saved"));
    } catch (e) {
      const key = (e as Error).message;
      toast(t((key in en ? key : "validation") as Key));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        title={t(old ? "edit" : "expenseTitle")}
        sub={t("expenseSub")}
        back
      />
      {
        <form onSubmit={submit}>
          <div className="detail-columns order-columns">
            <div>
              <div className="panel form">
                <div className="form-row">
                  <label>
                    {t("expenseName")}
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {t("payer")}
                    <select
                      value={payer}
                      onChange={(e) => setPayer(e.target.value)}
                    >
                      {h.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="section-heading">
                <h2>{t("items")}</h2>
                <span className="count-badge">{items.length}</span>
              </div>
              {items.map((item, i) => (
                <div className="panel order-item" key={i}>
                  <div className="item-heading">
                    <span className="item-number">{i + 1}</span>
                    <h3>{t("items")}</h3>
                    {items.length > 1 && (
                      <button
                        type="button"
                        aria-label={t("delete")}
                        className="icon-button"
                        onClick={() =>
                          setItems(items.filter((_, n) => n !== i))
                        }
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                  <div className="item-fields">
                    <label>
                      {t("itemName")}
                      <input
                        value={item.title}
                        required
                        maxLength={100}
                        onChange={(e) => update(i, { title: e.target.value })}
                      />
                    </label>
                    <label>
                      {t("quantity")}
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        required
                        value={item.quantity}
                        onChange={(e) =>
                          update(i, { quantity: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("unitPrice")} <small>{h.currency}</small>
                      <input
                        inputMode="decimal"
                        required
                        value={item.unitPrice}
                        onChange={(e) =>
                          update(i, { unitPrice: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <div className="assignment-head">
                    <label>{t("assigned")}</label>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => update(i, { custom: !item.custom })}
                    >
                      <Equal size={15} />
                      {t(item.custom ? "custom" : "equal")}
                    </button>
                  </div>
                  <div className="member-selector">
                    {h.members.map((m) => (
                      <button
                        className={item.selected.includes(m.id) ? "chosen" : ""}
                        type="button"
                        key={m.id}
                        onClick={() =>
                          update(i, {
                            selected: item.selected.includes(m.id)
                              ? item.selected.filter((id) => id !== m.id)
                              : [...item.selected, m.id],
                          })
                        }
                      >
                        <Avatar member={m} size="tiny" />
                        {m.name}
                        {item.selected.includes(m.id) && <Check size={14} />}
                      </button>
                    ))}
                  </div>
                  {item.custom && (
                    <div className="weights">
                      <small>{t("weights")}</small>
                      {item.selected.map((id) => (
                        <label key={id}>
                          {h.members.find((m) => m.id === id)?.name}
                          <input
                            aria-label={`${t("custom")} ${h.members.find((m) => m.id === id)?.name}`}
                            type="number"
                            min="1"
                            max="1000000000"
                            step="1"
                            required
                            value={item.weights[id] || "1"}
                            onChange={(e) =>
                              update(i, {
                                weights: {
                                  ...item.weights,
                                  [id]: e.target.value,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="add-item"
                onClick={() => setItems([...items, empty()])}
              >
                <Plus size={19} />
                {t("addItem")}
              </button>
            </div>
            <aside>
              <div className="panel form bill-summary">
                <h2>{t("overview")}</h2>
                <span className="currency-tag">{h.currency}</span>
                {(["tax", "service", "tip", "discount"] as const).map((k) => (
                  <label className="adjustment-row" key={k}>
                    {t(k)}
                    <input
                      aria-label={t(k)}
                      inputMode="decimal"
                      value={adjust[k]}
                      onChange={(e) =>
                        setAdjust({ ...adjust, [k]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <div className="bill-total">
                  <span>{t("total")}</span>
                  <strong>{money(total, h.currency)}</strong>
                </div>
                <Button type="submit" disabled={busy}>
                  <Check size={18} />
                  {t("saveExpense")}
                </Button>
                <p className="safe-note">
                  <ShieldCheck size={15} />
                  {t("safe")}
                </p>
              </div>
            </aside>
          </div>
        </form>
      }
    </>
  );
}
function ExpenseDetails({ h }: { h: Hangout }) {
  const { expenseId } = useParams();
  const { t, money, api, reload, toast } = useApp();
  const nav = useNavigate();
  const e = h.expenses.find((e) => e.id === expenseId);
  if (!e) return <Empty title={t("validation")} />;
  const result = expenseShares(e);
  return (
    <>
      <PageHead
        title={e.title}
        sub={`${t("paidBy")} ${h.members.find((m) => m.id === e.payerId)?.name}`}
        back
      >
        <Link className="button secondary" to="edit">
          {t("edit")}
        </Link>
        <Button
          secondary
          onClick={async () => {
            if (!window.confirm(t("deleteConfirm"))) return;
            try {
              await api(`/hangouts/${h.id}/expenses/${e.id}`, "DELETE");
              await reload();
              nav(`/hangout/${h.id}`);
            } catch (err) {
              toast(t((err as Error).message as Key));
            }
          }}
        >
          <Trash2 size={17} />
          {t("delete")}
        </Button>
      </PageHead>
      <div className="detail-columns">
        <div className="panel">
          {e.items.map((i, n) => (
            <div className="item-detail" key={n}>
              <div>
                <h3>{i.title}</h3>
                <p>
                  {i.quantity} × {money(i.unitPrice, h.currency)}
                </p>
                <div className="allocation-tags">
                  {i.allocations.map((a) => (
                    <span key={a.memberId}>
                      {h.members.find((m) => m.id === a.memberId)?.name} ·{" "}
                      {a.weight}
                    </span>
                  ))}
                </div>
              </div>
              <strong>{money(i.quantity * i.unitPrice, h.currency)}</strong>
            </div>
          ))}
          {(["tax", "service", "tip", "discount"] as const)
            .filter((k) => e[k] > 0)
            .map((k) => (
              <div className="adjustment-row" key={k}>
                {t(k)}
                <span>
                  {k === "discount" ? "−" : ""}
                  {money(e[k], h.currency)}
                </span>
              </div>
            ))}
          <div className="bill-total">
            <span>{t("total")}</span>
            <strong>{money(result.total, h.currency)}</strong>
          </div>
        </div>
        <div className="panel">
          <h2>{t("split")}</h2>
          {Object.entries(result.shares).map(([id, n]) => (
            <div className="member-row" key={id}>
              <Avatar member={h.members.find((m) => m.id === id)!} />
              <span>{h.members.find((m) => m.id === id)?.name}</span>
              <strong className="push-end">{money(n, h.currency)}</strong>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
function Split({ h, visual = false }: { h: Hangout; visual?: boolean }) {
  const { t, money } = useApp();
  const c = calculate(h);
  return (
    <>
      <PageHead title={t("flowTitle")} sub={t("flowSub")} back>
        <Link
          className="button secondary"
          to={`/hangout/${h.id}/${visual ? "split" : "flow"}`}
        >
          {t(visual ? "overview" : "viewFlow")}
        </Link>
        <Link className="button" to={`/hangout/${h.id}/settle`}>
          {t("record")}
        </Link>
      </PageHead>
      <div className={visual ? "debt-canvas" : "panel"}>
        {visual && (
          <div className="canvas-heading">
            <Sparkles size={25} />
            <span>DONG / {t("flow")}</span>
            <span className="currency-tag">{h.currency}</span>
          </div>
        )}
        {c.transfers.length ? (
          c.transfers.map((tr, i) => {
            const from = h.members.find((m) => m.id === tr.fromId)!;
            const to = h.members.find((m) => m.id === tr.toId)!;
            return visual ? (
              <div className="debt-connection" key={i}>
                <div className="debt-person">
                  <Avatar member={from} />
                  <div>
                    <strong>{from.name}</strong>
                    <small>{t("owes")}</small>
                  </div>
                </div>
                <div className="debt-path">
                  <span dir="auto">{money(tr.amount, h.currency)}</span>
                  <svg viewBox="0 0 300 70" preserveAspectRatio="none">
                    <path className="desktop-path" d="M0 35 H90 Q110 35 110 45 V50 Q110 60 130 60 H170 Q190 60 190 40 V35 H300" />
                    <path className="mobile-path" d="M60 0 V12 Q60 25 90 25 H200 Q230 25 230 45 V70" />
                  </svg>
                  <span className="path-dot" />
                </div>
                <div className="debt-person">
                  <Avatar member={to} />
                  <div>
                    <strong>{to.name}</strong>
                    <small>{t("receivable")}</small>
                  </div>
                  <span className="status-dot" />
                </div>
              </div>
            ) : (
              <div className="transfer-row" key={i}>
                <Avatar member={from} />
                <div>
                  <strong>{from.name}</strong>
                  <small>
                    {t("owes")} {to.name}
                  </small>
                </div>
                <ArrowRight className="transfer-arrow" size={20} />
                <Avatar member={to} />
                <strong className="push-end">
                  {money(tr.amount, h.currency)}
                </strong>
              </div>
            );
          })
        ) : (
          <Empty title={t("noDebt")} sub={t("noDebtSub")} />
        )}
      </div>
      <div className="section-heading">
        <h2>{t("overview")}</h2>
      </div>
      <div className="panel balance-table">
        <div className="balance-row table-head">
          <span>{t("members")}</span>
          <span>{t("consumed")}</span>
          <span>{t("paid")}</span>
          <span>{t("net")}</span>
        </div>
        {h.members.map((m) => (
          <div className="balance-row" key={m.id}>
            <span>
              <Avatar member={m} size="small" />
              {m.name}
            </span>
            <span>{money(c.balances[m.id].consumed, h.currency)}</span>
            <span>{money(c.balances[m.id].paid, h.currency)}</span>
            <strong
              className={c.balances[m.id].net >= 0 ? "positive" : "negative"}
            >
              {money(c.balances[m.id].net, h.currency)}
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}
function Settle({ h }: { h: Hangout }) {
  const { t, money, api, reload, toast, me } = useApp();
  const c = calculate(h);
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      c.transfers.findIndex(
        (tr) => h.members.find((m) => m.id === tr.fromId)?.userId === me.id,
      ),
    ),
  );
  const tr = c.transfers[selected];
  const [input, setInput] = useState("");
  const [method, setMethod] = useState("cash");
  const mine = h.members.find((m) => m.userId === me.id);
  const canPay = mine?.id === tr?.fromId;
  const [details, setDetails] = useState(
    mine ? h.preferences[mine.id]?.details || "" : "",
  );
  const [prefMethod, setPrefMethod] = useState(
    mine ? h.preferences[mine.id]?.method || "card" : "card",
  );
  async function act(path: string, body: any) {
    try {
      await api(`/hangouts/${h.id}${path}`, "POST", body);
      await reload();
      setInput("");
      toast(t("saved"));
    } catch (e) {
      toast(
        t(
          ((e as Error).message in en
            ? (e as Error).message
            : "validation") as Key,
        ),
      );
    }
  }
  return (
    <>
      <PageHead title={t("settleTitle")} sub={t("settleSub")} back />
      <div className="detail-columns">
        <div>
          <form
            className="panel form"
            onSubmit={(e) => {
              e.preventDefault();
              if (tr)
                try {
                  act("/settlements", {
                    ...tr,
                    amount: minor(
                      input || String(tr.amount / 10 ** precision(h.currency)),
                      h.currency,
                    ),
                    method,
                  });
                } catch {
                  toast(t("validation"));
                }
            }}
          >
            <h2>{t("record")}</h2>
            {tr ? (
              <>
                <label>
                  {t("from")} / {t("to")}
                  <select
                    value={selected}
                    onChange={(e) => {
                      setSelected(Number(e.target.value));
                      setInput("");
                    }}
                  >
                    {c.transfers.map((tr, i) => (
                      <option key={i} value={i}>
                        {h.members.find((m) => m.id === tr.fromId)?.name} →{" "}
                        {h.members.find((m) => m.id === tr.toId)?.name} ·{" "}
                        {money(tr.amount, h.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                {h.preferences[tr.toId]?.details && (
                  <div className="receiving-details">
                    <span>{t(h.preferences[tr.toId].method as Key)}</span>
                    <bdi>{h.preferences[tr.toId].details}</bdi>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={t("copy")}
                      onClick={() =>
                        navigator.clipboard
                          .writeText(h.preferences[tr.toId].details)
                          .then(() => toast(t("copied")))
                      }
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                )}
                <label>
                  {t("amount")} ({h.currency})
                  <input
                    inputMode="decimal"
                    value={input}
                    placeholder={String(
                      tr.amount / 10 ** precision(h.currency),
                    )}
                    onChange={(e) => setInput(e.target.value)}
                  />
                </label>
                <small>{t("partial")}</small>
                <label>
                  {t("method")}
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {["cash", "card", "wallet", "other"].map((m) => (
                      <option key={m} value={m}>
                        {t(m as Key)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="submit" disabled={!canPay}>
                  <Check size={17} />
                  {t("markPaid")}
                </Button>
                {!canPay && <p>{t("forbidden")}</p>}
              </>
            ) : (
              <Empty title={t("noDebt")} />
            )}
          </form>
          <div className="panel">
            <h2>{t("settlementHistory")}</h2>
            {!h.settlements.length && (
              <p className="muted">{t("noSettlements")}</p>
            )}
            {h.settlements.map((s) => (
              <div className="settlement-row" key={s.id}>
                <div>
                  <strong>
                    {h.members.find((m) => m.id === s.fromId)?.name} →{" "}
                    {h.members.find((m) => m.id === s.toId)?.name}
                  </strong>
                  <p>
                    {money(s.amount, h.currency)} · {t(s.method as Key)}
                  </p>
                  <span className={`status-badge ${s.status}`}>
                    {t(s.status)}
                  </span>
                </div>
                {s.status !== "confirmed" && mine?.id === s.toId && (
                  <Button
                    secondary
                    onClick={() => act(`/settlements/${s.id}/confirm`, {})}
                  >
                    <CheckCheck size={17} />
                    {t("confirm")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
        <aside>
          <form
            className="panel form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api(`/hangouts/${h.id}/preferences`, "PUT", {
                  memberId: mine?.id,
                  method: prefMethod,
                  details,
                });
                await reload();
                toast(t("saved"));
              } catch (e) {
                toast(t((e as Error).message as Key));
              }
            }}
          >
            <Wallet size={30} className="lavender" />
            <h2>{t("preferences")}</h2>
            <p>{t("receivingNote")}</p>
            <label>
              {t("method")}
              <select
                value={prefMethod}
                onChange={(e) => setPrefMethod(e.target.value)}
              >
                {["card", "wallet", "cash", "other"].map((m) => (
                  <option key={m} value={m}>
                    {t(m as Key)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("details")}
              <input
                value={details}
                maxLength={150}
                dir="ltr"
                autoComplete="off"
                onChange={(e) => setDetails(e.target.value)}
              />
            </label>
            <small>{t("sensitive")}</small>
            <Button secondary type="submit">
              {t("savePreferences")}
            </Button>
          </form>
        </aside>
      </div>
    </>
  );
}
function Profile() {
  const { t, me, hangouts } = useApp();
  return (
    <div className="narrow">
      <PageHead title={t("profileTitle")} />
      <div className="panel profile-card">
        <Avatar member={me} size="big" />
        <h2>{me.name}</h2>
        <span className="pill">
          <ShieldCheck size={16} />
          {t(me.demo ? "localIdentity" : "telegramIdentity")}
        </span>
        <div className="profile-count">
          <strong>{hangouts.length}</strong>
          <span>{t("hangouts")}</span>
        </div>
        <Link className="button secondary" to="/settings">
          <Settings size={18} />
          {t("settings")}
        </Link>
      </div>
    </div>
  );
}
function SettingsPage() {
  const { t, lang, setLang, theme, setTheme, me, demoUser, setDemoUser } =
    useApp();
  return (
    <div className="narrow">
      <PageHead title={t("settings")} sub={t("tagline")} />
      <div className="panel form">
        <label>
          {t("language")}
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="fa">فارسی</option>
          </select>
        </label>
        <label>
          {t("theme")}
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">{t("light")}</option>
            <option value="dark">{t("dark")}</option>
          </select>
        </label>
        {me.demo && (
          <>
            <label>
              {t("switchUser")}
              <select
                value={demoUser}
                onChange={(e) => setDemoUser(e.target.value)}
              >
                {["ali", "sara", "reza", "nima"].map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <div className="info-note">
              <ShieldCheck size={22} />
              <p>{t("demoNote")}</p>
            </div>
          </>
        )}
        <h2>{t("about")}</h2>
        <p>{t("aboutText")}</p>
      </div>
    </div>
  );
}
function Welcome() {
  const { t } = useApp();
  return (
    <div className="welcome panel">
      <span className="brand-symbol">✦</span>
      <span className="eyebrow">{t("welcome")}</span>
      <h1>
        {t("headline")}
        <br />
        {t("headline2")}
      </h1>
      <p>{t("welcomeText")}</p>
      <Link to="/" className="button">
        {t("getStarted")}
        <Plus size={18} />
      </Link>
      <Controls />
      <small>{t("safe")}</small>
    </div>
  );
}
export default App;
