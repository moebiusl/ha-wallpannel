import { Request, Response, NextFunction } from "express";

const LOCAL_SUFFIXES = [".local", ".lan", ".home", ".home.arpa", ".fritz.box", ".internal", ".localdomain"];
const INGRESS_ADDRESSES = ["172.30.32.2", "::ffff:172.30.32.2"];

/** Lowercased host without port; IPv6 literals keep their brackets stripped. */
function hostName(header: string): string {
  const value = header.trim().toLowerCase();
  if (value.startsWith("[")) { return value.slice(1, value.indexOf("]")); }
  return value.replace(/:\d+$/, "");
}

/**
 * DNS rebinding protection: a foreign web page must not reach the panel API under its own domain.
 * Local names, IP addresses, HA ingress and configured extra hosts stay allowed.
 */
export function isAllowedHost(header: string | undefined, extraHosts: string[] = []): boolean {
  if (!header) { return false; }
  const host = hostName(header);
  if (!host) { return false; }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || host.includes(":")) { return true; }
  if (host === "localhost" || !host.includes(".")) { return true; }
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) { return true; }
  return extraHosts.some((extra) => host === extra || host.endsWith("." + extra));
}

export function createHostGuard(extraHosts: string[]) {
  const extras = extraHosts.map((host) => host.trim().toLowerCase()).filter(Boolean);
  return function hostGuard(req: Request, res: Response, next: NextFunction): void {
    if (INGRESS_ADDRESSES.includes(req.socket.remoteAddress || "") || isAllowedHost(req.headers.host, extras)) { next(); return; }
    res.status(403).type("text").send("Unbekannte Adresse. Bitte das Wallpanel über die lokale Adresse öffnen.");
  };
}
