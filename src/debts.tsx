import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { useApp } from "./context";
import { Avatar, Empty, PageHead } from "./components";
import { accountBalances, type AccountDebt } from "../shared/balances";
import type { Currency, Hangout } from "../shared/engine";
export type LaneDebt = {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  currency: Currency;
};
export function DebtLanes({
  debts,
  people,
  selected,
  onSelect,
  compact = false,
}: {
  debts: LaneDebt[];
  people: Record<string, { name: string }>;
  selected?: string;
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const { t, money } = useApp();
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className={`unified-debts ${compact ? "compact-debts" : ""}`}>
      <div className={`debt-lanes ${debts.length > 6 ? "crowded" : ""}`}>
        {debts.map((d, i) => {
          const from = people[d.fromId],
            to = people[d.toId];
          if (!from || !to) return null;
          return (
            <button
              type="button"
              key={d.id}
              className={`debt-lane ${selected === d.id ? "highlighted" : ""}`}
              onClick={() => onSelect?.(d.id)}
              aria-pressed={selected === d.id}
              aria-label={`${from.name} → ${to.name}: ${money(d.amount, d.currency)}`}
              data-from={d.fromId}
              data-to={d.toId}
            >
              <span className="flow-node">
                <Avatar member={from} />
                <span>
                  <strong>
                    <bdi>{from.name}</bdi>
                  </strong>
                  <small>{t("debtorRole")}</small>
                </span>
              </span>
              <span className="flow-connector">
                <bdi>{money(d.amount, d.currency)}</bdi>
                {["wide", "narrow", "compact"].map((variant) => {
                  const marker = `debt-${prefix}-${i}-${variant}`;
                  return (
                    <svg
                      key={variant}
                      className={`${variant}-connector`}
                      viewBox="0 0 42 28"
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
                            strokeWidth="1.4"
                          />
                        </marker>
                      </defs>
                      <path
                        className="connection-path"
                        d="M2 14 L34 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        markerEnd={`url(#${marker})`}
                      />
                    </svg>
                  );
                })}
              </span>
              <span className="flow-node creditor-node">
                <Avatar member={to} />
                <span>
                  <strong>
                    <bdi>{to.name}</bdi>
                  </strong>
                  <small>{t("creditorRole")}</small>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function AllDebtPreview() {
  const { hangouts, me, t } = useApp();
  const b = accountBalances(hangouts, me.id);
  return (
    <section className="flow-preview all-debt-preview">
      <div className="flow-preview-head">
        <span className="mini-label">
          <Layers size={15} />
          {t("allBalances")}
        </span>
        <Sparkles size={19} />
      </div>
      <h3>{t("flowTitle")}</h3>
      <p>{t("allBalancesSub")}</p>
      {b.debts.length ? (
        <DebtLanes debts={b.debts} people={b.people} compact />
      ) : (
        <Empty title={t("noDebt")} />
      )}
      <Link to="/balances">
        {t("check")}
        <ArrowRight size={17} />
      </Link>
    </section>
  );
}
export function AccountFlowPage({
  peerIds,
  embedded = false,
}: {
  peerIds?: string[];
  embedded?: boolean;
}) {
  const { hangouts, me, t, money } = useApp();
  const b = accountBalances(hangouts, me.id);
  const debts = b.debts.filter(
    (d) => !peerIds || peerIds.includes(d.fromId === me.id ? d.toId : d.fromId),
  );
  const [chosen, setChosen] = useState("");
  const selected = debts.find((d) => d.id === chosen);
  return (
    <>
      {!embedded && (
        <PageHead title={t("allBalances")} sub={t("allBalancesSub")} back />
      )}
      <section className="debt-canvas premium-graph account-graph">
        <div className="canvas-heading">
          <Layers size={22} />
          <span>{t("allPeopleDebts")}</span>
        </div>
        <p className="graph-hint">{t("allBalancesSub")}</p>
        {debts.length ? (
          <DebtLanes
            debts={debts}
            people={b.people}
            selected={chosen}
            onSelect={setChosen}
          />
        ) : (
          <Empty title={t("noDebt")} sub={t("noDebtSub")} />
        )}
      </section>
      {selected && (
        <div className="panel account-breakdown" role="status">
          <h2>{t("balanceSources")}</h2>
          <div className="pair-total">
            <bdi>{b.people[selected.fromId].name}</bdi>
            <ArrowRight size={18} />
            <bdi>{b.people[selected.toId].name}</bdi>
            <strong>{money(selected.amount, selected.currency)}</strong>
          </div>
          {selected.sources.map((s, i) => (
            <div className="source-row" key={`${s.hangoutId}-${i}`}>
              <Link to={`/hangout/${s.hangoutId}/flow`}>{s.title}</Link>
              <span>
                <bdi>{b.people[s.fromUserId].name}</bdi> →{" "}
                <bdi>{b.people[s.toUserId].name}</bdi>
              </span>
              <bdi>{money(s.amount, selected.currency)}</bdi>
              {s.fromUserId === selected.fromId &&
                s.toUserId === selected.toId && (
                  <Link
                    className="text-button"
                    to={`/hangout/${s.hangoutId}/settle?from=${s.fromMemberId}&to=${s.toMemberId}&amount=${Math.min(s.amount, selected.amount)}`}
                  >
                    {t("record")}
                  </Link>
                )}
            </div>
          ))}
          <p className="muted">{t("pairOffsetNote")}</p>
        </div>
      )}
      {!embedded && (
        <div className="panel ledger-history">
          <h2>{t("history")}</h2>
          <p>{t("pairOffsetNote")}</p>
          {hangouts.map((h) => (
            <Link key={h.id} className="source-row" to={`/hangout/${h.id}`}>
              <span>{h.title}</span>
              <small>{h.currency}</small>
              <span>{h.members.map((m) => m.name).join(" · ")}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
