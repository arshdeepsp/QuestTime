/* In-memory stand-in for window.PCFB (see src/firebase/fb.js), shared by sync.spec and refresh.spec: docs keyed by path,
   snapshot listeners, auth with one known user (password secret1), a Firestore-shape validator in batch, and remote(path,
   data) to write "from another device". It survives the app's reloads through localStorage __fc. */
export const fake = `window.__cloud={docs:{},listeners:[],user:null,authCbs:[],fail:false};
/* The fake "cloud" survives reloads (the app reloads on sign-in/out) through localStorage __fc. */
(function(){try{var s=JSON.parse(localStorage.getItem("__fc")||"null");if(s){window.__cloud.docs=s.docs||{};window.__cloud.user=s.user||null;window.__cloud.clock=s.clock||0}}catch(e){}})();
window.__cloud.save=function(){localStorage.setItem("__fc",JSON.stringify({docs:window.__cloud.docs,user:window.__cloud.user,clock:window.__cloud.clock||0}))};
/* The server's clock for "at" (write time): a counter, unrelated to any device's Date.now(), like Firestore's. */
window.__cloud.tick=function(){window.__cloud.clock=Math.max(window.__cloud.clock||0,1700000000000)+100000;return window.__cloud.clock};
/* put() = another device's write landing in the cloud (stamped with the server's at), without the app noticing yet. */
window.__cloud.put=function(path,data){var d=JSON.parse(JSON.stringify(data));d.at=window.__cloud.tick();window.__cloud.docs[path]=d;window.__cloud.save()};
function segs(path,even){var n=path.split("/").length;if((n%2===0)!==even)throw new Error("Invalid "+(even?"document":"collection")+" reference: "+path+" has "+n+" segments")}
window.PCFB={init:function(){},
  auth:{user:function(){return window.__cloud.user},onAuth:function(cb){window.__cloud.authCbs.push(cb);setTimeout(function(){cb(window.__cloud.user)},0);return function(){}},
    signIn:function(e,p){if(p!=="secret1")return Promise.reject({code:"auth/invalid-credential",message:"bad"});window.__cloud.user={uid:"u1",email:e};window.__cloud.save();return Promise.resolve(window.__cloud.user)},
    signUp:function(e,p){window.__cloud.user={uid:"u1",email:e};window.__cloud.save();return Promise.resolve(window.__cloud.user)},
    signOut:function(){window.__cloud.user=null;window.__cloud.save();window.__cloud.authCbs.forEach(function(cb){setTimeout(function(){cb(null)},0)});return Promise.resolve()},reset:function(){return Promise.resolve()}},
  db:{get:function(path){if(window.__cloud.throwGet)throw new Error(window.__cloud.throwGet);segs(path,true);window.__cloud.reads=(window.__cloud.reads||0)+1;var d=window.__cloud.docs[path];return Promise.resolve({id:path.split("/").pop(),data:d?JSON.parse(JSON.stringify(d)):null,pending:false})},
    listSince:function(path,since){segs(path,false);var out=[];Object.keys(window.__cloud.docs).forEach(function(p){var d=window.__cloud.docs[p];if(p.indexOf(path+"/")===0&&p.slice(path.length+1).indexOf("/")<0&&(+d.at||0)>since)out.push({id:p.split("/").pop(),data:JSON.parse(JSON.stringify(d)),pending:false})});window.__cloud.reads=(window.__cloud.reads||0)+Math.max(1,out.length);return Promise.resolve(out)},
    list:function(path){segs(path,false);var out=[];Object.keys(window.__cloud.docs).forEach(function(p){if(p.indexOf(path+"/")===0&&p.slice(path.length+1).indexOf("/")<0)out.push({id:p.split("/").pop(),data:JSON.parse(JSON.stringify(window.__cloud.docs[p])),pending:false})});window.__cloud.reads=(window.__cloud.reads||0)+Math.max(1,out.length);return Promise.resolve(out)},
    set:function(path,data){segs(path,true);window.__cloud.docs[path]=JSON.parse(JSON.stringify(data));window.__cloud.save();return Promise.resolve()},
    batch:function(ops){ops.forEach(function(o){segs(o.path,true)});if(window.__cloud.fail)return Promise.reject(new Error("offline"));try{ops.forEach(function(o){check(o.data,o.path)})}catch(e){window.__cloud.bad=(window.__cloud.bad||[]).concat(e.message);return Promise.reject(e)}ops.forEach(function(o){var d=JSON.parse(JSON.stringify(o.data));d.at=window.__cloud.tick();window.__cloud.docs[o.path]=d});window.__cloud.save();window.__cloud.writes=(window.__cloud.writes||0)+ops.length;return Promise.resolve()},
    onDoc:function(path,cb){segs(path,true);var l={path:path,cb:cb};window.__cloud.listeners.push(l);return function(){window.__cloud.listeners=window.__cloud.listeners.filter(function(x){return x!==l})}},
    onCol:function(path,cb){segs(path,false);var l={col:path,cb:cb};window.__cloud.listeners.push(l);return function(){window.__cloud.listeners=window.__cloud.listeners.filter(function(x){return x!==l})}}}};
/* What Firestore refuses in a document: undefined, functions, an array directly inside an array, reserved __x__ field names, documents over 1 MiB. */
function check(v,at){if(v===undefined||typeof v==="function")throw new Error("bad value at "+at);
  if(Array.isArray(v)){v.forEach(function(x,i){if(Array.isArray(x))throw new Error("nested array at "+at+"["+i+"]");check(x,at+"["+i+"]")})}
  else if(v&&typeof v==="object"){Object.keys(v).forEach(function(k){if(/^__.*__$/.test(k)||k==="")throw new Error("bad field name "+JSON.stringify(k)+" at "+at);check(v[k],at+"."+k)});if(at.indexOf(".")<0&&JSON.stringify(v).length>1048576)throw new Error("document too big: "+at)}}
/* remote() = another device wrote; the app sees it the next time it comes back to the front (no live listeners), so this also fires visibilitychange. */
window.__cloud.remote=function(path,data){window.__cloud.put(path,data);setTimeout(function(){document.dispatchEvent(new Event("visibilitychange"))},0);var id=path.split("/").pop(),col=path.slice(0,path.lastIndexOf("/"));window.__cloud.listeners.forEach(function(l){if(l.path===path)l.cb({id:id,data:data,pending:false});if(l.col===col)l.cb([{id:id,data:data,pending:false,type:"modified"}])})};`;
