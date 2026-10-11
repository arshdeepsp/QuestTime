/* ---- local-only startup ---- */
dlChecked = true;
render();
if (
  "serviceWorker" in navigator &&
  /^https?:$/.test(location.protocol) &&
  !(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform())
) {
  navigator.serviceWorker
    .register("sw.js")
    .then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var w = reg.installing;
        if (!w) return;
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller)
            setSync("An update is ready. Reload to use it.");
        });
      });
    })
    .catch(function () {});
}
