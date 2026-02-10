// app.js
(() => {
  "use strict";
  const $ = (sel) => document.querySelector(sel);

  // Screens
  const screenLogin = $("#screenLogin");
  const screenTraining = $("#screenTraining");
  const screenPersonSearch = $("#screenPersonSearch");
  const screenReturn = $("#screenReturn");

  // Login UI
  const studentSurnameInput = $("#studentSurname");
  const studentGroupSel = $("#studentGroup");
  const studentDifficultySel = $("#studentDifficulty");
  const btnStartTraining = $("#btnStartTraining");
  const loginError = $("#loginError");

  // Topbar pills
  const studentPill = $("#studentPill");
  const versionPill = $("#versionPill");
  const voiceStatus = $("#voiceStatus");

  // Chat UI
  const chatThread = $("#chatThread");
  const visitorBubble = $("#visitorBubble");
  const visitorPrevRow = $("#visitorPrevRow");
  const visitorPrevBubble = $("#visitorPrevBubble");
  const visitorPrevAvatar = $("#visitorPrevAvatar");

  const studentBubble = $("#studentBubble");
  const moodLine = $("#moodLine");
  const hintBox = $("#hintBox");



  // ===== Chat ladder state =====
  // Shows last 4 bubbles. Oldest 2 fade, simulating pushing out of frame.
  const MAX_CHAT_BUBBLES = 4;
  const chatState = { items: [] }; // {role:"visitor"|"student", text, meta}

  function pushChat(role, text, meta){
    const t = String(text ?? "").trim();
    if (!t) return;
    chatState.items.push({ role, text: t, meta: String(meta || "") });
    if (chatState.items.length > MAX_CHAT_BUBBLES){
      chatState.items = chatState.items.slice(-MAX_CHAT_BUBBLES);
    }
    renderChatThread();
  }

  function renderChatThread(){
    if (!chatThread) return;
    chatThread.innerHTML = "";

    const visitorSrc = (ID_DATA && ID_DATA.photoSrc) ? ID_DATA.photoSrc : (visitorAvatar?.src || "");
    const studentSrc = "assets/photos/soldier.png";

    const fadeCount = Math.max(0, chatState.items.length - 2); // fade everything except newest 2
    for (let i=0; i<chatState.items.length; i++){
      const msg = chatState.items[i];
      const isFade = i < fadeCount;

      const row = document.createElement("div");
      row.className = "msgRow " + (msg.role === "student" ? "student" : "visitor") + (isFade ? " fadeOld" : "");

      const img = document.createElement("img");
      img.className = "msgAvatar";
      img.alt = msg.role === "student" ? "Student" : "Visitor";
      img.src = msg.role === "student" ? studentSrc : visitorSrc;

      const bubble = document.createElement("div");
      bubble.className = "msgBubble";
      bubble.textContent = msg.text;

      row.appendChild(img);
      row.appendChild(bubble);
      chatThread.appendChild(row);

      if (msg.role === "visitor" && msg.meta){
        const metaEl = document.createElement("div");
        metaEl.className = "msgMeta" + (isFade ? " fadeOld" : "");
        metaEl.textContent = msg.meta;
        chatThread.appendChild(metaEl);
      }
    }
  }

  function setVisitor(text, meta=""){ pushChat("visitor", text, meta); }
  function setStudent(text){ pushChat("student", text, ""); }

  // Question bank
  const qbIntent = $("#qbIntent");
  const qbPhrase = $("#qbPhrase");
  const qbResponse = $("#qbResponse");
  const qbRespKey = $("#qbRespKey");
  const qbCatLabel = $("#qbCatLabel");
  const qbCatKey = $("#qbCatKey");
  const qbAddCatBtn = $("#qbAddCatBtn");
  const qbDelCatBtn = $("#qbDelCatBtn");
  const qbCatList = $("#qbCatList");
  const qbJsonOut = $("#qbJsonOut");
  const qbCopyJsonBtn = $("#qbCopyJsonBtn");
  const qbAutoCopy = $("#qbAutoCopy");
  const qbInsertBtn = $("#qbInsertBtn");
  const qbAddBtn = $("#qbAddBtn");
  const qbAddRespBtn = $("#qbAddRespBtn");
  const qbLoadSeedBtn = $("#qbLoadSeedBtn");
  const qbExportBtn = $("#qbExportBtn");
  const qbImportBtn = $("#qbImportBtn");
  const qbImportFile = $("#qbImportFile");

  const textInput = $("#textInput");
  const btnSend = $("#btnSend");
  const holdToTalk = $("#holdToTalk");

  // Sidebar buttons
  const btnReset = $("#btnReset");
  const btnReturn = $("#btnReturn");
  const btnPersonSearch = $("#btnPersonSearch");
  const btnSignIn = $("#btnSignIn");
  const btnNewScenario = $("#btnNewScenario");
  const btnDeny = $("#btnDeny");
  const btnBackToTraining = $("#btnBackToTraining");
  const btnBackReturn = $("#btnBackReturn");

  // Avatars
  const visitorAvatar = $("#visitorAvatar");

  // ID UI
  const idCardWrap = $("#idCardWrap");
  const idSlotHint = $("#idSlotHint");
  const btnReturnId = $("#btnReturnId");
  const idPhoto = $("#idPhoto");
  const idName = $("#idName");
  const idDob = $("#idDob");
  const idNat = $("#idNat");
  const idNo = $("#idNo");

  // Supervisor modal
  const supervisorModal = $("#supervisorModal");
  const btnCloseSupervisor = $("#btnCloseSupervisor");
  const btnSupervisorCheck = $("#btnSupervisorCheck");
  const btnReturnToVisitor = $("#btnReturnToVisitor");
  const svWhy = $("#svWhy");
  const svAppt = $("#svAppt");
  const svWho = $("#svWho");
  const svAbout = $("#svAbout");
  const svTime = $("#svTime");
  const svWhyStatus = $("#svWhyStatus");
  const svApptStatus = $("#svApptStatus");
  const svWhoStatus = $("#svWhoStatus");
  const svAboutStatus = $("#svAboutStatus");
  const svTimeStatus = $("#svTimeStatus");
  const svNote = $("#svNote");

  // Config + Build
  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const ASSET_BASE = CFG.assetBase || "assets/photos";
  const HEADSHOT_PREFIX = CFG.headshotPrefix || "headshot_";
  const HEADSHOT_COUNT = Number(CFG.headshotCount || 10);
  const VOICE_AUTOSEND = CFG.voiceAutoSend !== false;

  // Version display + document title + console banner (cache sanity)
  if (versionPill) versionPill.textContent = `v${BUILD.version}`;
  document.title = `${BUILD.name} v${BUILD.version}`;
  console.info(
    `%c${BUILD.name} v${BUILD.version}`,
    "background:#161b22;color:#e6edf3;padding:6px 10px;border-radius:8px;font-weight:700;"
  );
  console.info("BUILD:", BUILD);
  console.info("CONFIG:", CFG);


  // ---------- Supervisor modal logic ----------
  const AUDIT_KEY = "veva.audit.v1";

  function normalize(s){
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}: ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function setStatus(el, ok){
    el.classList.remove("ok","bad");
    if (ok === true){ el.textContent = "OK"; el.classList.add("ok"); }
    else if (ok === false){ el.textContent = "NO"; el.classList.add("bad"); }
    else { el.textContent = "—"; }
  }

  function openSupervisorModal(){
    if (!supervisorModal) return;
    supervisorModal.hidden = false;

    svWhy.value = state?.facts?.why || "";
    svAppt.value = state?.facts?.appt || "yes";
    svWho.value = state?.facts?.who || "";
    svAbout.value = state?.facts?.about || "";
    svTime.value = state?.facts?.time || "";

    [svWhyStatus, svApptStatus, svWhoStatus, svAboutStatus, svTimeStatus].forEach(s => setStatus(s, null));
    if (svNote) svNote.textContent = "Fill in the answers, run checks, then return to the visitor.";
  }

  function closeSupervisorModal(){
    if (!supervisorModal) return;
    supervisorModal.hidden = true;
  }

  function runSupervisorChecks(){
    const expected = {      why: state?.facts?.why || "",
      appt: state?.facts?.appt || "yes",
      who: state?.facts?.who || "",
      about: state?.facts?.about || "",
      time: state?.facts?.time || ""
    };

    const entered = {      why: svWhy.value,
      appt: svAppt.value,
      who: svWho.value,
      about: svAbout.value,
      time: svTime.value
    };

    const mismatches = [];

    const whyOk = expected.why ? normalize(entered.why).includes(normalize(expected.why)) : true;
    setStatus(svWhyStatus, whyOk);
    if (!whyOk) mismatches.push("why");

    const apptOk = normalize(entered.appt) === normalize(expected.appt);
    setStatus(svApptStatus, apptOk);
    if (!apptOk) mismatches.push("appointment");

    const whoOk = expected.who ? normalize(entered.who).includes(normalize(expected.who)) : true;
    setStatus(svWhoStatus, whoOk);
    if (!whoOk) mismatches.push("who");

    const aboutOk = expected.about ? normalize(entered.about).includes(normalize(expected.about)) : true;
    setStatus(svAboutStatus, aboutOk);
    if (!aboutOk) mismatches.push("about");

    const timeOk = expected.time ? normalize(entered.time).includes(normalize(expected.time)) : true;
    setStatus(svTimeStatus, timeOk);
    if (!timeOk) mismatches.push("time");

    const msg = mismatches.length
      ? `Checks complete: ${mismatches.length} mismatch(es) recorded: ${mismatches.join(", ")}.`
      : "Checks complete: everything matches.";
    if (svNote) svNote.textContent = msg;

    try{
      const raw = localStorage.getItem(AUDIT_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      arr.push({
        ts: new Date().toISOString(),
        build: BUILD,
        student: session,
        expected,
        entered,
        mismatches
      });
      localStorage.setItem(AUDIT_KEY, JSON.stringify(arr));
    } catch {}

    console.info("Supervisor check", { expected, entered, mismatches });
    return { expected, entered, mismatches };
  }


  function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pad2(n){ return String(n).padStart(2,"0"); }
  function cap(s){ return (s||"").charAt(0).toUpperCase() + (s||"").slice(1); }

  // Persisted student info (prefill only; still requires Start)
  const STUDENT_KEY = "veva.student.v1";
  function loadStudentPrefill(){
    try{
      const raw = localStorage.getItem(STUDENT_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (!v || typeof v !== "object") return null;
      return v;
    } catch { return null; }
  }
  function saveStudentPrefill(v){
    try{ localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); } catch {}
  }


  // ---------- Custom intent phrases (localStorage) ----------
  // Stores arrays of "includes" phrases per intent, to make recognition robust without regex chaos.
  const INTENT_PHRASES_KEY = "veva.intentPhrases.v1";
  const INTENT_RESPONSES_KEY = "veva.intentResponses.v1";
  const CATEGORIES_KEY = "veva.qbCategories.v1";

  function loadIntentPhrases(){
    try{
      const raw = localStorage.getItem(INTENT_PHRASES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch { return {}; }
  }

  function saveIntentPhrases(map){
    try{ localStorage.setItem(INTENT_PHRASES_KEY, JSON.stringify(map)); } catch {}
  }

  function addIntentPhrase(intentKey, phrase){
    const p = (phrase || "").trim();
    if (!intentKey || !p) return false;
    const map = loadIntentPhrases();
    const arr = Array.isArray(map[intentKey]) ? map[intentKey] : [];
    const low = p.toLowerCase();
    if (!arr.map(x => String(x).toLowerCase()).includes(low)){
      arr.push(p);
      map[intentKey] = arr;
      saveIntentPhrases(map);
    }
    return true;
  }

  function matchStoredPhraseIntent(text){
    const t = (text || "").toLowerCase();
    const map = loadIntentPhrases();
    for (const [intent, phrases] of Object.entries(map)){
      if (!Array.isArray(phrases)) continue;
      for (const ph of phrases){
        if (!ph) continue;
        if (t.includes(String(ph).toLowerCase())) return intent;
      }
    }
    return null;
  }


  function loadIntentResponses(){
    try{
      const raw = localStorage.getItem(INTENT_RESPONSES_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch { return {}; }
  }

  function saveIntentResponses(map){
    try{ localStorage.setItem(INTENT_RESPONSES_KEY, JSON.stringify(map)); } catch {}
  }

  function addIntentResponse(intentKey, response){
    const r = (response || "").trim();
    if (!intentKey || !r) return false;
    const map = loadIntentResponses();
    const arr = Array.isArray(map[intentKey]) ? map[intentKey] : [];
    const low = r.toLowerCase();
    if (!arr.map(x => String(x).toLowerCase()).includes(low)){
      arr.push(r);
      map[intentKey] = arr;
      saveIntentResponses(map);
    }
    return true;


  // ---------- Categories (Question bank) ----------
  const BUILTIN_CATEGORIES = [
    ["help_open", "Opening / help"],
    ["ask_name", "Name"],
    ["ask_mood", "Mood"],
    ["purpose", "Purpose"],
    ["has_appointment", "Appointment: yes/no"],
    ["who_meeting", "Appointment: who"],
    ["time_meeting", "Appointment: time"],
    ["about_meeting", "Appointment: about"],
    ["ask_id", "Ask for ID"],
    ["dob_q", "Control: DOB"],
    ["nat_q", "Control: nationality"],
    ["illegal_items", "Illegal items (question)"],
    ["illegal_clarify", "Illegal items (clarify)"],
    ["everyone_searched", "Search policy"],
    ["why_searched", "Why searched"],
    ["due_threat", "Reason: threat"],
    ["go_person_search", "Go to person search"]
  ];

  function loadCategories(){
    try{
      const raw = localStorage.getItem(CATEGORIES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function saveCategories(arr){
    try{ localStorage.setItem(CATEGORIES_KEY, JSON.stringify(arr)); } catch {}
  

  function deleteCategory(key){
    const k = normalizeCatKey(key);
    if (!k) return false;
    const cur = loadCategories();
    const next = cur.filter(item => !(Array.isArray(item) && normalizeCatKey(item[0]) === k));
    if (next.length === cur.length) return false;
    saveCategories(next);
    return true;
  }

}

  function normalizeCatKey(k){
    return String(k || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_\-]/g, "");
  }

  

  function buildLiveSeedJSON(){
    const payload = {
      exportedAt: new Date().toISOString(),
      build: BUILD,
      categories: loadCategories(),
      phrases: loadIntentPhrases(),
      responses: loadIntentResponses()
    };
    return JSON.stringify(payload, null, 2);
  }

  async function copyToClipboard(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e){
      // fallback: select textarea
      try{
        if (qbJsonOut){
          qbJsonOut.focus();
          qbJsonOut.select();
          document.execCommand("copy");
          return true;
        }
      } catch {}
      return false;
    }
  }

  function refreshLiveJSON(){
    if (!qbJsonOut) return;
    const txt = buildLiveSeedJSON();
    qbJsonOut.value = txt;
    if (qbAutoCopy?.checked){
      copyToClipboard(txt).then(() => {});
    }
  }

  function countForKey(key){
    const phrases = loadIntentPhrases();
    const responses = loadIntentResponses();
    const p = Array.isArray(phrases[key]) ? phrases[key].length : 0;
    const r = Array.isArray(responses[key]) ? responses[key].length : 0;
    return { p, r };
  }

  function renderCategoryList(){
    if (!qbCatList) return;
    const custom = loadCategories(); // [key,label]
    if (!custom.length){
      qbCatList.innerHTML = '<div class="catKey">No custom categories yet.</div>';
      return;
    }
    qbCatList.innerHTML = "";
    for (const item of custom){
      if (!Array.isArray(item) || item.length < 2) continue;
      const key = normalizeCatKey(item[0]);
      const label = String(item[1] || key).trim();
      const {p,r} = countForKey(key);
      const row = document.createElement("div");
      row.className = "catRow";
      row.innerHTML = `
        <div style="min-width:0;">
          <div class="catLabel">${escapeHtml(label)}</div>
          <div class="catKey">${escapeHtml(key)}</div>
        </div>
        <div class="catCounts">phrases: ${p} · responses: ${r}</div>
      `;
      // click selects this category in dropdown
      row.addEventListener("click", () => {
        qbIntent.value = key;
        refreshLiveJSON();
      });
      qbCatList.appendChild(row);
    }
  }

  function escapeHtml(s){
    return String(s||"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
    if (visitorPrevRow){
      if (!current){
        visitorPrevRow.classList.add("is-empty");
      } else {
        visitorPrevRow.classList.remove("is-empty");
        // animate the previous bubble sliding up when a new visitor line arrives
        visitorPrevRow.classList.remove("slide-up");
        // force reflow
        void visitorPrevRow.offsetWidth;
        visitorPrevRow.classList.add("slide-up");
      }
    }

    if (visitorBubble) visitorBubble.textContent = next;
  }


function refreshCategoryDropdown(){
    if (!qbIntent) return;
    const custom = loadCategories(); // array of [key,label]
    const merged = [...BUILTIN_CATEGORIES];

    for (const item of custom){
      if (!Array.isArray(item) || item.length < 2) continue;
      const key = normalizeCatKey(item[0]);
      const label = String(item[1] || key).trim();
      if (!key || !label) continue;
      if (!merged.some(([k]) => k === key)){
        merged.push([key, label]);
      }
    }

    const current = qbIntent.value;
    qbIntent.innerHTML = '<option value="">Choose…</option>';
    for (const [k, label] of merged){
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = label;
      qbIntent.appendChild(opt);
    }
    if (current && merged.some(([k]) => k === current)) qbIntent.value = current;
    renderCategoryList();
    refreshLiveJSON();
  }



  // ---------- Mood-aware visitor responses (baked-in) ----------
  // We read mood from window.VEVA_STATE to avoid referencing `state` before init.
  function moodLevel(){
    const s = (window.VEVA_STATE || {});
    const m = (s.moodKey || s.mood || "").toString().toLowerCase();
    if (m.includes("relax") || m.includes("calm") || m.includes("friendly")) return 0.15;
    if (m.includes("confident")) return 0.25;
    if (m.includes("neutral")) return 0.45;
    if (m.includes("mixed") || m.includes("shifty")) return 0.55;
    if (m.includes("nervous")) return 0.75;
    if (m.includes("suspicious") || m.includes("hostile") || m.includes("angry")) return 0.9;
    const n = Number(s.moodLevel);
    if (Number.isFinite(n)) return Math.max(0, Math.min(1, n));
    return 0.5;
  }

  function pickFrom(arr){
    if (!Array.isArray(arr) || !arr.length) return "";
    const item = arr[Math.floor(Math.random() * arr.length)];
    try{
      return (typeof item === "function") ? String(item() ?? "") : String(item ?? "");
    }catch(e){
      return "";
    }
  }

  function pickMoodResponse(pools){
    const lvl = moodLevel();
    if (lvl <= 0.35) return pickFrom(pools.relaxed || pools.mixed || pools.nervous || []);
    if (lvl <= 0.7) return pickFrom(pools.mixed || pools.relaxed || pools.nervous || []);
    return pickFrom(pools.nervous || pools.mixed || pools.relaxed || []);
  }

  function moodMaybeLie(truth, lie, pBase=0.15){
    const lvl = moodLevel();
    const p = Math.min(0.85, pBase + lvl * 0.55);
    return (Math.random() < p) ? lie : truth;
  }

  const VISITOR_POOLS = {
    "visitor.greeting.hello": {
      relaxed: ["Hello.", "Hi there.", "Good morning.", "Good afternoon.", "Evening."],
      mixed:   ["Hello…", "Uh, hello.", "Hi.", "Good… morning.", "Hello."],
      nervous: ["Hello.", "Yeah… hello.", "Hi.", "Hello—", "…Hello."]
    },
    "visitor.open.need_help": {
      relaxed: ["Can you help me?", "Hi, can you help me please?", "Could you help me for a moment?", "Excuse me, can you help me?", "Can you help me with something?"],
      mixed:   ["Can you help me?", "I… need help.", "Can you help me, please?", "Could you help me?", "Can you help me—quickly?"],
      nervous: ["Can you help me?", "Look—can you help me?", "Can you just help me?", "Can you help me or not?", "I need help."]
    },
    "visitor.open.need_base": {
      relaxed: ["I need to get onto the base.", "I’m here for a meeting on base.", "I need access to the base.", "I’m supposed to be on base today.", "I’m here to enter the base."],
      mixed:   ["I need to get onto the base.", "I’m here for an appointment… on base.", "I need access, yeah.", "I’m supposed to be inside.", "I need to go in."],
      nervous: ["I need to get onto the base.", "I… need to go in.", "I’m here, I need access.", "I have to get in—okay?", "I’m supposed to be inside."]
    },
    "ask_name": {
      relaxed: ["My name is Alex Johnson.", "I’m Alex Johnson.", "Alex Johnson.", "Alex Johnson—nice to meet you.", "It’s Alex Johnson."],
      mixed:   ["Alex Johnson.", "My name is Alex… Johnson.", "Johnson. Alex Johnson.", "Alex Johnson.", "It’s… Alex Johnson."],
      nervous: ["Alex Johnson.", "Johnson.", "Alex… Johnson.", "Why do you need my name? Alex Johnson.", "Alex Johnson."]
    },
    "purpose": {
      relaxed: ["I have an appointment on base.", "I’m here for a scheduled meeting.", "I’m here to visit someone on base.", "I’m here for official business.", "I’m here for a delivery appointment."],
      mixed:   ["I have an appointment.", "I’m here for a meeting.", "I need to see someone.", "I’m supposed to be here.", "I have to drop something off."],
      nervous: ["Appointment.", "Meeting.", "I’m here to get in.", "I’m supposed to be here.", "I have business here."]
    },
    "has_appointment": {
      relaxed: ["Yes, I have an appointment.", "Yes, I do.", "Yes—my visit is scheduled.", "Yes, I’m expected.", "Yes, I have a meeting booked."],
      mixed:   ["Yes.", "Yeah, I have an appointment.", "I think so—yes.", "Yes, I’m supposed to.", "Yes… appointment."],
      nervous: [
        () => moodMaybeLie("Yes.", "No… I mean yes.", 0.2),
        "Yes.", "Yeah.", "Yes—appointment.", "Yes, okay?"
      ]
    },
    "who_meeting": {
      relaxed: ["I’m meeting Sergeant de Vries.", "I have an appointment with Sergeant de Vries.", "I’m here to see Sergeant de Vries.", "I’m meeting Captain van Dijk.", "I’m meeting the duty officer at reception."],
      mixed: [
        () => moodMaybeLie("I’m meeting Sergeant de Vries.", "I’m meeting Mr. de Vries.", 0.25),
        "I’m meeting Sergeant de Vries.", "I’m meeting Captain van Dijk.", "I’m meeting… de Vries.", "I’m here to see my contact."
      ],
      nervous: [
        () => moodMaybeLie("I’m meeting Sergeant de Vries.", "I’m meeting… uh… Mr. de Vries.", 0.35),
        "Sergeant de Vries.", "De Vries.", "My contact… de Vries.", "I’m meeting the officer—de Vries."
      ]
    },
    "time_meeting": {
      relaxed: ["At 14:00.", "At 09:30.", "At 10:15.", "At 15:00.", "At 13:45."],
      mixed: [
        () => moodMaybeLie("At 14:00.", "At 15:00.", 0.3),
        "At 14:00.", "Around 10:00.", "At 09:30.", "In the afternoon—14:00."
      ],
      nervous: [
        () => moodMaybeLie("At 14:00.", "Uh… 15:00.", 0.4),
        "At 14:00.", "I… 14:00.", "Around 14:00.", "I don’t remember—14:00."
      ]
    },
    "about_meeting": {
      relaxed: ["It’s a delivery for the workshop—tools and spare parts.", "It’s a maintenance meeting about paperwork.", "It’s an inspection meeting.", "It’s a briefing for contractor access.", "It’s about a scheduled service appointment."],
      mixed:   ["It’s about a delivery.", "Maintenance paperwork.", "It’s… an inspection.", "It’s about work on site.", "It’s about the workshop—delivery."],
      nervous: ["Delivery.", "Work stuff.", "It’s… paperwork.", "I was told to come here.", "Just a meeting—okay?"]
    },
    "visitor.search.why": {
      relaxed: ["Why am I being searched?", "Why do you need to search me?", "Is the search necessary?", "Why are you searching me today?", "What is the reason for the search?"],
      mixed:   ["Why am I searched?", "Why are you searching me?", "Do you really need to search me?", "Why me?", "Why am I being searched?"],
      nervous: ["Why are you searching me?!", "Why am I searched?", "What’s going on?", "Why do you need to search me?", "Why?"]
    },
    "visitor.illegal.what_is": {
      relaxed: ["What do you mean by illegal items?", "What counts as illegal items?", "What are illegal items exactly?", "Illegal items—like what?", "Can you explain what you mean by illegal items?"],
      mixed:   ["What are illegal items?", "What do you mean?", "Illegal items—what?", "Like what?", "What counts as illegal?"],
      nervous: ["What do you mean—illegal items?", "Illegal items? Like what?", "What are-… what are illegal items?", "What exactly do you mean?", "Illegal items?"]
    },
    "visitor.illegal.no_where": {
      relaxed: ["No, I don’t have anything like that. Where do I go?", "No. Tell me where to go.", "No—nothing. Where should I go now?", "No, I’m clean. Where do I go?", "No. What’s the next step?"],
      mixed:   ["No. Tell me where to go.", "No. Where do I go?", "No—nothing. Where now?", "No. Okay. Where do I go?", "No. Just tell me where to go."],
      nervous: ["No. Where do I go?", "No—nothing. Can we move on?", "No. Tell me where to go.", "No. Why all these questions?", "No… nothing. Where do I go?"]
    },
    "visitor.generic.ok": {
      relaxed: ["Okay.", "Alright.", "Sure.", "Understood.", "Okay, no problem."],
      mixed:   ["Okay.", "Alright.", "Fine.", "Okay…", "Sure."],
      nervous: ["Okay.", "Fine.", "Alright.", "Okay—can we continue?", "…Okay."]
    },
    "visitor.generic.thanks": {
      relaxed: ["Thank you.", "Thanks.", "Thank you, officer.", "Alright, thanks.", "Thanks for your help."],
      mixed:   ["Thanks.", "Thank you.", "Okay, thanks.", "Right… thanks.", "Thanks."],
      nervous: ["Yeah… thanks.", "Thanks.", "Okay.", "Uh—thanks.", "Thanks."]
    }
  ,
    "visitor.excuse.nationality": {
      relaxed: [
        "Oh—sorry. I misspoke. I’m Dutch, I just work in Germany.",
        "Right, yes—Dutch. I said German because I live there now.",
        "I have dual nationality, but this passport is Dutch.",
        "My apologies—Dutch. I got mixed up for a second.",
        "Dutch, yes. I’ve been travelling a lot, that’s why I said German."
      ],
      mixed: [
        "Uh… I live in Germany, but I’m Dutch. That’s what the passport says.",
        "I said German because I work there. The passport is Dutch.",
        "It’s… complicated. I’m Dutch, but I’m registered in Germany.",
        "I mixed it up. Dutch—okay?",
        "Dutch. I just answered too fast."
      ],
      nervous: [
        "I—look, I got confused. It’s Dutch, okay?",
        "I said the wrong thing. I’m Dutch. I’m just stressed.",
        "It’s Dutch. I… I misspoke, that’s all.",
        "I thought you meant where I live. I live in Germany. The passport is Dutch.",
        "Dutch. Can we move on, please?"
      ]
    },
    "visitor.excuse.dob": {
      relaxed: [
        "Oh sorry—let me correct that. The date on the ID is the correct one.",
        "My mistake. I said it wrong. The passport date is correct.",
        "I mixed up the day and month—sorry. The ID shows the right date.",
        "Apologies, I answered too quickly. The ID is correct.",
        "Sorry—yes, the date on the passport is correct."
      ],
      mixed: [
        "I misspoke. The date on the ID is correct.",
        "I got it wrong. The passport shows the right date.",
        "I mixed it up—sorry. The ID is correct.",
        "Uh… I said it wrong. The ID date is right.",
        "Sorry. The passport date is correct."
      ],
      nervous: [
        "I—sorry. I said it wrong. The ID date is correct.",
        "I’m nervous, okay? The passport date is correct.",
        "I mixed it up. The ID shows the right date.",
        "That was a mistake. The passport is correct.",
        "Sorry—can we just use what’s on the ID?"
      ]
    }};

  function visitorLine(key, fallbackList){
    const pools = VISITOR_POOLS[key] || null;
    if (pools){
      const v = pickMoodResponse(pools);
      if (v) return v;
    }
    const v2 = pickVisitorResponse(key, fallbackList);
    if (v2) return v2;
    return pickFrom(fallbackList) || "";
  }

  function pickVisitorResponse(intentKey, fallbackList){
    const map = loadIntentResponses();
    const arr = Array.isArray(map[intentKey]) ? map[intentKey] : [];
    const pool = arr.length ? arr : (Array.isArray(fallbackList) ? fallbackList : []);
    if (!pool.length) return "";
    return pool[Math.floor(Math.random() * pool.length)];
  }


  // Example questions per category (for inserting quickly)
  const QB_EXAMPLES = {
    help_open: [
      "Good morning. How can I help you?",
      "How can I help you today?",
      "What do you need?"
    ],
    ask_name: [
      "What is your name?",
      "May I have your name, please?"
    ],
    ask_mood: [
      "How are you feeling today?",
      "Are you okay?"
    ],
    purpose: [
      "Why are you here?",
      "What is the purpose of your visit?"
    ],
    has_appointment: [
      "Do you have an appointment?",
      "Have you got an appointment?",
      "Is your visit scheduled?"
    ],
    who_meeting: [
      "Who are you meeting?",
      "With whom do you have an appointment?"
    ],
    time_meeting: [
      "What time is the appointment?",
      "When are you expected?"
    ],
    about_meeting: [
      "What is the appointment about?",
      "What are you delivering?"
    ],
    ask_id: [
      "Have you got ID?",
      "Can I see your ID, please?",
      "Do you have a passport or identity card?"
    ],
    dob_q: [
      "What is your date of birth?",
      "When were you born?"
    ],
    nat_q: [
      "What is your nationality?",
      "Where are you from?"
    ]
  };


  // Response keys are separate from intents. Use these keys for specific visitor lines.
  const RESPONSE_KEYS = [
    "visitor.greeting.hello",
    "visitor.open.need_help",
    "visitor.open.need_base",
    "visitor.id.requested",
    "visitor.supervisor.wait",
    "visitor.search.why",
    "visitor.search.ok_where",
    "visitor.illegal.what_is",
    "visitor.illegal.followup_missing",
    "visitor.illegal.no_where",
    "visitor.generic.ok",
    "visitor.generic.thanks"
  ];

  function pickResponse(key, fallbackList){
    // Primary: response key. Secondary: intent-key responses (backward compatible).
    const r1 = pickVisitorResponse(key, fallbackList);
    if (r1) return r1;
    return pickVisitorResponse(String(key || "").replace(/^visitor\./,""), fallbackList);
  }


  function exportIntentPhrases(){
    const map = loadIntentPhrases();
    const payload = {
      exportedAt: new Date().toISOString(),
      build: BUILD,
      phrases: map,
      responses: loadIntentResponses(),
      categories: loadCategories()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const ts = new Date().toISOString().replace(/[:.]/g,"-");
    a.href = URL.createObjectURL(blob);
    a.download = `intent-phrases-${BUILD.version}-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function importIntentPhrasesFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const parsed = JSON.parse(String(reader.result || ""));
        const phrases = parsed.phrases || parsed; // allow raw map too
        const responses = parsed.responses || null;
        const categories = parsed.categories || null;
        if (!phrases || typeof phrases !== "object") throw new Error("Invalid JSON structure");
        // merge imported with existing
        const current = loadIntentPhrases();
        for (const [k, arr] of Object.entries(phrases)){
          if (!Array.isArray(arr)) continue;
          const curArr = Array.isArray(current[k]) ? current[k] : [];
          const set = new Set(curArr.map(x => String(x).toLowerCase()));
          for (const ph of arr){
            const s = String(ph || "").trim();
            if (!s) continue;
            const low = s.toLowerCase();
            if (!set.has(low)){
              curArr.push(s);
              set.add(low);
            }
          }
          current[k] = curArr;
        }
        saveIntentPhrases(current);

        // merge responses (optional)
        if (responses && typeof responses === "object"){
          const curR = loadIntentResponses();
          for (const [k, arr] of Object.entries(responses)){
            if (!Array.isArray(arr)) continue;
            const curArr = Array.isArray(curR[k]) ? curR[k] : [];
            const set = new Set(curArr.map(x => String(x).toLowerCase()));
            for (const rr of arr){
              const s = String(rr || "").trim();
              if (!s) continue;
              const low = s.toLowerCase();
              if (!set.has(low)){
                curArr.push(s);
                set.add(low);
              }
            }
            curR[k] = curArr;
          }
          saveIntentResponses(curR);
        }

        // merge categories (optional)
        if (Array.isArray(categories)){
          const curC = loadCategories();
          const seen = new Set(curC.map(x => Array.isArray(x) ? normalizeCatKey(x[0]) : ""));
          for (const item of categories){
            if (!Array.isArray(item) || item.length < 2) continue;
            const k = normalizeCatKey(item[0]);
            const label = String(item[1] || k).trim();
            if (!k || !label) continue;
            if (!seen.has(k)){
              curC.push([k, label]);
              seen.add(k);
            }
          }
          saveCategories(curC);
          refreshCategoryDropdown();
  visitorPrevRow?.classList.add('is-empty');
  refreshLiveJSON();
        }

        refreshLiveJSON();
        showHint("Imported phrases/responses/categories (merged).");
        setTimeout(() => hideHint(), 1100);
        console.info("Imported intent phrases", current);
      } catch(e){
        console.warn("Import failed", e);
        showHint("Import failed (invalid JSON).");
        setTimeout(() => hideHint(), 1400);
      }
    };
    reader.readAsText(file);
  }



  // Auto-load phrases from repo file (optional) and merge into localStorage.
  // This lets you build a big database locally and keep it versioned in GitHub.
  async function loadSeedPhrases(){
    try{
      const res = await fetch("intent_phrases.seed.json", { cache: "no-store" });
      if (!res.ok) return false;
      const parsed = await res.json();
      const phrases = parsed.phrases || parsed;
      const responses = parsed.responses || null;
      if (!phrases || typeof phrases !== "object") return false;

      const current = loadIntentPhrases();
      for (const [k, arr] of Object.entries(phrases)){
        if (!Array.isArray(arr)) continue;
        const curArr = Array.isArray(current[k]) ? current[k] : [];
        const set = new Set(curArr.map(x => String(x).toLowerCase()));
        for (const ph of arr){
          const s = String(ph || "").trim();
          if (!s) continue;
          const low = s.toLowerCase();
          if (!set.has(low)){
            curArr.push(s);
            set.add(low);
          }
        }
        current[k] = curArr;
      }
      saveIntentPhrases(current);

      // merge responses from seed (optional)
      if (responses && typeof responses === "object"){
        const curR = loadIntentResponses();
        for (const [k, arr] of Object.entries(responses)){
          if (!Array.isArray(arr)) continue;
          const curArr = Array.isArray(curR[k]) ? curR[k] : [];
          const set = new Set(curArr.map(x => String(x).toLowerCase()));
          for (const rr of arr){
            const s = String(rr || "").trim();
            if (!s) continue;
            const low = s.toLowerCase();
            if (!set.has(low)){
              curArr.push(s);
              set.add(low);
            }
          }
          curR[k] = curArr;
        }
        saveIntentResponses(curR);
      }

      console.info("Loaded seed phrases/responses from intent_phrases.seed.json");
      return true;
    } catch (e){
      console.warn("Seed phrases load failed (ok if file missing)", e);
      return false;
    }
  }




  // ---------- Student/session state ----------
  let session = {
    surname: "",
    group: "",
    difficulty: "standard" // basic | standard | advanced
  };

  function updateStudentPill(){
    if (!session.surname || !session.group){
      studentPill.textContent = "Student: —";
      return;
    }
    studentPill.textContent = `Student: ${session.surname} | Group: ${session.group} | ${cap(session.difficulty)}`;
  }

  // ---------- ID data ----------
  const ID_DATA = makeRandomId();

  function headshotPath(index){
    return `${ASSET_BASE}/${HEADSHOT_PREFIX}${pad2(index)}.png`;
  }

  function makeRandomId(){
    const idx = randInt(1, HEADSHOT_COUNT);
    return {
      name: "Jordan Miller",
      dob: "21 Mar 1982",
      nat: "Dutch",
      idNo: "NL-" + randInt(100000, 999999),
      headshotIndex: idx,
      photoSrc: headshotPath(idx)
    };
  }

  // Visitor avatar MUST equal ID photo (1:1)
  function syncAvatarAndIdPhoto(){
    if (visitorAvatar) visitorAvatar.src = ID_DATA.photoSrc;
    if (idPhoto) idPhoto.src = ID_DATA.photoSrc;
  }

  // ---------- Mood ----------
  const MOODS = [
    { key:"neutral", line:"The visitor looks neutral.", liarBias: 0.10 },
    { key:"nervous", line:"The visitor looks nervous.", liarBias: 0.30 },
    { key:"relaxed", line:"The visitor looks relaxed.", liarBias: 0.05 },
    { key:"angry",   line:"The visitor looks irritated.", liarBias: 0.35 }
  ];
  let currentMood = MOODS[0];

  // ---------- Training State ----------
  let state;

  // ---------- Screens ----------
  function setActiveScreen(name){
    [screenLogin, screenTraining, screenPersonSearch, screenReturn].forEach(s => s.classList.remove("screen--active"));
    if (name === "login") screenLogin.classList.add("screen--active");
    if (name === "training") screenTraining.classList.add("screen--active");
    if (name === "personSearch") screenPersonSearch.classList.add("screen--active");
    if (name === "return") screenReturn.classList.add("screen--active");
  }

  // ---------- ID show/hide (robust) ----------
  function showId(){
    idName.textContent = ID_DATA.name;
    idDob.textContent  = ID_DATA.dob;
    idNat.textContent  = ID_DATA.nat;
    idNo.textContent   = ID_DATA.idNo;

    syncAvatarAndIdPhoto();

    idCardWrap.hidden = false;
    idCardWrap.style.display = "flex";
    idSlotHint.hidden = true;

    state.idVisible = true;
  }

  function hideId(){
    idCardWrap.hidden = true;
    idCardWrap.style.display = "none";
    idSlotHint.hidden = false;

    if (state) state.idVisible = false;
  }

  // ---------- Hints ----------
  function showHint(text){
    if (session.difficulty === "advanced") return;
    hintBox.hidden = false;
    hintBox.textContent = text;
  }
  function hideHint(){
    hintBox.hidden = true;
    hintBox.textContent = "";
  }
  function maybeHint(){
    if (session.difficulty === "advanced") return;
    const hint = getHintForStage(state.stage);
    if (!hint) return;
    if (session.difficulty === "basic") showHint(hint);
    else if (state.misses >= 2) showHint(hint);
  }
  function getHintForStage(stage){
    switch(stage){
      case "start":
      case "greet": return "Try: “Good morning. How can I help you?”";
      case "help": return "Try: “How can I help you today?” / “What do you need?”";
      case "purpose":
        if (intent === "has_appointment"){ const r = visitorLine("has_appointment", ["Yes, I have an appointment."]); setVisitor(r); state.misses=0; hideHint(); break; }

        if (intent === "who_meeting"){ const r = visitorLine("who_meeting", ["I’m meeting Sergeant de Vries."]); setVisitor(r); state.misses=0; hideHint(); break; }
 return "Try 5W: “Who are you meeting?” “What is your appointment about?” “What time is it?”";
      case "control_q": return "Control questions: “What is your date of birth?” “What is your nationality?”";
      case "search_announce": return "Try: “We are going to search you.”";
      case "illegal_items": return "Try: “Do you have any illegal items?”";
      case "clarify_illegal": return "Try: “Do you have any drugs, weapons or alcohol?”";
      case "direction": return "Try: “Let’s go to the person search.”";
      default: return "";
    }
  }

  // ---------- Intents ----------
  const INTENTS = (() => {
    const rx = (s) => new RegExp(s, "i");
    return [
      { key:"greet", rx: rx("\\b(hi|hello|good\\s*(morning|afternoon|evening))\\b") },
      { key:"help_open", rx: rx("\\b(how\\s+can\\s+i\\s+help(\\s+you(\\s+today)?)?|what\\s+do\\s+you\\s+need|how\\s+may\\s+i\\s+help)\\b") },
      { key:"spell_last_name", rx: rx("\\b(spell\\s+(your\\s+)?(last\\s+name|surname)|how\\s+do\\s+you\\s+spell\\s+(your\\s+)?(last\\s+name|surname)|can\\s+you\\s+spell\\s+(your\\s+)?(last\\s+name|surname))\\b") },
      { key:"ask_name", rx: rx("\\b(what\\s+is\\s+your\\s+name|what\\'s\\s+your\\s+name|may\\s+i\\s+have\\s+your\\s+name|your\\s+name\\s+please)\\b") },
      { key:"ask_mood", rx: rx("\\b(how\\s+are\\s+you\\s+feeling\\s+today|are\\s+you\\s+okay|how\\s+do\\s+you\\s+feel)\\b") },
      { key:"purpose", rx: rx("\\b(what\\s+is\\s+the\\s+purpose|why\\s+are\\s+you\\s+here|where\\s+are\\s+you\\s+going|what\\s+is\\s+the\\s+reason\\s+for\\s+your\\s+visit|what\\s+s\\s+the\\s+reason\\s+for\\s+your\\s+visit|whats\\s+the\\s+reason\\s+for\\s+your\\s+visit)\\b") },
      { key:"who_meeting", rx: rx("\b(who\s+are\s+you\s+(meeting|seeing|talking\s+to)(\s+with)?|who\s+are\s+you\s+meeting\s+with|who\s+do\s+you\s+have\s+an\s+(appointment|meeting)\s+with|who\s+do\s+you\s+have\s+(an\s+)?appointment\s+with|who\s+is\s+your\s+(appointment|meeting)\s+with|who\s+is\s+it\s+with|who\s+is\s+your\s+(host|contact)|who\s+are\s+you\s+here\s+to\s+see)\b") },
      { key:"time_meeting", rx: rx("\b(what\s+time\s+is\s+(the\s+)?(appointment|meeting)|what\s+time\s+is\s+your\s+(appointment|meeting)|when\s+is\s+(the\s+)?(appointment|meeting)|when\s+is\s+your\s+(appointment|meeting)|when\s+are\s+you\s+(expected|due)|what\s+time\s+are\s+you\s+expected)\b") },
      { key:"about_meeting", rx: rx("\b(what\s+is\s+(the\s+)?(appointment|meeting)\s+about|what\s+is\s+this\s+(appointment|meeting)\s+about|what\s+is\s+the\s+purpose\s+of\s+the\s+(appointment|meeting)|can\s+you\s+tell\s+me\s+(a\s+little\s+bit\s+more|more)\s+about\s+the\s+(appointment|meeting)|tell\s+me\s+more\s+about\s+the\s+(appointment|meeting)|what\s+are\s+you\s+delivering|what\s+is\s+inside|what\s+is\s+the\s+delivery)\b") },
      { key:"ask_id", rx: rx("\\b(do\\s+you\\s+have\\s+(an\\s+)?id|have\\s+you\\s+got\\s+id|can\\s+i\\s+see\\s+your\\s+id|may\\s+i\\s+see\\s+your\\s+id|show\\s+me\\s+your\\s+id|id\\s+please|identification\\s+please|identity\\s+card|passport)\\b") },
      { key:"dob_q", rx: rx("\\b(date\\s+of\\s+birth|dob|when\\s+were\\s+you\\s+born)\\b") },
      { key:"nat_q", rx: rx("\\b(nationality|what\\s+is\\s+your\\s+nationality|where\\s+are\\s+you\\s+from)\\b") },
      { key:"contact_supervisor", rx: rx("\\b(i\\s+will\\s+contact\\s+my\\s+supervisor|i\\s+need\\s+to\\s+contact\\s+my\\s+supervisor|let\\s+me\\s+call\\s+my\\s+supervisor)\\b") },
      { key:"confront_nat", rx: rx("\\b(your\\s+nationality\\s+(on\\s+the\\s+)?(id|passport)\\s+(is|says)|(id|passport)\\s+says\\s+you\\s+are\\s+(dutch|german|from)|but\\s+your\\s+(id|passport)\\s+says\\s+(dutch|german)|that\\s+doesn\\x27t\\s+match\\s+(your\\s+)?nationality|nationality\\s+mismatch|on\\s+your\\s+(id|passport)\\s+it\\s+says\\s+(dutch|netherlands|german)|it\\s+says\\s+(dutch|netherlands|german)\\s+here)\\b") },
      { key:"confront_dob", rx: rx("\\b(date\\s+of\\s+birth\\s+(on\\s+the\\s+)?(id|passport)\\s+(is|says)|(id|passport)\\s+says\\s+your\\s+date\\s+of\\s+birth|but\\s+your\\s+(id|passport)\\s+says\\s+you\\x27re\\s+born|that\\s+doesn\\x27t\\s+match\\s+(your\\s+)?(dob|date\\s+of\\s+birth)|(dob|date\\s+of\\s+birth)\\s+mismatch|on\\s+your\\s+(id|passport)\\s+it\\s+says\\s+you\\x27re\\s+born)\\b") },
      { key:"confront_id", rx: rx("\\b(your\\s+(id|passport)\\s+says|it\\s+says\\s+here|but\\s+your\\s+(id|passport)\\s+says|on\\s+your\\s+(id|passport)\\s+it\\s+says|that\\s+doesn\\x27t\\s+match|that\\s+doesn\\x27t\\s+line\\s+up|mismatch)\\b") },
      { key:"return_id", rx: rx("\\b(here\\'?s\\s+your\\s+id\\s+back|return\\s+your\\s+id|you\\s+can\\s+have\\s+your\\s+id\\s+back)\\b") },
                  { key:"we_search_you", rx: rx("\\b(we\\s+are\\s+going\\s+to\\s+search\\s+you|we\\s+will\\s+search\\s+you|i\\s+am\\s+going\\s+to\\s+search\\s+you)\\b") },
      { key:"illegal_items", rx: rx("\\b(illegal\\s+items|contraband|prohibited\\s+items|anything\\s+illegal|do\\s+you\\s+have\\s+illegal)\\b") },
      { key:"illegal_clarify", rx: rx("\\b(weapons|drugs|alcohol|knife|gun)\\b") },
      { key:"everyone_searched", rx: rx("\\b(everyone\\s+is\\s+searched|everyone\\s+gets\\s+searched|we\\s+search\\s+everyone|routine\\s+search)\\b") },
      { key:"why_searched", rx: rx("\\b(why\\s+am\\s+i\\s+searched|why\\s+do\\s+you\\s+search\\s+me|why\\s+me)\\b") },
      { key:"due_threat", rx: rx("\\b(due\\s+to\\s+(an?\\s+)?(increased\\s+threat|heightened\\s+security|security\\s+reasons|a\\s+threat)|heightened\\s+security)\\b") },
      { key:"go_person_search", rx: rx("\\b(let\\'?s\\s+go\\s+to\\s+the\\s+person\\s+search|go\\s+to\\s+person\\s+search|to\\s+the\\s+search\\s+area|follow\\s+me\\s+to\\s+the\\s+search)\\b") },
      { key:"deny", rx: rx("\\b(deny\\s+entrance|you\\s+cannot\\s+enter|access\\s+denied|you\\s+are\\s+not\\s+allowed\\s+to\\s+enter)\\b") },
    ];
  })();

  function detectIntent(text){
    const stored = matchStoredPhraseIntent(text);
    if (stored) return stored;

    for (const it of INTENTS){
      if (it.rx.test(text)) return it.key;
    }
    return "unknown";
  }

  // ---------- Dialogue ----------
  function handleStudent(text){
    const clean = (text || "").trim();
    if (!clean) return;

        setStudent(clean);
const intent = detectIntent(clean);

    if (intent === "return_id"){ hideId(); setVisitor("Thank you."); return; }
    if (intent === "deny"){ setVisitor("Why? I need to get in."); return; }
    if (intent === "contact_supervisor"){ openSupervisorModal(); return; }

    if (intent === "ask_name"){
      setVisitor(`My name is ${ID_DATA.name}.`);
      state.misses = 0; hideHint();
      return;
    }

    switch(state.stage){
      case "start":
      case "greet":
        if (intent === "greet" || intent === "help_open"){
          state.stage = "help";
          state.misses = 0;
          hideHint();
          setVisitor(visitorLine("visitor.open.need_help", ["Can you help me?"]), currentMood.line);
        } else miss("Try greeting first.");
        break;

      case "help":
        if (intent === "help_open"){
          state.stage = "purpose";
          state.misses = 0;
          hideHint();
          setVisitor(visitorLine("visitor.open.need_base", ["I need to get onto the base."]), currentMood.line);
          if (state && state.facts) state.facts.why = "I need to get onto the base.";
        } else if (intent === "greet"){
          setVisitor(visitorLine("visitor.greeting.hello", ["Hello."]), currentMood.line);
        } else miss();
        break;

      case "purpose":
        if (intent === "ask_mood"){ const r = moodReply(); setVisitor(r); if (state && state.facts) state.facts.mood = r; state.misses=0; hideHint(); break; }
        if (intent === "who_meeting"){ const r = pickVisitorResponse("who_meeting", [maybeInconsistent("I am meeting Sergeant de Vries.", "I am meeting Mr. de Vries."), "I am meeting Sergeant de Vries.", "I am meeting the duty officer."]); setVisitor(r); if (state && state.facts) state.facts.who = r; state.misses=0; hideHint(); break; }
        if (intent === "time_meeting"){ const t = getMeetingTimeHHMM(); const r = `At ${t}.`; setVisitor(r); state.misses=0; hideHint(); break; }
        if (intent === "about_meeting"){ const r = pickVisitorResponse("about_meeting", ["It is a delivery for the workshop. Tools and spare parts.", "It is an inspection meeting.", "It is a meeting about maintenance paperwork."]); setVisitor(r); if (state && state.facts) state.facts.about = r; state.misses=0; hideHint(); break; }
        if (intent === "confront_nat"){
          setVisitor(visitorLine("visitor.excuse.nationality", ["I misspoke. The passport is correct."]));
          state.misses=0; hideHint(); break;
        }
        if (intent === "confront_dob"){
          setVisitor(visitorLine("visitor.excuse.dob", ["I said it wrong. The ID date is correct."]));
          state.misses=0; hideHint(); break;
        }
        if (intent === "confront_id"){
          const t = clean.toLowerCase();
          if (hasMismatch("nat") || /nationality|dutch|german|netherlands|from\b/.test(t)){
            setVisitor(visitorLine("visitor.excuse.nationality", ["I misspoke. The passport is correct."]));
            state.misses=0; hideHint(); break;
          }
          if (hasMismatch("dob") || /date\s+of\s+birth|dob|born/.test(t)){
            setVisitor(visitorLine("visitor.excuse.dob", ["I said it wrong. The ID date is correct."]));
            state.misses=0; hideHint(); break;
          }
          setVisitor("Sorry—what do you mean?");
          state.misses=0; hideHint(); break;
        }

        
        if (intent === "ask_id"){
          state.stage = "control_q"; state.misses=0; hideHint();
          setVisitor("Sure. Here you go.");
          showId();
          break;
        }
        if (intent === "purpose"){ const r = pickVisitorResponse("purpose", ["I have an appointment on base.", "I am here for an appointment.", "I need access for a meeting."]); setVisitor(r); if (state && state.facts) state.facts.why = r; state.misses=0; hideHint(); break; }
        if (intent === "has_appointment"){ const r = pickResponse("visitor.appointment.yes", ["Yes, I have an appointment.", "Yes.", "Yes, I do."]); setVisitor(r); if (state && state.facts) state.facts.appt = "yes"; state.misses=0; hideHint(); break; }
        miss();
        break;

      case "control_q":
        if (intent === "dob_q"){ setVisitor(maybeInconsistent(`My date of birth is ${ID_DATA.dob}.`, `My date of birth is 22 Mar 1982.`)); state.misses=0; hideHint(); break; }
        if (intent === "spell_last_name"){ setVisitor(spellLastName()); state.misses=0; hideHint(); break; }
        if (intent === "nat_q"){ const truth = `My nationality is ${ID_DATA.nat}.`; const lie = "My nationality is German."; const out = maybeInconsistent(truth, lie); setVisitor(out); try{ state.facts = state.facts || {}; state.facts.nat = out.replace(/.*nationality is\s+/i,"").replace(/\.$/,""); }catch{} if (out !== truth){ noteMismatch("nat", ID_DATA.nat, (state.facts && state.facts.nat) ? state.facts.nat : ""); } state.misses=0; hideHint(); break; }
        if (intent === "ask_id"){ setVisitor("I already gave you my ID."); showId(); state.misses=0; hideHint(); break; }
        if (intent === "confront_nat"){
          setVisitor(visitorLine("visitor.excuse.nationality", ["I misspoke. The passport is correct."]));
          state.misses=0; hideHint(); break;
        }
        if (intent === "confront_dob"){
          setVisitor(visitorLine("visitor.excuse.dob", ["I said it wrong. The ID date is correct."]));
          state.misses=0; hideHint(); break;
        }
        if (intent === "confront_id"){
          const t = clean.toLowerCase();
          if (hasMismatch("nat") || /nationality|dutch|german|netherlands|from\b/.test(t)){
            setVisitor(visitorLine("visitor.excuse.nationality", ["I misspoke. The passport is correct."]));
            state.misses=0; hideHint(); break;
          }
          if (hasMismatch("dob") || /date\s+of\s+birth|dob|born/.test(t)){
            setVisitor(visitorLine("visitor.excuse.dob", ["I said it wrong. The ID date is correct."]));
            state.misses=0; hideHint(); break;
          }
          setVisitor("Sorry—what do you mean?");
          state.misses=0; hideHint(); break;
        }

        
        miss("Try a control question (DOB / nationality), or return the ID.");
        break;


      case "search_announce":
        if (intent === "we_search_you"){
          state.stage = "why_searched";
          state.misses = 0; hideHint();
          setVisitor(visitorLine("visitor.search.why", ["Why am I searched?", "Why are you searching me?", "Why do you need to search me?"]));
          break;
        }
        miss('Try: “We are going to search you.”');
        break;

      case "why_searched":
        if (intent === "everyone_searched" || intent === "due_threat"){
          state.stage = "illegal_items";
          state.misses = 0; hideHint();
          setVisitor(visitorLine("visitor.generic.ok", ["Okay."]));
          break;
        }
        miss('Try: “Everyone is searched due to an increased threat / heightened security.”');
        break;

      case "illegal_items":
        if (intent === "illegal_items"){
          state.stage = "clarify_illegal";
          state.misses = 0; hideHint();
          setVisitor(visitorLine("visitor.illegal.what_is", ["What are illegal items?", "What do you mean by illegal items?", "What counts as illegal items?"]));
          break;
        }
        miss('Try: “Do you have any illegal items?”');
        break;

      case "clarify_illegal": {
        // Student must clarify by covering weapons, drugs, and alcohol (order doesn't matter)
        const t = (clean || "").toLowerCase();
        if (t.includes("weapon") || t.includes("knife") || t.includes("gun")) state.contraband.weapons = true;
        if (t.includes("drug")) state.contraband.drugs = true;
        if (t.includes("alcohol") || t.includes("beer") || t.includes("wine")) state.contraband.alcohol = true;

        const missing = [];
        if (!state.contraband.weapons) missing.push("weapons");
        if (!state.contraband.drugs) missing.push("drugs");
        if (!state.contraband.alcohol) missing.push("alcohol");

        if (intent === "illegal_clarify"){
          if (missing.length){
            state.misses = 0; hideHint();
            setVisitor(`Anything about ${missing.join(", ")}?`);
          } else {
            state.stage = "direction";
            state.misses = 0; hideHint();
            setVisitor(visitorLine("visitor.illegal.no_where", ["No. I do not. Tell me where to go.", "No. I don’t have anything. Where do I go?", "No. Nothing like that. Where should I go?"]));
          }
          break;
        }

        miss('Clarify: “Do you have any drugs, weapons or alcohol?”');
        break;
      }

      case "direction":
        if (intent === "go_person_search"){
          state.misses = 0; hideHint();
          setVisitor(visitorLine("visitor.generic.ok", ["Okay."]));
          setActiveScreen("personSearch");
          break;
        }
        miss("Try: “Let's go to the person search.”");
        break;

      default:
        miss();
    }
  }

  function miss(custom){
    state.misses += 1;
    maybeHint();
    if (custom) showHint(custom);
  }

  function moodReply(){
    switch(currentMood.key){
      case "nervous": return "I feel a bit nervous, to be honest.";
      case "relaxed": return "I feel fine. Pretty relaxed.";
      case "angry":   return "I’m annoyed. I’ve been waiting.";
      default:        return "I’m okay.";
    }
  }

  

  function getLastName(){
    const full = (ID_DATA && ID_DATA.name) ? String(ID_DATA.name) : "Miller";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    return parts.length ? parts[parts.length-1] : full;
  }

  function spellLastName(){
    const ln = getLastName();
    const letters = ln.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
    return letters.length ? letters.join("-") : ln.toUpperCase();
  }

  

  function pad2(n){ return String(n).padStart(2,"0"); }

  // Meeting time logic:
  // When asked "What time is the meeting/appointment?", we look at the system clock and add a random offset.
  // Offset is chosen once per run (17..23 minutes) so the time stays consistent for follow-up questions.
  function getMeetingTimeHHMM(){
    try{
      state.facts = state.facts || {};
      if (state.facts.meetingTime && /^\d{2}:\d{2}$/.test(state.facts.meetingTime)) return state.facts.meetingTime;
      const now = new Date();
      const offsetMin = Math.floor(Math.random() * (23 - 17 + 1)) + 17; // 17..23
      const dt = new Date(now.getTime() + offsetMin * 60 * 1000);
      const hhmm = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
      state.facts.meetingTime = hhmm;
      state.facts.meetingOffsetMin = offsetMin;
      return hhmm;
    }catch{
      // fallback deterministic: +23 minutes
      const now = new Date();
      const dt = new Date(now.getTime() + 23 * 60 * 1000);
      return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    }
  }

function noteMismatch(type, expected, said){
    try{
      state.mismatch = state.mismatch || {};
      state.mismatch[type] = { expected, said, ts: Date.now() };
    }catch{}
  }
  function hasMismatch(type){
    try{
      return !!(state && state.mismatch && state.mismatch[type] && state.mismatch[type].expected && state.mismatch[type].said && state.mismatch[type].expected !== state.mismatch[type].said);
    }catch{ return false; }
  }

function maybeInconsistent(a, b){
    return Math.random() < currentMood.liarBias ? b : a;
  }

  // ---------- Reset training (does NOT bypass login) ----------
  function resetTrainingOnly(){
    try{ chatState.items = []; }catch{}
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    moodLine.textContent = currentMood.line;

    state = { stage:"start", misses:0, idVisible:false, facts: { mood:"", why:"", appt:"yes", who:"", about:"", time:"" }, contraband: { weapons:false, drugs:false, alcohol:false } };

    setVisitor(visitorLine("visitor.greeting.hello", ["Hello."]));
    setStudent("Hold-to-talk or type below.");
    hideHint();
    hideId();

    const fresh = makeRandomId();
    Object.assign(ID_DATA, fresh);
    syncAvatarAndIdPhoto();
  }

  // ---------- Voice: write into input, send on release ----------
  let recognition = null;
  let isRecognizing = false;
  let interim = "";

  function setupSpeech(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR){
      voiceStatus.textContent = "Voice: not supported";
      holdToTalk.disabled = true;
      holdToTalk.title = "SpeechRecognition not supported in this browser.";
      return;
    }
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true; // keep, but we don't show interim text in the input
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      interim = "";
      voiceStatus.textContent = "Voice: listening…";
    };
  window.VEVA_STATE = state;

    recognition.onresult = (event) => {
      // Only show FINAL recognized text (no interim "stuttering" in the input bar)
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++){
        const res = event.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalText += t;
      }
      const clean = (finalText || "").trim();
      if (clean) textInput.value = clean;
    };

    recognition.onerror = () => {
      voiceStatus.textContent = "Voice: error";
      isRecognizing = false;
    };

    recognition.onend = () => {
      voiceStatus.textContent = "Voice: ready";
      isRecognizing = false;

      const spoken = (textInput.value || "").trim();
      if (VOICE_AUTOSEND && spoken){
        handleStudent(spoken);
        textInput.value = "";
      }
    };
  }

  function startListen(){
    if (!recognition || isRecognizing) return;
    try { recognition.start(); } catch {}
  }
  function stopListen(){
    if (!recognition || !isRecognizing) return;
    try { recognition.stop(); } catch {}
  }

  // ---------- Login ----------
  function tryStart(){
    const surname = (studentSurnameInput.value || "").trim();
    const group = studentGroupSel.value;
    const difficulty = studentDifficultySel.value || "standard";

    if (!surname || !group){
      loginError.style.display = "block";
      return;
    }
    loginError.style.display = "none";

    session = { surname, group, difficulty };
    saveStudentPrefill(session);
    updateStudentPill();

    resetTrainingOnly();
    setActiveScreen("training");
    textInput.focus();
  }

  // ---------- Events ----------
  btnStartTraining.addEventListener("click", tryStart);
  studentSurnameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryStart(); });

  btnSend.addEventListener("click", () => {
    handleStudent(textInput.value);
    textInput.value = "";
    textInput.focus();
  });
  textInput.addEventListener("keydown", (e) => { if (e.key === "Enter") btnSend.click(); });

  holdToTalk.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk.addEventListener("pointercancel", stopListen);
  holdToTalk.addEventListener("pointerleave", () => stopListen());

  btnReturnId.addEventListener("click", () => { hideId(); setVisitor("Thank you."); });

  btnReset.addEventListener("click", () => {
    setActiveScreen("login");
    hideId();
    hideHint();
    updateStudentPill();
  });

  btnPersonSearch.addEventListener("click", () => setActiveScreen("personSearch"));
  btnReturn.addEventListener("click", () => setActiveScreen("return"));
  btnDeny.addEventListener("click", () => { setVisitor("Why? I need to get in."); });

  btnBackToTraining?.addEventListener("click", () => setActiveScreen("training"));
  btnBackReturn?.addEventListener("click", () => setActiveScreen("training"));


  // ---------- Question bank events ----------
  qbInsertBtn?.addEventListener("click", () => {
    const key = qbIntent?.value;
    if (!key) return;
    const ex = QB_EXAMPLES[key] || [];
    if (!ex.length) return;
    const pick = ex[Math.floor(Math.random() * ex.length)];
    textInput.value = pick;
    textInput.focus();
  });

  qbAddBtn?.addEventListener("click", () => {
    const key = qbIntent?.value;
    const phrase = qbPhrase?.value || textInput.value;
    const ok = addIntentPhrase(key, phrase);
    if (ok){
      qbPhrase.value = "";
      showHint("Phrase added to recognition.");
      setTimeout(() => hideHint(), 900);
    } else {
      showHint("Select a category and type a phrase first.");
      setTimeout(() => hideHint(), 1200);
    }
  });

  qbAddRespBtn?.addEventListener("click", () => {
    const key = (qbRespKey?.value || qbIntent?.value || "").trim();
    const response = qbResponse?.value || "";
    const ok = addIntentResponse(key, response);
if (ok){
      qbResponse.value = "";
      showHint("Response added.");
      refreshLiveJSON();
      setTimeout(() => hideHint(), 900);
    } else {
      showHint("Select a category and type a response first.");
      setTimeout(() => hideHint(), 1200);
    }
  });


    qbLoadSeedBtn?.addEventListener("click", async () => {
    const ok = await loadSeedPhrases();
    showHint(ok ? "Seed phrases loaded." : "No seed file found (or invalid).");
    setTimeout(() => hideHint(), 1100);
  });

  qbCopyJsonBtn?.addEventListener("click", async () => {
    const txt = buildLiveSeedJSON();
    refreshLiveJSON();
    const ok = await copyToClipboard(txt);
    showHint(ok ? "JSON copied." : "Copy failed.");
    setTimeout(() => hideHint(), 900);
  });


qbExportBtn?.addEventListener("click", () => exportIntentPhrases());

  qbImportBtn?.addEventListener("click", () => {
    qbImportFile?.click();
  });

  qbImportFile?.addEventListener("change", (e) => {
    const file = e.target?.files?.[0];
    importIntentPhrasesFile(file);
    // reset so the same file can be selected again
    e.target.value = "";
  });

  qbAddCatBtn?.addEventListener("click", () => {
    const label = (qbCatLabel?.value || "").trim();
    const keyRaw = (qbCatKey?.value || "").trim();
    const key = normalizeCatKey(keyRaw);
    if (!label || !key){
      showHint("Type a label and a key first.");
      setTimeout(() => hideHint(), 1200);
      return;
    }
    const arr = loadCategories();
    if (!arr.some(x => Array.isArray(x) && normalizeCatKey(x[0]) === key)){
      arr.push([key, label]);
      saveCategories(arr);
    }
    qbCatLabel.value = "";
    qbCatKey.value = "";
    refreshCategoryDropdown();
  refreshLiveJSON();
    refreshLiveJSON();
    showHint("Category added.");
    setTimeout(() => hideHint(), 900);
  });

  qbDelCatBtn?.addEventListener("click", () => {
    const key = (qbIntent?.value || "").trim();
    if (!key){
      showHint("Select a category first.");
      setTimeout(() => hideHint(), 1100);
      return;
    }
    // protect built-in categories
    if (BUILTIN_CATEGORIES.some(([k]) => k === key)){
      showHint("Built-in categories cannot be deleted.");
      setTimeout(() => hideHint(), 1300);
      return;
    }
    const ok = confirm(`Delete category "${key}"? (phrases/responses for this key will remain in storage until you clear them)`);
    if (!ok) return;
    const did = deleteCategory(key);
    if (did){
      refreshCategoryDropdown();
  refreshLiveJSON();
      showHint("Category deleted.");
      setTimeout(() => hideHint(), 900);
    } else {
      showHint("Nothing deleted.");
      setTimeout(() => hideHint(), 900);
    }
  });





  // ---------- Supervisor modal events ----------
  btnCloseSupervisor?.addEventListener("click", closeSupervisorModal);
  supervisorModal?.addEventListener("click", (e) => {
    if (e.target === supervisorModal) closeSupervisorModal();
  });
  btnSupervisorCheck?.addEventListener("click", runSupervisorChecks);
  btnReturnToVisitor?.addEventListener("click", () => {
    runSupervisorChecks();
    closeSupervisorModal();
    // Return ID and continue to contraband questions
    hideId();
    setStudent("Okay. Everything checks out. Here is your ID back.");
    setVisitor(visitorLine("visitor.generic.thanks", ["Thank you."]));
    state.stage = "search_announce";
    state.contraband = { weapons:false, drugs:false, alcohol:false };
    state.misses = 0;
    hideHint();
  });


  // Extra sidebar buttons
  btnSignIn?.addEventListener("click", () => {
    setStudent("Let's go to the sign-in office.");
    setVisitor(visitorLine("visitor.generic.ok", ["Okay."]), currentMood.line);
  });

  btnNewScenario?.addEventListener("click", () => {
    startNewScenario();
  });

// ---------- Boot ----------
  const pre = loadStudentPrefill();
  if (pre){
    if (pre.surname) studentSurnameInput.value = pre.surname;
    if (pre.group) studentGroupSel.value = pre.group;
    if (pre.difficulty) studentDifficultySel.value = pre.difficulty;
  }

  // Load seed phrases from repo file (non-blocking)

  hideId();                // enforce hidden on boot
  updateStudentPill();
  setupSpeech();
  syncAvatarAndIdPhoto();
  setActiveScreen("login");
})();


  // --- Scenario reset ---
  function startNewScenario(){
    try{ supervisorModal && (supervisorModal.hidden = true); }catch{}
    try{ chatState.items = []; }catch{}

    // New mood + new ID
    try{
      currentMood = MOODS[randInt(0, MOODS.length - 1)];
      moodLine.textContent = currentMood.line;
      const fresh = makeRandomId();
      Object.assign(ID_DATA, fresh);
      syncAvatarAndIdPhoto();
    }catch{}

    // Reset training state
    state = { stage:"start", misses:0, idVisible:false, facts: { mood:"", why:"", appt:"yes", who:"", about:"", time:"" }, contraband: { weapons:false, drugs:false, alcohol:false } };

    hideId();
    hideHint();
    setVisitor(visitorLine("visitor.greeting.hello", ["Hello."]), currentMood.line);
    setStudent("Hold-to-talk or type below.");
  }
