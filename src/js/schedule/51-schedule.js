/* ---- today's schedule ----
     Places today's time quests on Your day. Stored on the day entry as e.sched = [{id, q, f, t, j5}]: one entry per
     block ("shot"), so a quest can be split into several. f/t are minutes from that day's midnight (dayWin scale).
     j5 = "5-min start": fixed length, its notification starts Just 5; otherwise a resizable range whose notification
     starts the normal timer. Planning only: hasEntry ignores it, so it never affects clearing or streaks.
     Busy times are a weekday template in cfg.busy = [{id, lb, f, t, dows, from, until?}], edited on the same page in
     "busy" mode (Settings › Your day › Busy times, or from the schedule). A block applies from the day it was added
     (from) on its weekdays, until `until` if set. schAll merges them as read-only {id:"z-"+id, busy, lb}: Auto-plan and
     new shots avoid them, but shots already placed that overlap stay (marked .clash) and still remind.
     Weekly quest repeats live in cfg.rep = [{id, q, f, t, j5?, dows, from, until}]; schAll merges them into each day as
     {id:"r-"+rep, rep, ...}. Editing one occurrence detaches it (a one-off copy + e.schSkip), with "Every week" to push
     the change back to the series. */
import { G } from "../core/g.js";

export var SCH_STEP, SCH_ROW_FULL, SCH_ROW_DENSE, SCH_DENSE_MIN, REP_MAX, SCH_AHEAD, SCH_ENDED, SCH_EDGE;

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  SCH_STEP = 15;
  G.SCH_ROW = 22;
  SCH_ROW_FULL = 22;
  SCH_ROW_DENSE = 16;
  SCH_DENSE_MIN = 120;
  REP_MAX = 26;
  G.schSel = null;
  G.schQ = null;
  G.schMsg = "";
  G.schBody = null;
  G.schDrag = null;
  G.schDet = null;
  G.schRep = null;
  G.schMd = "today";
  G.schWd = 1;
  G.schBack = false;
  G.schShown = null;
  G.schDay = null;
  SCH_AHEAD = 13;
  SCH_ENDED = "That block has ended, so it stays as planned. Re-plan or add a new block instead.";
  /* Full-screen page (#schPage): header, quest chips, the timeline as the only scroller, and a bottom bar that is
     either help + Auto-plan, a quest picker for a tapped free time (schPick), or controls for a selected block (schSel). */
  G.schPick = null;
  G.schPg = null;
  G.schAdj = false;
  /* Edge auto-scroll for drags: while the finger/mouse sits within SCH_EDGE px of the timeline's top or bottom (or past
     it, e.g. over the footer), the timeline keeps scrolling on its own, faster the deeper you go. tick(y) is re-run every
     frame with the last pointer position, so the dragged block stays under the finger while the day scrolls. */
  SCH_EDGE = 64;
  G.resKey = "?";
  G.resT = 0;
}
