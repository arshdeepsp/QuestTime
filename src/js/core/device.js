/* ---- this device ----
     devId(): a random id made once per install (localStorage pc-dev, device-only, never synced), so a running pomodoro
     shared through the account (sync/54-account.js, "live") knows which device runs it. devName(): what the other device
     calls it ("phone" or "computer"). */
import { nativeApp } from "./native.js";

export function devId() {
  var k = "pc-dev",
    v = null;
  try {
    v = localStorage.getItem(k);
  } catch (x) {}
  if (!v) {
    v = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem(k, v);
    } catch (x) {}
  }
  return v;
}
export function devName() {
  var ua = (navigator && navigator.userAgent) || "";
  return nativeApp() || /Android|iPhone|iPod|Mobile/i.test(ua)
    ? "phone"
    : /iPad|Tablet/i.test(ua)
      ? "tablet"
      : "computer";
}
