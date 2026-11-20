import { describe, it, expect } from "vitest";
import {
  calculate,
  distribute,
  expenseShares,
  minor,
  type Hangout,
  type Expense,
} from "../shared/engine";
const item = (price: number, ids = ["a", "b"], weights = ids.map(() => 1)) => ({
  title: "Item",
  unitPrice: price,
  quantity: 1,
  allocations: ids.map((memberId, i) => ({ memberId, weight: weights[i] })),
});
const expense = (
  items = [item(100)],
  payerId = "a",
  extra: Partial<Expense> = {},
): Expense => ({
  id: "e",
  title: "Dinner",
  payerId,
  currency: "AMD",
  items,
  tax: 0,
  tip: 0,
  service: 0,
  discount: 0,
  createdAt: "",
  ...extra,
});
const hangout = (expenses: Expense[]): Hangout => ({
  id: "h",
  title: "Dinner",
  description: "",
  date: "2026-11-20",
  icon: "dinner",
  currency: "AMD",
  ownerId: "a",
  members: ["a", "b", "c"].map((id) => ({ id, name: id, userId: id })),
  expenses,
  settlements: [],
  inviteToken: "token",
  preferences: {},
});
describe("integer financial engine", () => {
  it("parses currency precision without floats", () => {
    expect(minor("12.34", "USD")).toBe(1234);
    expect(minor("3500", "AMD")).toBe(3500);
    expect(() => minor("1.1", "AMD")).toThrow();
    expect(() => minor("1.234", "USDT")).toThrow();
  });
  it("splits unequal individual orders", () => {
    const c = calculate(
      hangout([
        expense([item(3500, ["a"]), item(4000, ["b"]), item(2000, ["c"])]),
      ]),
    );
    expect(c.balances.b.net).toBe(-4000);
    expect(c.total).toBe(9500);
    expect(c.transfers.reduce((s, t) => s + t.amount, 0)).toBe(6000);
  });
  it("rounds shared orders deterministically", () => {
    expect(
      distribute(100, [
        { memberId: "c", weight: 1 },
        { memberId: "a", weight: 1 },
        { memberId: "b", weight: 1 },
      ]),
    ).toEqual({ a: 34, b: 33, c: 33 });
  });
  it("supports weighted shares", () => {
    expect(
      expenseShares(expense([item(100, ["a", "b"], [1, 3])])).shares,
    ).toEqual({ a: 25, b: 75 });
  });
  it("combines multiple payers and simplifies debts", () => {
    const c = calculate(
      hangout([expense([item(100)]), expense([item(60)], "b")]),
    );
    expect(c.transfers).toEqual([{ fromId: "b", toId: "a", amount: 20 }]);
  });
  it("allocates tax, service, tips and discounts proportionally", () => {
    const r = expenseShares(
      expense([item(100, ["a"]), item(300, ["b"])], "a", {
        tax: 40,
        service: 20,
        tip: 40,
        discount: 100,
      }),
    );
    expect(r.shares).toEqual({ a: 100, b: 300 });
    expect(r.total).toBe(400);
  });
  it("only confirmed partial settlements affect balances", () => {
    const h = hangout([expense()]);
    h.settlements = [
      {
        id: "s",
        fromId: "b",
        toId: "a",
        amount: 20,
        status: "marked",
        method: "cash",
        createdAt: "",
      },
    ];
    expect(calculate(h).transfers[0].amount).toBe(50);
    h.settlements[0].status = "confirmed";
    expect(calculate(h).transfers[0].amount).toBe(30);
  });
  it("recalculates edited and deleted expenses", () => {
    const h = hangout([expense()]);
    h.expenses[0].items[0].unitPrice = 200;
    expect(calculate(h).transfers[0].amount).toBe(100);
    h.expenses = [];
    expect(calculate(h).transfers).toEqual([]);
  });
  it("rejects invalid and duplicate allocations", () => {
    expect(() => distribute(1, [])).toThrow();
    expect(() => distribute(100, [{ memberId: "a", weight: 0 }])).toThrow();
    expect(() => expenseShares(expense([item(100, ["a", "a"])]))).toThrow();
    expect(() =>
      expenseShares(expense([item(100)], "a", { discount: 200 })),
    ).toThrow();
  });
  it("handles large values exactly", () => {
    const split = distribute(999999999999, [
      { memberId: "a", weight: 999999999 },
      { memberId: "b", weight: 999999998 },
    ]);
    expect(Object.values(split).reduce((s, n) => s + n, 0)).toBe(999999999999);
  });
  it("rejects mixed currencies and nonmembers", () => {
    expect(() =>
      calculate(hangout([expense(undefined, "a", { currency: "USD" })])),
    ).toThrow();
    expect(() => calculate(hangout([expense([item(100, ["x"])])]))).toThrow();
  });
  it("reconciles many expenses and ties", () => {
    const h = hangout(
      Array.from({ length: 100 }, (_, i) =>
        expense([item(1001 + i, ["a", "b", "c"])], ["a", "b", "c"][i % 3]),
      ),
    );
    const c = calculate(h);
    expect(Object.values(c.balances).reduce((s, b) => s + b.net, 0)).toBe(0);
    expect(c.transfers.length).toBeLessThanOrEqual(2);
  });
});
