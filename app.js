// app.js
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // Build / config
  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const ASSET_BASE = CFG.assetBase || "assets/photos";
  const HEADSHOT_PREFIX = CFG.headshotPrefix || "headshot_";
  const HEADSHOT_COUNT = Number(CFG.headshotCount || 10);
  const VOICE_AUTOSEND = CFG.voiceAutoSend !== false;

  // UI
  const versionPill = $("#versionPill");
  const studentPill = $("#studentPill");
  const voiceStatus = $("#voiceStatus");

  const loginModal = $("#loginModal");
  const studentSurnameInput = $("#studentSurname");
  const studentGroupSel = $("#studentGroup");
  const studentDifficultySel = $("#studentDifficulty");
  const btnStartTraining = $("#btnStartTraining");
  const loginError = $("#loginError");

  const btnReset = $("#btnReset");
  const btnReturn = $("#btnReturn");
  const btnPersonSearch = $("#btnPersonSearch");
  const btnSignIn = $("#btnSignIn");
  const btnDeny = $("#btnDeny");
  const btnNewScenario = $("#btnNewScenario");

  const holdToTalk = $("#holdToTalk");
  const textInput = $("#textInput");
  const btnSend = $("#btnSend");

  // ID UI
  const idCardWrap = $("#idCardWrap");
  const idSlotHint = $("#idSlotHint");
  const btnReturnId = $("#btnReturnId");
  const idPhoto = $("#idPhoto");
  const idName = $("#idName");
  const idDob = $("#idDob");
  const idNat = $("#idNat");
  const idNo = $("#idNo");
const hintBand = $("#hintBand");
  const hintBandText = $("#hintBandText");

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

  // Chat slots (4)
  const slotEls = [
    { row: $("#slot0"), av: $("#slot0Avatar"), txt: $("#slot0Text"), meta: $("#slot0Meta") },
    { row: $("#slot1"), av: $("#slot1Avatar"), txt: $("#slot1Text"), meta: $("#slot1Meta") },
    { row: $("#slot2"), av: $("#slot2Avatar"), txt: $("#slot2Text"), meta: $("#slot2Meta") },
    { row: $("#slot3"), av: $("#slot3Avatar"), txt: $("#slot3Text"), meta: $("#slot3Meta") },
    { row: $("#slot4"), av: $("#slot4Avatar"), txt: $("#slot4Text"), meta: $("#slot4Meta") },
    { row: $("#slot5"), av: $("#slot5Avatar"), txt: $("#slot5Text"), meta: $("#slot5Meta") },
  ];

  // Version banner
  const __assetVer = String(window.__ASSET_VER__ || "");
  const __assetShort = __assetVer ? __assetVer.slice(-6) : "";
  if (versionPill) versionPill.textContent = `v${BUILD.version}${__assetShort ? " · " + __assetShort : ""}`;
  document.title = `${BUILD.name} v${BUILD.version}${__assetShort ? " ("+__assetShort+")" : ""}`;
  console.info(
    `%c${BUILD.name} v${BUILD.version}`,
    "background:#161b22;color:#e6edf3;padding:6px 10px;border-radius:8px;font-weight:800;"
  );
  console.info("BUILD:", BUILD);
  console.info("CONFIG:", CFG);

  // ---------- Helpers ----------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pad2 = (n) => String(n).padStart(2, "0");

  function normalize(s){
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}: ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // ---------- Session ----------
  const STUDENT_KEY = "veva.student.v2";
  let session = { surname:"", group:"", difficulty:"standard" };

  function loadStudentPrefill(){
    try{ return JSON.parse(localStorage.getItem(STUDENT_KEY) || "null"); } catch { return null; }
  }
  function saveStudentPrefill(v){
    try{ localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); } catch {}
  }
  function updateStudentPill(){
    if (!session.surname || !session.group){
      studentPill.textContent = "Student: —";
      return;
    }
    const cap = (s) => (s||"").charAt(0).toUpperCase() + (s||"").slice(1);
    studentPill.textContent = `Student: ${session.surname} | Group: ${session.group} | ${cap(session.difficulty)}`;
  }

  // ---------- ID + Avatar (1:1) ----------
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

  let ID_DATA = makeRandomId();

  function syncVisitorAvatars(){
    // visitor uses same headshot in all visitor slots + ID card
    for (const i of [0,2]){
      const el = slotEls[i]?.av;
      if (el) el.src = ID_DATA.photoSrc;
    }
    if (idPhoto) idPhoto.src = ID_DATA.photoSrc;
  }

  function showId(){
    if (!idCardWrap) return;
    idName.textContent = state.visitor.name;
    idDob.textContent  = state.visitor.dob;
    idNat.textContent  = state.visitor.nat;
    idNo.textContent   = state.visitor.idNo;
    idPhoto.src = state.visitor.photoSrc;

    idCardWrap.hidden = false;
    state.idVisible = true;
    if (hintBand) hintBand.hidden = true;
  }

  function hideId(){
    if (idCardWrap) idCardWrap.hidden = true;
    state.idVisible = false;
    updateHintBand(true);
  }

  // ---------- Mood ----------
  const MOODS = [
    { key:"relaxed",  line:"The visitor looks relaxed.",  liarBias:0.08 },
    { key:"neutral",  line:"The visitor looks neutral.",  liarBias:0.12 },
    { key:"mixed",    line:"The visitor looks a bit uneasy.", liarBias:0.22 },
    { key:"nervous",  line:"The visitor looks nervous.",  liarBias:0.35 },
    { key:"irritated",line:"The visitor looks irritated.",liarBias:0.28 }
  ];
  let currentMood = MOODS[1];

  // ---------- Chat ladder ----------
  // Keep last 4 messages (V,S,V,S). Oldest 2 are faded via CSS.
  
  let history = []; // { side:'visitor'|'student', text:'', meta:'' }
  // ---------- Hint band ----------
  function shouldShowHints(){
    return (session?.difficulty || "standard") !== "advanced";
  }

  function setHintText(t){
    if (!hintBandText) return;
    hintBandText.textContent = t || "";
  }

  function nudge(t){
    state.misses = (state.misses || 0) + 1;
    const diff = (session?.difficulty || "standard");
    const canShow = diff === "basic" || (diff === "standard" && state.misses >= 2);
    if (!shouldShowHints() || state?.idVisible || !canShow) return;
    if (hintBand) hintBand.hidden = false;
    setHintText(t || getNextHint());
  }

  function updateHintBand(force=false){
    if (!hintBand) return;
    if (!shouldShowHints()){
      hintBand.hidden = true;
      return;
    }
    // In "standard" difficulty, show hints after a couple misses. In "basic", always show.
    const diff = (session?.difficulty || "standard");
    const canShow = force || diff === "basic" || (diff === "standard" && (state?.misses || 0) >= 2);

    if (state?.idVisible){
      hintBand.hidden = true;
      return;
    }

    if (!canShow){
      hintBand.hidden = true;
      return;
    }

    hintBand.hidden = false;
    setHintText(getNextHint());
  }

  function getNextHint(){
    // Fixed intake order requested by you:
    // 1) name, 2) purpose, 3) appointment, 4) who, 5) time, 6) about, then ID.
    const f = state?.facts || {};
    if (state?.stage === "greet") return 'Say: “Good morning. How can I help you?”';
    if (state?.stage === "help")  return 'Ask: “What do you need?”';

    if (!f.name) return 'Ask: “Who are you?”';
    if (!f.purpose) return 'Ask: “What are you doing here?”';
    if (!f.appt) return 'Ask: “Do you have an appointment?”';

    if (f.appt === "yes"){
      if (!f.who) return 'Ask: “With whom do you have an appointment?”';
      if (!f.time) return 'Ask: “What time is your appointment?”';
      if (!f.about) return 'Ask: “What is the appointment about?”';
    }

    if (!state?.idChecked) return 'Ask: “Can I see your ID, please?”';
    return "Continue the procedure.";
  }

  function applySlotSide(rowEl, side){
    if (!rowEl) return;
    // Visitor should be LEFT, Student (soldier) should be RIGHT
    rowEl.classList.toggle("left", side === "visitor");
    rowEl.classList.toggle("right", side === "student");
  }

  function renderHistory(){
    // Newest message is stored first and shown at the TOP (slot0).
    const slice = history.slice(0, slotEls.length);

    slotEls.forEach((s, i) => {
      const msg = slice[i];
      if (!s?.row) return;

      if (!msg){
        s.row.hidden = true;
        if (s.txt) s.txt.textContent = "";
        if (s.meta) s.meta.textContent = "";
        return;
      }

      s.row.hidden = false;
      s.row.classList.toggle("visitor", msg.side === "visitor");
      s.row.classList.toggle("student", msg.side === "student");

      if (s.av){
        s.av.src = (msg.side === "visitor") ? (state?.visitor?.photoSrc || "") : "assets/photos/soldier.png";
      }
      if (s.txt) s.txt.textContent = msg.text || "";

      // Only show the mood line once (under the newest visitor bubble), otherwise keep it blank.
      if (s.meta){
        if (i === 0 && msg.side === "visitor" && state?.moodLine) s.meta.textContent = state.moodLine;
        else s.meta.textContent = "";
      }

      // Fade older messages a bit for readability (keep newest crisp).
      s.row.classList.toggle("fade", i >= 4);
    });
  }

function pushVisitor(text){
    history.unshift({ side:"visitor", text:String(text||"").trim() });
    history = history.slice(0, 6);
    state.misses = 0;
    renderHistory();
    updateHintBand();
  }

  function pushStudent(text){
    history.unshift({ side:"student", text:String(text||"").trim() });
    history = history.slice(0, 6);
    state.misses = 0;
    renderHistory();
    updateHintBand();
  }

  // ---------- Meeting time (system clock + 17..23 min) ----------
  function getMeetingTimeHHMM(){
    state.facts = state.facts || {};
    if (state.facts.meetingTime && /^\d{2}:\d{2}$/.test(state.facts.meetingTime)) return state.facts.meetingTime;
    const now = new Date();
    const offsetMin = randInt(17, 23);
    const dt = new Date(now.getTime() + offsetMin * 60 * 1000);
    const hhmm = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    state.facts.meetingTime = hhmm;
    state.facts.meetingOffsetMin = offsetMin;
    return hhmm;
  }

  // ---------- Visitor lines (mood-aware, at least 5 variants per block) ----------
  function pick(arr){
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function moodPool(pools){
    const k = currentMood.key;
    if (k === "relaxed") return pools.relaxed || pools.neutral || pools.nervous;
    if (k === "neutral") return pools.neutral || pools.relaxed || pools.nervous;
    if (k === "mixed") return pools.mixed || pools.neutral || pools.nervous;
    if (k === "nervous") return pools.nervous || pools.mixed || pools.neutral;
    return pools.neutral || pools.mixed || pools.nervous;
  }

  function visitorLine(key){
    const pools = VISITOR[key];
    if (!pools) return "Okay.";
    return pick(moodPool(pools));
  }

  function maybeLie(truth, lie){
    return (Math.random() < currentMood.liarBias) ? lie : truth;
  }

  const VISITOR = {
    greeting: {
      relaxed: ["Hello.", "Hi there.", "Good morning.", "Good afternoon.", "Evening."],
      neutral: ["Hello.", "Hi.", "Good morning.", "Hello.", "Hi there."],
      mixed:   ["Hello…", "Uh, hello.", "Hi.", "Hello.", "Good… morning."],
      nervous: ["Hello.", "Yeah… hello.", "Hi.", "…Hello.", "Hello—"]
    },
    need_help: {
      relaxed: ["Can you help me?", "Excuse me, can you help me?", "Could you help me for a moment?", "Hi, can you help me please?", "Can you help me with something?"],
      neutral: ["Can you help me?", "Could you help me?", "Can you help me please?", "Excuse me—can you help?", "Can you help me?"],
      mixed:   ["I… need help.", "Can you help me?", "Could you help me?", "Can you help me—quickly?", "Can you help me, please?"],
      nervous: ["Can you help me or not?", "Look—can you help me?", "Can you just help me?", "I need help.", "Can you help me?"]
    },
    need_base: {
      relaxed: ["I need to get onto the base.", "I’m here for a meeting on base.", "I need access to the base.", "I’m supposed to be on base today.", "I’m here to enter the base."],
      neutral: ["I need to get onto the base.", "I’m here for a meeting.", "I need access.", "I’m expected on base.", "I’m here to go in."],
      mixed:   ["I need to get onto the base.", "I’m here for an appointment… on base.", "I need access, yeah.", "I’m supposed to be inside.", "I need to go in."],
      nervous: ["I… need to go in.", "I need to get onto the base.", "I’m supposed to be inside.", "I have to get in—okay?", "I need access."]
    },
    appointment_yes: {
      relaxed: ["Yes, I have an appointment.", "Yes, I do.", "Yes—my visit is scheduled.", "Yes, I’m expected.", "Yes, I have a meeting booked."],
      neutral: ["Yes.", "Yes, I do.", "Yes, I have an appointment.", "Yes—scheduled.", "Yes, I’m expected."],
      mixed:   ["Yes.", "Yeah, I have an appointment.", "I think so—yes.", "Yes… appointment.", "Yes, I’m supposed to."],
      nervous: ["Yes.", "Yes—appointment.", () => maybeLie("Yes.", "No… I mean yes."), "Yeah.", "Yes, okay?"]
    },
    who_meeting: {
      relaxed: ["I’m meeting Sergeant de Vries.", "I have an appointment with Sergeant de Vries.", "I’m here to see Sergeant de Vries.", "I’m meeting Captain van Dijk.", "I’m meeting the duty officer at reception."],
      neutral: ["I’m meeting Sergeant de Vries.", "I’m meeting Captain van Dijk.", "I’m meeting the duty officer.", "I’m here to see de Vries.", "I’m meeting my contact."],
      mixed:   [() => maybeLie("I’m meeting Sergeant de Vries.", "I’m meeting Mr. de Vries."), "I’m meeting Sergeant de Vries.", "I’m meeting… de Vries.", "I’m here to see my contact.", "I’m meeting Captain van Dijk."],
      nervous: [() => maybeLie("I’m meeting Sergeant de Vries.", "I’m meeting… uh… Mr. de Vries."), "De Vries.", "Sergeant de Vries.", "My contact… de Vries.", "I’m meeting the officer—de Vries."]
    },
    about_meeting: {
      relaxed: ["It’s a delivery for the workshop—tools and spare parts.", "It’s a maintenance meeting about paperwork.", "It’s an inspection meeting.", "It’s a briefing for contractor access.", "It’s about a scheduled service appointment."],
      neutral: ["It’s about a delivery.", "It’s an inspection.", "Maintenance paperwork.", "It’s about work on site.", "It’s about the workshop—delivery."],
      mixed:   ["It’s… a delivery.", "Work paperwork.", "It’s an inspection, I think.", "It’s about maintenance.", "It’s about workshop parts."],
      nervous: ["Delivery.", "Work stuff.", "Paperwork.", "I was told to come here.", "Just a meeting—okay?"]
    },
    nat_excuse: {
      relaxed: ["Oh—sorry. I misspoke. I’m Dutch, I just work in Germany.", "Right, yes—Dutch. I said German because I live there now.", "I have dual nationality, but this passport is Dutch.", "My apologies—Dutch. I got mixed up for a second.", "Dutch, yes. I’ve been travelling a lot, that’s why I said German."],
      neutral: ["Sorry, I misspoke. I’m Dutch.", "Dutch—yes. I answered too fast.", "I live in Germany but I’m Dutch. The passport is Dutch.", "Dutch. I got mixed up.", "I thought you meant where I live. I live in Germany. The passport is Dutch."],
      mixed:   ["Uh… I live in Germany, but I’m Dutch. That’s what the passport says.", "I said German because I work there. The passport is Dutch.", "It’s… complicated. I’m Dutch, but I’m registered in Germany.", "I mixed it up. Dutch—okay?", "Dutch. I just answered too fast."],
      nervous: ["I—look, I got confused. It’s Dutch, okay?", "I said the wrong thing. I’m Dutch. I’m just stressed.", "It’s Dutch. I… I misspoke, that’s all.", "I thought you meant where I live. I live in Germany. The passport is Dutch.", "Dutch. Can we move on, please?"]
    },
    search_why: {
      relaxed: ["Why am I being searched?", "Why do you need to search me?", "Is the search necessary?", "Why are you searching me today?", "What is the reason for the search?"],
      neutral: ["Why am I being searched?", "Why do you need to search me?", "Why are you searching me?", "Why me?", "What’s the reason for the search?"],
      mixed:   ["Why am I searched?", "Why are you searching me?", "Do you really need to search me?", "Why me?", "Why am I being searched?"],
      nervous: ["Why are you searching me?!", "Why am I searched?", "What’s going on?", "Why do you need to search me?", "Why?"]
    },
    illegal_what: {
      relaxed: ["What do you mean by illegal items?", "What counts as illegal items?", "What are illegal items exactly?", "Illegal items—like what?", "Can you explain what you mean by illegal items?"],
      neutral: ["What are illegal items?", "What do you mean?", "What counts as illegal?", "Illegal items—like what?", "Can you explain that?"],
      mixed:   ["Illegal items—what?", "Like what?", "What do you mean by illegal items?", "What counts as illegal items?", "What is illegal here?"],
      nervous: ["Illegal items? Like what?", "What do you mean—illegal items?", "What exactly do you mean?", "Illegal items?", "What are illegal items?"]
    },
    thanks: {
      relaxed: ["Thank you.", "Thanks.", "Thank you, officer.", "Alright, thanks.", "Thanks for your help."],
      neutral: ["Thanks.", "Thank you.", "Okay, thanks.", "Right… thanks.", "Thanks."],
      mixed:   ["Thanks.", "Okay… thanks.", "Thank you.", "Alright, thanks.", "Thanks."],
      nervous: ["Yeah… thanks.", "Thanks.", "Okay.", "Uh—thanks.", "Thanks."]
    },
    deny_why: {
      relaxed: ["Why are you denying me?", "Why can’t I enter?", "What changed?", "Why are you stopping me?", "Is there a problem?"],
      neutral: ["Why are you denying me?", "Why can’t I enter?", "What changed?", "Why are you stopping me?", "Why?"],
      mixed:   ["Why are you denying me?", "What changed?", "Why can’t I enter now?", "What’s the reason?", "Why?"],
      nervous: ["Why are you denying me?!", "What changed?", "Why can’t I enter?", "Why are you stopping me?", "What’s going on?"]
    }
  };

  // Ensure function pools return strings
  function resolveMaybeFn(v){
    return (typeof v === "function") ? String(v() || "").trim() : String(v || "").trim();
  }
  // Patch visitorLine to resolve functions
  function visitorLineResolved(key){
    const pools = VISITOR[key];
    if (!pools) return "Okay.";
    const raw = pick(moodPool(pools));
    const out = resolveMaybeFn(raw);
    return out || "Okay.";
  }

  // ---------- Intents ----------
  const INTENTS = [
    { key:"greet", rx:/\b(hi|hello|good\s*(morning|afternoon|evening))\b/i },
    { key:"help_open", rx:/\b(how\s+can\s+i\s+help(\s+you(\s+today)?)?|what\s+do\s+you\s+need|how\s+may\s+i\s+help)\b/i },
    { key:"purpose", rx:/\b(why\s+are\s+you\s+here|what\s+is\s+the\s+purpose\s+of\s+your\s+visit|what\s+is\s+the\s+reason\s+for\s+your\s+visit|what\'?s\s+the\s+reason\s+for\s+your\s+visit|whats\s+the\s+reason\s+for\s+your\s+visit)\b/i },
    { key:"has_appointment", rx:/\b(do\s+you\s+have\s+an\s+appointment|do\s+you\s+have\s+a\s+meeting|have\s+you\s+got\s+an\s+appointment|have\s+you\s+got\s+a\s+meeting|is\s+your\s+visit\s+scheduled)\b/i },
    { key:"who_meeting", rx:/\b(who\s+are\s+you\s+(meeting|seeing|talking\s+to)(\s+with)?|who\s+do\s+you\s+have\s+an?\s+(appointment|meeting)\s+with|with\s+whom\s+do\s+you\s+have\s+an\s+appointment)\b/i },
    { key:"time_meeting", rx:/\b(what\s+time\s+is\s+(the\s+)?(appointment|meeting)|when\s+is\s+(the\s+)?(appointment|meeting)|when\s+are\s+you\s+expected|what\s+time\s+are\s+you\s+expected)\b/i },
    { key:"about_meeting", rx:/\b(what\s+is\s+(the\s+)?(appointment|meeting)\s+about|can\s+you\s+tell\s+me\s+(a\s+little\s+bit\s+more|more)\s+about\s+the\s+(appointment|meeting)|tell\s+me\s+more\s+about\s+the\s+(appointment|meeting)|what\s+are\s+you\s+delivering)\b/i },
    { key:"ask_id", rx:/\b(do\s+you\s+have\s+(an\s+)?id|have\s+you\s+got\s+id|can\s+i\s+see\s+your\s+id|may\s+i\s+see\s+your\s+id|show\s+me\s+your\s+id|id\s+please|identity\s+card|passport)\b/i },
    { key:"dob_q", rx:/\b(date\s+of\s+birth|dob|when\s+were\s+you\s+born)\b/i },
    { key:"nat_q", rx:/\b(nationality|what\s+is\s+your\s+nationality|where\s+are\s+you\s+from)\b/i },
    { key:"spell_last_name", rx:/\b(spell\s+(your\s+)?(last\s+name|surname)|how\s+do\s+you\s+spell\s+(your\s+)?(last\s+name|surname))\b/i },
    { key:"contact_supervisor", rx:/\b(i\s+will\s+contact\s+my\s+(supervisor|boss)(\s+now)?|please\s+wait\s*,?\s*i\s+will\s+contact\s+my\s+(supervisor|boss)|let\s+me\s+call\s+my\s+(supervisor|boss))\b/i },
    { key:"confront_nat", rx:/\b(nationality\s+mismatch|doesn\'?t\s+match\s+your\s+nationality|but\s+your\s+(id|passport)\s+says\s+(dutch|german)|on\s+your\s+(id|passport)\s+it\s+says\s+(dutch|netherlands|german))\b/i },
    { key:"return_id", rx:/\b(here\'?s\s+your\s+id\s+back|return\s+your\s+id|you\s+can\s+have\s+your\s+id\s+back)\b/i },
    { key:"we_search_you", rx:/\b(we\s+are\s+going\s+to\s+search\s+you|you\s+will\s+be\s+searched|you\s+are\s+going\s+to\s+be\s+searched|we\s+will\s+search\s+you)\b/i },
    { key:"everyone_searched", rx:/\b(everyone\s+is\s+searched|we\s+search\s+everyone|routine\s+search)\b/i },
    { key:"due_threat", rx:/\b(due\s+to\s+(an?\s+)?(increased\s+threat|heightened\s+security|security\s+reasons)|heightened\s+security)\b/i },
    { key:"illegal_items", rx:/\b(do\s+you\s+have\s+any\s+illegal\s+items|anything\s+illegal|contraband|prohibited\s+items)\b/i },
    { key:"illegal_clarify", rx:/\b(weapons?|drugs?|alcohol|knife|gun)\b/i },
    { key:"go_person_search", rx:/\b(let\'?s\s+go\s+to\s+(the\s+)?person\s+search|go\s+to\s+person\s+search)\b/i }
  ];

  function detectIntent(text){
    const t = String(text||"");
    for (const it of INTENTS){
      if (it.rx.test(t)) return it.key;
    }
    return "unknown";
  }

  // ---------- State machine ----------
  let state = null;

  function resetScenario(){
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    ID_DATA = makeRandomId();
    history.length = 0;

    state = {
      stage: "start",
      misses: 0,
      idVisible: false,
      idChecked: false,
      moodLine: currentMood.line,
      visitor: { ...ID_DATA },
      facts: { name:"", purpose:"", appt:"", who:"", time:"", about:"" }
    };

    // Initial visitor line
    pushVisitor("Hello.");
    hideId();
    updateHintBand(true);
  }

function spellLastName(){
    const full = (ID_DATA && ID_DATA.name) ? String(ID_DATA.name) : "Miller";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    const ln = parts.length ? parts[parts.length-1] : full;
    const letters = ln.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
    return letters.length ? letters.join("-") : ln.toUpperCase();
  }

  function noteMismatchNat(){
    // If the student confronts, visitor gives an excuse.
    return visitorLineResolved("nat_excuse");
  }

  // ---------- Supervisor modal ----------
  function setStatus(el, ok){
    if (!el) return;
    el.classList.remove("ok","bad");
    if (ok === true){ el.textContent = "OK"; el.classList.add("ok"); }
    else if (ok === false){ el.textContent = "NO"; el.classList.add("bad"); }
    else { el.textContent = "—"; }
  }

  function openSupervisorModal(){
    if (!supervisorModal) return;
    supervisorModal.hidden = false;

    svWhy.value   = state.facts.why || "";
    svAppt.value  = state.facts.appt || "yes";
    svWho.value   = state.facts.who || "";
    svAbout.value = state.facts.about || "";
    svTime.value  = state.facts.meetingTime ? `At ${state.facts.meetingTime}.` : "";

    setStatus(svWhyStatus, null);
    setStatus(svApptStatus, null);
    setStatus(svWhoStatus, null);
    setStatus(svAboutStatus, null);
    setStatus(svTimeStatus, null);

    svNote.textContent = "Fill in the answers, run checks, then return to the visitor.";
  }

  function closeSupervisorModal(){
    if (!supervisorModal) return;
    supervisorModal.hidden = true;
  }

  function runSupervisorChecks(){
    const expected = {
      why: normalize(state.facts.why),
      appt: normalize(state.facts.appt),
      who: normalize(state.facts.who),
      about: normalize(state.facts.about),
      time: normalize(state.facts.meetingTime)
    };

    const entered = {
      why: normalize(svWhy.value),
      appt: normalize(svAppt.value),
      who: normalize(svWho.value),
      about: normalize(svAbout.value),
      time: normalize(svTime.value)
    };

    // Empty is allowed but should show NO (red cross) so user sees they forgot.
    const whyOk   = entered.why ? (expected.why ? entered.why.includes(expected.why) : true) : false;
    const apptOk  = entered.appt ? (expected.appt ? entered.appt === expected.appt : true) : false;
    const whoOk   = entered.who ? (expected.who ? entered.who.includes(expected.who) : true) : false;
    const aboutOk = entered.about ? (expected.about ? entered.about.includes(expected.about) : true) : false;
    const timeOk  = entered.time ? (expected.time ? entered.time.includes(expected.time) : true) : false;

    setStatus(svWhyStatus, whyOk);
    setStatus(svApptStatus, apptOk);
    setStatus(svWhoStatus, whoOk);
    setStatus(svAboutStatus, aboutOk);
    setStatus(svTimeStatus, timeOk);

    const mism = [];
    if (!whyOk) mism.push("why");
    if (!apptOk) mism.push("appointment");
    if (!whoOk) mism.push("who");
    if (!aboutOk) mism.push("about");
    if (!timeOk) mism.push("time");

    svNote.textContent = mism.length ? `Checks complete: mismatch(es) recorded: ${mism.join(", ")}.` : "Checks complete: everything matches.";
    console.info("Supervisor check", { expected, entered, mismatches: mism });
  }

  // ---------- Dialogue ----------
  function handleStudent(raw){
    const clean = String(raw || "").trim();
    if (!clean) return;

    pushStudent(clean);
    const intent = detectIntent(clean);
    // Track progress for hinting (intake order)
    if (intent === "ask_name") state.facts.name = state.visitor.name;
    if (intent === "purpose") state.facts.purpose = "known";
    if (intent === "has_appointment") state.facts.appt = "yes";
    if (intent === "who_meeting") state.facts.who = "known";
    if (intent === "time_meeting") state.facts.time = "known";
    if (intent === "about_meeting") state.facts.about = "known";
    if (intent === "ask_id") state.idChecked = true;

    // Deny flow
    if (state.stage === "deny_reason"){
      // Any non-empty reason ends it.
      pushVisitor("Okay. I understand.");
      endConversation();
      return;
    }

    if (intent === "contact_supervisor"){
      openSupervisorModal();
      return;
    }

    if (intent === "return_id"){
      hideId();
      pushVisitor(visitorLineResolved("thanks"));
      return;
    }

    if (intent === "confront_nat"){
      pushVisitor(noteMismatchNat());
      return;
    }

    // Stages
    switch(state.stage){
      case "start":
        if (intent === "greet"){
          state.stage = "help";
          pushVisitor(visitorLineResolved("need_help"));
          return;
        }
        // allow help_open as well
        if (intent === "help_open"){
          state.stage = "purpose";
          state.facts.why = "I need to get onto the base.";
          pushVisitor(visitorLineResolved("need_base"));
          return;
        }
        nudge("Try greeting first.");
        return;

      case "help":
        if (intent === "help_open"){
          state.stage = "purpose";
          state.facts.why = "I need to get onto the base.";
          pushVisitor(visitorLineResolved("need_base"));
          return;
        }
        if (intent === "greet"){
          pushVisitor(visitorLineResolved("greeting"));
          return;
        }
        nudge("Try: “How can I help you?”");
        return;

      case "purpose":
        if (intent === "purpose"){
          state.facts.why = "I have an appointment on base.";
          pushVisitor("I have an appointment on base.");
          return;
        }
        if (intent === "has_appointment"){
          state.facts.appt = "yes";
          pushVisitor(visitorLineResolved("appointment_yes"));
          return;
        }
        if (intent === "who_meeting"){
          state.facts.who = "Sergeant de Vries";
          pushVisitor(visitorLineResolved("who_meeting"));
          return;
        }
        if (intent === "time_meeting"){
          const t = getMeetingTimeHHMM();
          state.facts.meetingTime = t;
          pushVisitor(`At ${t}.`);
          return;
        }
        if (intent === "about_meeting"){
          state.facts.about = "delivery";
          pushVisitor(visitorLineResolved("about_meeting"));
          return;
        }
        if (intent === "ask_id"){
          showId();
          state.stage = "control_q";
          pushVisitor("Sure. Here you go.");
          return;
        }
        nudge("Try 5W questions, or ask for ID.");
        return;

      case "control_q":
        if (intent === "dob_q"){
          pushVisitor(maybeLie(`My date of birth is ${ID_DATA.dob}.`, `My date of birth is 22 Mar 1982.`));
          return;
        }
        if (intent === "nat_q"){
          const truth = `My nationality is ${ID_DATA.nat}.`;
          const lie = "My nationality is German.";
          pushVisitor(maybeLie(truth, lie));
          return;
        }
        if (intent === "spell_last_name"){
          pushVisitor(spellLastName());
          return;
        }
        if (intent === "ask_id"){
          showId();
          pushVisitor("I already gave you my ID.");
          return;
        }
        // Move on when supervisor was called
        nudge("Try a control question, or contact your supervisor.");
        return;

      case "search_announce":
        if (intent === "we_search_you"){
          state.stage = "why_searched";
          pushVisitor(visitorLineResolved("search_why"));
          return;
        }
        nudge("Try: “You will be searched.”");
        return;

      case "why_searched":
        if (intent === "everyone_searched" || intent === "due_threat"){
          state.stage = "illegal_items";
          pushVisitor("Okay.");
          return;
        }
        nudge("Try: “Everyone is searched due to an increased threat.”");
        return;

      case "illegal_items":
        if (intent === "illegal_items"){
          state.stage = "clarify_illegal";
          pushVisitor(visitorLineResolved("illegal_what"));
          return;
        }
        nudge("Try: “Do you have any illegal items?”");
        return;

      case "clarify_illegal": {
        const t = clean.toLowerCase();
        if (t.includes("weapon") || t.includes("knife") || t.includes("gun")) state.contraband.weapons = true;
        if (t.includes("drug")) state.contraband.drugs = true;
        if (t.includes("alcohol") || t.includes("beer") || t.includes("wine")) state.contraband.alcohol = true;

        const missing = [];
        if (!state.contraband.weapons) missing.push("weapons");
        if (!state.contraband.drugs) missing.push("drugs");
        if (!state.contraband.alcohol) missing.push("alcohol");

        if (intent === "illegal_clarify"){
          if (missing.length){
            pushVisitor(`Anything about ${missing.join(", ")}?`);
          } else {
            state.stage = "direction";
            pushVisitor("No. Tell me where to go.");
          }
          return;
        }
        pushVisitor("Clarify: drugs, weapons and alcohol.");
        return;
      }

      case "direction":
        if (intent === "go_person_search"){
          pushVisitor("Okay.");
          // placeholder screen switch later
          return;
        }
        nudge("Try: “Let’s go to the person search.”");
        return;

      default:
        pushVisitor("Okay.");
        return;
    }
  }

  function endConversation(){
    state.stage = "ended";
    // Disable inputs
    textInput.disabled = true;
    btnSend.disabled = true;
    holdToTalk.disabled = true;
    // Leave deny button usable for now
  }

  // ---------- Sidebar buttons ----------
  btnDeny.addEventListener("click", () => {
    pushVisitor(visitorLineResolved("deny_why"));
    state.stage = "deny_reason";
  });

  btnNewScenario.addEventListener("click", () => {
    // Keep student session, restart scenario
    textInput.disabled = false;
    btnSend.disabled = false;
    holdToTalk.disabled = false;
    resetScenario();
  });

  btnReset.addEventListener("click", () => {
    // Back to login
    loginModal.hidden = false;
    textInput.disabled = false;
    btnSend.disabled = false;
    holdToTalk.disabled = false;
    history.length = 0;
    renderHistory();
    hideId();
    updateStudentPill();
    textInput.value = "";
  });

  // Placeholders
  btnReturn.addEventListener("click", () => pushVisitor("Return (placeholder)."));
  btnPersonSearch.addEventListener("click", () => pushVisitor("Person search (placeholder)."));
  btnSignIn.addEventListener("click", () => pushVisitor("Sign-in office (placeholder)."));

  // ---------- Input ----------
  btnSend.addEventListener("click", () => {
    const t = textInput.value;
    textInput.value = "";
    handleStudent(t);
    textInput.focus();
  });
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend.click();
  });

  // ID return button can be omitted in some layouts; guard to prevent boot failure.
  btnReturnId?.addEventListener("click", () => {
    hideId();
    pushVisitor(visitorLineResolved("thanks"));
  });

  // ---------- Supervisor events ----------
  btnCloseSupervisor?.addEventListener("click", closeSupervisorModal);
  supervisorModal?.addEventListener("click", (e) => {
    if (e.target === supervisorModal) closeSupervisorModal();
  });
  btnSupervisorCheck?.addEventListener("click", runSupervisorChecks);
  btnReturnToVisitor?.addEventListener("click", () => {
    runSupervisorChecks();
    closeSupervisorModal();
    hideId();
    pushStudent("Okay. Everything checks out. Here is your ID back.");
    pushVisitor(visitorLineResolved("thanks"));
    state.stage = "search_announce";
  });

  // ---------- Voice ----------
  let recognition = null;
  let isRecognizing = false;

  function voiceSupported(){
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setupSpeech(){
    if (!voiceSupported()){
      voiceStatus.textContent = "Voice: not supported";
      holdToTalk.disabled = true;
      holdToTalk.title = "SpeechRecognition not supported in this browser.";
      return;
    }

    // Secure context check: avoid permission-loop on file://
    const isLocalhost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const okContext = window.isSecureContext || location.protocol === "https:" || isLocalhost;

    if (!okContext){
      voiceStatus.textContent = "Voice: use https/localhost";
      holdToTalk.disabled = true;
      holdToTalk.title = "Voice requires https:// or http://localhost (not file://).";
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      voiceStatus.textContent = "Voice: listening…";
    };

    recognition.onresult = (event) => {
      // Only final text into input (no stutter)
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++){
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
      }
      const clean = (finalText || "").trim();
      if (clean) textInput.value = clean;
    };

    recognition.onerror = (e) => {
      console.warn("Speech error", e);
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

  // Use pointer events so mouse/touch both work
  holdToTalk.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk.addEventListener("pointercancel", stopListen);
  holdToTalk.addEventListener("pointerleave", stopListen);

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

    loginModal.hidden = true;
    resetScenario();
    textInput.focus();
  }

  btnStartTraining.addEventListener("click", tryStart);
  studentSurnameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") tryStart(); });

  // ---------- Boot ----------
  const pre = loadStudentPrefill();
  if (pre && typeof pre === "object"){
    if (pre.surname) studentSurnameInput.value = pre.surname;
    if (pre.group) studentGroupSel.value = pre.group;
    if (pre.difficulty) studentDifficultySel.value = pre.difficulty;
  }

  updateStudentPill();
  hideId();
  syncVisitorAvatars();
  setupSpeech();
  loginModal.hidden = false;
  renderHistory();
})();
