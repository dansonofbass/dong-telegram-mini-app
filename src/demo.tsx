import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Plus,
  RotateCcw,
  Users,
  ArrowRight,
  ShieldCheck,
  Receipt,
} from "lucide-react";
import { useApp } from "./context";
import { Avatar, Button, PageHead } from "./components";
import { DebtLanes } from "./debts";
import {
  calculate,
  expenseShares,
  minor,
  precision,
  type Hangout,
  type Expense,
  type Currency,
} from "../shared/engine";
import { accountBalances } from "../shared/balances";
import type { Key } from "./i18n";
type DemoState = {
  step: number;
  created: boolean;
  h: Hangout;
  prices: string[];
  tax: boolean;
  discount: boolean;
  events: { actor: string; label: Key; amount?: number }[];
};
const people = [
  { id: "demo-ali", name: "Ali", userId: "demo-ali" },
  { id: "demo-sara", name: "Sara", userId: "demo-sara" },
  { id: "demo-reza", name: "Reza", userId: "demo-reza" },
];
const initial = (): DemoState => ({
  step: 0,
  created: false,
  h: {
    id: "interactive-demo",
    title: "Friday together",
    description: "",
    currency: "AMD",
    date: new Date().toLocaleDateString("en-CA"),
    icon: "dinner",
    ownerId: "demo-ali",
    members: [people[0]],
    expenses: [],
    settlements: [],
    inviteToken: "local-simulation-only",
    preferences: {},
  },
  prices: ["3500", "4000", "2000", "1500", "2400", "1800"],
  tax: false,
  discount: false,
  events: [],
});
const steps: Key[] = [
  "demoCreate",
  "demoInvite",
  "demoAliBill",
  "demoSaraBill",
  "demoRezaBill",
  "demoReview",
  "flowTitle",
  "demoSettle",
  "demoHistory",
];
const descriptions: Key[] = [
  "demoCreateText",
  "demoInviteText",
  "demoAliText",
  "demoSaraText",
  "demoRezaText",
  "demoReviewText",
  "flowSub",
  "demoSettleText",
  "demoHistoryText",
];
export function DemoGuide() {
  const { t, money, toast, me } = useApp();
  const [state, setState] = useState<DemoState>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("dong-demo-guide-v2") || "null",
      );
      if (
        saved &&
        Number.isInteger(saved.step) &&
        saved.step >= 0 &&
        saved.step < steps.length &&
        saved.prices?.length === 6 &&
        saved.h?.id === "interactive-demo"
      ) {
        calculate(saved.h);
        return saved;
      }
    } catch {}
    return initial();
  });
  const { h, step } = state;
  const c = calculate(h);
  const [payer, setPayer] = useState("");
  const [selectedDebt, setSelectedDebt] = useState("");
  const [partial, setPartial] = useState("");
  const pending = h.settlements.find((s) => s.status === "marked");
  const confirmed = h.settlements.some((s) => s.status === "confirmed");
  const tr =
    c.transfers.find((d) => d.fromId + "-" + d.toId === selectedDebt) ||
    c.transfers[0];
  useEffect(() => {
    localStorage.setItem("dong-demo-guide-v2", JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    setPayer(step === 3 ? "demo-sara" : step === 4 ? "demo-reza" : "demo-ali");
    document.querySelector('.demo-steps .current')?.scrollIntoView({block:'nearest',inline:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }, [step]);
  function makeBill(): Expense {
    const all = people.map((m) => ({ memberId: m.id, weight: 1 }));
    const item = (title: string, index: number, ids: string[]) => ({
      title,
      quantity: 1,
      unitPrice: minor(state.prices[index], h.currency),
      allocations: all.filter((a) => ids.includes(a.memberId)),
    });
    const allIds = people.map((m) => m.id);
    const actor =
      step === 3 ? "demo-sara" : step === 4 ? "demo-reza" : "demo-ali";
    const e: Expense = {
      id: step === 3 ? "taxi" : step === 4 ? "coffee" : "dinner",
      title: t(steps[step]),
      createdByUserId: actor,
      payerId: payer || actor,
      currency: h.currency,
      createdAt: new Date().toISOString(),
      items:
        step === 3
          ? [item(t("trip"), 4, allIds)]
          : step === 4
            ? [item(t("coffee"), 5, ["demo-ali", "demo-reza"])]
            : [
                item(t("demoPizza"), 0, ["demo-ali"]),
                item(t("demoPasta"), 1, ["demo-sara"]),
                item(t("demoSalad"), 2, ["demo-reza"]),
                item(t("demoFries"), 3, allIds),
              ],
      tax: 0,
      service: 0,
      tip: 0,
      discount: 0,
      ...(step === 2
        ? {
            adjustments: {
              discount: {
                mode: "percentage" as const,
                value: state.discount ? 1000 : 0,
              },
              service: {
                mode: "percentage" as const,
                value: state.tax ? 500 : 0,
              },
            },
          }
        : {}),
    };
    return e;
  }
  function bill() {
    try {
      const e = makeBill();
      const actor = e.createdByUserId!;
      const amount = expenseShares(e).total;
      setState((s) => ({
        ...s,
        h: {
          ...s.h,
          expenses: [...s.h.expenses.filter((x) => x.id !== e.id), e],
        },
        events: [...s.events, { actor, label: "eventExpenseCreated", amount }],
      }));
      toast(t("saved"));
    } catch {
      toast(t("validation"));
    }
  }
  let preview: ReturnType<typeof expenseShares> | null = null;
  if (step >= 2 && step <= 4)
    try {
      preview = expenseShares(makeBill());
    } catch {}
  const canNext =
    step === 0
      ? state.created
      : step === 1
        ? h.members.length === 3
        : step === 2
          ? h.expenses.some((e) => e.id === "dinner")
          : step === 3
            ? h.expenses.some((e) => e.id === "taxi")
            : step === 4
              ? h.expenses.some((e) => e.id === "coffee")
              : step === 7
                ? confirmed
                : true;
  const name = (id: string) => people.find((p) => p.id === id)?.name || id;
  const nextHangout: Hangout = {
    ...h,
    id: "demo-next-hangout",
    members: people,
    title: t("coffee"),
    settlements: [],
    expenses: [
      {
        id: "next-coffee",
        title: t("coffee"),
        payerId: "demo-sara",
        createdByUserId: "demo-sara",
        currency: h.currency,
        createdAt: "",
        items: [
          {
            title: t("coffee"),
            quantity: 1,
            unitPrice: minor("1800", h.currency),
            allocations: [{ memberId: "demo-ali", weight: 1 }],
          },
        ],
        tax: 0,
        service: 0,
        tip: 0,
        discount: 0,
      },
    ],
  };
  const nextBalances = accountBalances([h, nextHangout], "demo-ali");
  return (
    <div className="demo-guide">
      <PageHead title={t("demoGuide")} sub={t("demoGuideSub")} back />
      <div className="demo-safety">
        <ShieldCheck size={19} />
        <span>{t("demoIsolated")}</span>
      </div>
      <div className="demo-layout">
        <aside className="demo-steps">
          <ol>
            {steps.map((key, i) => (
              <li key={key}>
                <button
                  type="button"
                  className={
                    step === i ? "current" : i < step ? "complete" : ""
                  }
                  disabled={i > step + 1 || (i === step + 1 && !canNext)}
                  onClick={() => setState((s) => ({ ...s, step: i }))}
                >
                  <span>{i < step ? <Check size={15} /> : i + 1}</span>
                  {t(key)}
                </button>
              </li>
            ))}
          </ol>
          <button
            className="text-button"
            onClick={() => {
              setState(initial());
              setPartial("");
              setSelectedDebt("");
            }}
          >
            <RotateCcw size={15} />
            {t("demoRestart")}
          </button>
          <small>{t("demoSavedLocally")}</small>
        </aside>
        <div className="demo-workspace">
          <div className="demo-step-heading">
            <span>
              {t("demoStep")} {step + 1} / {steps.length}
            </span>
            <h2>{t(steps[step])}</h2>
            <p>{t(descriptions[step])}</p>
          </div>
          {step === 0 && (
            <form
              className="panel form"
              onSubmit={(e) => {
                e.preventDefault();
                setState((s) => ({
                  ...s,
                  created: true,
                  events: [
                    ...s.events,
                    { actor: "demo-ali", label: "eventCreated" },
                  ],
                }));
              }}
            >
              <div className="demo-actor">
                <Avatar member={people[0]} />
                {t("demoRole")} <strong>Ali</strong>
              </div>
              <label>
                {t("title")}
                <input
                  required
                  maxLength={100}
                  value={h.title}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      h: { ...s.h, title: e.target.value },
                    }))
                  }
                />
              </label>
              <label>
                {t("currency")}
                <select
                  value={h.currency}
                  disabled={h.expenses.length > 0}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      h: { ...s.h, currency: e.target.value as Currency },
                    }))
                  }
                >
                  {["AMD", "USD", "EUR", "USDT", "CAD"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <Button type="submit">
                <Plus size={17} />
                {t(state.created ? "demoCreated" : "create")}
              </Button>
            </form>
          )}
          {step === 1 && (
            <div className="panel form">
              <div className="demo-invite-illustration">
                <Users size={42} />
                <span>{t("demoInvitation")}</span>
              </div>
              {people.map((p) => (
                <div className="member-row" key={p.id}>
                  <Avatar member={p} />
                  <strong>{p.name}</strong>
                  {h.members.some((m) => m.id === p.id) ? (
                    <span className="preferred push-end">
                      <Check size={14} />
                      {t("demoJoined")}
                    </span>
                  ) : (
                    <Button
                      secondary
                      onClick={() =>
                        setState((s) => ({
                          ...s,
                          h: { ...s.h, members: [...s.h.members, p] },
                          events: [
                            ...s.events,
                            { actor: p.id, label: "eventJoined" },
                          ],
                        }))
                      }
                    >
                      {t(
                        p.id === "demo-sara" ? "demoJoinSara" : "demoJoinReza",
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          {step >= 2 && step <= 4 && (
            <form
              className="panel form"
              onSubmit={(e) => {
                e.preventDefault();
                bill();
              }}
            >
              <div className="demo-actor">
                <Avatar member={people[step - 2]} />
                {t("demoRole")} <strong>{people[step - 2].name}</strong>
              </div>
              <label>
                {t("payer")}
                <select
                  value={payer}
                  onChange={(e) => setPayer(e.target.value)}
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {(step === 2 ? [0, 1, 2, 3] : step === 3 ? [4] : [5]).map((i) => (
                <label className="demo-price-row" key={i}>
                  <span>
                    {t(
                      (
                        [
                          "demoPizza",
                          "demoPasta",
                          "demoSalad",
                          "demoFries",
                          "demoTaxi",
                          "demoCoffee",
                        ] as const
                      )[i],
                    )}{" "}
                    ·{" "}
                    {
                      [
                        "Ali",
                        "Sara",
                        "Reza",
                        "Ali + Sara + Reza",
                        "Ali + Sara + Reza",
                        "Ali + Reza",
                      ][i]
                    }
                  </span>
                  <input
                    aria-label={t(
                      (
                        [
                          "demoPizza",
                          "demoPasta",
                          "demoSalad",
                          "demoFries",
                          "demoTaxi",
                          "demoCoffee",
                        ] as const
                      )[i],
                    )}
                    inputMode="decimal"
                    required
                    value={state.prices[i]}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        prices: s.prices.map((p, n) =>
                          n === i ? e.target.value : p,
                        ),
                      }))
                    }
                  />
                  <small>{h.currency}</small>
                </label>
              ))}
              {step === 2 && (
                <>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={state.discount}
                      onChange={(e) =>
                        setState((s) => ({ ...s, discount: e.target.checked }))
                      }
                    />
                    {t("demoDiscount")}
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={state.tax}
                      onChange={(e) =>
                        setState((s) => ({ ...s, tax: e.target.checked }))
                      }
                    />
                    {t("demoTax")}
                  </label>
                </>
              )}
              {preview && (
                <div className="demo-live-shares">
                  <h3>{t("split")}</h3>
                  {Object.entries(preview.shares).map(([id, n]) => (
                    <div className="adjustment-row" key={id}>
                      <span>{name(id)}</span>
                      <bdi>{money(n, h.currency)}</bdi>
                    </div>
                  ))}
                  <div className="bill-total">
                    <strong>{t("total")}</strong>
                    <bdi>{money(preview.total, h.currency)}</bdi>
                  </div>
                </div>
              )}
              <Button type="submit">
                <Receipt size={17} />
                {t("demoExpense")}
              </Button>
            </form>
          )}
          {(step === 5 || step === 8) && (
            <div className="panel demo-ledger">
              <h3>{t("demoLedger")}</h3>
              {h.expenses.map((e) => (
                <div className="demo-expense" key={e.id}>
                  <div>
                    <strong>{e.title}</strong>
                    <small>
                      {t("creator")}: {name(e.createdByUserId!)} · {t("paidBy")}{" "}
                      {name(e.payerId)}
                    </small>
                    <p>{e.items.map((i) => i.title).join(" · ")}</p>
                  </div>
                  <bdi>{money(expenseShares(e).total, h.currency)}</bdi>
                </div>
              ))}
              <div className="bill-total">
                <strong>{t("total")}</strong>
                <bdi>{money(c.total, h.currency)}</bdi>
              </div>
              {people.map((p) => (
                <div className="member-row" key={p.id}>
                  <Avatar member={p} />
                  <span>{p.name}</span>
                  <strong className="push-end">
                    {money(c.balances[p.id]?.net || 0, h.currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {(step === 6 || step === 7) && (
            <div className="debt-canvas premium-graph demo-debts">
              <DebtLanes
                debts={c.transfers.map((d) => ({
                  ...d,
                  id: d.fromId + "-" + d.toId,
                  currency: h.currency,
                }))}
                people={Object.fromEntries(people.map((p) => [p.id, p]))}
                selected={selectedDebt}
                onSelect={setSelectedDebt}
              />
              {!c.transfers.length && <p>{t("noDebt")}</p>}
            </div>
          )}
          {step === 7 && (
            <div className="panel form">
              {!pending && tr && (
                <>
                  <label>
                    {t("from")} / {t("to")}
                    <select
                      value={tr.fromId + "-" + tr.toId}
                      onChange={(e) => {
                        setSelectedDebt(e.target.value);
                        setPartial("");
                      }}
                    >
                      {c.transfers.map((d) => (
                        <option
                          key={d.fromId + "-" + d.toId}
                          value={d.fromId + "-" + d.toId}
                        >
                          {name(d.fromId)} → {name(d.toId)} ·{" "}
                          {money(d.amount, h.currency)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("amount")} ({h.currency})
                    <input
                      inputMode="decimal"
                      value={partial}
                      placeholder={String(
                        Math.max(1, Math.floor(tr.amount / 2)) /
                          10 ** precision(h.currency),
                      )}
                      onChange={(e) => setPartial(e.target.value)}
                    />
                  </label>
                  <Button
                    onClick={() => {
                      try {
                        const n = partial
                          ? minor(partial, h.currency)
                          : Math.max(1, Math.floor(tr.amount / 2));
                        if (n <= 0 || n > tr.amount) throw Error();
                        setState((s) => ({
                          ...s,
                          h: {
                            ...s.h,
                            settlements: [
                              ...s.h.settlements,
                              {
                                id: "demo-settlement-" + Date.now(),
                                fromId: tr.fromId,
                                toId: tr.toId,
                                amount: n,
                                method: "cash",
                                status: "marked",
                                createdAt: new Date().toISOString(),
                              },
                            ],
                          },
                          events: [
                            ...s.events,
                            {
                              actor: tr.fromId,
                              label: "eventMarked",
                              amount: n,
                            },
                          ],
                        }));
                        toast(t("demoMarked"));
                      } catch {
                        toast(t("overpayment"));
                      }
                    }}
                  >
                    {t("markPaid")} · {name(tr.fromId)}
                  </Button>
                </>
              )}
              {pending && (
                <>
                  <div className="info-note">
                    <span>
                      {name(pending.fromId)} → {name(pending.toId)} ·{" "}
                      {money(pending.amount, h.currency)}
                      <p>{t("demoMarked")}</p>
                    </span>
                  </div>
                  <Button
                    onClick={() => {
                      setState((s) => ({
                        ...s,
                        h: {
                          ...s.h,
                          settlements: s.h.settlements.map((x) =>
                            x.id === pending.id
                              ? { ...x, status: "confirmed" }
                              : x,
                          ),
                        },
                        events: [
                          ...s.events,
                          {
                            actor: pending.toId,
                            label: "eventConfirmed",
                            amount: pending.amount,
                          },
                        ],
                      }));
                      toast(t("demoConfirmed"));
                    }}
                  >
                    {t("confirm")} · {name(pending.toId)}
                  </Button>
                </>
              )}
              {confirmed && <p className="positive">{t("demoConfirmed")}</p>}
            </div>
          )}
          {step === 8 && (
            <>
              <div className="panel form">
                <h3>{t("allBalances")}</h3>
                <p>
                  {h.title} + {nextHangout.title}
                </p>
                <p>{t("pairOffsetNote")}</p>
                <div className="debt-canvas premium-graph">
                  <DebtLanes
                    debts={nextBalances.debts}
                    people={nextBalances.people}
                  />
                </div>
              </div>
              <div className="panel">
                <h3>{t("activity")}</h3>
                <ol className="demo-events">
                  {state.events.map((e, i) => (
                    <li key={i}>
                      <Avatar
                        size="small"
                        member={people.find((p) => p.id === e.actor)!}
                      />
                      <span>
                        <strong>{name(e.actor)}</strong> {t(e.label)}
                      </span>
                      {e.amount !== undefined && (
                        <bdi>{money(e.amount, h.currency)}</bdi>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
              <Link to={me.id ? "/create" : "/"} className="button full">
                {t("demoEnd")}
                <ArrowRight size={18} />
              </Link>
            </>
          )}
          <nav className="demo-navigation">
            <Button
              secondary
              disabled={step === 0}
              onClick={() => setState((s) => ({ ...s, step: s.step - 1 }))}
            >
              {t("demoPrevious")}
            </Button>
            {step < steps.length - 1 && (
              <Button
                disabled={!canNext}
                onClick={() => setState((s) => ({ ...s, step: s.step + 1 }))}
              >
                {t("demoNext")}
                <ArrowRight size={17} />
              </Button>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}
