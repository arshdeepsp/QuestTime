/* ---- the pixel tomato ----
     10 × 11 rows: R body, D shade, H highlight, G stem, L leaf light, . transparent. A function rather than a variable so
     any module can draw it at any point of startup (ui/23-quick-actions.js draws the slot button before 43b's init). */
export function tomatoRows() {
  return [
    "....GG....",
    "...GGLG...",
    "..RRGGRR..",
    ".RRRRRRRR.",
    "RRHRRRRRRR",
    "RHRRRRRRRR",
    "RRRRRRRRRR",
    "RRRRRRRRRD",
    ".RRRRRRRD.",
    "..DRRRRD..",
    "...DDDD...",
  ];
}
