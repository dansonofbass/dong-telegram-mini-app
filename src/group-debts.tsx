import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight } from "lucide-react";
import { useApp } from "./context";
import { DebtLanes, AccountFlowPage } from "./debts";
import { Avatar, Empty, PageHead } from "./components";
import { calculate, type Hangout } from "../shared/engine";
export function GroupDebtGraph({
  h,
  visual = true,
}: {
  h: Hangout;
  visual?: boolean;
}) {
  const { t, money, hangouts, me } = useApp();
  const c = calculate(h);
  const [chosen, setChosen] = useState("");
  const selected = c.transfers.find(
    (tr) => tr.fromId + "-" + tr.toId === chosen,
  );
  const name = (id: string) => h.members.find((m) => m.id === id)!;
  const peers = h.members
    .map((m) => m.userId)
    .filter((uid): uid is string => !!uid && uid !== me.id);
  const previous = hangouts.some(
    (other) =>
      other.id !== h.id &&
      other.members.some((m) => m.userId && peers.includes(m.userId)),
  );
  return (
    <>
      <PageHead title={t("flowTitle")} sub={t("flowSub")} back>
        <Link
          className="button secondary"
          to={"/hangout/" + h.id + "/" + (visual ? "split" : "flow")}
        >
          {t(visual ? "overview" : "viewFlow")}
        </Link>
        <Link className="button secondary" to="/balances">
          {t("allBalances")}
        </Link>
        <Link className="button" to={"/hangout/" + h.id + "/settle"}>
          {t("record")}
        </Link>
      </PageHead>
      {visual && previous && (
        <section className="carryover-panel">
          <h2>{t("allBalances")}</h2>
          <AccountFlowPage embedded peerIds={peers} />
        </section>
      )}
      <section
        className={
          visual
            ? "debt-canvas premium-graph group-debt-graph"
            : "panel group-debt-graph"
        }
      >
        <div className="canvas-heading">
          <Sparkles size={23} />
          <span>
            {t("groupOnly")} / {h.title}
          </span>
          <span className="currency-tag">{h.currency}</span>
        </div>
        {c.transfers.length ? (
          <DebtLanes
            debts={c.transfers.map((tr) => ({
              ...tr,
              id: tr.fromId + "-" + tr.toId,
              currency: h.currency,
            }))}
            people={Object.fromEntries(h.members.map((m) => [m.id, m]))}
            selected={chosen}
            onSelect={setChosen}
          />
        ) : (
          <Empty title={t("noDebt")} sub={t("noDebtSub")} />
        )}
        {selected && (
          <div className="graph-selection" role="status">
            <div>
              <span>{t("debtDirection")}</span>
              <strong>
                <bdi>{name(selected.fromId).name}</bdi>
                <ArrowRight size={17} />
                <bdi>{name(selected.toId).name}</bdi>
              </strong>
            </div>
            <bdi>{money(selected.amount, h.currency)}</bdi>
            <Link
              className="button"
              to={
                "/hangout/" +
                h.id +
                "/settle?from=" +
                selected.fromId +
                "&to=" +
                selected.toId
              }
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
