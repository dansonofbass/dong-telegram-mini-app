import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyTelegram(
  raw: string,
  token: string,
  now = Date.now() / 1000,
) {
  const p = new URLSearchParams(raw);
  if ([...p.keys()].length !== new Set(p.keys()).size) throw Error("auth");
  const hash = p.get("hash") || "";
  p.delete("hash");
  const date = Number(p.get("auth_date"));
  if (!Number.isFinite(date) || now - date > 3600 || date - now > 30)
    throw Error("auth");
  const key = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", key)
    .update(
      [...p.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n"),
    )
    .digest();
  if (
    !/^[a-f0-9]{64}$/.test(hash) ||
    !timingSafeEqual(expected, Buffer.from(hash, "hex"))
  )
    throw Error("auth");
  const user = JSON.parse(p.get("user") || "{}");
  if (!Number.isSafeInteger(user.id) || typeof user.first_name !== "string")
    throw Error("auth");
  return user as {
    id: number;
    first_name: string;
    last_name?: string;
    language_code?: string;
    username?: string;
    photo_url?: string;
  };
}
