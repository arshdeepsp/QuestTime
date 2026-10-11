/* settings drawer */
import { renderSettings } from "./10-settings.js";
import { go } from "../ui/44-navigation.js";

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  (function () {
    var btn = document.getElementById("setBtn"),
      dr = document.getElementById("setDrawer"),
      sc = document.getElementById("setScrim"),
      cl = document.getElementById("setClose");
    function open_() {
      go("settings");
      return;
      renderSettings();
      dr.hidden = false;
      sc.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      cl.focus();
    }
    function close_() {
      dr.hidden = true;
      sc.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    }
    btn.addEventListener("click", function () {
      open_();
    });
    cl.addEventListener("click", close_);
    sc.addEventListener("click", close_);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !dr.hidden) close_();
    });
  })();
}
