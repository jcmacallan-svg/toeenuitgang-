// logger.js
// Lightweight event logger for VEVA Trainer.
// Sends JSON events to a Google Apps Script Web App endpoint (or any HTTP endpoint).
// - Buffers to localStorage when offline or endpoint not set.
// - Flushes in batches.

(() => {
  "use strict";

  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const LS_KEY = "veva.log.buffer.v1";
  const LS_KEY_LASTERR = "veva.log.lastError.v1";

  function nowISO(){
    return new Date().toISOString();
  }

  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch{ return fallback; }
  }

  function getBuffer(){
    const raw = localStorage.getItem(LS_KEY);
    const arr = safeJsonParse(raw || "[]", []);
    return Array.isArray(arr) ? arr : [];
  }

  function setBuffer(arr){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(-bufferLimit())));
    }catch{}
  }

  function bufferLimit(){
    const n = Number(CFG.logBufferLimit || 300);
    return Number.isFinite(n) ? Math.max(50, Math.min(2000, n)) : 300;
  }

  function enabled(){
    return !!CFG.logEnabled;
  }

  function endpoint(){
    return String(CFG.logEndpoint || "").trim();
  }

  function lastError(){
    return localStorage.getItem(LS_KEY_LASTERR) || "";
  }

  function setLastError(msg){
    try{ localStorage.setItem(LS_KEY_LASTERR, String(msg || "")); }catch{}
  }

  function baseContext(ctx={}){
    const assetVer = String(window.__ASSET_VER__ || "");
    return {
      ts: nowISO(),
      app: BUILD.name || "VEVA Trainer",
      build: BUILD.version || "dev",
      assetVer: assetVer ? assetVer.slice(-10) : "",
      page: location.pathname || "",
      host: location.host || "",
      ...ctx
    };
  }

  async function postJSON(url, payload){
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      // keepalive helps during unload; not all browsers support
      keepalive: true,
      mode: "cors"
    });
    // Apps Script returns 200 even on some errors; still treat non-2xx as failure
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  }

  // Flush a few at a time to avoid huge requests.
  async function flush(maxBatch=20){
    if (!enabled()) return { ok:false, reason:"disabled" };
    const url = endpoint();
    if (!url) return { ok:false, reason:"no-endpoint" };

    const buf = getBuffer();
    if (!buf.length) return { ok:true, sent:0 };

    const batch = buf.slice(0, Math.max(1, Math.min(maxBatch, 50)));
    try{
      await postJSON(url, { type: "batch", events: batch });
      setBuffer(buf.slice(batch.length));
      setLastError("");
      return { ok:true, sent: batch.length, remaining: buf.length - batch.length };
    }catch(err){
      setLastError(String(err && err.message ? err.message : err));
      return { ok:false, reason:"send-failed", error: String(err && err.message ? err.message : err) };
    }
  }

  // Public API: logEvent(type, data)
  function logEvent(type, data={}, ctx={}){
    const ev = baseContext({ type: String(type || "event"), ...ctx, data });

    // Always buffer so nothing is lost; flushing is best-effort.
    const buf = getBuffer();
    buf.push(ev);
    setBuffer(buf);

    if (enabled() && endpoint()){
      if (CFG.logSendImmediately){
        // Fire-and-forget best-effort
        flush(1);
      } else {
        // Flush small batch opportunistically
        if (buf.length >= 10) flush(20);
      }
    }

    return ev;
  }

  // Flush on visibility change / unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(20);
  });
  window.addEventListener("beforeunload", () => {
    // try to flush a tiny batch
    flush(10);
  });

  // Expose
  window.VEVA_LOGGER = {
    enabled,
    endpoint,
    lastError,
    logEvent,
    flush,
    _getBuffer: getBuffer
  };
})();
