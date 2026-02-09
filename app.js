(() => {
  "use strict";

  const APP_VERSION = "veva-whatsapp-v1-2026-02-09";
  console.log("[VEVA]", APP_VERSION, "loaded");

  const CONFIG = window.APP_CONFIG || {};
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;
  const VOICE_AUTO_SEND = CONFIG.voiceAutoSend === true;
  const VOICE_LANG = CONFIG.voiceLang || "en-US";

  const $ = (sel, root = document) => root.querySelector(sel);

  const nowIso = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function safeLower(s){ return (s || "").toString().trim().toLowerCase(); }
  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

  function parseYear(text){
    const m = (text || "").match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  function z2(n){ return n < 10 ? "0" + n : "" + n; }
  function formatDob(d){ return `${d.yyyy}-${z2(d.mm)}-${z2(d.dd)}`; }

  function calcAgeFromDob(dob){
    const today = new Date();
    let age = today.getFullYear() - dob.yyyy;
    const m = today.getMonth() + 1;
    const d = today.getDate();
    if (m < dob.mm || (m === dob.mm && d < dob.dd)) age -= 1;
    return age;
  }

  function chance(p){ return Math.random() < clamp(p, 0, 1); }

  // -------- logging (no-cors to avoid Apps Script CORS) ----------
  function logEvent(event, payload = {}){
    if (!LOG_ENDPOINT) return;
    try {
      fetch(LOG_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ ts: nowIso(), event, ...payload })
      }).catch(() => {});
    } catch {}
  }

  // ----------------- intents -----------------
  const INTENTS = {
    ask_name: [
      /\bwhat\s+is\s+your\s+name\b/i,
      /\bname\s*,?\s+please\b/i
    ],
    ask_purpose: [
      /\bpurpose\s+of\s+(your\s+)?visit\b/i,
      /\bwhy\s+are\s+you\s+here\b/i,
      /\bwhat\s+brings\s+you\s+here\b/i
    ],
    ask_appointment: [
      /\bdo\s+you\s+have\s+an?\s+appointment\b/i,
      /\bare\s+you\s+expected\b/i
    ],
    ask_who: [
      /\bwho\s+are\s+you\s+(meeting|here\s+to\s+see)\b/i,
      /\bwho\s+is\s+your\s+appointment\s+with\b/i
    ],
    ask_time: [
      /\bwhat\s+time\s+is\s+your\s+appointment\b/i,
      /\bwhen\s+is\s+your\s+appointment\b/i
    ],
    ask_where: [
      /\bwhere\s+are\s+you\s+going\b/i,
      /\bwhich\s+(building|unit|office)\b/i
    ],
    ask_subject: [
      /\bwhat\s+is\s+the\s+meeting\s+about\b/i,
      /\bwhat\s+is\s+it\s+about\b/i
    ],
    ask_id: [
      /\b(can\s+i|could\s+i|may\s+i|let\s+me)\s+(see|check)\s+(your\s+)?(id|identification)\b/i,
      /\bshow\s+(me\s+)?(your\s+)?(id|identification)\b/i,
      /\bid\s+please\b/i
    ],
    ask_age: [
      /\bhow\s+old\s+are\s+you\b/i,
      /\bwhat\s+is\s+your\s+age\b/i
    ],
    ask_dob: [
      /\bwhat\s+is\s+your\s+(date\s+of\s+birth|dob)\b/i,
      /\bwhen\s+were\s+you\s+born\b/i,
      /\bdob\b/i
    ],
    confirm_born_year: [
      /\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i
    ],
    ask_nationality: [
      /\bwhat\s+is\s+your\s+nationality\b/i,
      /\bwhere\s+are\s+you\s+from\b/i
    ],
    contact_supervisor: [
      /\b(i\s+(will|’ll|'ll)\s+)?(contact|call|ring|phone)\s+(my\s+)?(supervisor|boss|team\s*leader|manager)\b/i
    ],
    go_person_search: [
      /\bgo\s+to\s+person\s+search\b/i,
      /\bpat-?\s*down\b/i,
      /\bfrisk\b/i
    ],
    deny: [
      /\bdeny\s+(entrance|entry|access)\b/i,
      /\byou\s+cannot\s+enter\b/i,
      /\bnot\s+allowed\s+to\s+enter\b/i
    ]
  };

  function matchIntent(text){
    const t = text || "";
    for (const [k, arr] of Object.entries(INTENTS)) {
      if (arr.some(rx => rx.test(t))) return k;
    }
    return "unknown";
  }

  // ----------------- scenario -----------------
  const MOODS = [
    { name: "relaxed", lieBoost: 0.02, inconsBoost: 0.02 },
    { name: "tired but cooperative", lieBoost: 0.05, inconsBoost: 0.05 },
    { name: "uneasy", lieBoost: 0.10, inconsBoost: 0.12 },
    { name: "nervous", lieBoost: 0.18, inconsBoost: 0.20 },
    { name: "irritated", lieBoost: 0.12, inconsBoost: 0.10 }
  ];

  const NATIONALITIES = ["Dutch","German","Belgian","French","Spanish","Italian","Polish","Romanian","Turkish","British","American","Canadian"];
  const FIRST = ["David","Michael","James","Robert","Daniel","Thomas","Mark","Lucas","Noah","Adam","Omar","Yusuf","Mateusz","Julien","Marco"];
  const LAST = ["Johnson","Miller","Brown","Davis","Martinez","Kowalski","Nowak","Schmidt","Dubois","Rossi","Yilmaz"];

  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  function randomDob(){
    const y = new Date().getFullYear() - (18 + Math.floor(Math.random() * 38));
    return { yyyy: y, mm: 1 + Math.floor(Math.random()*12), dd: 1 + Math.floor(Math.random()*28) };
  }
  function randomExpiry(){
    const y = new Date().getFullYear() + (1 + Math.floor(Math.random()*8));
    return { yyyy: y, mm: 1 + Math.floor(Math.random()*12), dd: 1 + Math.floor(Math.random()*28) };
  }
  function randomIdNumber(){
    const a = Math.floor(100000 + Math.random()*900000);
    const b = Math.floor(1000 + Math.random()*9000);
    return `ID-${a}-${b}`;
  }

  function buildVisitor(){
    const mood = pick(MOODS);
    const dob = randomDob();
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const nationality = pick(NATIONALITIES);
    const id = {
      name,
      nationality,
      dob,
      age: calcAgeFromDob(dob),
      idNumber: randomIdNumber(),
      expiry: randomExpiry()
    };

    const idx = 1 + Math.floor(Math.random()*12);
    const headshot = `assets/photos/headshot_${String(idx).padStart(2,"0")}.png`;

    const purpose = pick(["delivery","maintenance","meeting","visit","contract work"]);
    const appointment = chance(0.7);
    const apptTime = appointment ? pick(["09:30","10:00","13:15","14:00","15:45"]) : "";
    const meetingWith = appointment ? pick(["Captain Lewis","Sgt. van Dijk","Mr. Peters","Lt. Schmidt"]) : "";
    const goingWhere = pick(["HQ building","Logistics office","Barracks admin","Workshop"]);
    const subject = pick(["paperwork","equipment handover","maintenance report","security briefing","contract discussion"]);

    return {
      mood,
      headshot,
      id,
      intake: { purpose, appointment, apptTime, meetingWith, goingWhere, subject },
      claims: { dob: null, age: null, nationality: null, name: null },
      inconsistencies: []
    };
  }

  // ----------------- UI helpers (WhatsApp style: ONLY last messages) -----------------
  function setVisitorText(text, moodText = ""){
    const vb = $("#visitorBubble");
    const vm = $("#visitorMood");
    if (vb) vb.textContent = text || "";
    if (vm) vm.textContent = moodText || "";
  }

  function setStudentText(text){
    const sb = $("#studentBubble");
    if (!sb) return;
    sb.style.display = "";
    sb.textContent = text || "";
  }

  function setMoodLine(){
    const v = state.visitor;
    const vm = $("#visitorMood");
    if (!vm || !v) return;
    vm.textContent = `The visitor looks ${v.mood.name}.`;
  }

  function equalizeAvatars(){
    const va = $("#visitorAvatar");
    const sa = $("#studentAvatar");
    const size = 56;

    if (va instanceof HTMLImageElement) {
      va.width = size;
      va.height = size;
      va.style.width = size + "px";
      va.style.height = size + "px";
      va.style.borderRadius = "50%";
      va.style.objectFit = "cover";
    }
    if (sa instanceof HTMLImageElement) {
      sa.width = size;
      sa.height = size;
      sa.style.width = size + "px";
      sa.style.height = size + "px";
      sa.style.borderRadius = "50%";
      sa.style.objectFit = "cover";
    }
  }

  // ----------------- ID canvas -----------------
  function drawIdCard(v){
    const canvas = $("#idCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0b1b36";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // inner card
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 4;
    roundRect(ctx, 40, 40, canvas.width - 80, canvas.height - 80, 24, true, true);

    // title
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("IDENTIFICATION CARD", 80, 120);

    // fields
    ctx.font = "600 30px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.86)";

    const lines = [
      ["Name", v.id.name],
      ["Nationality", v.id.nationality],
      ["DOB", formatDob(v.id.dob)],
      ["Age", String(v.id.age)],
      ["ID number", v.id.idNumber],
      ["Expiry", formatDob(v.id.expiry)]
    ];

    let y = 190;
    for (const [k, val] of lines) {
      ctx.fillStyle = "rgba(255,255,255,0.70)";
      ctx.fillText(k + ":", 80, y);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(val, 300, y);
      y += 60;
    }
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    if (w < 2*r) r = w/2;
    if (h < 2*r) r = h/2;
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.arcTo(x+w, y, x+w, y+h, r);
    ctx.arcTo(x+w, y+h, x, y+h, r);
    ctx.arcTo(x, y+h, x, y, r);
    ctx.arcTo(x, y, x+w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function showIdPanel(show){
    const p = $("#idPanel");
    if (!p) return;
    p.style.display = show ? "" : "none";
  }

  // ----------------- supervisor modal -----------------
  function openSupervisorModal(){
    $("#supervisorModal")?.classList.remove("hidden");

    // prefill from scenario
    const v = state.visitor;
    if (!v) return;
    $("#wWho") && ($("#wWho").value = v.id.name);
    $("#wWhat") && ($("#wWhat").value = v.intake.purpose);
    $("#wWithWhom") && ($("#wWithWhom").value = v.intake.meetingWith);
    $("#wTime") && ($("#wTime").value = v.intake.apptTime);
    $("#wWhy") && ($("#wWhy").value = v.intake.subject);
  }

  function closeSupervisorModal(){
    $("#supervisorModal")?.classList.add("hidden");
  }

  // ----------------- control answers -----------------
  function makeFake(kind){
    const v = state.visitor;
    if (kind === "age") return String(clamp(v.id.age + pick([-2,-1,1,2,3]), 18, 70));
    if (kind === "dob") {
      const d = { ...v.id.dob };
      if (chance(0.5)) d.dd = clamp(d.dd + pick([-2,-1,1,2]), 1, 28);
      else d.mm = clamp(d.mm + pick([-1,1]), 1, 12);
      return formatDob(d);
    }
    if (kind === "nationality") return pick(NATIONALITIES.filter(n => n !== v.id.nationality));
    if (kind === "name") return `${pick(FIRST)} ${pick(LAST)}`;
    return "";
  }

  function controlAnswer(kind){
    const v = state.visitor;
    const lieP = 0.04 + v.mood.lieBoost;
    const inconsP = 0.05 + v.mood.inconsBoost;

    const truth = (kind === "dob") ? formatDob(v.id.dob)
                : (kind === "age") ? String(v.id.age)
                : (kind === "nationality") ? v.id.nationality
                : v.id.name;

    const prev = v.claims[kind];
    if (prev) {
      if (chance(inconsP)) {
        const fake = makeFake(kind);
        if (fake !== prev) {
          v.inconsistencies.push({ kind, prev, next: fake, ts: nowIso() });
          v.claims[kind] = fake;
          return { value: fake, lied: true, inconsistent: true };
        }
      }
      return { value: prev, lied: prev !== truth, inconsistent: false };
    }

    if (chance(lieP)) {
      const fake = makeFake(kind);
      v.claims[kind] = fake;
      return { value: fake, lied: fake !== truth, inconsistent: false };
    }

    v.claims[kind] = truth;
    return { value: truth, lied: false, inconsistent: false };
  }

  // ----------------- state -----------------
  const state = {
    runId: uid(),
    started: false,
    finished: false,
    processing: false,
    student: { name: "", className: "", difficulty: "Standard" },
    visitor: null,
    stats: {
      asked_id: false,
      asked_dob: false,
      asked_age: false,
      asked_nationality: false,
      supervisor_contacted: false,
      did_person_search: false
    }
  };

  // ----------------- core flow -----------------
  function startRun(){
    state.started = true;
    state.finished = false;
    state.processing = false;
    state.runId = uid();
    state.visitor = buildVisitor();

    // switch screens
    $("#screen-login")?.classList.add("hidden");
    $("#screen-train")?.classList.remove("hidden");
    $("#screen-feedback")?.classList.add("hidden");

    // avatars
    const va = $("#visitorAvatar");
    if (va instanceof HTMLImageElement) {
      va.src = state.visitor.headshot;
      va.onerror = () => { va.src = "assets/photos/headshot_01.png"; };
    }
    equalizeAvatars();

    // initial bubbles: only last messages
    setVisitorText("Hello.");
    setMoodLine();
    setStudentText("");

    showIdPanel(false);

    logEvent("start", {
      runId: state.runId,
      student: state.student,
      mood: state.visitor.mood.name
    });
  }

  async function denyEntrance(){
    if (state.finished) return;
    setStudentText("I’m denying entry. You cannot enter the site.");
    setVisitorText("Okay…", "");
    state.finished = true;
    logEvent("deny", { runId: state.runId, student: state.student });
    await sleep(500);
    finishRun();
  }

  function finishRun(){
    // For now: just go to feedback screen minimal
    $("#screen-train")?.classList.add("hidden");
    $("#screen-feedback")?.classList.remove("hidden");

    // show minimal feedback (you can expand later)
    const top3 = $("#top3");
    if (top3) {
      top3.innerHTML = "";
      const li = document.createElement("li");
      li.textContent = "Run finished (feedback can be expanded).";
      top3.appendChild(li);
    }

    logEvent("finish", { runId: state.runId, student: state.student, stats: state.stats });
  }

  function handleBornYearConfirm(text){
    const yearAsked = parseYear(text);
    if (!yearAsked) {
      setVisitorText("Sorry, could you repeat the year?");
      setMoodLine();
      return;
    }

    const v = state.visitor;
    const claim = controlAnswer("dob"); // may be lie
    const claimYear = parseYear(claim.value) || v.id.dob.yyyy;
    const trueYear = v.id.dob.yyyy;

    if (yearAsked === claimYear) {
      setVisitorText("Yes, that’s correct.");
      setMoodLine();
      return;
    }

    // not matching
    if (yearAsked === trueYear && claim.lied) {
      setVisitorText(`Actually… you’re right. I was born in ${trueYear}. Sorry.`);
      v.claims.dob = formatDob(v.id.dob); // align back to truth
      setMoodLine();
      return;
    }

    setVisitorText(`No, that’s not correct. I was born in ${claimYear}.`);
    setMoodLine();
  }

  async function onSend(text){
    if (state.processing || state.finished) return;
    const t = (text || "").trim();
    if (!t) return;

    state.processing = true;
    setStudentText(t);

    logEvent("message", { runId: state.runId, student: state.student, text: t });

    const intent = matchIntent(t);

    try {
      if (intent === "deny") return denyEntrance();

      if (intent === "ask_id") {
        state.stats.asked_id = true;
        drawIdCard(state.visitor);
        showIdPanel(true);
        setVisitorText("Yes. Here you go.");
        setMoodLine();
        return;
      }

      if (intent === "ask_dob") {
        state.stats.asked_dob = true;
        const a = controlAnswer("dob");
        setVisitorText(`My date of birth is ${a.value}.`);
        setMoodLine();
        return;
      }

      if (intent === "confirm_born_year") {
        state.stats.asked_dob = true;
        handleBornYearConfirm(t);
        return;
      }

      if (intent === "ask_age") {
        state.stats.asked_age = true;
        const a = controlAnswer("age");
        setVisitorText(`I’m ${a.value} years old.`);
        setMoodLine();
        return;
      }

      if (intent === "ask_nationality") {
        state.stats.asked_nationality = true;
        const a = controlAnswer("nationality");
        setVisitorText(`I’m ${a.value}.`);
        setMoodLine();
        return;
      }

      if (intent === "contact_supervisor") {
        state.stats.supervisor_contacted = true;
        openSupervisorModal();
        setVisitorText("Okay. Please contact your supervisor.");
        setMoodLine();
        return;
      }

      if (intent === "go_person_search") {
        state.stats.did_person_search = true;
        setVisitorText("Okay.", "");
        setMoodLine();
        setStudentText("I’m going to do a quick pat-down search. Is that okay?");
        await sleep(350);
        setVisitorText("Yes, that’s okay.");
        setMoodLine();
        await sleep(450);
        finishRun();
        return;
      }

      // basic 5W replies from scenario (optional, but nice)
      const v = state.visitor;
      if (intent === "ask_name") { setVisitorText(`My name is ${v.id.name}.`); setMoodLine(); return; }
      if (intent === "ask_purpose") { setVisitorText(`I’m here for ${v.intake.purpose}.`); setMoodLine(); return; }
      if (intent === "ask_appointment") {
        setVisitorText(v.intake.appointment ? "Yes, I have an appointment." : "No, I don’t have an appointment.");
        setMoodLine();
        return;
      }
      if (intent === "ask_who") { setVisitorText(v.intake.meetingWith ? `I’m meeting ${v.intake.meetingWith}.` : "I’m not meeting anyone specific."); setMoodLine(); return; }
      if (intent === "ask_time") { setVisitorText(v.intake.apptTime ? `It’s at ${v.intake.apptTime}.` : "I don’t have a specific time."); setMoodLine(); return; }
      if (intent === "ask_where") { setVisitorText(`I’m going to the ${v.intake.goingWhere}.`); setMoodLine(); return; }
      if (intent === "ask_subject") { setVisitorText(`It’s about ${v.intake.subject}.`); setMoodLine(); return; }

      // unknown
      setVisitorText("Sorry, I don’t understand. Can you ask it another way?");
      setMoodLine();
      if (LOG_UNKNOWN) logEvent("unknown", { runId: state.runId, student: state.student, text: t });

    } finally {
      state.processing = false;
    }
  }

  // ----------------- voice: hold to talk -----------------
  function setupVoice(){
    const btn = $("#btnMicHold");
    const status = $("#micStatus");
    const input = $("#studentInput");

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!btn || !input || !SR) {
      if (status) status.textContent = SR ? "" : "Voice not supported in this browser.";
      return;
    }

    const rec = new SR();
    rec.lang = VOICE_LANG;
    rec.interimResults = true;
    rec.continuous = false;

    let isHolding = false;
    let finalText = "";

    const setStatus = (t) => { if (status) status.textContent = t; };

    rec.onresult = (e) => {
      let interim = "";
      finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += txt;
        else interim += txt;
      }
      input.value = (finalText || interim || "").trim();
    };

    rec.onerror = () => setStatus("Voice error.");
    rec.onend = async () => {
      setStatus("");
      if (!isHolding) return;
      isHolding = false;

      const txt = (input.value || "").trim();
      if (VOICE_AUTO_SEND && txt) {
        input.value = "";
        await onSend(txt);
      }
    };

    function start(){
      if (isHolding) return;
      isHolding = true;
      setStatus("Listening…");
      try { rec.start(); } catch { /* ignore */ }
    }

    function stop(){
      if (!isHolding) return;
      try { rec.stop(); } catch { /* ignore */ }
    }

    // mouse
    btn.addEventListener("mousedown", (e) => { e.preventDefault(); start(); });
    btn.addEventListener("mouseup", (e) => { e.preventDefault(); stop(); });
    btn.addEventListener("mouseleave", () => { if (isHolding) stop(); });

    // touch
    btn.addEventListener("touchstart", (e) => { e.preventDefault(); start(); }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); stop(); }, { passive: false });
    btn.addEventListener("touchcancel", (e) => { e.preventDefault(); stop(); }, { passive: false });
  }

  // ----------------- init wiring -----------------
  function init(){
    // Fix your HTML typo: if you still have "<<script", the page breaks.
    // (Nothing we can do here, but mentioning: make sure it’s "<script ...>")

    // Buttons
    $("#btnStart")?.addEventListener("click", () => {
      const name = ($("#studentName")?.value || "").trim();
      const className = ($("#className")?.value || "").trim();
      const difficulty = ($("#difficulty")?.value || "Standard").trim();

      if (!name) {
        alert("Vul je naam in.");
        return;
      }

      state.student = { name, className, difficulty };
      startRun();
    });

    $("#btnSend")?.addEventListener("click", () => {
      const input = $("#studentInput");
      const txt = input?.value || "";
      if (input) input.value = "";
      onSend(txt);
    });

    $("#studentInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const input = $("#studentInput");
        const txt = input?.value || "";
        if (input) input.value = "";
        onSend(txt);
      }
    });

    $("#btnDenyEntrance")?.addEventListener("click", denyEntrance);
    $("#btnFinishRun")?.addEventListener("click", finishRun);
    $("#btnNewScenario")?.addEventListener("click", startRun);

    // Supervisor modal buttons
    $("#btnCloseModal")?.addEventListener("click", closeSupervisorModal);
    $("#btnBackToVisitor")?.addEventListener("click", closeSupervisorModal);

    $("#btnSendSupervisor")?.addEventListener("click", () => {
      $("#supervisorResponse") && ($("#supervisorResponse").textContent = "Supervisor: OK. Proceed with checks.");
      logEvent("supervisor_request", { runId: state.runId, student: state.student });
    });

    // Voice
    setupVoice();

    // Make sure avatars are equal size even if images load late
    equalizeAvatars();
    window.addEventListener("resize", equalizeAvatars);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
