/* ---- the page scroller ----
     On phones (02-layout.css, ≤ 720px) the document doesn't scroll: html/body are fixed to the screen and .wrap is the
     scroller, so only the content between the fixed title bar and the tab bar moves and Android's overscroll stretch
     stays inside it. Desktop keeps the ordinary document scroll. Code that scrolls the page goes through these. */
export function pageScroller() {
  var w = document.querySelector(".wrap");
  if (w && /auto|scroll/.test(getComputedStyle(w).overflowY)) return w;
  return document.scrollingElement || document.documentElement;
}
export function pageScrollTop() {
  return pageScroller().scrollTop;
}
export function pageScrollTo(y) {
  var s = pageScroller();
  if (s === document.scrollingElement || s === document.documentElement) window.scrollTo(0, y);
  else s.scrollTop = y;
}
export function pageScrollBy(dy) {
  var s = pageScroller();
  if (s === document.scrollingElement || s === document.documentElement) window.scrollBy(0, dy);
  else s.scrollTop += dy;
}
