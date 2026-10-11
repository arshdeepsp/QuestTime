import { test, expect } from "@playwright/test";
import { openApp } from "./helpers.mjs";

/* In-memory Firebase facade: accounts by email, documents by path, and a log of emails "sent". */
const fake = `window.__fb={users:{"arsh@example.com":{pw:"secret1",uid:"u1",verified:true}},user:null,docs:{},sent:[],cbs:[]};
/* Survives the app's reloads on sign-in/out through localStorage __fb. */
(function(){try{var s=JSON.parse(localStorage.getItem("__fb")||"null");if(s)["users","user","docs","sent","clock"].forEach(function(k){window.__fb[k]=s[k]})}catch(e){}})();
window.__fb.save=function(){var F=window.__fb;localStorage.setItem("__fb",JSON.stringify({users:F.users,user:F.user,docs:F.docs,sent:F.sent,clock:F.clock}))};
(function(F){function me(){var u=F.user&&F.users[F.user];return u?{uid:u.uid,email:F.user,verified:u.verified}:null}
function no(c){return Promise.reject({code:c,message:c})}
function segs(p,even){var n=p.split("/").length;if((n%2===0)!==even)throw new Error("Invalid "+(even?"document":"collection")+" reference: "+p+" has "+n+" segments")}
window.PCFB={init:function(){},
  auth:{user:me,onAuth:function(cb){F.cbs.push(cb);setTimeout(function(){cb(me())},0);return function(){}},
    signIn:function(e,p){var u=F.users[e];if(!u||u.pw!==p)return no("auth/invalid-credential");F.user=e;F.save();return Promise.resolve(me())},
    signUp:function(e,p){if(F.users[e])return no("auth/email-already-in-use");F.users[e]={pw:p,uid:"u2",verified:false};F.user=e;F.sent.push(["verify",e]);F.save();return Promise.resolve(me())},
    signOut:function(){F.user=null;F.save();F.cbs.forEach(function(cb){setTimeout(function(){cb(null)},0)});return Promise.resolve()},
    reset:function(e){F.sent.push(["reset",e]);F.save();return Promise.resolve()},
    verify:function(){F.sent.push(["verify",F.user]);F.save();return Promise.resolve()},
    refresh:function(){return Promise.resolve(me())},
    reauth:function(p){return F.users[F.user]&&F.users[F.user].pw===p?Promise.resolve():no("auth/wrong-password")},
    changePassword:function(c,n){return window.PCFB.auth.reauth(c).then(function(){F.users[F.user].pw=n;F.save()})},
    deleteUser:function(){delete F.users[F.user];F.user=null;F.save();F.cbs.forEach(function(cb){cb(null)});return new Promise(function(r){setTimeout(r,30)})}},
  db:{get:function(p){segs(p,true);return Promise.resolve({id:p.split("/").pop(),data:F.docs[p]?JSON.parse(JSON.stringify(F.docs[p])):null,pending:false})},
    listSince:function(p,since){segs(p,false);return Promise.resolve(Object.keys(F.docs).filter(function(k){return k.indexOf(p+"/")===0&&(+F.docs[k].at||0)>since}).map(function(k){return {id:k.split("/").pop(),data:F.docs[k],pending:false}}))},
    list:function(p){segs(p,false);return Promise.resolve(Object.keys(F.docs).filter(function(k){return k.indexOf(p+"/")===0}).map(function(k){return {id:k.split("/").pop(),data:F.docs[k],pending:false}}))},
    set:function(p,d){segs(p,true);F.docs[p]=d;return Promise.resolve()},
    batch:function(ops){ops.forEach(function(o){segs(o.path,true)});ops.forEach(function(o){var d=JSON.parse(JSON.stringify(o.data));F.clock=(F.clock||1700000000000)+100000;d.at=F.clock;F.docs[o.path]=d});F.save();return Promise.resolve()},
    remove:function(ps){ps.forEach(function(p){segs(p,true)});ps.forEach(function(p){delete F.docs[p]});F.save();return Promise.resolve()},
    onDoc:function(p){segs(p,true);return function(){}},onCol:function(p){segs(p,false);return function(){}}}}})(window.__fb);`;

const J = { id: "j", type: "check", label: "Journal" };
const gate = { "pc-noacct": "" };
const fb = (page) => page.evaluate(() => window.__fb);
const signedIn = (page) => page.addInitScript(() => { if (localStorage.getItem("__fb")) return; localStorage.setItem("pc-account", JSON.stringify({ uid: "u1", email: "arsh@example.com" })); window.__fb.user = "arsh@example.com"; });
const ev = async (page, fn) => { try { return await page.evaluate(fn); } catch (e) { return null; } };
async function reloadOn(page, fn) {
  await page.evaluate(() => { window.__pre = 1; });
  await fn();
  await expect.poll(async () => { try { return await page.evaluate(() => !window.__pre && document.readyState === "complete"); } catch (e) { return false; } }, { timeout: 10000 }).toBe(true);
}
async function account(page) {
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='account']");
}

test("signed out, the app opens on Sign in until you sign in or choose to use it without an account", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await expect(page.locator("#authPage")).toBeVisible();
  await expect(page.locator("#auTitle")).toHaveText("Sign in");
  await expect(page.locator("#auClose")).toHaveCount(0);
  await page.click("#auSkip");
  await expect(page.locator("#authPage")).toBeHidden();
  expect(await page.evaluate(() => [sessionStorage.getItem("pc-noacct"), localStorage.getItem("pc-noacct")])).toEqual(["1", null]);
  await expect(page.locator("#quests .q")).toHaveCount(1);
  const next = await page.context().newPage();
  await openApp(next, { cfg: { quests: [J] }, extra: gate });
  await expect(next.locator("#authPage")).toBeVisible();
  await expect(next.locator("#auSkip")).toBeVisible();
});

test("a signed-in device never sees the sign-in page; the session just carries on", async ({ page }) => {
  await page.addInitScript(fake);
  await signedIn(page);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.waitForTimeout(400);
  await expect(page.locator("#authPage")).toHaveCount(0);
  await account(page);
  await expect(page.locator(".srow", { hasText: "Signed in as" })).toContainText("arsh@example.com");
});

test("sign in from the gate: wrong password explained, then in", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.fill("#auEmail", "arsh@example");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("That doesn’t look like an email.");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "nope");
  await page.press("#auPw", "Enter");
  await expect(page.locator("#auMsg")).toHaveText("Wrong email or password.");
  await page.fill("#auPw", "secret1");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#authPage")).toHaveCount(0);
  await expect(page.locator("#sync")).toHaveText("Signed in.");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-account")))).toEqual({ uid: "u1", email: "arsh@example.com" });
});

test("show/hide reveals the password", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.fill("#auPw", "secret1");
  await page.click("[data-eye='auPw']");
  await expect(page.locator("#auPw")).toHaveAttribute("type", "text");
  await expect(page.locator("[data-eye='auPw']")).toHaveText("Hide");
  await page.click("[data-eye='auPw']");
  await expect(page.locator("#auPw")).toHaveAttribute("type", "password");
});

test("create an account: checks the passwords, sends a verification email, and Settings tracks verification", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.click("[data-av='signup']");
  await expect(page.locator("#auTitle")).toHaveText("Create account");
  await page.fill("#auEmail", "new@example.com");
  await page.fill("#auPw", "abc");
  await page.fill("#auPw2", "abc");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("Use at least 6 characters.");
  await page.fill("#auPw", "abcdef");
  await page.fill("#auPw2", "abcdeg");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("The passwords don’t match.");
  await page.fill("#auPw2", "abcdef");
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#authPage")).toHaveCount(0);
  expect((await fb(page)).sent).toEqual([["verify", "new@example.com"]]);
  await page.evaluate(() => { location.hash = "settings"; });
  await page.click("[data-st='account']");
  await expect(page.locator(".srow", { hasText: "Signed in as" })).toContainText("not verified");
  await page.click("#acVer");
  expect((await fb(page)).sent.length).toBe(2);
  await page.evaluate(() => { window.__fb.users["new@example.com"].verified = true; });
  await page.click("#acVerOk");
  await expect(page.locator(".srow", { hasText: "Signed in as" })).not.toContainText("not verified");
  await expect(page.locator("#acVer")).toHaveCount(0);
});

test("an email that already has an account is sent to sign in", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.click("[data-av='signup']");
  await page.fill("#auEmail", "arsh@example.com");
  await page.fill("#auPw", "abcdef");
  await page.fill("#auPw2", "abcdef");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("That email already has an account. Sign in instead.");
});

test("forgot password carries the email over and sends the reset link without saying whether the account exists", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.fill("#auEmail", "arsh@example.com");
  await page.click("[data-av='reset']");
  await expect(page.locator("#auTitle")).toHaveText("Reset password");
  await expect(page.locator("#auEmail")).toHaveValue("arsh@example.com");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("If there’s an account for arsh@example.com, a reset link is on its way. Check your spam folder too.");
  expect((await fb(page)).sent).toEqual([["reset", "arsh@example.com"]]);
  await page.click("[data-av='login']");
  await expect(page.locator("#auTitle")).toHaveText("Sign in");
});

test("change password needs the current one", async ({ page }) => {
  await page.addInitScript(fake);
  await signedIn(page);
  await openApp(page, { cfg: { quests: [J] } });
  await account(page);
  await page.click("#acPwB");
  await expect(page.locator("#auTitle")).toHaveText("Change password");
  await page.fill("#auPw0", "wrong1");
  await page.fill("#auPw", "newpass");
  await page.fill("#auPw2", "newpass");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("That password isn’t right.");
  await page.fill("#auPw0", "secret1");
  await page.click("#auGo");
  await expect(page.locator("#authPage")).toBeHidden();
  expect((await fb(page)).users["arsh@example.com"].pw).toBe("newpass");
});

test("delete account asks twice, then removes the account and all its data, in the cloud and on this device", async ({ page }) => {
  await page.addInitScript(fake);
  await signedIn(page);
  await page.addInitScript(() => { if (localStorage.getItem("__fb")) return; window.__fb.docs = { "users/u1/data/cfg": { quests: [], u: 1 }, "users/u1/data/refl": { map: {}, u: 1 }, "users/u1/days/2026-10-30": { j: true, u: 1 }, "users/u2/data/cfg": { u: 1 } }; });
  await openApp(page, { cfg: { quests: [J] }, days: { "2026-11-01": { j: true } }, extra: gate });
  await expect.poll(() => ev(page, () => localStorage.getItem("pc-cache-u-u1"))).not.toBeNull();
  await account(page);
  await page.click("#acDel");
  await expect(page.locator("#auTitle")).toHaveText("Delete account");
  await page.fill("#auPw0", "secret1");
  await page.click("#auGo");
  await expect(page.locator("#auGo")).toHaveText("Tap again to delete");
  expect(Object.keys((await fb(page)).docs).some((k) => k.startsWith("users/u1/"))).toBe(true);
  await reloadOn(page, () => page.click("#auGo"));
  await expect(page.locator("#auNote")).toHaveText("Your account and its data were deleted.");
  await expect(page.locator("#auSkip")).toBeVisible();
  const F = await fb(page);
  expect(Object.keys(F.docs)).toEqual(["users/u2/data/cfg"]);
  expect(F.users["arsh@example.com"]).toBeUndefined();
  expect(await page.evaluate(() => [localStorage.getItem("pc-account"), localStorage.getItem("pc-cache-u-u1")])).toEqual([null, null]);
});

test("a wrong password on delete changes nothing", async ({ page }) => {
  await page.addInitScript(fake);
  await signedIn(page);
  await page.addInitScript(() => { if (localStorage.getItem("__fb")) return; window.__fb.docs = { "users/u1/data/cfg": { quests: [], u: 1 } }; });
  await openApp(page, { cfg: { quests: [J] } });
  await account(page);
  await page.click("#acDel");
  await page.fill("#auPw0", "nope");
  await page.click("#auGo");
  await page.click("#auGo");
  await expect(page.locator("#auMsg")).toHaveText("That password isn’t right.");
  expect((await fb(page)).users["arsh@example.com"]).toBeTruthy();
  expect(await page.evaluate(() => localStorage.getItem("pc-account"))).not.toBeNull();
});

test("Settings opens the pages; Close returns without signing in", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] } });
  await account(page);
  await page.click("#acNew");
  await expect(page.locator("#auTitle")).toHaveText("Create account");
  await expect(page.locator("#auSkip")).toHaveCount(0);
  await page.click("#auClose");
  await expect(page.locator("#authPage")).toBeHidden();
  await expect(page.locator("#acOpen")).toBeVisible();
});

test("the first-run welcome waits until the sign-in gate is closed", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [] }, extra: gate });
  await page.addInitScript(() => localStorage.removeItem("pc-welcomed"));
  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.locator("#authPage")).toBeVisible();
  await expect(page.locator("#gModal")).toBeHidden();
  await page.click("#auSkip");
  await expect(page.locator("#gModal")).toBeVisible();
});

test("Erase this device removes every copy on it and starts fresh on the sign-in page", async ({ page }) => {
  await page.addInitScript(fake);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await page.click("#auSkip");
  await page.locator("#quests .q .sw").first().click();
  await page.evaluate(() => localStorage.setItem("pc-cache-u-zz", "{}"));
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='data']");
  await page.click("#setErase");
  await expect(page.locator("#setErase")).toHaveText("Tap again to erase");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-02"].j)).toBe(true);
  await reloadOn(page, () => page.click("#setErase"));
  await expect(page.locator("#auNote")).toHaveText("This device’s data was erased.");
  expect(await page.evaluate(() => localStorage.getItem("pc-cache-u-zz"))).toBeNull();
  expect(await page.evaluate(() => (JSON.parse(localStorage.getItem("pc-cache-v1")).days["2026-11-02"] || {}).j)).toBeFalsy();
});

test("Erase this device while signed in signs out too; the account keeps its data", async ({ page }) => {
  await page.addInitScript(fake);
  await signedIn(page);
  await openApp(page, { cfg: { quests: [J] }, extra: gate });
  await expect.poll(async () => Object.keys((await fb(page)).docs)).toContain("users/u1/data/cfg");
  await page.goto("http://127.0.0.1:4173/index.html#settings");
  await page.click("[data-st='data']");
  await expect(page.locator(".srow", { hasText: "Erase this device" })).toContainText("Signs you out");
  await page.click("#setErase");
  await reloadOn(page, () => page.click("#setErase"));
  await expect(page.locator("#authPage")).toBeVisible();
  expect(await page.evaluate(() => [localStorage.getItem("pc-account"), localStorage.getItem("pc-cache-u-u1")])).toEqual([null, null]);
  expect(Object.keys((await fb(page)).docs)).toContain("users/u1/data/cfg");
});
