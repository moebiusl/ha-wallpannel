import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

/** The PIN unlocks a signed, HttpOnly admin session, never a client-side flag. */
export function createSettingsAuth(pin: string) {
  const secret = crypto.randomBytes(32);
  const attempts = new Map<string, { count: number; until: number }>();
  const lifetime = 8 * 60 * 60 * 1000;
  const sign = (value: string) => crypto.createHmac("sha256", secret).update(value).digest("hex");
  function authenticated(req: Request): boolean {
    const cookie = /(?:^|;\s*)wallpanel_admin=([^;]+)/.exec(req.headers.cookie || "")?.[1] || "";
    const [expires, nonce, signature] = cookie.split(".");
    if (!/^\d+$/.test(expires || "") || !/^[a-f0-9]{32}$/.test(nonce || "") || !/^[a-f0-9]{64}$/.test(signature || "")) { return false; }
    return Number(expires) > Date.now() && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${expires}.${nonce}`)));
  }
  function unlock(req: Request, res: Response): void {
    const now = Date.now();
    for (const [key, value] of attempts) { if (value.until <= now) { attempts.delete(key); } }
    const key = req.ip || "unknown";
    const previous = attempts.get(key);
    if (previous && previous.count >= 5) { res.status(429).json({ ok: false, message: "Bitte eine Minute warten." }); return; }
    if (String(req.body?.pin || "") !== pin) {
      attempts.set(key, { count: (previous?.count || 0) + 1, until: previous?.until || now + 60000 });
      res.status(401).json({ ok: false });
      return;
    }
    attempts.delete(key);
    const value = `${now + lifetime}.${crypto.randomBytes(16).toString("hex")}`;
    res.cookie("wallpanel_admin", `${value}.${sign(value)}`, { httpOnly: true, sameSite: "strict", path: "/", maxAge: lifetime });
    res.json({ ok: true });
  }
  function guard(req: Request, res: Response, next: NextFunction): void {
    if (req.method === "POST" && !req.is("application/json")) {
      res.status(415).json({ ok: false, message: "JSON erforderlich." }); return;
    }
    const adminWrite = req.method !== "GET" && (
      req.path === "/api/panel-config" || req.path === "/api/tablets/settings" ||
      req.path === "/api/panel/reload" ||
      req.path === "/api/tablets/doorbell-test" || /^\/api\/tablets\/[^/]+(?:\/command)?$/.test(req.path) &&
      !["/api/tablets/notify", "/api/tablets/doorbell-close"].includes(req.path) ||
      /^\/api\/addons\/[^/]+\/update$/.test(req.path)
    );
    if (adminWrite && (!authenticated(req) || req.get("X-Wallpanel-Admin") !== "1")) {
      res.status(401).json({ ok: false, message: "Bitte die Optionen mit der PIN entsperren." });
      return;
    }
    next();
  }
  return { unlock, guard, status: (req: Request, res: Response) => { res.json({ unlocked: authenticated(req) }); } };
}
