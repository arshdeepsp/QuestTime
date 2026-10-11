/* ---- native app (Capacitor) plugins ---- */
import { G } from "./g.js";

/* ---- notifications (native app via Capacitor; inert in the browser) ---- */
export function nativeApp() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (x) {
    return false;
  }
}
export function LN() {
  if (G.LNp) return G.LNp;
  try {
    if (!nativeApp()) return null;
    G.LNp =
      (window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) ||
      (window.Capacitor.registerPlugin ? window.Capacitor.registerPlugin("LocalNotifications") : null);
  } catch (x) {
    G.LNp = null;
  }
  return G.LNp;
}
/* ---- native app glue: files, back button, keep awake, ongoing focus notice ---- */
export function capPlugin(n) {
  try {
    if (!nativeApp()) return null;
    var C = window.Capacitor;
    return (C.Plugins && C.Plugins[n]) || (C.registerPlugin ? C.registerPlugin(n) : null);
  } catch (x) {
    return null;
  }
}
export function toB64(data) {
  return new Promise(function (res, rej) {
    if (typeof data === "string") {
      try {
        res(btoa(unescape(encodeURIComponent(data))));
      } catch (e) {
        rej(e);
      }
      return;
    }
    var fr = new FileReader();
    fr.onload = function () {
      res(String(fr.result).split(",")[1] || "");
    };
    fr.onerror = rej;
    fr.readAsDataURL(data instanceof Blob ? data : new Blob([data]));
  });
}
