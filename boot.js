// boot.js
window.BUILD = { version: "7.4.14", name: "VEVA Ingang/Uitgang Trainer", date: "2026-02-16" };

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
    // Logger + phrase bank (responses) + intent matchers are loaded BEFORE app.js
    load("logger.js", function(){
      load("phrasebank.js", function(){
        load("intents_patch_en.js", function () {
          load("app.js", function () {
            // Optional extra patches can load after app.js
            load("v7_4_12_patch_v2.js");
          });
        });
      });
    });
  });
})();