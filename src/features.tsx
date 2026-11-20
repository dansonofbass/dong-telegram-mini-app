import { useState, useEffect, useRef, useId } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  Plus,
  Check,
  Copy,
  Wallet,
  Trash2,
  Pencil,
  Star,
  ArrowRight,
  ArrowDown,
  Receipt,
  Users,
  ShieldCheck,
  Clock,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import { useApp } from "./context";
import { Avatar, Button, Empty, PageHead } from "./components";
import {
  calculate,
  minor,
  precision,
  type Hangout,
  type ActivityEvent,
  type ReceivingMethod,
} from "../shared/engine";
import { en, type Key } from "./i18n";
const errorKey = (e: unknown) =>
  ((e as Error).message in en ? (e as Error).message : "validation") as Key;
export function Onboarding() {
  const { t, me, guestEnabled, api, refreshIdentity, toast } = useApp();
  const [name, setName] = useState(me.name);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const nav = useNavigate();
  const token = location.pathname.match(/^\/(?:invite|join)\/([^/]+)/)?.[1];
  return (
    <section className="onboarding">
      <div className="onboarding-art">
        <span>÷</span>
        <Sparkles size={25} />
      </div>
      <span className="eyebrow small-text">DONG / {t("tagline")}</span>
      <h1>{t("onboardingTitle")}</h1>
      <p>{t("onboardingSub")}</p>
      {guestEnabled || me.id ? (
        <form
          className="panel form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(me.id ? "/me" : "/auth/guest", me.id ? "PUT" : "POST", {
                name,
              });
              if (token) {
                try {
                  const h = await api(`/invites/${token}/join`, "POST", {});
                  await refreshIdentity();
                  nav(`/hangout/${h.id}`, { replace: true });
                } catch (e) {
                  await refreshIdentity();
                  toast(t(errorKey(e)));
                }
              } else await refreshIdentity();
            } catch (e) {
              toast(t(errorKey(e)));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {t("displayName")}
            <input
              autoComplete="nickname"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {t(me.id ? "confirmName" : "continue")}
            <Check size={18} />
          </Button>
          <small>
            <ShieldCheck size={15} />
            {t(me.id ? "telegramIdentity" : "guestIdentity")}
          </small>
        </form>
      ) : (
        <div className="info-note">{t("guestDisabled")}</div>
      )}
    </section>
  );
}
const eventKeys: Record<string, Key> = {
  "hangout.created": "eventCreated",
  "hangout.updated": "eventUpdated",
  "member.joined": "eventJoined",
  "member.removed": "eventRemoved",
  "invite.regenerated": "eventInvite",
  "expense.created": "eventExpenseCreated",
  "expense.edited": "eventExpenseEdited",
  "expense.deleted": "eventExpenseDeleted",
  "expense.payerChanged": "eventPayer",
  "expense.allocationsChanged": "eventAllocation",
  "expense.adjustmentsChanged": "eventAdjustments",
  "settlement.marked": "eventMarked",
  "settlement.partial": "eventPartial",
  "settlement.confirmed": "eventConfirmed",
  "receiving.updated": "eventReceiving",
};
export function Timeline({ h }: { h?: Hangout }) {
  const { api, t, lang, money, hangouts } = useApp();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const scope = useRef("");
  const first = async () => {
    try {
      if (h) {
        const reset = scope.current !== h.id;
        scope.current = h.id;
        const data = await api(`/hangouts/${h.id}/activity`);
        if (scope.current !== h.id) return;
        setEvents((prev) =>
          reset
            ? data.events
            : [
                ...data.events,
                ...prev.filter(
                  (e) => !data.events.some((n: ActivityEvent) => n.id === e.id),
                ),
              ].sort((a, b) => b.sequence - a.sequence),
        );
        if (reset) setCursor(data.nextCursor);
      } else {
        const data = await Promise.all(
          hangouts.map((h) => api(`/hangouts/${h.id}/activity?limit=100`)),
        );
        setEvents(
          data.flatMap((d) => d.events).sort((a, b) => b.sequence - a.sequence),
        );
      }
      setError("");
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    first();
  }, [h?.id, h?.version, hangouts.map((h) => h.version).join(",")]);
  return (
    <div className="panel timeline-panel">
      {loading ? (
        <p>{t("loading")}</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !events.length ? (
        <Empty title={t("activityEmpty")} />
      ) : (
        <ol className="timeline">
          {events.map((e) => {
            const Icon = e.type.startsWith("expense")
              ? Receipt
              : e.type.startsWith("settlement")
                ? CheckCheck
                : e.type.startsWith("receiving")
                  ? Wallet
                  : Users;
            return (
              <li key={e.id}>
                <div className="timeline-person">
                  <Avatar member={{ name: e.actorName }} />
                  <span>
                    <Icon size={11} />
                  </span>
                </div>
                <div className="timeline-content">
                  <p>
                    <strong>{e.actorName}</strong>{" "}
                    {t(eventKeys[e.type] || "eventUpdated")}
                    {typeof e.metadata.title === "string" && (
                      <>
                        {" "}
                        · <bdi>{e.metadata.title}</bdi>
                      </>
                    )}
                  </p>
                  {typeof e.metadata.amount === "number" && (
                    <bdi className="timeline-amount">
                      {money(
                        e.metadata.amount,
                        (e.metadata.currency ||
                          h?.currency ||
                          "AMD") as Hangout["currency"],
                      )}
                    </bdi>
                  )}
                  <div className="timeline-meta">
                    <time dateTime={e.createdAt}>
                      {new Intl.DateTimeFormat(
                        lang === "fa" ? "fa-IR" : "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      ).format(new Date(e.createdAt))}
                    </time>
                    {e.metadata.administrative && (
                      <span className="pill">{t("adminBadge")}</span>
                    )}
                    {!h && (
                      <Link to={`/hangout/${e.hangoutId}/activity`}>
                        {hangouts.find((h) => h.id === e.hangoutId)?.title}
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {cursor && h && (
        <Button
          secondary
          onClick={async () => {
            try {
              const data = await api(
                `/hangouts/${h.id}/activity?before=${cursor}`,
              );
              setEvents((prev) => [
                ...prev,
                ...data.events.filter(
                  (e: ActivityEvent) => !prev.some((p) => p.id === e.id),
                ),
              ]);
              setCursor(data.nextCursor);
            } catch (e) {
              setError(t(errorKey(e)));
            }
          }}
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}
const blank = {
  kind: "card" as ReceivingMethod["kind"],
  label: "",
  value: "",
  recipientName: "",
  bankName: "",
  network: "",
  preferred: false,
};
export function ReceivingMethods() {
  const { t, api, toast } = useApp();
  const [methods, setMethods] = useState<ReceivingMethod[]>([]);
  const [editing, setEditing] = useState("");
  const [draft, setDraft] = useState({ ...blank });
  const [opened, setOpened] = useState<ReceivingMethod | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<ReceivingMethod[]>("/receiving-methods").then(setMethods);
  useEffect(() => {
    load().catch((e) => toast(t(errorKey(e))));
  }, []);
  async function edit(m: ReceivingMethod) {
    try {
      const data = await api<ReceivingMethod>(`/receiving-methods/${m.id}`);
      setDraft({ ...blank, ...data, value: data.value || "" });
      setEditing(m.id);
      setShowForm(true);
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }
  return (
    <div className="narrow">
      <PageHead title={t("receivingMethods")} sub={t("settleSub")} back />
      <p className="receiving-privacy">{t("receivingPrivacy")}</p>
      <div className="panel receiving-list">
        {!methods.length && <Empty title={t("noMethods")} />}
        {methods.map((m) => (
          <div className="receiving-card" key={m.id}>
            <span className="method-icon">
              <Wallet size={22} />
            </span>
            <div>
              <h3>{m.label || t(m.kind)}</h3>
              <p dir="auto">{m.maskedValue || t("cash")}</p>
              {m.preferred && (
                <span className="preferred">
                  <Star size={11} />
                  {t("preferred")}
                </span>
              )}
            </div>
            <div className="method-actions">
              <button
                className="icon-button"
                aria-label={t("openDetails")}
                onClick={async () => {
                  try {
                    setOpened(await api(`/receiving-methods/${m.id}`));
                  } catch (e) {
                    toast(t(errorKey(e)));
                  }
                }}
              >
                <Copy size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={t("editMethod")}
                onClick={() => edit(m)}
              >
                <Pencil size={17} />
              </button>
              <button
                className="icon-button"
                aria-label={t("delete")}
                onClick={async () => {
                  try {
                    await api(`/receiving-methods/${m.id}`, "DELETE");
                    await load();
                    if (opened?.id === m.id) setOpened(null);
                  } catch (e) {
                    toast(t(errorKey(e)));
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
        <Button
          secondary
          onClick={() => {
            setEditing("");
            setDraft({ ...blank });
            setShowForm(true);
          }}
        >
          <Plus size={18} />
          {t("addMethod")}
        </Button>
      </div>
      {opened && (
        <div className="panel form">
          <h2>{opened.label || t(opened.kind)}</h2>
          <bdi className="full-value">{opened.value || t("cash")}</bdi>
          <Button
            secondary
            onClick={() =>
              navigator.clipboard
                .writeText(opened.value || "")
                .then(() => toast(t("copied")))
                .catch(() => toast(t("server")))
            }
          >
            <Copy size={18} />
            {t("copyValue")}
          </Button>
          <Button secondary onClick={() => setOpened(null)}>
            {t("cancel")}
          </Button>
        </div>
      )}
      {showForm && (
        <form
          className="panel form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(
                `/receiving-methods${editing ? "/" + editing : ""}`,
                editing ? "PUT" : "POST",
                draft,
              );
              setShowForm(false);
              setOpened(null);
              await load();
              toast(t("saved"));
            } catch (e) {
              toast(t(errorKey(e)));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>{t(editing ? "editMethod" : "addMethod")}</h2>
          <label>
            {t("method")}
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  kind: e.target.value as ReceivingMethod["kind"],
                  value: "",
                })
              }
            >
              {(["card", "bank", "wallet", "cash", "other"] as const).map(
                (k) => (
                  <option key={k} value={k}>
                    {t(k)}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            {t("methodLabel")}
            <input
              value={draft.label}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          {draft.kind !== "cash" && (
            <label>
              {t("receivingValue")}
              <input
                required
                dir="ltr"
                autoComplete="off"
                value={draft.value}
                maxLength={150}
                onChange={(e) => setDraft({ ...draft, value: e.target.value })}
              />
            </label>
          )}
          {draft.kind === "card" && (
            <>
              <label>
                {t("recipientName")}
                <input
                  value={draft.recipientName}
                  maxLength={100}
                  onChange={(e) =>
                    setDraft({ ...draft, recipientName: e.target.value })
                  }
                />
              </label>
              <label>
                {t("bankName")}
                <input
                  value={draft.bankName}
                  maxLength={100}
                  onChange={(e) =>
                    setDraft({ ...draft, bankName: e.target.value })
                  }
                />
              </label>
            </>
          )}
          {draft.kind === "wallet" && (
            <label>
              {t("network")}
              <input
                value={draft.network}
                maxLength={40}
                onChange={(e) =>
                  setDraft({ ...draft, network: e.target.value })
                }
              />
            </label>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.preferred}
              onChange={(e) =>
                setDraft({ ...draft, preferred: e.target.checked })
              }
            />
            {t("setPreferred")}
          </label>
          <small>{t("sensitive")}</small>
          <Button type="submit" disabled={busy}>
            {t("save")}
          </Button>
          <Button secondary onClick={() => setShowForm(false)}>
            {t("cancel")}
          </Button>
        </form>
      )}
    </div>
  );
}
export function SettlementPage({ h }: { h: Hangout }) {
  const { t, me, api, reload, toast, money } = useApp();
  const c = calculate(h);
  const mine = h.members.find((m) => m.userId === me.id);
  const [params] = useSearchParams();
  const [relationship, setRelationship] = useState(() => {
    const tr =
      c.transfers.find(
        (tr) =>
          tr.fromId === (params.get("from") || mine?.id) &&
          (!params.get("to") || tr.toId === params.get("to")),
      ) || c.transfers[0];
    return tr ? tr.fromId + ":" + tr.toId : "";
  });
  const tr =
    c.transfers.find((tr) => tr.fromId + ":" + tr.toId === relationship) ||
    c.transfers[0];
  const [amount, setAmount] = useState("");
  const [methods, setMethods] = useState<ReceivingMethod[]>([]);
  const [chosen, setChosen] = useState("cash");
  const [opened, setOpened] = useState<ReceivingMethod | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setChosen("cash");
    setOpened(null);
    setAmount("");
    if (tr && mine?.id === tr.fromId)
      api<ReceivingMethod[]>(`/hangouts/${h.id}/receiving/${tr.toId}`)
        .then((data) => {
          setMethods(data);
          const preferred = data.find((m) => m.preferred);
          if (preferred) setChosen(preferred.id);
        })
        .catch(() => setMethods([]));
    else setMethods([]);
  }, [tr?.fromId, tr?.toId, h.version]);
  const act = async (path: string, body: any) => {
    setBusy(true);
    try {
      await api(`/hangouts/${h.id}${path}`, "POST", body);
      await reload();
      toast(t("saved"));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead title={t("settleTitle")} sub={t("settleSub")} back />
      <div className="detail-columns">
        <div>
          <form
            className="panel form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!tr) return;
              try {
                const m = methods.find((m) => m.id === chosen);
                act("/settlements", {
                  fromId: tr.fromId,
                  toId: tr.toId,
                  amount: minor(
                    amount || String(tr.amount / 10 ** precision(h.currency)),
                    h.currency,
                  ),
                  method: m?.kind || "cash",
                  ...(m ? { receivingMethodId: m.id } : {}),
                });
              } catch (e) {
                toast(t(errorKey(e)));
              }
            }}
          >
            <h2>{t("record")}</h2>
            {tr ? (
              <>
                <label>
                  {t("from")} / {t("to")}
                  <select
                    value={tr.fromId + ":" + tr.toId}
                    onChange={(e) => setRelationship(e.target.value)}
                  >
                    {c.transfers.map((tr, i) => (
                      <option key={i} value={tr.fromId + ":" + tr.toId}>
                        {h.members.find((m) => m.id === tr.fromId)?.name} →{" "}
                        {h.members.find((m) => m.id === tr.toId)?.name} ·{" "}
                        {money(tr.amount, h.currency)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="settlement-debt">
                  <span>{h.members.find((m) => m.id === tr.fromId)?.name}</span>
                  <ArrowRight size={19} />
                  <span>{h.members.find((m) => m.id === tr.toId)?.name}</span>
                  <strong>{money(tr.amount, h.currency)}</strong>
                </div>
                <label>
                  {t("amount")} ({h.currency})
                  <input
                    inputMode="decimal"
                    value={amount}
                    placeholder={String(
                      tr.amount / 10 ** precision(h.currency),
                    )}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <small>{t("partial")}</small>
                <label>
                  {t("method")}
                  <select
                    value={chosen}
                    onChange={(e) => {
                      setChosen(e.target.value);
                      setOpened(null);
                    }}
                  >
                    <option value="cash">{t("cash")}</option>
                    {methods
                      .filter((m) => m.kind !== "cash")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label || t(m.kind)} · {m.maskedValue}
                          {m.preferred ? " ★" : ""}
                        </option>
                      ))}
                  </select>
                </label>
                {chosen !== "cash" && (
                  <Button
                    secondary
                    onClick={async () => {
                      try {
                        setOpened(
                          await api(
                            `/hangouts/${h.id}/receiving/${tr.toId}/${chosen}`,
                          ),
                        );
                      } catch (e) {
                        toast(t(errorKey(e)));
                      }
                    }}
                  >
                    {t("openDetails")}
                  </Button>
                )}
                {opened && (
                  <div className="receiving-details">
                    <bdi>{opened.value}</bdi>
                    <p>
                      {[opened.recipientName, opened.bankName, opened.network]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(opened.value || "")
                          .then(() => toast(t("copied")))
                          .catch(() => toast(t("server")))
                      }
                    >
                      <Copy size={15} />
                      {t("copyValue")}
                    </button>
                  </div>
                )}
                {!methods.length && mine?.id === tr.fromId && (
                  <p>{t("noReceiving")}</p>
                )}
                <Button type="submit" disabled={busy || mine?.id !== tr.fromId}>
                  <Check size={18} />
                  {t("markPaid")}
                </Button>
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
                    disabled={busy}
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
        <aside className="panel form">
          <Wallet className="lavender" size={32} />
          <h2>{t("receivingMethods")}</h2>
          <p>{t("receivingNote")}</p>
          <Link className="button secondary" to="/receiving">
            {t("receivingMethods")}
          </Link>
          <small>{t("sensitive")}</small>
        </aside>
      </div>
    </>
  );
}
export function DebtGraph({
  h,
  visual = true,
}: {
  h: Hangout;
  visual?: boolean;
}) {
  const { t, money } = useApp();
  const c = calculate(h);
  const [chosen, setChosen] = useState("");
  const id = useId().replace(/:/g, "");
  const selected = c.transfers.find(
    (tr) => `${tr.fromId}-${tr.toId}` === chosen,
  );
  const name = (id: string) => h.members.find((m) => m.id === id)!;
  const crowded = c.transfers.length > 6;
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
      <section className={visual ? "debt-canvas premium-graph" : "panel"}>
        <div className="canvas-heading">
          <Sparkles size={23} />
          <span>
            {h.title} / {t("flow")}
          </span>
          <span className="currency-tag">{h.currency}</span>
        </div>
        {!c.transfers.length ? (
          <Empty title={t("noDebt")} sub={t("noDebtSub")} />
        ) : (
          <>
            <p className="graph-hint">{t("selectDebt")}</p>
            <div className={`debt-lanes ${crowded ? "crowded" : ""}`}>
              {c.transfers.map((tr, i) => {
                const key = `${tr.fromId}-${tr.toId}`;
                const marker = `${id}-${i}`;
                return (
                  <button
                    type="button"
                    className={`debt-lane ${chosen === key ? "highlighted" : ""}`}
                    key={key}
                    onClick={() => setChosen(key)}
                    aria-pressed={chosen === key}
                    aria-label={`${name(tr.fromId).name} → ${name(tr.toId).name}: ${money(tr.amount, h.currency)}`}
                    data-from={tr.fromId}
                    data-to={tr.toId}
                  >
                    <span className="flow-node">
                      <Avatar member={name(tr.fromId)} />
                      <span>
                        <strong>{name(tr.fromId).name}</strong>
                        <small>{t("owes")}</small>
                      </span>
                    </span>
                    <span className="flow-connector">
                      <bdi>{money(tr.amount, h.currency)}</bdi>
                      <svg
                        className="wide-connector"
                        viewBox="0 0 300 60"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <defs>
                          <marker
                            id={marker}
                            markerWidth="7"
                            markerHeight="7"
                            refX="6"
                            refY="3.5"
                            orient="auto"
                          >
                            <path
                              d="M0 0 L7 3.5 L0 7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </marker>
                        </defs>
                        <path
                          className="connection-path"
                          d="M2 40 L290 40"
                          markerEnd={`url(#${marker})`}
                        />
                      </svg>
                      <svg
                        className="narrow-connector"
                        viewBox="0 0 200 90"
                        aria-hidden="true"
                      >
                        <defs>
                          <marker
                            id={marker + "-m"}
                            markerWidth="7"
                            markerHeight="7"
                            refX="6"
                            refY="3.5"
                            orient="auto"
                          >
                            <path
                              d="M0 0 L7 3.5 L0 7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </marker>
                        </defs>
                        <path
                          className="connection-path"
                          d="M50 2 C50 45 150 45 150 82"
                          markerEnd={`url(#${marker}-m)`}
                        />
                      </svg>
                      <svg
                        className="compact-connector"
                        viewBox="0 0 40 70"
                        aria-hidden="true"
                      >
                        <defs>
                          <marker
                            id={marker + "-compact"}
                            markerWidth="7"
                            markerHeight="7"
                            refX="6"
                            refY="3.5"
                            orient="auto"
                          >
                            <path
                              d="M0 0 L7 3.5 L0 7"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.2"
                            />
                          </marker>
                        </defs>
                        <path
                          className="connection-path"
                          d="M2 35 L32 35"
                          markerEnd={`url(#${marker}-compact)`}
                        />
                      </svg>
                    </span>
                    <span className="flow-node creditor-node">
                      <Avatar member={name(tr.toId)} />
                      <span>
                        <strong>{name(tr.toId).name}</strong>
                        <small>{t("receivable")}</small>
                      </span>
                      <Check size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {selected && (
          <div className="graph-selection" role="status">
            <div>
              <span>{t("debtDirection")}</span>
              <strong>
                <bdi>{name(selected.fromId).name}</bdi> <ArrowRight size={17} />{" "}
                <bdi>{name(selected.toId).name}</bdi>
              </strong>
            </div>
            <bdi>{money(selected.amount, h.currency)}</bdi>
            <Link
              className="button"
              to={`/hangout/${h.id}/settle?from=${selected.fromId}&to=${selected.toId}`}
            >
              {t("record")}
            </Link>
          </div>
        )}
      </section>
      <div className="section-heading">
        <h2>{t("overview")}</h2>
        <small className="muted">{t("sync")}</small>
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
export function HangoutSettings({ h }: { h: Hangout }) {
  const { t, api, reload, toast, me } = useApp();
  const [title, setTitle] = useState(h.title);
  const [description, setDescription] = useState(h.description);
  const [version] = useState(h.version || 0);
  if (h.ownerId !== me.id) return <Empty title={t("forbidden")} />;
  return (
    <div className="narrow">
      <PageHead title={t("hangoutSettings")} back />
      <form
        className="panel form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`/hangouts/${h.id}`, "PATCH", {
              title,
              description,
              expectedVersion: version,
            });
            await reload();
            toast(t("saved"));
          } catch (e) {
            toast(t(errorKey(e)));
          }
        }}
      >
        <label>
          {t("title")}
          <input
            required
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          {t("description")}
          <textarea
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <Button type="submit">{t("save")}</Button>
      </form>
    </div>
  );
}
