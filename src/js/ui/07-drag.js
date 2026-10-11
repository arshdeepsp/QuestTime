/* ---- drag to reorder (hold to pick up on phones) ---- */
/* sortable(container, itemSel, handleSel, onDrop, holdSkip): drag rows by their handle (mouse/pen/touch) or, when
     holdSkip is given, by holding a touch anywhere on the row for HOLD_MS that isn't on a control matching holdSkip
     (a finger that moves before then scrolls as usual). Arrow keys on the handle move too. onDrop(order, newIndex). */
var HOLD_MS = 350;
function sortable(container, itemSel, handleSel, onDrop, holdSkip) {
  var items0 = [].slice.call(container.querySelectorAll(itemSel)).filter(function (x) {
    return x.parentNode === container;
  });
  items0.forEach(function (it, ix) {
    it.setAttribute("data-sidx", ix);
  });
  items0.forEach(function (row) {
    var hd = row.querySelector(handleSel);
    function sibs() {
      return [].slice.call(container.children).filter(function (x) {
        return x.matches(itemSel);
      });
    }
    function run(touch) {
      var moved = false;
      row.classList.add("dragging");
      function mv(e) {
        var rows = sibs(),
          placed = false;
        if (e.clientY < 60) window.scrollBy(0, -12);
        else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
        var sc = container.closest(".modal-b,.drawer-b");
        if (sc) {
          var sb = sc.getBoundingClientRect();
          if (e.clientY < sb.top + 50) sc.scrollTop -= 12;
          else if (e.clientY > sb.bottom - 50) sc.scrollTop += 12;
        }
        for (var r = 0; r < rows.length; r++) {
          var el = rows[r];
          if (el === row) continue;
          var bb = el.getBoundingClientRect();
          if (e.clientY < bb.top + bb.height / 2) {
            if (el.previousElementSibling !== row) {
              container.insertBefore(row, el);
              moved = true;
            }
            placed = true;
            break;
          }
        }
        if (!placed) {
          var last = rows
            .filter(function (x) {
              return x !== row;
            })
            .pop();
          if (last && last.nextElementSibling !== row) {
            container.insertBefore(row, last.nextSibling);
            moved = true;
          }
        }
      }
      function done() {
        row.classList.remove("dragging");
        if (moved) {
          var order = sibs().map(function (x) {
            return +x.getAttribute("data-sidx");
          });
          onDrop(order, order.indexOf(+row.getAttribute("data-sidx")));
        }
      }
      if (touch) {
        function tm(e) {
          e.preventDefault();
          mv({ clientY: e.touches[0].clientY });
        }
        function te() {
          row.removeEventListener("touchmove", tm);
          row.removeEventListener("touchend", te);
          row.removeEventListener("touchcancel", te);
          done();
        }
        row.addEventListener("touchmove", tm, { passive: false });
        row.addEventListener("touchend", te);
        row.addEventListener("touchcancel", te);
      } else {
        function up() {
          document.removeEventListener("pointermove", mv);
          document.removeEventListener("pointerup", up);
          document.removeEventListener("pointercancel", up);
          done();
        }
        document.addEventListener("pointermove", mv);
        document.addEventListener("pointerup", up);
        document.addEventListener("pointercancel", up);
      }
    }
    if (hd) {
      hd.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
      });
      hd.addEventListener("keydown", function (ev) {
        if (ev.key !== "ArrowUp" && ev.key !== "ArrowDown") return;
        ev.preventDefault();
        ev.stopPropagation();
        var i = +row.getAttribute("data-sidx"),
          j = i + (ev.key === "ArrowUp" ? -1 : 1);
        if (j < 0 || j >= items0.length) return;
        var order = items0.map(function (_, k) {
          return k;
        });
        order.splice(j, 0, order.splice(i, 1)[0]);
        onDrop(order, j);
      });
      hd.addEventListener("pointerdown", function (ev) {
        if (ev.button !== undefined && ev.button !== 0) return;
        ev.preventDefault();
        ev.stopPropagation();
        run(false);
      });
    }
    if (holdSkip != null) {
      var lp = null;
      row.addEventListener(
        "touchstart",
        function (ev) {
          if (ev.touches.length !== 1 || ev.target.closest(holdSkip)) return;
          var x0 = ev.touches[0].clientX,
            y0 = ev.touches[0].clientY;
          clearTimeout(lp);
          function cancel(e2) {
            if (
              e2.type === "touchmove" &&
              Math.abs(e2.touches[0].clientY - y0) < 8 &&
              Math.abs(e2.touches[0].clientX - x0) < 8
            )
              return;
            clearTimeout(lp);
            lp = null;
            row.removeEventListener("touchmove", cancel);
            row.removeEventListener("touchend", cancel);
            row.removeEventListener("touchcancel", cancel);
          }
          lp = setTimeout(function () {
            lp = null;
            row.removeEventListener("touchmove", cancel);
            row.removeEventListener("touchend", cancel);
            row.removeEventListener("touchcancel", cancel);
            haptic("medium");
            run(true);
          }, HOLD_MS);
          row.addEventListener("touchmove", cancel, { passive: true });
          row.addEventListener("touchend", cancel, { passive: true });
          row.addEventListener("touchcancel", cancel, { passive: true });
        },
        { passive: true },
      );
      row.addEventListener("contextmenu", function (e) {
        if (row.classList.contains("dragging") || lp) e.preventDefault();
      });
    }
  });
}
function reorder(arr, order) {
  return order.map(function (k) {
    return arr[k];
  });
}
