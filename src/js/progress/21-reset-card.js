/* ---- after a streak reset: a card, not a gate ---- The day the streak reset (st.resets' last entry, within the last
     RESET_CARD_DAYS) gets a dismissible card under the HUD: "Streak reset on Tue — what broke it?" with a note that is
     saved to S.refl[day] (visible on that day's past-day modal), or Skip (S.refl[day] = {skip:true}). Challenge only. */
import { G } from "../core/g.js";
import { S, dirty } from "../core/00-state.js";
import { cfg, saveCfg } from "../core/config.js";
import { daysBetween, todayKey } from "../core/days.js";
import { ro } from "../core/entries.js";
import { cache, flush } from "../core/storage.js";
import { clone, esc, fmtD } from "../core/util.js";
import { rewardsOff } from "../rules/modes.js";
import { xpNet } from "../rules/xp.js";
import { sfx } from "../ui/01-sound.js";
import { render } from "../ui/04-render.js";
import { setSync } from "../ui/feedback.js";

export var RESET_CARD_DAYS, REPAIR_XP;

/* Streak repair (Challenge only): within RESET_CARD_DAYS of a reset, REPAIR_XP buys back the day that reset it: that day gets e.rep = true (compute treats it as cleared, marked "repaired"), cfg.xpSpent grows, and the streak carries on from before the miss. */
/* Only a reset caused by a second missed day can be repaired; a reset from a lost period total can't (the lost days stay lost, and periodCheck would reset again). */
export function canRepair(st) {
  var k = resetCardDay(st);
  return k &&
    st.marks[k] === "miss" &&
    !(st.lost || []).some(function (l) {
      return l.k === k;
    }) &&
    xpNet() >= REPAIR_XP &&
    !(S.days[k] || {}).rep
    ? k
    : null;
}
export function repairStreak(k) {
  var c = clone(cfg());
  c.xpSpent = (c.xpSpent | 0) + REPAIR_XP;
  saveCfg(c);
  S.days[k] = Object.assign({}, S.days[k] || {}, { rep: true });
  dirty[k] = true;
  S.refl = Object.assign({}, S.refl);
  S.refl[k] = { repaired: true, at: new Date().toISOString() };
  cache();
  clearTimeout(G.timer);
  G.timer = setTimeout(flush, 300);
  sfx("level");
  G.qSig = "";
  render();
  setSync("Streak repaired: " + fmtD(k) + " counts as cleared. \u2212" + REPAIR_XP + " XP.");
}
export function resetCardDay(st) {
  var last = st.resets && st.resets[st.resets.length - 1];
  if (!last || rewardsOff() || S.refl[last]) return null;
  return daysBetween(last, todayKey()) <= RESET_CARD_DAYS ? last : null;
}
export function renderResetCard(st) {
  var el = document.getElementById("resetCard");
  if (!el) {
    el = document.createElement("div");
    el.id = "resetCard";
    el.className = "resetcard";
    el.hidden = true;
    var qw = document.getElementById("questsWrap");
    qw.parentNode.insertBefore(el, qw);
  }
  var k = resetCardDay(st);
  if (!k || ro()) {
    el.hidden = true;
    return;
  }
  if (el.dataset.k === k) {
    el.hidden = false;
    return;
  }
  el.dataset.k = k;
  el.hidden = false;
  var rp = canRepair(st),
    lostQ = (
      (st.lost || []).filter(function (l) {
        return l.k === k;
      })[0] || {}
    ).q;
  el.innerHTML =
    "<b>Streak reset on " +
    esc(fmtD(k)) +
    (lostQ && lostQ.length ? ": " + esc(lostQ.join(", ")) + " missed its total." : ".") +
    '</b><span>What got in the way? A line now makes the next one easier to spot.</span><textarea id="rcText" rows="2" maxlength="200" placeholder="e.g. late night, no plan for the morning"></textarea><div class="edrow end">' +
    (rp ? '<button type="button" class="stone" id="rcRepair">Repair for ' + REPAIR_XP + " XP</button>" : "") +
    '<button type="button" class="stone" id="rcSkip">Skip</button><button type="button" class="stone save" id="rcSave">Save</button></div>';
  var rb = el.querySelector("#rcRepair");
  if (rb)
    rb.addEventListener("click", function () {
      if (rb.dataset.arm) {
        repairStreak(k);
        return;
      }
      rb.dataset.arm = "1";
      rb.textContent = "Spend " + REPAIR_XP + " XP?";
      rb.classList.add("armed");
    });
  function done(v) {
    S.refl = Object.assign({}, S.refl);
    S.refl[k] = v;
    cache();
    el.hidden = true;
    delete el.dataset.k;
    setSync(
      v.skip
        ? "Fresh start. The streak counts from your next cleared day."
        : "Noted. The streak counts from your next cleared day.",
    );
  }
  el.querySelector("#rcSkip").addEventListener("click", function () {
    done({ skip: true, at: new Date().toISOString() });
  });
  el.querySelector("#rcSave").addEventListener("click", function () {
    var t = el.querySelector("#rcText").value.trim();
    if (!t) {
      el.querySelector("#rcText").focus();
      return;
    }
    done({ text: t, at: new Date().toISOString() });
  });
}

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  RESET_CARD_DAYS = 3;
  REPAIR_XP = 200;
}
