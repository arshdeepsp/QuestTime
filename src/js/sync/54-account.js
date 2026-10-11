/* ---- account and cloud sync (Firebase: email/password auth + Firestore) ----
     Nothing here runs until someone signs in. cloud.boot() on startup: if pc-account says a user was signed in on this
     device, the SDK (vendor/firebase.js, built from src/firebase/fb.js) is imported and auth restores the session.
     Data layout: users/<uid>/data/cfg, users/<uid>/data/refl, users/<uid>/days/<date> (document paths need an even number of segments). Every document carries u (ms, the store's
     stamp) and at (server write time); a removed day is written as {del:true, u} so other devices delete it too. Who
     wins is decided by content against the last agreed version (takeRemote; merge helpers in sync/merge.js), not by clocks. Local writes keep going to localStorage
     through the local adapter; the cloud adapter wraps it and pushes the changed docs a few seconds after the last edit.
     Remote changes are pulled (launch, return to the app, Sync now) and adopted through store.adopt (no re-push); there
     are no live listeners. Tests replace window.PCFB with a fake. */
import { G } from "../core/g.js";
import { S, localAdapter, store } from "../core/00-state.js";
import { dedupeQuests } from "../core/config.js";
import { cache, cloudAccount } from "../core/storage.js";
import { lockReset } from "../rules/past-days.js";
import { renderSettings } from "../settings/10-settings.js";
import { render } from "../ui/04-render.js";
import { hashOf, merge3 } from "./merge.js";
import { welcomeCheck } from "../ui/24-help.js";
import { applyLook } from "../ui/look.js";

export var FIREBASE_CONFIG, ACCOUNT_KEY, cloud;

/* Runs once at startup, in file-number order (main.js). */
export function init() {
  FIREBASE_CONFIG = {
    apiKey: "AIzaSyA4UK9_-Ujodg0nYmj8wA9ILt-zNMxT63U",
    authDomain: "productivitycraft.firebaseapp.com",
    projectId: "productivitycraft",
    storageBucket: "productivitycraft.firebasestorage.app",
    messagingSenderId: "632131334250",
    appId: "1:632131334250:web:03d4a81e706eb9cc551a13",
  };
  ACCOUNT_KEY = "pc-account";
  cloud = (function () {
    var fb = null,
      user = null,
      unsub = [],
      state = { status: "off", last: 0, err: "", pending: 0 },
      listeners = [],
      pushing = false,
      queue = {},
      startP = null;
    function acct() {
      return cloudAccount();
    }
    function setAcct(a) {
      try {
        if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a));
        else localStorage.removeItem(ACCOUNT_KEY);
      } catch (x) {}
    }
    function emit() {
      listeners.forEach(function (f) {
        try {
          f(state);
        } catch (x) {}
      });
    }
    function setStatus(s, err) {
      state.status = s;
      state.err = err || "";
      emit();
    }
    function lib() {
      if (fb) return Promise.resolve(fb);
      if (window.PCFB) {
        fb = window.PCFB;
        fb.init(FIREBASE_CONFIG);
        return Promise.resolve(fb);
      }
      return import("./vendor/firebase.js").then(function () {
        fb = window.PCFB;
        fb.init(FIREBASE_CONFIG);
        return fb;
      });
    }
    function base() {
      return "users/" + user.uid;
    }
    function strip(o) {
      return JSON.parse(JSON.stringify(o));
    }
    /* Firestore document paths need an even number of segments: cfg and refl live in users/<uid>/data/, days in users/<uid>/days/. */
    function docPath(id) {
      return id === "cfg" || id === "refl" ? base() + "/data/" + id : base() + "/" + id;
    }
    function localDoc(id) {
      if (id === "cfg") return S.cfg;
      if (id === "refl") return { map: S.refl };
      if (id.indexOf("days/") === 0) return S.days[id.slice(5)] || null;
      return null;
    }
    /* Stamps are ms timestamps: never |0 them (that truncates to 32 bits). */
    function stampOf(id) {
      return +((S.meta && S.meta.u && S.meta.u[id]) || 0);
    }
    function tombOf(id) {
      return +((S.meta && S.meta.del && S.meta.del[id]) || 0);
    }
    /* Push one doc (or its tombstone) with its stamp; stamp an unstamped local doc now. */
    function op(id) {
      var d = tombOf(id),
        l = localDoc(id);
      if (!l && d) return { id: id, path: docPath(id), data: { del: true, u: d } };
      if (!l) return null;
      var u = stampOf(id);
      if (!u) {
        u = Date.now();
        S.meta.u[id] = u;
      }
      var data = strip(l);
      data.u = u;
      delete data.del;
      delete data.at;
      return { id: id, path: docPath(id), data: data };
    }
    /* A doc's content without the sync fields (u = device stamp, at = server write time, del = tombstone). */
    function bare(data) {
      var d = strip(data);
      delete d.u;
      delete d.at;
      delete d.del;
      return d;
    }
    /* Record the version both sides now share (null = deleted): its hash, and for cfg the version itself (merge base). */
    function agree(id, content) {
      var m = meta(),
        H = m.h || (m.h = {});
      if (content == null) {
        H[id] = "del";
        if (id === "cfg") delete m.cb;
      } else {
        H[id] = hashOf(content);
        if (id === "cfg") m.cb = content;
      }
    }
    function flushQueue() {
      if (pushing || !user || !fb) return;
      var ids = Object.keys(queue);
      if (!ids.length) return;
      var t0 = Date.now();
      queue = {};
      pushing = true;
      var ops = ids.map(op).filter(Boolean);
      state.pending = ids.length;
      setStatus("syncing");
      fb.db.batch(ops).then(
        function () {
          pushing = false;
          state.last = Date.now();
          state.pending = 0;
          ops.forEach(function (o) {
            agree(o.id, o.data.del ? null : bare(o.data));
          });
          setStatus("on");
          flushQueue();
          if (!Object.keys(queue).length && !pushing) {
            meta().synced = t0;
            try {
              localAdapter.save(S);
            } catch (x) {}
          }
        },
        function (e) {
          pushing = false;
          ids.forEach(function (i) {
            queue[i] = true;
          });
          setStatus("error", String((e && e.message) || e));
        },
      );
    }
    var cloudAdapter = {
      name: "cloud",
      load: function () {
        return localAdapter.load();
      },
      save: function (state0, changed) {
        localAdapter.save(state0);
        changed.forEach(function (id) {
          if (id === "session") return;
          queue[id.charAt(0) === "-" ? id.slice(1) : id] = true;
        });
        schedulePush();
      },
    };
    /* No real-time traffic: changes are pushed PUSH_DELAY after the last edit (a burst of +/- taps is one write), and
       straight away when the app goes to the background. Other devices' changes are pulled on launch, on return to the
       app (only documents stamped since the last pull) and on Sync now / pull to refresh; there are no live listeners,
       so nothing from the cloud lands while you're tapping. */
    var PUSH_DELAY = 3000,
      pushT = 0,
      pulling = false;
    /* Cheap pulls: every write carries `at`, the server's write time (fb.js). S.meta.pat (saved with this account's copy
       on the device, so it goes when the copy goes) = the newest `at` seen. With it, launch and return read only documents
       written after it (less PULL_SLACK): a handful of reads instead of every day ever logged, and no device clock is
       involved. Without it (first use of the account on this device) the full merge runs. S.meta.synced = when
       everything here last reached the cloud; local docs stamped after it are pushed on the next pull, so edits made
       just before the app closed still go up. Sync now is always the full merge. */
    var PULL_SLACK = 60000;
    function meta() {
      S.meta = S.meta || { u: {} };
      return S.meta;
    }
    /* Before signing out or clearing: push what's waiting now rather than in PUSH_DELAY, and wait (up to 6 s) for it. */
    var settled = false;
    function settle() {
      clearTimeout(pushT);
      flushQueue();
      return new Promise(function (res) {
        var t0 = Date.now();
        (function w() {
          if (!pushing || Date.now() - t0 > 6000) res();
          else setTimeout(w, 100);
        })();
      });
    }
    function schedulePush() {
      clearTimeout(pushT);
      pushT = setTimeout(flushQueue, PUSH_DELAY);
    }
    function seen(data) {
      var a = +((data && data.at) || 0),
        m = meta();
      if (a > (m.pat || 0)) m.pat = a;
    }
    function inSync(t0) {
      if (!Object.keys(queue).length && !pushing) {
        meta().synced = t0;
        setStatus("on");
      }
    }
    function pull() {
      if (!user || !fb) return Promise.resolve();
      if (pulling) return pulling;
      delete meta().pulled;
      if (!meta().pat) return merge();
      var since = meta().pat - PULL_SLACK,
        t0 = Date.now();
      pulling = Promise.resolve()
        .then(function () {
          return Promise.all([fb.db.listSince(base() + "/data", since), fb.db.listSince(base() + "/days", since)]);
        })
        .then(
          function (r) {
            pulling = false;
            var ch = false,
              got = {},
              m = meta(),
              syn = m.synced || 0;
            r[0]
              .concat(
                r[1].map(function (x) {
                  return { id: "days/" + x.id, data: x.data };
                }),
              )
              .forEach(function (x) {
                got[x.id] = 1;
                seen(x.data);
                if (takeRemote(x.id, x.data)) ch = true;
              });
            Object.keys(m.u || {}).forEach(function (id) {
              if (!got[id] && m.u[id] > syn && localDoc(id)) queue[id] = true;
            });
            Object.keys(m.del || {}).forEach(function (id) {
              if (!got[id] && m.del[id] > syn) queue[id] = true;
            });
            /* render now, not on the store's next-microtask render: freezing past days during render changes docs,
               and those changes must go out with this pull's push */
            if (ch) {
              G.qSig = "";
              render();
            }
            cache();
            flushQueue();
            inSync(t0);
            try {
              localAdapter.save(S);
            } catch (x) {}
          },
          function (e) {
            pulling = false;
            setStatus("error", String((e && e.message) || e));
          },
        );
      return pulling;
    }
    document.addEventListener("visibilitychange", function () {
      if (!user) return;
      if (document.visibilityState === "hidden") {
        clearTimeout(pushT);
        flushQueue();
      } else pull();
    });
    /* A local doc with nothing in it (the default cfg a fresh install makes, a day with only an auto snapshot, no reflections) never beats a remote doc, whatever its stamp: startup housekeeping stamps docs too, and that must not overwrite real data from another device. */
    function emptyLocal(id) {
      var l = localDoc(id);
      if (!l) return true;
      if (id === "cfg") return !(l.quests || []).length && !(l.subjects || []).length && !(l.rules || []).length;
      if (id === "refl") return !Object.keys(l.map || {}).length;
      return Object.keys(l).every(function (f) {
        return f === "q" || f === "ck" || f === "schSkip";
      });
    }
    /* A remote doc against ours, by content (S.meta.h = hash of the version both last agreed on), not by device clock:
       only the remote changed → take it; only ours changed → push ours; both → merge (sync/merge.js: cfg three-way against
       S.meta.cb, days and reflections field by field), install the result as a local edit and push it. An edit beats a
       deletion from the other side. Docs with no agreed version yet (synced before this existed) fall back to the
       newer stamp once; an empty local doc never beats a remote one. */
    function takeRemote(id, data) {
      if (!data) return false;
      var m = meta(),
        hb = (m.h || {})[id],
        ru = +(data.u || 0),
        lu = stampOf(id),
        ld = tombOf(id),
        l = localDoc(id);
      if (data.del) {
        if (!l) {
          agree(id, null);
          return false;
        }
        if (hb != null ? hashOf(l) === hb || emptyLocal(id) : ru > Math.max(lu, ld)) {
          store.adopt(id, null, ru);
          agree(id, null);
          return true;
        }
        queue[id] = true;
        return false;
      }
      var r = bare(data),
        rc = id === "refl" ? { map: r.map || {} } : r,
        hr = hashOf(rc);
      function take() {
        var obj = id === "refl" ? rc.map : r;
        /* A cfg from a device that saved a quest twice: take it without the copies and push the repaired version back. */
        if (id === "cfg") {
          var fx = JSON.parse(JSON.stringify(r));
          if (dedupeQuests(fx)) {
            obj = fx;
            queue.cfg = true;
          }
        }
        store.adopt(id, obj, ru);
        agree(id, rc);
        return true;
      }
      if (!l) {
        if (ld && (hb != null ? hr === hb : ld > ru)) {
          queue[id] = true;
          return false;
        }
        return take();
      }
      var hl = hashOf(l);
      if (hl === hr) {
        agree(id, rc);
        return false;
      }
      if (emptyLocal(id)) return take();
      if (hb == null) {
        if (ru > lu) return take();
        queue[id] = true;
        return false;
      }
      if (hl === hb) return take();
      if (hr === hb) {
        queue[id] = true;
        return false;
      }
      var mg = merge3(id === "cfg" ? m.cb : id === "refl" ? { map: {} } : {}, l, rc, lu >= ru ? "l" : "r");
      if (id === "cfg") {
        dedupeQuests(mg);
        S.cfg = mg;
        applyLook();
      } else if (id === "refl") S.refl = mg.map || {};
      else S.days[id.slice(5)] = mg;
      agree(id, rc);
      lockReset();
      G.qSig = "";
      queue[id] = true;
      return true;
    }
    /* First merge after sign-in: everything remote vs everything local, then push what's newer here. */
    function merge() {
      var t0 = Date.now();
      setStatus("syncing");
      return Promise.all([fb.db.get(docPath("cfg")), fb.db.get(docPath("refl")), fb.db.list(base() + "/days")]).then(
        function (r) {
          var got = { cfg: 1, refl: 1 },
            ch = false;
          seen(r[0].data);
          seen(r[1].data);
          r[2].forEach(function (s) {
            seen(s.data);
          });
          if (takeRemote("cfg", r[0].data)) ch = true;
          else if (S.cfg && !r[0].data) queue.cfg = true;
          if (takeRemote("refl", r[1].data)) ch = true;
          else if (!r[1].data && Object.keys(S.refl || {}).length) queue.refl = true;
          r[2].forEach(function (s) {
            var id = "days/" + s.id;
            got[id] = 1;
            if (takeRemote(id, s.data)) ch = true;
            if (!s.data.at) queue[id] = true;
          });
          /* Docs written before writes carried `at` are rewritten once, so incremental pulls can see them from now on. */
          [
            ["cfg", r[0].data],
            ["refl", r[1].data],
          ].forEach(function (x) {
            if (x[1] && !x[1].at) queue[x[0]] = true;
          });
          Object.keys(S.days).forEach(function (k) {
            var id = "days/" + k;
            if (!got[id]) queue[id] = true;
          });
          Object.keys((S.meta && S.meta.del) || {}).forEach(function (id) {
            if (!got[id]) queue[id] = true;
          });
          if (ch) {
            G.qSig = "";
            render();
          }
          cache();
          flushQueue();
          inSync(t0);
          try {
            localAdapter.save(S);
          } catch (x) {}
        },
      );
    }
    /* start() is reached twice on a sign-in when boot's auth listener is live (the SDK notifies it before the sign-in promise resolves): the same uid reuses the first run. */
    function start(u) {
      if (user && user.uid === u.uid && startP) return startP;
      user = u;
      setAcct({ uid: u.uid, email: u.email });
      store.use(cloudAdapter);
      setStatus("syncing");
      startP = Promise.resolve()
        .then(pull)
        .then(
          function () {
            if (typeof welcomeCheck === "function") welcomeCheck(0);
          },
          function (e) {
            setStatus("error", String((e && e.message) || e));
          },
        );
      return startP;
    }
    function stop() {
      unsub.forEach(function (f) {
        try {
          f();
        } catch (x) {}
      });
      unsub = [];
      user = null;
      startP = null;
      queue = {};
      store.use(localAdapter);
      setStatus("off");
    }
    /* Changes not yet in the cloud: queued or in flight, or sync not up to date. */
    /* leaving: this device is deleting the account; the SDK's own "signed out" callback must not reload first. */
    var leaving = false;
    function unsynced() {
      return Object.keys(queue).length + (pushing ? 1 : 0) + (user && state.status !== "on" ? 1 : 0);
    }
    /* After auth succeeds: pick this account's copy on the device and reload into it. A new account takes the data made
       without an account (the guest copy). Signing in to an account that has nothing in the cloud does too; one that
       already has data loads its own copy (or starts empty and pulls everything), and the guest copy stays put. */
    function enter(u, isNew) {
      var key = "pc-cache-u-" + u.uid,
        has = false;
      try {
        has = localStorage.getItem(key) !== null;
      } catch (x) {}
      var p = isNew
        ? Promise.resolve(true)
        : has
          ? Promise.resolve(false)
          : Promise.resolve()
              .then(function () {
                return Promise.all([fb.db.get("users/" + u.uid + "/data/cfg"), fb.db.list("users/" + u.uid + "/days")]);
              })
              .then(
                function (r) {
                  return !r[0].data && !r[1].length;
                },
                function () {
                  return false;
                },
              );
      return p.then(function (take) {
        cache();
        G.storeHold = true;
        try {
          if (take && !has) {
            var g = localStorage.getItem("pc-cache-v1");
            if (g !== null) localStorage.setItem(key, g);
            localStorage.removeItem("pc-cache-v1");
          }
        } catch (x) {}
        setAcct({ uid: u.uid, email: u.email });
        reloadApp(isNew ? "Account created. Check your inbox to verify your email." : "Signed in.");
        return u;
      });
    }
    function reloadApp(note) {
      try {
        sessionStorage.setItem("pc-authnote", note || "");
      } catch (x) {}
      setTimeout(function () {
        location.reload();
      }, 0);
    }
    return {
      state: state,
      on: function (f) {
        listeners.push(f);
      },
      user: function () {
        return user;
      },
      account: acct,
      boot: function () {
        if (!acct()) return;
        setStatus("connecting");
        lib().then(
          function (f) {
            f.auth.onAuth(function (u) {
              if (u) {
                if (!user || user.uid !== u.uid) {
                  if (user) stop();
                  start(u);
                } else user.verified = u.verified;
              } else {
                if (leaving) return;
                var had = !!user || !!acct();
                if (user) stop();
                if (had) {
                  G.storeHold = true;
                  setAcct(null);
                  reloadApp(
                    "You were signed out. Sign in again to see your data; it's kept on this device until you do.",
                  );
                } else {
                  setAcct(null);
                  setStatus("off");
                }
              }
            });
          },
          function (e) {
            setStatus("error", "Couldn’t load the sync library: " + String((e && e.message) || e));
          },
        );
      },
      signIn: function (email, pw) {
        return lib()
          .then(function (f) {
            return f.auth.signIn(email, pw);
          })
          .then(function (u) {
            return enter(u, false);
          });
      },
      signUp: function (email, pw) {
        return lib()
          .then(function (f) {
            return f.auth.signUp(email, pw);
          })
          .then(function (u) {
            return enter(u, true);
          });
      },
      reset: function (email) {
        return lib().then(function (f) {
          return f.auth.reset(email);
        });
      },
      /* Sign out removes this account's copy from the device. Refused while a timer or sprint runs (they belong to the
         account's data), and while changes haven't reached the cloud unless force (the UI asks first). */
      signOut: function (force) {
        if (S.timer || (S.sprint && S.sprint.phase !== "done")) return Promise.reject({ code: "app/timer" });
        if (!force && !settled) {
          return settle()
            .then(function () {
              settled = true;
              return cloud.signOut(false);
            })
            .then(
              function (r) {
                settled = false;
                return r;
              },
              function (e) {
                settled = false;
                throw e;
              },
            );
        }
        var n = unsynced();
        if (n && !force) return Promise.reject({ code: "app/unsynced", n: n });
        var f = fb,
          u = user || acct();
        stop();
        G.storeHold = true;
        try {
          if (u) localStorage.removeItem("pc-cache-u-" + u.uid);
        } catch (x) {}
        setAcct(null);
        return (f ? f.auth.signOut() : Promise.resolve())
          .catch(function () {})
          .then(function () {
            reloadApp("Signed out. Your data is in your account and comes back when you sign in.");
          });
      },
      unsynced: function () {
        return unsynced();
      },
      /* Erase this device: every copy (guest and each account's), the rescue copy and the signed-in account, then reload
         to a fresh start on the sign-in page. Accounts keep their data in the cloud. Same timer/unsynced guards as sign-out. */
      eraseDevice: function (force) {
        if (S.timer || (S.sprint && S.sprint.phase !== "done")) return Promise.reject({ code: "app/timer" });
        if (user && !force && !settled) {
          return settle()
            .then(function () {
              settled = true;
              return cloud.eraseDevice(false);
            })
            .then(
              function (r) {
                settled = false;
                return r;
              },
              function (e) {
                settled = false;
                throw e;
              },
            );
        }
        var n = user ? unsynced() : 0;
        if (n && !force) return Promise.reject({ code: "app/unsynced", n: n });
        var f = fb;
        stop();
        G.storeHold = true;
        try {
          var ks = [];
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k && (k.indexOf("pc-cache-") === 0 || k === "pc-account" || k === "pc-welcomed" || k === "pc-rerate"))
              ks.push(k);
          }
          ks.forEach(function (k) {
            localStorage.removeItem(k);
          });
          sessionStorage.removeItem("pc-noacct");
        } catch (x) {}
        return (f ? f.auth.signOut() : Promise.resolve())
          .catch(function () {})
          .then(function () {
            reloadApp("This device’s data was erased.");
          });
      },
      /* Email verification, password change and account deletion (55 draws the pages). Deleting needs the password again
         (Firebase wants a recent sign-in); sync stops first so nothing is pushed back while the documents go, then every
         users/<uid> document is removed and the Firebase user deleted, then this account's copy on the device. */
      verify: function () {
        return lib().then(function (f) {
          return f.auth.verify();
        });
      },
      refresh: function () {
        return lib()
          .then(function (f) {
            return f.auth.refresh();
          })
          .then(function (u) {
            if (user && u) {
              user.verified = u.verified;
              emit();
            }
            return u;
          });
      },
      changePw: function (cur, next) {
        return lib().then(function (f) {
          return f.auth.changePassword(cur, next);
        });
      },
      deleteAccount: function (pw) {
        var f,
          u = user;
        if (!u) return Promise.reject({ code: "auth/no-current-user" });
        return lib()
          .then(function (x) {
            f = x;
            return f.auth.reauth(pw);
          })
          .then(function () {
            unsub.forEach(function (g) {
              try {
                g();
              } catch (x) {}
            });
            unsub = [];
            queue = {};
            store.use(localAdapter);
            return f.db.list("users/" + u.uid + "/days");
          })
          .then(function (L) {
            return f.db.remove(
              L.map(function (d) {
                return "users/" + u.uid + "/days/" + d.id;
              }).concat(["users/" + u.uid + "/data/cfg", "users/" + u.uid + "/data/refl"]),
            );
          })
          .then(function () {
            leaving = true;
            return f.auth.deleteUser();
          })
          .then(
            function () {
              stop();
              G.storeHold = true;
              try {
                localStorage.removeItem("pc-cache-u-" + u.uid);
              } catch (x) {}
              setAcct(null);
              reloadApp("Your account and its data were deleted.");
            },
            function (e) {
              leaving = false;
              if (user && user.uid === u.uid && !unsub.length) {
                startP = null;
                var uu = user;
                user = null;
                start(uu);
              }
              throw e;
            },
          );
      },
      syncNow: function () {
        if (!user) return;
        Object.keys(S.days).forEach(function (k) {
          if (!stampOf("days/" + k)) queue["days/" + k] = true;
        });
        flushQueue();
        clearTimeout(pushT);
        return Promise.resolve()
          .then(merge)
          .then(
            function () {},
            function (e) {
              setStatus("error", String((e && e.message) || e));
            },
          );
      },
    };
  })();
  store.adopt = function (id, obj, u) {
    if (id === "cfg") {
      S.cfg = obj;
      applyLook();
    } else if (id === "refl") {
      S.refl = obj || {};
    } else if (id.indexOf("days/") === 0) {
      var k = id.slice(5);
      if (obj) S.days[k] = obj;
      else delete S.days[k];
    }
    S.meta = S.meta || { u: {} };
    S.meta.u = S.meta.u || {};
    if (obj) {
      S.meta.u[id] = u;
      if (S.meta.del) delete S.meta.del[id];
    } else {
      delete S.meta.u[id];
      (S.meta.del = S.meta.del || {})[id] = u;
    }
    store.markClean(id, obj);
    lockReset();
    G.qSig = "";
    store.emit([obj ? id : "-" + id]);
  };
  cloud.on(function () {
    if (
      typeof G.setTab !== "undefined" &&
      G.setTab === "account" &&
      typeof renderSettings === "function" &&
      document.querySelector("[data-view='settings']:not([hidden])")
    )
      renderSettings();
  });
  cloud.boot();
}
