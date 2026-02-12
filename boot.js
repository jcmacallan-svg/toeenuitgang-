// boot.js
window.BUILD = { version: "7.4.11", name: "VEVA Ingang/Uitgang Trainer", date: "2026-02-11" };

(function () {
  var qp = new URLSearchParams(location.search);
  var v = qp.get("v") || String(Date.now());
  window.__ASSET_VER__ = v;

  function load(src, cb) {
    var s = document.createElement("script");
    s.src = src + "?v=" + encodeURIComponent(v);
    s.defer = true;
    s.onload = cb || function () {};
    s.onerror = function () { console.warn("Failed to load", s.src); };
    document.head.appendChild(s);
  }

  load("config.js", function () {
    // Load Person Search patch BEFORE app.js so PS_PATCH is ready immediately
    load("v7_4_12_patch_person_search_en.js", function () {
      load("app.js", function () {
        load("v7_4_12_patch_v2.js");
      });
    });
  });
})();
