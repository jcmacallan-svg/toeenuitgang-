(() => {
  "use strict";

  const APP_VERSION = "veva-whatsapp-clean-2026-02-09-inline-id";
  console.log("[VEVA]", APP_VERSION, "loaded");

  const CONFIG = window.APP_CONFIG || {};
  const LOG_ENDPOINT = CONFIG.logEndpoint || "";
  const LOG_UNKNOWN = CONFIG.logUnknownQuestions !== false;

  const VOICE_AUTO_SEND = CONFIG.voiceAutoSend === true;
  const VOICE_LANG = CONFIG.voiceLang || "en-US";

  const $id = (id) => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const uid = () => Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function chance(p) { return Math.random() < clamp(p, 0, 1); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function parseYear(text) {
    const m = (text || "").match(/\b(19\d{2}|20\d{2})\b/);
    return m ? Number(m[1]) : null;
  }

  // --- Date formatting: "DD Mon YYYY"
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function formatDobPretty({ yyyy, mm, dd }) {
    const d = String(dd).padStart(2, "0");
    const m = MON[clamp(mm,1,12)-1] || "Jan";
    return `${d} ${m} ${yyyy}`;
  }

  function calcAgeFromDob(dobObj) {
    const today = new Date();
    const y = today.getFullYear();
    let age = y - dobObj.yyyy;
    const m = today.getMonth() + 1;
    const d = today.getDate();
    if (m < dobObj.mm || (m === dobObj.mm && d < dobObj.dd)) age -= 1;
    return age;
  }

  async function logEvent(type, payload = {}) {
    if (!LOG_ENDPOINT) return;
    const body = JSON.stringify({ ts: nowIso(), type, ...payload });
    try { await fetch(LOG_ENDPOINT, { method: "POST", mode: "no-cors", body }); } catch {}
  }

  // -------------------------
  // Visitor generation
  // -------------------------
  const MOODS = [
    { key: "relaxed", text: "The visitor looks relaxed and confident.", short: "relaxed and confident", lieBoost: 0.02, inconsBoost: 0.02 },
    { key: "tired",   text: "The visitor looks tired but polite.",       short: "tired but polite", lieBoost: 0.05, inconsBoost: 0.05 },
    { key: "uneasy",  text: "The visitor looks uneasy.",                short: "uneasy", lieBoost: 0.10, inconsBoost: 0.12 },
    { key: "nervous", text: "The visitor looks nervous.",               short: "nervous", lieBoost: 0.18, inconsBoost: 0.20 },
    { key: "irritated", text: "The visitor looks irritated.",           short: "irritated", lieBoost: 0.12, inconsBoost: 0.10 }
  ];

  const NATIONALITIES = [
    "Dutch","German","Belgian","French","Spanish","Italian",
    "Polish","Romanian","Turkish","British","American","Canadian"
  ];

  const FIRSTNAMES = ["David","Michael","James","Robert","Daniel","Thomas","Mark","Lucas","Noah","Adam","Omar","Yusuf","Mateusz","Julien","Marco"];
  const LASTNAMES  = ["Johnson","Miller","Brown","Davis","Martinez","Kowalski","Nowak","Schmidt","Dubois","Rossi","Yilmaz"];

  function randomDob() {
    const today = new Date();
    const year = today.getFullYear() - (18 + Math.floor(Math.random() * 38)); // 18..55
    const mm = 1 + Math.floor(Math.random() * 12);
    const dd = 1 + Math.floor(Math.random() * 28);
    return { yyyy: year, mm, dd };
  }

  function randomIdNumber() {
    const a = Math.floor(100000 + Math.random() * 900000);
    const b = Math.floor(1000 + Math.random() * 9000);
    return `ID-${a}-${b}`;
  }

  function randomExpiry() {
    const today = new Date();
    const y = today.getFullYear() + (1 + Math.floor(Math.random() * 8));
    const mm = 1 + Math.floor(Math.random() * 12);
    const dd = 1 + Math.floor(Math.random() * 28);
    return { yyyy: y, mm, dd };
  }

  function buildBackstory(intake) {
    const stories = [
      `I’m delivering replacement radio batteries. Sergeant van Dijk requested them last week because they’re running low.`,
      `I’m here to drop off maintenance parts for a generator. It was arranged after the last inspection found an issue.`,
      `I’m delivering documents and a sealed package for the logistics office. It was scheduled earlier this week.`,
      `I’m here to deliver spare helmet mounts. The unit requested them because several broke during training.`,
      `I’m bringing a repair kit for the workshop. We agreed on this delivery two weeks ago after a service call.`
    ];
    intake.subjectDetail = pick(stories);
    return intake;
  }

  function buildVisitor() {
    const mood = pick(MOODS);
    const dob = randomDob();
    const nat = pick(NATIONALITIES);
    const name = pick(FIRSTNAMES) + " " + pick(LASTNAMES);
    const age = calcAgeFromDob(dob);

    // IMPORTANT: you have 10 headshots
    const idx = 1 + Math.floor(Math.random() * 10);
    const headshot = `assets/photos/headshot_${String(idx).padStart(2, "0")}.png`;

    const appointment = chance(0.7);
    const apptTime = appointment ? pick(["09:30","10:00","13:15","14:00","15:45"]) : null;
    const meetingWith = appointment ? pick(["Sergeant van Dijk","Captain Lewis","Mr. Peters","Lt. Schmidt"]) : null;

    let intake = {
      purpose: pick(["delivery","maintenance","meeting","visit","contract work"]),
      appointment,
      apptTime,
      meetingWith,
      goingWhere: pick(["HQ building","Logistics office","Barracks admin","Workshop"]),
      subject: pick(["paperwork","equipment handover","maintenance report","security briefing","contract discussion"]),
      subjectDetail: ""
    };
    intake = buildBackstory(intake);

    return {
      mood,
      headshot,
      id: { name, nationality: nat, dob, age, idNumber: randomIdNumber(), expiry: randomExpiry() },
      intake,
      claims: { age: null, dob: null, nationality: null, name: null },
      inconsistencies: [],
      idShown: false
    };
  }

  // -------------------------
  // Intents
  // -------------------------
  function compilePatterns(extra) {
    const base = {
      greet: [/\b(hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)\b/i],
      offer_help: [
        /\b(how\s+can\s+i\s+help(\s+you)?(\s+today)?|what\s+can\s+i\s+do\s+for\s+you|how\s+may\s+i\s+help|what\s+can\s+i\s+help\s+you\s+with)\b/i,
        /\b(can\s+i\s+help(\s+you)?|do\s+you\s+need\s+help)\b/i
      ],
      ask_feeling: [
        /\bhow\s+are\s+you\s+feeling(\s+today)?\b/i,
        /\bhow\s+do\s+you\s+feel(\s+today)?\b/i
      ],
      ask_id: [
        /\b(can|could|may)\s+i\s+(see|check|verify|inspect|look\s+at)\s+(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(show|present)\s+(me\s+)?(your|ur)\s+(id|identification|passport|card)\b/i,
        /\b(do\s+you\s+have|have\s+you\s+got)\s+(an?\s+)?(id|identification|passport)\b/i,
        /\b(id|identification|passport)\s+(please|pls)\b/i
      ],
      return_id: [
        /\bhere\s+(is|are)\s+(your|ur)\s+(id|card|identification|passport)\s+back\b/i,
        /\b(return|give)\s+(it|the\s+(id|card|identification|passport))\s+back\b/i,
        /\byou\s+can\s+have\s+(your|ur)\s+(id|card|passport)\s+back\b/i
      ],
      contact_supervisor: [
        /\b(i\s*(will|’ll|'ll|need\s+to|have\s+to|must)\s+)?(contact|call|ring|phone|ask|speak\s+to|talk\s+to)\s+(my\s+)?(supervisor|boss|manager|team\s*leader|officer)\b/i,
        /\b(i\s+)?need\s+(approval|authori[sz]ation|permission)\b/i
      ],
      ask_name: [
        /\bwhat\s*(is|'s)\s+your\s+name\b/i,
        /\bcan\s+i\s+have\s+your\s+name\b/i,
        /\bmay\s+i\s+have\s+your\s+name\b/i,
        /\byour\s+name\s*,?\s+please\b/i,
        /\bstate\s+your\s+name\b/i,
        /\bwho\s+are\s+you\b(?!\s+(talking|meeting|seeing|visiting)\b)/i
      ],
      ask_purpose: [
        /\bwhat\s+are\s+you\s+here\s+for\b/i,
        /\bwhy\s+are\s+you\s+here\b/i,
        /\bwhat\s*(is|'s)\s+the\s+reason\s+for\s+(your\s+)?visit\b/i,
        /\bwhat\s*(is|'s)\s+the\s+purpose\s+of\s+(your\s+)?visit\b/i,
        /\bwhat\s+brings\s+you\s+here\b/i,
        /\bwhat\s+do\s+you\s+want\b/i,
        /\bwhat\s+are\s+you\s+doing\s+here\b/i
      ],
      ask_appointment: [
        /\bdo\s+you\s+have\s+(an?\s+)?appointment\b/i,
        /\bare\s+you\s+expected\b/i,
        /\bis\s+this\s+pre[-\s]?arranged\b/i,
        /\bdid\s+you\s+schedule\s+(a\s+)?(meeting|appointment)\b/i
      ],
      ask_who: [
        /\bwho\s+is\s+(your\s+)?(appointment|meeting)\s+with\b/i,
        /\bwho\s+are\s+you\s+meeting\b/i,
        /\bwho\s+are\s+you\s+here\s+to\s+see\b/i,
        /\bwho\s+is\s+your\s+contact\b/i,
        /\bwho\s+is\s+expecting\s+you\b/i,
        /\bwho\s+do\s+you\s+have\s+a\s+(meeting|appointment)\s+with\b/i,
        /\bwhat\s+is\s+the\s+name\s+of\s+(the\s+)?(person|host)\s+(you\s+are\s+seeing|you\s+are\s+meeting)\b/i
      ],
      ask_time: [
        /\bwhat\s+time\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhen\s+is\s+(your\s+)?(appointment|meeting)\b/i,
        /\bwhat\s+time\s+are\s+you\s+expected\b/i,
        /\bwhen\s+are\s+you\s+expected\b/i,
        /\bwhat\s+time\s+were\s+you\s+supposed\s+to\s+(meet|see)\b/i
      ],
      ask_where: [
        /\bwhere\s+are\s+you\s+going\b/i,
        /\bwhat\s+is\s+your\s+destination\b/i,
        /\bwhich\s+(building|unit|office|department|area)\b/i,
        /\bwhere\s+is\s+the\s+(meeting|appointment)\b/i,
        /\bwhere\s+are\s+you\s+meeting\s+(him|her|them)\b/i
      ],
      ask_subject: [
        /\bwhat\s*(is|'s)\s+(this|it|the\s+visit|the\s+meeting)\s+about\b/i,
        /\bwhat\s+will\s+you\s+discuss\b/i,
        /\bcan\s+you\s+tell\s+me\s+more\s+about\s+(the\s+)?(meeting|visit)\b/i,
        /\bwhat\s+are\s+you\s+delivering\b/i,
        /\bwhat\s+are\s+you\s+bringing\b/i
      ],
      ask_age: [/\bhow\s+old\s+are\s+you\b/i, /\bwhat\s+is\s+your\s+age\b/i, /\bcan\s+you\s+confirm\s+your\s+age\b/i],
      ask_dob: [/\bwhat\s*(is|'s)\s+your\s+(date\s+of\s+birth|dob)\b/i, /\bdate\s+of\s+birth\b/i, /\bwhen\s+were\s+you\s+born\b/i],
      confirm_born_year: [/\bwere\s+you\s+born\s+in\s+(19\d{2}|20\d{2})\b/i, /\bis\s+your\s+birth\s+year\s+(19\d{2}|20\d{2})\b/i],
      ask_nationality: [/\bwhat\s+is\s+your\s+nationality\b/i, /\bwhat\s+country\s+are\s+you\s+from\b/i, /\bwhere\s+are\s+you\s+from\b/i],
      deny: [/\bdeny\s+(entrance|entry|access)\b/i, /\byou\s+cannot\s+enter\b/i]
    };

    const merged = { ...base };

    const addPatterns = (key, arr) => {
      if (!arr || !Array.isArray(arr)) return;
      merged[key] = merged[key] || [];
      for (const p of arr) {
        if (!p) continue;
        if (p instanceof RegExp) merged[key].push(p);
        else if (typeof p === "string") { try { merged[key].push(new RegExp(p, "i")); } catch {} }
      }
    };

    if (extra) {
      const intentsObj = extra.intents && typeof extra.intents === "object" ? extra.intents : null;
      if (intentsObj) {
        for (const [k, v] of Object.entries(intentsObj)) if (v && Array.isArray(v.patterns)) addPatterns(k, v.patterns);
      } else {
        for (const [k, v] of Object.entries(extra)) if (Array.isArray(v)) addPatterns(k, v);
      }
    }

    const compiled = {};
    for (const [k, arr] of Object.entries(merged)) compiled[k] = (text) => arr.some(rx => rx.test(text || ""));
    compiled._raw = merged;
    return compiled;
  }

  async function loadPhrasebank() {
    try {
      const res = await fetch("phrasebank.json", { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  const INTENT_ORDER = [
    "return_id","ask_id","contact_supervisor","ask_feeling","greet","offer_help",
    "ask_name","ask_purpose","ask_appointment","ask_who","ask_time","ask_where","ask_subject",
    "ask_age","ask_dob","confirm_born_year","ask_nationality","deny"
  ];

  function matchIntent(intents, text) {
    for (const k of INTENT_ORDER) if (intents[k] && intents[k](text)) return k;
    for (const k of Object.keys(intents)) if (k !== "_raw" && intents[k](text)) return k;
    return "unknown";
  }

  // UI helpers
  function setVisitorBubble(text) { const el = $id("visitorBubble"); if (el) el.textContent = text || ""; }
  function setVisitorMood(text) { const el = $id("visitorMood"); if (el) el.textContent = text || ""; }
  function setStudentBubble(text) {
    const el = $id("studentBubble");
    if (!el) return;
    el.textContent = text || "";
    el.style.display = text ? "" : "none";
  }

  function showIdPanel() { document.body.classList.add("id-visible"); }
  function hideIdPanel() { document.body.classList.remove("id-visible"); }

  // ID canvas
  function drawIdCard(visitor) {
    showIdPanel();
    const canvas = $id("idCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#f4f6fb";
    ctx.fillRect(0,0,W,H);

    ctx.fillStyle = "#163a66";
    ctx.fillRect(0,0,W,96);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("VISITOR ID", 32, 62);

    ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("Checkpoint Access Card", 34, 84);

    ctx.fillStyle = "#e8ecf5";
    ctx.fillRect(34, 132, 210, 260);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.strokeRect(34, 132, 210, 260);

    const v = visitor.id;
    const rows = [
      ["Name", v.name],
      ["Nationality", v.nationality],
      ["DOB", formatDobPretty(v.dob)],
      ["Age", String(v.age)],
      ["ID nr", v.idNumber],
      ["Expiry", formatDobPretty(v.expiry)]
    ];

    let y = 160;
    ctx.fillStyle = "#111827";
    for (const [label, value] of rows) {
      ctx.font = "700 20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(label + ":", 270, y);
      ctx.font = "20px system-ui, -apple-system, Segoe UI, Roboto, Arial";
      ctx.fillText(value, 420, y);
      y += 48;
    }

    // footer text
    ctx.fillStyle = "rgba(17,24,39,0.75)";
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("Valid only for stated purpose. Subject to search and denial.", 34, H - 18);

    // face
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(34, 132, 210, 260);
      ctx.clip();
      ctx.drawImage(img, 34, 132, 210, 260);
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.12)";
      ctx.strokeRect(34, 132, 210, 260);
    };
    img.src = visitor.headshot;
  }

  // Control answers
  function makeFakeControl(visitor, kind) {
    if (kind === "age") return String(clamp(visitor.id.age + pick([-2,-1,1,2,3]), 18, 70));
    if (kind === "dob") {
      const dob = { ...visitor.id.dob };
      if (chance(0.5)) dob.dd = clamp(dob.dd + pick([-2,-1,1,2]), 1, 28);
      else dob.mm = clamp(dob.mm + pick([-1,1]), 1, 12);
      return formatDobPretty(dob);
    }
    if (kind === "nationality") return pick(NATIONALITIES.filter(n => n !== visitor.id.nationality));
    if (kind === "name") return pick(FIRSTNAMES) + " " + pick(LASTNAMES);
    return "";
  }

  function visitorControlAnswer(visitor, kind) {
    const lieP = 0.04 + visitor.mood.lieBoost;
    const inconsP = 0.05 + visitor.mood.inconsBoost;

    const truth = (() => {
      if (kind === "age") return String(visitor.id.age);
      if (kind === "dob") return formatDobPretty(visitor.id.dob);
      if (kind === "nationality") return visitor.id.nationality;
      if (kind === "name") return visitor.id.name;
      return "";
    })();

    const prev = visitor.claims[kind];
    if (prev) {
      if (chance(inconsP)) {
        const fake = makeFakeControl(visitor, kind);
        if (fake !== prev) {
          visitor.inconsistencies.push({ kind, prev, next: fake, ts: nowIso() });
          visitor.claims[kind] = fake;
          return { value: fake, lied: true, inconsistent: true };
        }
      }
      return { value: prev, lied: prev !== truth, inconsistent: false };
    }

    if (chance(lieP)) {
      const fake = makeFakeControl(visitor, kind);
      visitor.claims[kind] = fake;
      return { value: fake, lied: fake !== truth, inconsistent: false };
    }

    visitor.claims[kind] = truth;
    return { value: truth, lied: false, inconsistent: false };
  }

  // Required checkpoints
  const REQUIRED = [
    { key: "asked_name", label: "You didn’t ask the visitor’s name.", example: "What is your name, please?" },
    { key: "asked_purpose", label: "You didn’t ask the purpose of the visit.", example: "What is the reason for your visit?" },
    { key: "asked_appointment", label: "You didn’t confirm the appointment.", example: "Do you have an appointment?" },
    { key: "asked_who", label: "You didn’t ask who they are meeting.", example: "Who is your appointment with?" },
    { key: "asked_time", label: "You didn’t confirm the time.", example: "What time is the meeting?" },
    { key: "asked_where", label: "You didn’t confirm where they are going.", example: "Where are you going on base?" },
    { key: "asked_subject", label: "You didn’t ask what it’s about.", example: "What is the meeting about?" },
    { key: "asked_id", label: "You didn’t ask to see an ID.", example: "Can I see your ID, please?" }
  ];

  // State
  const state = {
    runId: uid(),
    student: { name: "", className: "", difficulty: "Standard" },
    visitor: null,
    intents: null,
    flags: {
      asked_name: false, asked_purpose: false, asked_appointment: false, asked_who: false,
      asked_time: false, asked_where: false, asked_subject: false, asked_id: false
    },
    finished: false,
    unknowns: 0,
    missStreak: 0
  };

  function showScreen(which) {
    $id("screen-login")?.classList.toggle("hidden", which !== "login");
    $id("screen-train")?.classList.toggle("hidden", which !== "train");
    $id("screen-feedback")?.classList.toggle("hidden", which !== "feedback");
  }

  function setStep(title, help) {
    const t = $id("stepTitle"); const h = $id("stepHelp");
    if (t) t.textContent = title || "";
    if (h) h.textContent = help || "";
  }

  function resetBubbles() {
    setVisitorBubble("Ask your first question…");
    setStudentBubble("");
    setVisitorMood(state.visitor?.mood?.text || "");
    hideIdPanel();
  }

  function intakeAnswer(kind) {
    const v = state.visitor;
    const a = v.intake;
    if (kind === "name") return `My name is ${v.id.name}.`;
    if (kind === "purpose") return "I’m here to deliver a package for the base.";
    if (kind === "appointment") return a.appointment ? "Yes, I have an appointment." : "No, I don’t have an appointment.";
    if (kind === "who") return a.meetingWith ? `I’m meeting ${a.meetingWith}.` : "I’m not meeting anyone specific.";
    if (kind === "time") return a.apptTime ? `It’s at ${a.apptTime}.` : "I don’t have a specific time.";
    if (kind === "where") return `I’m going to the ${a.goingWhere}.`;
    if (kind === "subject") return a.subjectDetail || `It’s about ${a.subject}.`;
    return "Okay.";
  }

  function handleBornYearConfirm(userText) {
    const yearAsked = parseYear(userText);
    if (!yearAsked) { setVisitorBubble("Sorry, could you repeat the year?"); return; }

    const v = state.visitor;
    const claim = visitorControlAnswer(v, "dob");
    const claimYear = parseYear(claim.value) || v.id.dob.yyyy;
    const trueYear = v.id.dob.yyyy;

    if (yearAsked === claimYear) { setVisitorBubble("Yes, that’s correct."); return; }

    setVisitorBubble("No, that’s not correct.");

    if (yearAsked === trueYear && claim.lied) {
      setVisitorBubble(`Actually… you’re right. I was born in ${trueYear}. Sorry.`);
      v.claims.dob = formatDobPretty(v.id.dob);
      return;
    }

    setVisitorBubble(`I was born in ${claimYear}.`);
  }

  function maybeHintAfterMiss() {
    const diff = state.student.difficulty || "Standard";
    if (diff === "Advanced") return;
    if (diff === "Basic") { setVisitorBubble("Hint: try “What is your name?” or “What is the reason for your visit?”"); return; }
    if (state.missStreak >= 2) setVisitorBubble("Hint: try “Do you have an appointment?” / “Who is your appointment with?” / “What time is the meeting?”");
  }

  function finishRun(reason) {
    if (state.finished) return;
    state.finished = true;
    logEvent("finish", {
      runId: state.runId, reason, student: state.student, flags: state.flags,
      unknowns: state.unknowns, inconsistencies: state.visitor?.inconsistencies || []
    });
    showFeedback();
  }

  function showFeedback() {
    showScreen("feedback");
    const misses = REQUIRED.filter(r => !state.flags[r.key]);
    const top3 = misses.slice(0,3);

    const ulTop = $id("top3");
    const all = $id("allMisses");

    if (ulTop) ulTop.innerHTML = top3.map(m => `<li><b>${m.label}</b><br><span class="muted small">Example: ${m.example}</span></li>`).join("");
    if (all) all.innerHTML = misses.map(m => `<div style="margin:10px 0;"><b>${m.label}</b><div class="muted small">Example: ${m.example}</div></div>`).join("");
  }

  function denyEntrance() {
    setStudentBubble("I’m denying entry. You cannot enter the site.");
    setVisitorBubble("Okay.");
    finishRun("denied");
  }

  function handleMessage(text) {
    if (state.finished) return;
    const t = (text || "").trim();
    if (!t) return;

    setStudentBubble(t);
    logEvent("message", { runId: state.runId, from: "student", text: t });

    const intent = matchIntent(state.intents, t);
    const diff = state.student.difficulty || "Standard";
    if (intent !== "unknown") state.missStreak = 0;

    if (intent === "deny") { denyEntrance(); return; }

    if (intent === "return_id") { setVisitorBubble("Thank you."); hideIdPanel(); return; }

    if (intent === "ask_id") {
      state.flags.asked_id = true;
      state.visitor.idShown = true;
      setVisitorBubble("Yes. Here you go.");
      drawIdCard(state.visitor);
      setStep("ID check", "Check the ID and ask control questions (DOB, age, nationality).");
      logEvent("show_id", { runId: state.runId });
      return;
    }

    if (intent === "contact_supervisor") {
      setVisitorBubble("Okay. Please contact your supervisor.");
      // keep modal, but button hidden
      const modal = $id("supervisorModal");
      if (modal) modal.classList.remove("hidden");
      setStep("Supervisor", "Fill the 5W briefing. Then continue.");
      logEvent("supervisor_trigger", { runId: state.runId, source: "text" });
      return;
    }

    if (intent === "ask_feeling") { setVisitorBubble(`I feel ${state.visitor.mood.short}.`); return; }

    if (intent === "greet") {
      setVisitorBubble("Can you help me?");
      setStep("Start", "Ask how you can help. Then continue with 5W/5WH.");
      return;
    }

    if (intent === "offer_help") {
      setVisitorBubble("I need to get onto the base.");
      setStep("Intake", "Ask the 5W/5WH questions (name, purpose, appointment, who, time, where, subject).");
      return;
    }

    if (intent === "ask_name") { state.flags.asked_name = true; setVisitorBubble(intakeAnswer("name")); return; }
    if (intent === "ask_purpose") { state.flags.asked_purpose = true; setVisitorBubble(intakeAnswer("purpose")); return; }
    if (intent === "ask_appointment") { state.flags.asked_appointment = true; setVisitorBubble(intakeAnswer("appointment")); return; }
    if (intent === "ask_who") { state.flags.asked_who = true; setVisitorBubble(intakeAnswer("who")); return; }
    if (intent === "ask_time") { state.flags.asked_time = true; setVisitorBubble(intakeAnswer("time")); return; }
    if (intent === "ask_where") { state.flags.asked_where = true; setVisitorBubble(intakeAnswer("where")); return; }
    if (intent === "ask_subject") { state.flags.asked_subject = true; setVisitorBubble(intakeAnswer("subject")); return; }

    if (intent === "ask_age") {
      const a = visitorControlAnswer(state.visitor, "age");
      setVisitorBubble(`I’m ${a.value} years old.`);
      return;
    }
    if (intent === "ask_dob") {
      const a = visitorControlAnswer(state.visitor, "dob");
      setVisitorBubble(`My date of birth is ${a.value}.`);
      return;
    }
    if (intent === "confirm_born_year") { handleBornYearConfirm(t); return; }
    if (intent === "ask_nationality") {
      const a = visitorControlAnswer(state.visitor, "nationality");
      setVisitorBubble(`I’m ${a.value}.`);
      return;
    }

    state.unknowns += 1;
    state.missStreak += 1;
    setVisitorBubble("Sorry, I don’t understand. Can you ask it another way?");
    if (LOG_UNKNOWN) logEvent("unknown_question", { runId: state.runId, text: t });
    if (diff !== "Advanced") maybeHintAfterMiss();
  }

  // Voice (hold-to-talk) minimal
  function setupVoice() {
    const btn = $id("btnMicHold");
    const status = $id("micStatus");
    const input = $id("studentInput");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!btn || !status || !input) return;

    if (!SpeechRecognition) {
      status.textContent = "Voice not supported in this browser.";
      btn.disabled = true;
      return;
    }

    let rec = null;
    let listening = false;

    function setStatus(s) { status.textContent = s || ""; }

    function startRec() {
      if (listening) return;
      rec = new SpeechRecognition();
      rec.lang = VOICE_LANG;
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = (e) => {
        let out = "";
        for (let i = e.resultIndex; i < e.results.length; i++) out += (e.results[i][0]?.transcript || "");
        input.value = out.trim();
      };

      rec.onend = () => {
        listening = false;
        btn.classList.remove("listening");
        setStatus("");
        if (VOICE_AUTO_SEND) {
          const val = (input.value || "").trim();
          if (val) { input.value = ""; handleMessage(val); }
        }
      };

      listening = true;
      btn.classList.add("listening");
      setStatus("Listening…");
      try { rec.start(); } catch {}
    }

    function stopRec() { try { rec && rec.stop(); } catch {} }

    btn.addEventListener("mousedown", (e) => { e.preventDefault(); startRec(); });
    document.addEventListener("mouseup", () => { if (listening) stopRec(); });

    btn.addEventListener("touchstart", (e) => { e.preventDefault(); startRec(); }, { passive: false });
    btn.addEventListener("touchend", (e) => { e.preventDefault(); stopRec(); }, { passive: false });
  }

  async function init() {
    // Hard-hide supervisor button always
    const supBtn = $id("btnContactSupervisor");
    if (supBtn) { supBtn.style.display = "none"; supBtn.disabled = true; }

    const pb = await loadPhrasebank();
    state.intents = compilePatterns(pb);

    showScreen("login");

    $id("btnResetLocal")?.addEventListener("click", () => {
      localStorage.removeItem("veva_runs");
      alert("Lokaal gereset.");
    });

    $id("btnStart")?.addEventListener("click", async () => {
      const name = ($id("studentName")?.value || "").trim();
      const cls = ($id("className")?.value || "").trim();
      const diff = ($id("difficulty")?.value || "Standard").trim();

      if (!name) { alert("Vul je naam in."); return; }
      if (!cls) { alert("Kies je groep."); return; } // group mandatory

      state.student = { name, className: cls, difficulty: diff };
      state.runId = uid();
      state.finished = false;
      state.unknowns = 0;
      state.missStreak = 0;
      Object.keys(state.flags).forEach(k => state.flags[k] = false);

      state.visitor = buildVisitor();

      const vA = $id("visitorAvatar");
      if (vA) { vA.src = state.visitor.headshot; vA.onerror = () => { vA.src = "assets/photos/headshot_01.png"; }; }

      const meta = $id("meta");
      if (meta) meta.textContent = `${name} · ${cls} · ${diff} · Run ${state.runId.slice(0, 6)}`;

      showScreen("train");
      resetBubbles();

      setVisitorBubble("Hello.");
      setVisitorMood(state.visitor.mood.text);
      setStep("Start", "Say hello. Then ask: “How can I help you?”");

      await logEvent("start", { runId: state.runId, student: state.student, mood: state.visitor.mood.key });
    });

    $id("btnSend")?.addEventListener("click", () => {
      const input = $id("studentInput");
      if (!input) return;
      const val = input.value;
      input.value = "";
      handleMessage(val);
    });

    $id("studentInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const input = $id("studentInput");
        const val = input.value;
        input.value = "";
        handleMessage(val);
      }
    });

    $id("btnDenyEntrance")?.addEventListener("click", () => denyEntrance());

    $id("btnHint")?.addEventListener("click", () => {
      setVisitorBubble("Try: “How can I help you?” → “What is your name?” → “Do you have an appointment?” → “Can I see your ID?”");
    });

    $id("btnDoneStep")?.addEventListener("click", () => {
      if (!state.flags.asked_name || !state.flags.asked_purpose) { setVisitorBubble("Next: ask name + reason for visit."); return; }
      if (!state.flags.asked_id) { setVisitorBubble("Next: ask for an ID."); return; }
      setVisitorBubble("Good. Continue with checks (DOB / nationality) or return the ID.");
    });

    $id("btnNewScenario")?.addEventListener("click", () => { showScreen("login"); state.finished = false; });
    $id("btnFinishRun")?.addEventListener("click", () => finishRun("manual_finish"));

    $id("btnCloseId")?.addEventListener("click", hideIdPanel);

    // Supervisor modal
    $id("btnCloseModal")?.addEventListener("click", () => $id("supervisorModal")?.classList.add("hidden"));
    $id("btnBackToVisitor")?.addEventListener("click", () => $id("supervisorModal")?.classList.add("hidden"));

    $id("btnSendSupervisor")?.addEventListener("click", () => {
      const diff = state.student.difficulty || "Standard";
      const who = ($id("wWho")?.value || "").trim();
      const what = ($id("wWhat")?.value || "").trim();
      const withWhom = ($id("wWithWhom")?.value || "").trim();
      const time = ($id("wTime")?.value || "").trim();
      const why = ($id("wWhy")?.value || "").trim();

      const missing = [];
      if (!who) missing.push("WHO");
      if (!what) missing.push("WHAT");
      if (!withWhom) missing.push("WITH WHOM");
      if (!time) missing.push("TIME");
      if (!why) missing.push("WHY");

      const resp = $id("supervisorResponse");

      if (diff !== "Advanced" && missing.length) {
        if (resp) resp.textContent = `Supervisor: Are you sure? You are missing: ${missing.join(", ")}. Go back and ask again.`;
        $id("supervisorModal")?.classList.add("hidden");
        setVisitorBubble("Your supervisor says you should go back and ask the missing questions.");
        return;
      }

      if (resp) resp.textContent = "Supervisor: Approved. Proceed with additional checks.";
      $id("supervisorModal")?.classList.add("hidden");
      setVisitorBubble("Understood.");
    });

    $id("btnBackToStart")?.addEventListener("click", () => showScreen("login"));

    $id("btnDownloadCsv")?.addEventListener("click", () => {
      const rows = [
        ["ts", nowIso()],
        ["runId", state.runId],
        ["studentName", state.student.name],
        ["className", state.student.className],
        ["difficulty", state.student.difficulty],
        ["unknowns", String(state.unknowns)]
      ];
      const csv = rows.map(r => r.map(x => `"${String(x).replaceAll('"', '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `veva_${state.runId}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

    setupVoice();
  }

  document.addEventListener("DOMContentLoaded", init);
})();