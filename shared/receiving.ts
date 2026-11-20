/** Normalize human-entered banking values without changing wallet addresses. */
export function normalizeReceivingValue(kind: string, value: string) {
  if (kind === "cash") return "";
  if (kind !== "card" && kind !== "bank") return value.trim();
  const digits = value
    .normalize("NFKC")
    .replace(/[۰-۹٠-٩]/g, (c) =>
      String(c.charCodeAt(0) - (c >= "۰" && c <= "۹" ? 0x6f0 : 0x660)),
    );
  return digits
    .replace(/[\s\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069\-‐‑–—]/g, "")
    .toUpperCase();
}
