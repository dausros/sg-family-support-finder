// Installed by AccessBar.ApplySavedPrefs (JavaScript node) in SGFamilySupportFinder.
// D is the content of docs/i18n/sgfsf-i18n.json.

if (!window.__sgsfI18n) {
  var D = DICT;
  var NUM = /\d[\d,]*(?:\.\d+)?/g;
  var S = window.__sgsfI18n = { lang: "en", tx: new WeakMap(), at: new WeakMap() };
  var ATTRS = ["placeholder", "aria-label", "title"];
  var code = function (loc) { loc = (loc || "").toLowerCase(); if (loc.indexOf("ms") === 0) return "ms"; if (loc.indexOf("zh") === 0) return "zh"; if (loc.indexOf("ta") === 0) return "ta"; return "en"; };
  var tr = function (txt, lang) {
    var t = txt.trim(); if (!t || !D[lang]) return null;
    var nums = []; var k = t.replace(NUM, function (m) { nums.push(m); return "{" + (nums.length - 1) + "}"; });
    var v = D[lang][k]; if (v == null) return null;
    v = v.replace(/\{(\d+)\}/g, function (_, i) { return nums[+i] != null ? nums[+i] : ""; });
    return txt.replace(t, v);
  };
  var skip = function (el) { return !el || el.closest("script,style,[translate=no]"); };
  var doText = function (n) {
    if (skip(n.parentElement)) return;
    var cur = n.nodeValue, rec = S.tx.get(n);
    if (rec && cur !== rec.set) rec = null;
    var src = rec ? rec.src : cur;
    var v = S.lang === "en" ? null : tr(src, S.lang);
    if (v == null) { if (rec) { n.nodeValue = rec.src; S.tx.delete(n); } return; }
    if (cur !== v) n.nodeValue = v;
    S.tx.set(n, { src: src, set: v });
  };
  var doAttrs = function (el) {
    if (skip(el)) return;
    var m = S.at.get(el) || {};
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var cur = el.getAttribute(a), rec = m[a];
      if (rec && cur !== rec.set) rec = null;
      var src = rec ? rec.src : cur;
      var v = S.lang === "en" ? null : tr(src, S.lang);
      if (v == null) { if (rec) { el.setAttribute(a, rec.src); delete m[a]; } return; }
      if (cur !== v) el.setAttribute(a, v);
      m[a] = { src: src, set: v };
    });
    S.at.set(el, m);
  };
  S.rm = S.rm || new Set();
  var norm = function (s) { return (s || "").replace(/[^\p{L}\p{M}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().toLowerCase(); };
  var fixLabels = function (root) {
    S.rm.forEach(function (el) {
      if (!el.isConnected) { S.rm.delete(el); return; }
      if (S.lang === "en") { el.setAttribute("aria-label", el.__sgsfLbl); S.rm.delete(el); }
    });
    if (S.lang === "en" || !root.querySelectorAll) return;
    var els = [].slice.call(root.querySelectorAll("[aria-label]")); if (root.hasAttribute && root.hasAttribute("aria-label")) els.push(root);
    els.forEach(function (el) {
      if (skip(el) || !/^(A|BUTTON)$/.test(el.tagName)) return;
      var vis = norm(el.innerText); if (!vis) return;
      var lbl = norm(el.getAttribute("aria-label"));
      if (lbl.indexOf(vis) === -1) { var m = S.at.get(el) || {}; el.__sgsfLbl = m["aria-label"] ? m["aria-label"].src : el.getAttribute("aria-label"); el.removeAttribute("aria-label"); S.rm.add(el); }
    });
  };
  var walk0 = function (root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  };
  var pending = [], queued = false;
  var walk = function (root) { walk0(root); if (root && root.nodeType === 1) fixLabels(root); };
  var flush = function () { queued = false; var p = pending; pending = []; p.forEach(walk); };
  S.obs = new MutationObserver(function (ms) {
    if (S.lang === "en" && !S.dirty) return;
    ms.forEach(function (m) {
      if (m.type === "childList") m.addedNodes.forEach(function (x) { pending.push(x); });
      else pending.push(m.target);
    });
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  });
  S.obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  S.set = function (loc) {
    S.lang = code(loc); if (S.lang !== "en") S.dirty = true;
    document.documentElement.lang = S.lang === "zh" ? "zh-CN" : S.lang;
    walk(document.body);
  };
}
window.__sgsfI18n.set($parameters.Loc);
