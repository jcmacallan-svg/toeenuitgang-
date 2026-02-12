// app.js
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // -----------------------------
  // Build / config
  // -----------------------------
  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const ASSET_BASE = CFG.assetBase || "assets/photos";
  const HEADSHOT_PREFIX = CFG.headshotPrefix || "headshot_";
  const HEADSHOT_COUNT = Number(CFG.headshotCount || 10);

  // Support both legacy keys (voiceAutoSend) and new keys (voiceAutosend)
  const _voiceCfg = (CFG.voiceAutosend !== undefined) ? CFG.voiceAutosend
    : (CFG.voiceAutoSend !== undefined) ? CFG.voiceAutoSend
    : undefined;
  const VOICE_AUTOSEND = (_voiceCfg === undefined) ? true : !!_voiceCfg;

  // -----------------------------
  // UI
  // -----------------------------
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
  const btnReturnId = $("#btnReturnId");
  const idPhoto = $("#idPhoto");
  const portraitPhoto = $("#portraitPhoto");
  const portraitMood = $("#portraitMood");
  const idName = $("#idName");
  const idSurname = $("#idSurname");
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

  // Chat slots (6)
  const slotEls = [
    { row: $("#slot0"), av: $("#slot0Avatar"), txt: $("#slot0Text"), meta: $("#slot0Meta") },
    { row: $("#slot1"), av: $("#slot1Avatar"), txt: $("#slot1Text"), meta: $("#slot1Meta") },
    { row: $("#slot2"), av: $("#slot2Avatar"), txt: $("#slot2Text"), meta: $("#slot2Meta") },
    { row: $("#slot3"), av: $("#slot3Avatar"), txt: $("#slot3Text"), meta: $("#slot3Meta") },
    { row: $("#slot4"), av: $("#slot4Avatar"), txt: $("#slot4Text"), meta: $("#slot4Meta") },
    { row: $("#slot5"), av: $("#slot5Avatar"), txt: $("#slot5Text"), meta: $("#slot5Meta") },
  ];
  const MAX_SLOTS = slotEls.length;

  // Avatars (sources only)
  const visitorAvatar = portraitPhoto || { src: "" };
  const soldierAvatar = new Image();
  soldierAvatar.src = `${ASSET_BASE}/soldier.png`;

  // -----------------------------
  // Version banner
  // -----------------------------
  const __assetVer = String(window.__ASSET_VER__ || "");
  const __assetShort = __assetVer ? __assetVer.slice(-6) : "";
  if (versionPill) versionPill.textContent = `v${BUILD.version}${__assetShort ? " · " + __assetShort : ""}`;
  document.title = `${BUILD.name} v${BUILD.version}${__assetShort ? " (" + __assetShort + ")" : ""}`;

  // -----------------------------
  // Helpers
  // -----------------------------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pad2 = (n) => String(n).padStart(2, "0");

  function normalize(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}: ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function pick(arr) {
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // -----------------------------
  // Visitor TTS (optional)
  // -----------------------------
  let VISITOR_TTS_ENABLED = true;
  let _ttsReady = false;

  function primeTTS() {
    try {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume?.();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.lang = "en-GB";
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
      _ttsReady = true;
    } catch { /* noop */ }
  }

  function speakVisitor(text) {
    try {
      if (!VISITOR_TTS_ENABLED) return;
      if (!("speechSynthesis" in window)) return;
      if (!_ttsReady) return;
      const t = String(text || "").trim();
      if (!t) return;

      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = "en-GB";
      u.rate = 1.0;
      u.pitch = 1.0;
      u.volume = 1.0;
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  }

  // -----------------------------
  // Session
  // -----------------------------
  const STUDENT_KEY = "veva.student.v2";
  let session = { surname: "", group: "", difficulty: "standard" };

  function loadStudentPrefill() {
    try { return JSON.parse(localStorage.getItem(STUDENT_KEY) || "null"); }
    catch { return null; }
  }
  function saveStudentPrefill(v) {
    try { localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); }
    catch { /* noop */ }
  }
  function updateStudentPill() {
    if (!studentPill) return;
    if (!session.surname || !session.group) {
      studentPill.textContent = "Student: —";
      return;
    }
    const cap = (s) => (s || "").charAt(0).toUpperCase() + (s || "").slice(1);
    studentPill.textContent = `Student: ${session.surname} | Group: ${session.group} | ${cap(session.difficulty)}`;
  }

  // -----------------------------
  // ID + Avatar (male only for now)
  // -----------------------------
  function headshotPath(index) {
    return `${ASSET_BASE}/${HEADSHOT_PREFIX}${pad2(index)}.png`;
  }

  // ✅ Male-only first names (as requested)
  const FIRST_MALE = [
    "Liam","Noah","James","Oliver","Lucas","Milan","Daan","Sem","Jayden","Finn",
    "Jack","Charlie","Oscar","Henry","William","Thomas","Harry","Leo","Arthur","Max"
  ];

  const LAST = [
    "Miller","Bakker","de Vries","Jansen","Visser","Smit","Bos","van Dijk","de Jong","Meijer",
    "Mulder","de Boer","Vos","van Leeuwen","Dekker","Vermeer","van der Meer","Peters","Dijkstra","Kuipers"
  ];

  // Nationalities (no city fields anywhere)
  const NATS = ["Dutch","German","Belgian","French","British"];
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function makeRandomId() {
    const idx = randInt(1, HEADSHOT_COUNT);

    const first = pick(FIRST_MALE);         // ✅ always male
    const last = pick(LAST);
    const year = randInt(1976, 2002);
    const month = MONTHS[randInt(0, MONTHS.length - 1)];
    const day = pad2(randInt(1, 28));
    const nat = pick(NATS);

    const prefix = (nat === "Dutch") ? "NL-"
      : (nat === "German") ? "DE-"
      : (nat === "Belgian") ? "BE-"
      : (nat === "French") ? "FR-"
      : "UK-";

    const idNoVal = prefix + randInt(100000, 999999);

    return {
      first,
      last,
      name: `${first} ${last}`,
      dob: `${day} ${month} ${year}`,
      nat,
      idNo: idNoVal,
      headshotIndex: idx,
      photoSrc: headshotPath(idx),
    };
  }

  let ID_DATA = makeRandomId();

  function syncVisitorAvatars() {
    // One source of truth for visitor avatar is portraitPhoto.src
    if (portraitPhoto) portraitPhoto.src = ID_DATA.photoSrc;
    if (idPhoto) idPhoto.src = ID_DATA.photoSrc;
  }

  // -----------------------------
  // Mood
  // -----------------------------
  const MOODS = [
    { key: "relaxed", line: "The visitor looks relaxed.", liarBias: 0.08 },
    { key: "neutral", line: "The visitor looks neutral.", liarBias: 0.12 },
    { key: "mixed", line: "The visitor looks a bit uneasy.", liarBias: 0.22 },
    { key: "nervous", line: "The visitor looks nervous.", liarBias: 0.35 },
    { key: "irritated", line: "The visitor looks irritated.", liarBias: 0.28 }
  ];
  let currentMood = MOODS[1];

  function syncMoodUI() {
    if (portraitMood) portraitMood.textContent = currentMood?.line || "";
  }

  function maybeLie(truth, lie) {
    return (Math.random() < (currentMood?.liarBias || 0)) ? lie : truth;
  }

  // -----------------------------
  // Visitor lines (fallback if PS patch missing)
  // -----------------------------
  function moodPool(pools) {
    const k = currentMood.key;
    if (k === "relaxed") return pools.relaxed || pools.neutral || pools.nervous;
    if (k === "neutral") return pools.neutral || pools.relaxed || pools.nervous;
    if (k === "mixed") return pools.mixed || pools.neutral || pools.nervous;
    if (k === "nervous") return pools.nervous || pools.mixed || pools.neutral;
    return pools.neutral || pools.mixed || pools.nervous;
  }

  const VISITOR = {
    greeting: {
      relaxed: ["Hello.", "Hi there.", "Good morning.", "Good afternoon.", "Evening."],
      neutral: ["Hello.", "Hi.", "Good morning.", "Hello.", "Hi there."],
      mixed: ["Hello…", "Uh, hello.", "Hi.", "Hello.", "Good… morning."],
      nervous: ["Hello.", "Yeah… hello.", "Hi.", "…Hello.", "Hello—"],
      irritated: ["Yeah. Hello.", "Hello.", "Hi.", "What?", "Hello."]
    },
    need_help: {
      relaxed: ["Can you help me?", "Excuse me, can you help me?", "Could you help me for a moment?", "Hi, can you help me please?", "Can you help me with something?"],
      neutral: ["Can you help me?", "Could you help me?", "Can you help me please?", "Excuse me—can you help?", "Can you help me?"],
      mixed: ["I… need help.", "Can you help me?", "Could you help me?", "Can you help me—quickly?", "Can you help me, please?"],
      nervous: ["I need help.", "Look—can you help me?", "Can you just help me?", "I… need help.", "Can you help me?"],
      irritated: ["Can you help me or not?", "I need help.", "Can we do this quickly?", "Help me.", "Can you help?"]
    },
    need_base: {
      relaxed: ["I need to get onto the base.", "I’m here for a meeting on base.", "I need access to the base.", "I’m supposed to be on base today.", "I’m here to enter the base."],
      neutral: ["I need to get onto the base.", "I’m here for a meeting.", "I need access.", "I’m expected on base.", "I’m here to go in."],
      mixed: ["I need to get onto the base.", "I’m here for an appointment… on base.", "I need access, yeah.", "I’m supposed to be inside.", "I need to go in."],
      nervous: ["I… need to go in.", "I need to get onto the base.", "I’m supposed to be inside.", "I have to get in—okay?", "I need access."],
      irritated: ["I need access.", "I’m here for a meeting.", "I need to get in.", "I’m expected.", "I’m here for work."]
    },
    appointment_yes: {
      relaxed: ["Yes, I have an appointment.", "Yes, I do.", "Yes—my visit is scheduled.", "Yes, I’m expected.", "Yes, I have a meeting booked."],
      neutral: ["Yes.", "Yes, I do.", "Yes, I have an appointment.", "Yes—scheduled.", "Yes, I’m expected."],
      mixed: ["Yes.", "Yeah, I have an appointment.", "I think so—yes.", "Yes… appointment.", "Yes, I’m supposed to."],
      nervous: ["Yes.", "Yes—appointment.", () => maybeLie("Yes.", "No… I mean yes."), "Yeah.", "Yes, okay?"],
      irritated: ["Yes.", "Yes, I do.", "Yes—obviously.", "Yes, I have an appointment.", "Yes."]
    },
    appointment_no: {
      relaxed: ["No, I don’t have an appointment.", "No, I’m here without an appointment.", "No, I’m not scheduled.", "No—no appointment.", "No, I just need access."],
      neutral: ["No.", "No, I don’t.", "No—no appointment.", "No, not scheduled.", "No."],
      mixed: ["No…", "I don’t think so.", "No, I’m not scheduled.", "No appointment.", "No."],
      nervous: ["No.", "No—wait… no.", "No appointment.", "I… don’t have one.", "No."],
      irritated: ["No.", "No appointment.", "No—can I still go in?", "No. Why?", "No."]
    },
    who_meeting: {
      relaxed: ["I’m meeting Sergeant de Vries.", "I have an appointment with Sergeant de Vries.", "I’m here to see Sergeant de Vries.", "I’m meeting Captain van Dijk.", "I’m meeting the duty officer at reception."],
      neutral: ["I’m meeting Sergeant de Vries.", "I’m meeting Captain van Dijk.", "I’m meeting the duty officer.", "I’m here to see de Vries.", "I’m meeting my contact."],
      mixed: [() => maybeLie("I’m meeting Sergeant de Vries.", "I’m meeting Mr. de Vries."), "I’m meeting Sergeant de Vries.", "I’m meeting… de Vries.", "I’m here to see my contact.", "I’m meeting Captain van Dijk."],
      nervous: [() => maybeLie("I’m meeting Sergeant de Vries.", "I’m meeting… uh… Mr. de Vries."), "De Vries.", "Sergeant de Vries.", "My contact… de Vries.", "I’m meeting the officer—de Vries."],
      irritated: ["De Vries.", "Sergeant de Vries.", "My contact.", "The duty officer.", "Captain van Dijk."]
    },
    about_meeting: {
      relaxed: ["It’s a delivery for the workshop—tools and spare parts.", "It’s a maintenance meeting about paperwork.", "It’s an inspection meeting.", "It’s a briefing for contractor access.", "It’s about a scheduled service appointment."],
      neutral: ["It’s about a delivery.", "It’s an inspection.", "Maintenance paperwork.", "It’s about work on site.", "It’s about the workshop—delivery."],
      mixed: ["It’s… a delivery.", "Work paperwork.", "It’s an inspection, I think.", "It’s about maintenance.", "It’s about workshop parts."],
      nervous: ["Delivery.", "Work stuff.", "Paperwork.", "I was told to come here.", "Just a meeting—okay?"],
      irritated: ["It’s a delivery.", "Work paperwork.", "Inspection.", "Maintenance.", "Work."]
    },
    nat_excuse: {
      relaxed: ["Oh—sorry. I misspoke. I’m Dutch, I just work in Germany.", "Right, yes—Dutch. I said German because I live there now.", "I have dual nationality, but this passport is Dutch.", "My apologies—Dutch. I got mixed up for a second.", "Dutch, yes. I’ve been travelling a lot, that’s why I said German."],
      neutral: ["Sorry, I misspoke. I’m Dutch.", "Dutch—yes. I answered too fast.", "I live in Germany but I’m Dutch. The passport is Dutch.", "Dutch. I got mixed up.", "I thought you meant where I live. I live in Germany. The passport is Dutch."],
      mixed: ["Uh… I live in Germany, but I’m Dutch. That’s what the passport says.", "I said German because I work there. The passport is Dutch.", "It’s… complicated. I’m Dutch, but I’m registered in Germany.", "I mixed it up. Dutch—okay?", "Dutch. I just answered too fast."],
      nervous: ["I—look, I got confused. It’s Dutch, okay?", "I said the wrong thing. I’m Dutch. I’m just stressed.", "It’s Dutch. I… I misspoke, that’s all.", "I thought you meant where I live. I live in Germany. The passport is Dutch.", "Dutch. Can we move on, please?"],
      irritated: ["Dutch. I misspoke.", "Dutch.", "I answered too fast. Dutch.", "Dutch. Can we move on?", "Dutch."]
    },
    search_why: {
      relaxed: ["Why am I being searched?", "Why do you need to search me?", "Is the search necessary?", "Why are you searching me today?", "What is the reason for the search?"],
      neutral: ["Why am I being searched?", "Why do you need to search me?", "Why are you searching me?", "Why me?", "What’s the reason for the search?"],
      mixed: ["Why am I searched?", "Why are you searching me?", "Do you really need to search me?", "Why me?", "Why am I being searched?"],
      nervous: ["Why are you searching me?!", "Why am I searched?", "What’s going on?", "Why do you need to search me?", "Why?"],
      irritated: ["Why am I being searched?", "Why me?", "What’s the reason?", "Why?", "Why now?"]
    },
    illegal_what: {
      relaxed: ["What do you mean by illegal items?", "What counts as illegal items?", "What are illegal items exactly?", "Illegal items—like what?", "Can you explain what you mean by illegal items?"],
      neutral: ["What are illegal items?", "What do you mean?", "What counts as illegal?", "Illegal items—like what?", "Can you explain that?"],
      mixed: ["Illegal items—what?", "Like what?", "What do you mean by illegal items?", "What counts as illegal items?", "What is illegal here?"],
      nervous: ["Illegal items? Like what?", "What do you mean—illegal items?", "What exactly do you mean?", "Illegal items?", "What are illegal items?"],
      irritated: ["Illegal items—like what?", "What do you mean?", "Explain.", "Like what?", "What’s illegal?"]
    },
    thanks: {
      relaxed: ["Thank you.", "Thanks.", "Thank you, officer.", "Alright, thanks.", "Thanks for your help."],
      neutral: ["Thanks.", "Thank you.", "Okay, thanks.", "Right… thanks.", "Thanks."],
      mixed: ["Thanks.", "Okay… thanks.", "Thank you.", "Alright, thanks.", "Thanks."],
      nervous: ["Yeah… thanks.", "Thanks.", "Okay.", "Uh—thanks.", "Thanks."],
      irritated: ["Yeah, thanks.", "Thanks.", "Okay.", "Right.", "Thanks."]
    },
    deny_why: {
      relaxed: ["Why are you denying me?", "Why can’t I enter?", "What changed?", "Why are you stopping me?", "Is there a problem?"],
      neutral: ["Why are you denying me?", "Why can’t I enter?", "What changed?", "Why are you stopping me?", "Why?"],
      mixed: ["Why are you denying me?", "What changed?", "Why can’t I enter now?", "What’s the reason?", "Why?"],
      nervous: ["Why are you denying me?!", "What changed?", "Why can’t I enter?", "Why are you stopping me?", "What’s going on?"],
      irritated: ["Why can’t I enter?", "What changed?", "Why are you stopping me?", "Why?", "Problem?"]
    }
  };

  function resolveMaybeFn(v) {
    return (typeof v === "function") ? String(v() || "").trim() : String(v || "").trim();
  }

  function visitorLineResolved(key) {
    const pools = VISITOR[key];
    if (!pools) return "Okay.";
    const raw = pick(moodPool(pools));
    const out = resolveMaybeFn(raw);
    return out || "Okay.";
  }

  // -----------------------------
  // Hint band
  // -----------------------------
  function shouldShowHints() {
    return (session?.difficulty || "standard") !== "advanced";
  }

  function setHintText(t) {
    if (!hintBandText) return;
    hintBandText.textContent = t || "";
  }

  // -----------------------------
  // Chat ladder
  // -----------------------------
  let history = []; // { side:'visitor'|'student', text:'', typing?:true }

  function renderHistory() {
    let view = history.slice(0, MAX_SLOTS);

    const typingMsg =
      (state && state.typing && state.typing.visitor) ? { side: "visitor", typing: true } :
      (state && state.typing && state.typing.student) ? { side: "student", typing: true } :
      null;

    if (typingMsg) view = [typingMsg, ...view].slice(0, MAX_SLOTS);

    for (let i = 0; i < MAX_SLOTS; i++) {
      const msg = view[i];
      const slot = slotEls[i];
      if (!slot || !slot.row) continue;

      const rowEl = slot.row;
      if (!msg) {
        rowEl.hidden = true;
        continue;
      }

      rowEl.hidden = false;
      rowEl.classList.toggle("isVisitor", msg.side === "visitor");
      rowEl.classList.toggle("isStudent", msg.side === "student");
      rowEl.classList.toggle("left", msg.side === "visitor");
      rowEl.classList.toggle("right", msg.side === "student");

      if (slot.av) {
        slot.av.src = (msg.side === "visitor") ? (visitorAvatar.src || "") : (soldierAvatar.src || "");
        slot.av.alt = (msg.side === "visitor") ? "Visitor" : "Soldier";
      }

      if (slot.meta) slot.meta.textContent = "";

      if (slot.txt) {
        slot.txt.classList.toggle("typing", !!msg.typing);
        if (msg.typing) {
          slot.txt.innerHTML = '<span class="typingDots" aria-label="Typing"><span></span><span></span><span></span></span>';
        } else {
          slot.txt.textContent = msg.text || "";
        }
      }
    }
  }

  function pushVisitor(text) {
    const t = String(text || "").trim();
    if (!t) return;
    history.unshift({ side: "visitor", text: t });
    history = history.slice(0, MAX_SLOTS);
    if (state) state.misses = 0;
    renderHistory();
    updateHintBand();
    speakVisitor(t);
  }

  function pushStudent(text) {
    const t = String(text || "").trim();
    if (!t) return;
    if (state && state.typing) state.typing.student = false;
    history.unshift({ side: "student", text: t });
    history = history.slice(0, MAX_SLOTS);
    if (state) state.misses = 0;
    renderHistory();
    updateHintBand();
  }

  // Visitor delayed replies
  const VISITOR_REPLY_DELAY_MS = 2000;
  const _visitorQueue = [];
  let _visitorTimer = null;

  function enqueueVisitor(text) {
    const t = String(text || "").trim();
    if (!t) return;
    _visitorQueue.push(t);
    drainVisitorQueue();
  }

  function drainVisitorQueue() {
    if (_visitorTimer) return;
    if (!_visitorQueue.length) return;

    if (state && state.typing) {
      state.typing.visitor = true;
      state.typing.student = false;
    }
    renderHistory();

    _visitorTimer = setTimeout(() => {
      _visitorTimer = null;

      if (state && state.typing) state.typing.visitor = false;
      const next = _visitorQueue.shift();
      if (next) pushVisitor(next);

      if (_visitorQueue.length) drainVisitorQueue();
    }, VISITOR_REPLY_DELAY_MS);
  }

  // -----------------------------
  // Hint logic
  // -----------------------------
  function getNextHint() {
    const f = state?.facts || {};
    if (state?.mode === "person_search") return 'Try: “Can I see your ID, please?” or “Do you have an appointment?”';

    if (state?.stage === "start") return 'Say: “Good morning. How can I help you?”';
    if (state?.stage === "help") return 'Ask: “What do you need?”';

    if (!f.name) return 'Ask: “Who are you?”';
    if (!f.purpose) return 'Ask: “What are you doing here?”';
    if (!f.appt) return 'Ask: “Do you have an appointment?”';

    if (f.appt === "yes") {
      if (!f.who) return 'Ask: “With whom do you have an appointment?”';
      if (!f.time) return 'Ask: “What time is your appointment?”';
      if (!f.about) return 'Ask: “What is the appointment about?”';
    }

    if (!state?.idChecked) return 'Ask: “Can I see your ID, please?”';
    return "Continue the procedure.";
  }

  function nudge(t) {
    if (!state) return;
    state.misses = (state.misses || 0) + 1;
    const diff = (session?.difficulty || "standard");
    const canShow = diff === "basic" || (diff === "standard" && state.misses >= 2);
    if (!shouldShowHints() || state?.idVisible || !canShow) return;
    if (hintBand) hintBand.hidden = false;
    setHintText(t || getNextHint());
  }

  function updateHintBand(force = false) {
    if (!hintBand) return;
    if (!shouldShowHints()) {
      hintBand.hidden = true;
      return;
    }
    if (state?.idVisible) {
      hintBand.hidden = true;
      return;
    }
    const diff = (session?.difficulty || "standard");
    const canShow = force || diff === "basic" || (diff === "standard" && (state?.misses || 0) >= 2);

    hintBand.hidden = !canShow;
    if (canShow) setHintText(getNextHint());
  }

  // -----------------------------
  // ID Card show/hide
  // -----------------------------
  let state = null;

  function showId() {
    if (!idCardWrap) return;
    if (!state || !state.visitor) return;

    if (idName) idName.textContent = state.visitor.name || "";
    if (idSurname) idSurname.textContent = state.visitor.last || "";
    if (idDob) idDob.textContent = state.visitor.dob || "";
    if (idNat) idNat.textContent = state.visitor.nat || "";
    if (idNo) idNo.textContent = state.visitor.idNo || "";
    if (idPhoto) idPhoto.src = state.visitor.photoSrc || "";

    idCardWrap.hidden = false;
    state.idVisible = true;
    if (hintBand) hintBand.hidden = true;
  }

  function hideId() {
    if (idCardWrap) idCardWrap.hidden = true;
    if (state) state.idVisible = false;
    updateHintBand(true);
  }

  function spellLastNameFromId() {
    const full = (ID_DATA && ID_DATA.name) ? String(ID_DATA.name) : "Miller";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    const ln = parts.length ? parts[parts.length - 1] : full;
    const letters = ln.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
    return letters.length ? letters.join("-") : ln.toUpperCase();
  }

  // -----------------------------
  // Meeting time helper
  // -----------------------------
  function getMeetingTimeHHMM() {
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

  // -----------------------------
  // Person Search Patch (B1) helpers
  // -----------------------------
  function psBand() {
    const fn = window.PS_PATCH?.bandFromMoodKey;
    if (typeof fn === "function") return fn(currentMood.key) || "cautious";
    if (currentMood.key === "relaxed") return "open";
    if (currentMood.key === "nervous" || currentMood.key === "irritated") return "evasive";
    return "cautious";
  }

  function psPickAnswer(intentKey, ctx = {}) {
    const qa = window.PS_PATCH?.QA?.[intentKey];
    if (!qa) return "Okay.";
    const band = psBand();
    const arr = qa[band] || qa.cautious || [];
    let line = pick(arr);

    const v = state?.visitor || {};
    const claimedFirst = v.claimedFirst || v.first || "";
    const claimedLast = v.claimedLast || v.last || "";
    const claimedName = v.claimedName || v.name || "";

    const rep = (key, val) => {
      const re = new RegExp("\\{" + key + "\\}", "g");
      line = String(line || "").replace(re, String(val ?? ""));
    };

    rep("meetingTime", ctx.meetingTime || v.meetingTime || "");
    rep("name", v.name || "");
    rep("first", v.first || "");
    rep("last", v.last || "");
    rep("dob", v.dob || "");
    rep("nat", v.nat || "");
    rep("idNo", v.idNo || "");
    rep("claimedFirst", claimedFirst);
    rep("claimedLast", claimedLast);
    rep("claimedName", claimedName);

    return String(line || "Okay.").trim();
  }

  // -----------------------------
  // Intents (bigger set)
  // -----------------------------
  const INTENTS = [
    { key: "greet", rx: /\b(hi|hello|good\s*(morning|afternoon|evening))\b/i },
    { key: "help_open", rx: /\b(how\s+can\s+i\s+help(\s+you(\s+today)?)?|what\s+do\s+you\s+need|how\s+may\s+i\s+help)\b/i },
    { key: "purpose", rx: /\b(why\s+are\s+you\s+here|what\s+is\s+the\s+purpose\s+of\s+your\s+visit|what\s+is\s+the\s+reason\s+for\s+your\s+visit|what\'?s\s+the\s+reason\s+for\s+your\s+visit|whats\s+the\s+reason\s+for\s+your\s+visit)\b/i },
    { key: "has_appointment", rx: /\b(do\s+you\s+have\s+an\s+appointment|do\s+you\s+have\s+a\s+meeting|have\s+you\s+got\s+an\s+appointment|have\s+you\s+got\s+a\s+meeting|is\s+your\s+visit\s+scheduled)\b/i },

    { key: "ask_name", rx: /\b(who\s+are\s+you|what\s+is\s+your\s+name|may\s+i\s+have\s+your\s+name|your\s+name\s*,?\s+please)\b/i },
    { key: "who_meeting", rx: /\b(who\s+are\s+you\s+(meeting|seeing|talking\s+to)(\s+with)?|who\s+do\s+you\s+have\s+an?\s+(appointment|meeting)\s+with|with\s+whom\s+do\s+you\s+have\s+an\s+appointment)\b/i },
    { key: "time_meeting", rx: /\b(what\s+time\s+is\s+(the\s+)?(appointment|meeting)|when\s+is\s+(the\s+)?(appointment|meeting)|when\s+are\s+you\s+expected|what\s+time\s+are\s+you\s+expected)\b/i },
    { key: "about_meeting", rx: /\b(what\s+is\s+(the\s+)?(appointment|meeting)\s+about|can\s+you\s+tell\s+me\s+(a\s+little\s+bit\s+more|more)\s+about\s+the\s+(appointment|meeting)|tell\s+me\s+more\s+about\s+the\s+(appointment|meeting)|what\s+are\s+you\s+delivering)\b/i },

    { key: "ask_id", rx: /\b(do\s+you\s+have\s+(an\s+)?id|have\s+you\s+got\s+id|can\s+i\s+see\s+your\s+id|may\s+i\s+see\s+your\s+id|show\s+me\s+your\s+id|id\s+please|identity\s+card|passport)\b/i },
    { key: "dob_q", rx: /\b(date\s+of\s+birth|dob|when\s+were\s+you\s+born)\b/i },
    { key: "nat_q", rx: /\b(nationality|what\s+is\s+your\s+nationality|where\s+are\s+you\s+from)\b/i },
    { key: "spell_last_name", rx: /\b(spell\s+(your\s+)?(last\s+name|surname)|how\s+do\s+you\s+spell\s+(your\s+)?(last\s+name|surname))\b/i },

    { key: "contact_supervisor", rx: /\b(i\s+will\s+contact\s+my\s+(supervisor|boss)(\s+now)?|please\s+wait\s*,?\s*i\s+will\s+contact\s+my\s+(supervisor|boss)|let\s+me\s+call\s+my\s+(supervisor|boss))\b/i },

    { key: "confront_nat", rx: /\b(nationality\s+mismatch|doesn\'?t\s+match\s+your\s+nationality|but\s+your\s+(id|passport)\s+says\s+(dutch|german)|on\s+your\s+(id|passport)\s+it\s+says\s+(dutch|netherlands|german))\b/i },
    { key: "return_id", rx: /\b(here\'?s\s+your\s+id\s+back|return\s+your\s+id|you\s+can\s+have\s+your\s+id\s+back)\b/i },

    { key: "we_search_you", rx: /\b(we\s+are\s+going\s+to\s+search\s+you|you\s+will\s+be\s+searched|you\s+are\s+going\s+to\s+be\s+searched|we\s+will\s+search\s+you)\b/i },
    { key: "everyone_searched", rx: /\b(everyone\s+is\s+searched|we\s+search\s+everyone|routine\s+search)\b/i },
    { key: "due_threat", rx: /\b(due\s+to\s+(an?\s+)?(increased\s+threat|heightened\s+security|security\s+reasons)|heightened\s+security)\b/i },
    { key: "illegal_items", rx: /\b(do\s+you\s+have\s+any\s+illegal\s+items|anything\s+illegal|contraband|prohibited\s+items)\b/i },
    { key: "illegal_clarify", rx: /\b(weapons?|drugs?|alcohol|knife|gun)\b/i },

    { key: "go_person_search", rx: /\b(let\'?s\s+go\s+to\s+(the\s+)?person\s+search|go\s+to\s+person\s+search)\b/i },
    { key: "go_sign_in", rx: /\b(go\s+to\s+(the\s+)?sign[\s-]*in(\s+office)?|go\s+to\s+reception|sign[\s-]*in\s+office)\b/i },

    // Extra scenario confronts
    { key: "confront_name_mismatch", rx: /\b(name\s+doesn\'?t\s+match|this\s+is\s+not\s+your\s+name|different\s+name\s+on\s+(your\s+)?id)\b/i },
    { key: "confront_dob_mismatch", rx: /\b(dob\s+doesn\'?t\s+match|date\s+of\s+birth\s+doesn\'?t\s+match|different\s+date\s+of\s+birth)\b/i },
    { key: "id_expired_q", rx: /\b(id\s+is\s+expired|your\s+id\s+expired|passport\s+expired|this\s+id\s+has\s+expired)\b/i },
    { key: "appointment_proof", rx: /\b(proof\s+of\s+appointment|show\s+me\s+your\s+appointment|do\s+you\s+have\s+confirmation|appointment\s+confirmation)\b/i },
  ];

  function detectIntent(text) {
    const t = String(text || "");
    for (const it of INTENTS) {
      if (it.rx.test(t)) return it.key;
    }
    return "unknown";
  }

  // -----------------------------
  // Supervisor modal
  // -----------------------------
  function setStatus(el, ok) {
    if (!el) return;
    el.classList.remove("ok", "bad");
    if (ok === true) { el.textContent = "OK"; el.classList.add("ok"); }
    else if (ok === false) { el.textContent = "NO"; el.classList.add("bad"); }
    else { el.textContent = "—"; }
  }

  function openSupervisorModal() {
    if (!supervisorModal || !state) return;
    supervisorModal.hidden = false;

    if (svWhy) svWhy.value = state.facts.why || "";
    if (svAppt) svAppt.value = state.facts.appt || "yes";
    if (svWho) svWho.value = state.facts.who || "";
    if (svAbout) svAbout.value = state.facts.about || "";
    if (svTime) svTime.value = state.facts.meetingTime ? `At ${state.facts.meetingTime}.` : "";

    setStatus(svWhyStatus, null);
    setStatus(svApptStatus, null);
    setStatus(svWhoStatus, null);
    setStatus(svAboutStatus, null);
    setStatus(svTimeStatus, null);

    if (svNote) svNote.textContent = "Fill in the answers, run checks, then return to the visitor.";
  }

  function closeSupervisorModal() {
    if (!supervisorModal) return;
    supervisorModal.hidden = true;
  }

  function runSupervisorChecks() {
    if (!state) return;

    const expected = {
      why: normalize(state.facts.why),
      appt: normalize(state.facts.appt),
      who: normalize(state.facts.who),
      about: normalize(state.facts.about),
      time: normalize(state.facts.meetingTime)
    };

    const entered = {
      why: normalize(svWhy?.value),
      appt: normalize(svAppt?.value),
      who: normalize(svWho?.value),
      about: normalize(svAbout?.value),
      time: normalize(svTime?.value)
    };

    const whyOk = entered.why ? (expected.why ? entered.why.includes(expected.why) : true) : false;
    const apptOk = entered.appt ? (expected.appt ? entered.appt === expected.appt : true) : false;
    const whoOk = entered.who ? (expected.who ? entered.who.includes(expected.who) : true) : false;
    const aboutOk = entered.about ? (expected.about ? entered.about.includes(expected.about) : true) : false;
    const timeOk = entered.time ? (expected.time ? entered.time.includes(expected.time) : true) : false;

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

    if (svNote) {
      svNote.textContent = mism.length
        ? `Checks complete: mismatch(es) recorded: ${mism.join(", ")}.`
        : "Checks complete: everything matches.";
    }
  }

  // -----------------------------
  // Scenario reset (B2) + branches
  // -----------------------------
  function resetScenario() {
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    syncMoodUI();

    ID_DATA = makeRandomId();
    history.length = 0;
    syncVisitorAvatars();

    state = {
      mode: "gate", // "gate" | "person_search"
      stage: "start",
      misses: 0,
      typing: { visitor: false, student: false },
      contraband: { weapons: false, drugs: false, alcohol: false },
      idVisible: false,
      idChecked: false,
      visitor: { ...ID_DATA },

      facts: { name: "", purpose: "", appt: "", who: "", time: "", about: "", why: "", meetingTime: "" },

      // B2: scenario branches
      scenario: {
        hasAppointment: Math.random() < 0.75,
        nameMismatch: Math.random() < 0.10,
        dobMismatch: Math.random() < 0.08,
        idExpired: Math.random() < 0.06,
        noId: Math.random() < 0.05
      }
    };

    // Derived "claimed" fields (used in PS patch replacements)
    state.visitor.claimedFirst = state.visitor.first;
    state.visitor.claimedLast = state.visitor.last;
    state.visitor.claimedName = state.visitor.name;
    state.visitor.claimedDob = state.visitor.dob;

    if (state.scenario.nameMismatch) {
      const altLast = pick(LAST.filter(x => x !== state.visitor.last));
      state.visitor.claimedLast = altLast;
      state.visitor.claimedName = `${state.visitor.first} ${altLast}`;
    }
    if (state.scenario.dobMismatch) {
      state.visitor.claimedDob = "11 Mar 1988";
    }

    hideId();
    updateHintBand(true);

    // Initial line
    pushVisitor(visitorLineResolved("greeting"));
  }

  // -----------------------------
  // Person Search Mode
  // -----------------------------
  function enterPersonSearch() {
    if (!state) return;
    state.mode = "person_search";
    hideId();
    enqueueVisitor("Person search. Please ask for my surname and date of birth.");
    updateHintBand(true);
  }

  function handlePersonSearch(clean, intent) {
    const meetingTime = getMeetingTimeHHMM();

    // Scenario confronts (prefer patch answers if present)
    if (intent === "confront_name_mismatch") {
      enqueueVisitor(psPickAnswer("confront_name_mismatch", { meetingTime }));
      return;
    }
    if (intent === "confront_dob_mismatch") {
      enqueueVisitor(psPickAnswer("confront_dob_mismatch", { meetingTime }));
      return;
    }
    if (intent === "id_expired_q") {
      enqueueVisitor(psPickAnswer("id_expired_ack", { meetingTime }));
      return;
    }
    if (intent === "appointment_proof") {
      enqueueVisitor(psPickAnswer("appointment_proof", { meetingTime }));
      return;
    }

    // Core PS
    if (intent === "ask_name") {
      enqueueVisitor(psPickAnswer("ask_name", { meetingTime }));
      return;
    }
    if (intent === "spell_last_name") {
      // B3: consistent spelling from ID
      enqueueVisitor(spellLastNameFromId());
      return;
    }
    if (intent === "dob_q") {
      // B3: claimedDob can be wrong in scenario
      enqueueVisitor(state?.visitor?.claimedDob || state?.visitor?.dob || "—");
      return;
    }
    if (intent === "nat_q") {
      enqueueVisitor(psPickAnswer("nat_q", { meetingTime }));
      return;
    }
    if (intent === "has_appointment") {
      // B4: scenario-driven yes/no
      const hasAppt = !!state?.scenario?.hasAppointment;
      enqueueVisitor(psPickAnswer(hasAppt ? "has_appointment_yes" : "has_appointment_no", { meetingTime }));
      return;
    }
    if (intent === "who_meeting") {
      enqueueVisitor(psPickAnswer("who_meeting", { meetingTime }));
      return;
    }
    if (intent === "time_meeting") {
      enqueueVisitor(psPickAnswer("time_meeting", { meetingTime }));
      return;
    }
    if (intent === "about_meeting") {
      enqueueVisitor(psPickAnswer("about_meeting", { meetingTime }));
      return;
    }
    if (intent === "ask_id") {
      // B5: noId + idExpired
      if (state?.scenario?.noId) {
        enqueueVisitor(psPickAnswer("no_id", { meetingTime }));
        return;
      }
      showId();
      enqueueVisitor(psPickAnswer("ask_id", { meetingTime }));
      if (state?.scenario?.idExpired) {
        enqueueVisitor("…Actually, I’m not sure if it’s still valid.");
      }
      return;
    }
    if (intent === "return_id") {
      hideId();
      enqueueVisitor(psPickAnswer("return_id", { meetingTime }));
      return;
    }
    if (intent === "go_sign_in") {
      enqueueVisitor(psPickAnswer("ps_direct_signin", { meetingTime }));
      enqueueVisitor("Sign-in office (placeholder).");
      return;
    }

    // Unknown
    nudge('Try: “Surname and date of birth, please.”');
    enqueueVisitor("Okay.");
  }

  // -----------------------------
  // Gate dialogue (plus routing)
  // -----------------------------
  function handleStudent(raw) {
    const clean = String(raw || "").trim();
    if (!clean || !state) return;

    pushStudent(clean);
    const intent = detectIntent(clean);

    // Route to Person Search if active
    if (state.mode === "person_search") {
      handlePersonSearch(clean, intent);
      return;
    }

    // Deny stage shortcut
    if (state.stage === "deny_reason") {
      enqueueVisitor("Okay. I understand.");
      endConversation();
      return;
    }

    if (intent === "contact_supervisor") {
      openSupervisorModal();
      return;
    }

    if (intent === "return_id") {
      hideId();
      enqueueVisitor(visitorLineResolved("thanks"));
      return;
    }

    if (intent === "confront_nat") {
      enqueueVisitor(visitorLineResolved("nat_excuse"));
      return;
    }

    // Gate stages
    switch (state.stage) {
      case "start":
        if (intent === "greet") {
          state.stage = "help";
          enqueueVisitor(visitorLineResolved("need_help"));
          return;
        }
        if (intent === "help_open") {
          state.stage = "purpose";
          state.facts.why = "I need to get onto the base.";
          enqueueVisitor(visitorLineResolved("need_base"));
          return;
        }
        nudge("Try greeting first.");
        return;

      case "help":
        if (intent === "help_open") {
          state.stage = "purpose";
          state.facts.why = "I need to get onto the base.";
          enqueueVisitor(visitorLineResolved("need_base"));
          return;
        }
        if (intent === "greet") {
          enqueueVisitor(visitorLineResolved("greeting"));
          return;
        }
        nudge("Try: “How can I help you?”");
        return;

      case "purpose":
        if (intent === "purpose") {
          state.facts.purpose = "known";
          enqueueVisitor("I have an appointment on base.");
          return;
        }
        if (intent === "has_appointment") {
          const yesNo = state.scenario.hasAppointment ? "yes" : "no";
          state.facts.appt = yesNo;
          enqueueVisitor(yesNo === "yes" ? visitorLineResolved("appointment_yes") : visitorLineResolved("appointment_no"));
          return;
        }
        if (intent === "who_meeting") {
          state.facts.who = "known";
          enqueueVisitor(visitorLineResolved("who_meeting"));
          return;
        }
        if (intent === "time_meeting") {
          const t = getMeetingTimeHHMM();
          state.facts.meetingTime = t;
          state.facts.time = "known";
          enqueueVisitor(`At ${t}.`);
          return;
        }
        if (intent === "about_meeting") {
          state.facts.about = "known";
          enqueueVisitor(visitorLineResolved("about_meeting"));
          return;
        }
        if (intent === "ask_id") {
          showId();
          state.idChecked = true;
          state.stage = "control_q";
          enqueueVisitor("Sure. Here you go.");
          return;
        }
        nudge("Try 5W questions, or ask for ID.");
        return;

      case "control_q":
        if (intent === "dob_q") {
          enqueueVisitor(maybeLie(`My date of birth is ${state.visitor.dob}.`, `My date of birth is ${state.visitor.claimedDob}.`));
          return;
        }
        if (intent === "nat_q") {
          const truth = `My nationality is ${state.visitor.nat}.`;
          const lie = "My nationality is German.";
          enqueueVisitor(maybeLie(truth, lie));
          return;
        }
        if (intent === "spell_last_name") {
          enqueueVisitor(spellLastNameFromId());
          return;
        }
        if (intent === "we_search_you") {
          state.stage = "why_searched";
          enqueueVisitor(visitorLineResolved("search_why"));
          return;
        }
        nudge("Try a control question, or announce the search.");
        return;

      case "why_searched":
        if (intent === "everyone_searched" || intent === "due_threat") {
          state.stage = "illegal_items";
          enqueueVisitor("Okay.");
          return;
        }
        nudge("Try: “Everyone is searched due to an increased threat.”");
        return;

      case "illegal_items":
        if (intent === "illegal_items") {
          state.stage = "clarify_illegal";
          enqueueVisitor(visitorLineResolved("illegal_what"));
          return;
        }
        nudge("Try: “Do you have any illegal items?”");
        return;

      case "clarify_illegal": {
        const t = clean.toLowerCase();
        if (t.includes("weapon") || t.includes("knife") || t.includes("gun")) state.contraband.weapons = true;
        if (t.includes("drug")) state.contraband.drugs = true;
        if (t.includes("alcohol") || t.includes("beer") || t.includes("wine")) state.contraband.alcohol = true;

        if (intent === "illegal_clarify") {
          const missing = [];
          if (!state.contraband.weapons) missing.push("weapons");
          if (!state.contraband.drugs) missing.push("drugs");
          if (!state.contraband.alcohol) missing.push("alcohol");

          if (missing.length) enqueueVisitor(`Anything about ${missing.join(", ")}?`);
          else {
            state.stage = "direction";
            enqueueVisitor("No. Tell me where to go.");
          }
          return;
        }
        enqueueVisitor("Clarify: drugs, weapons and alcohol.");
        return;
      }

      case "direction":
        if (intent === "go_person_search") {
          enterPersonSearch();
          return;
        }
        if (intent === "go_sign_in") {
          enqueueVisitor("Sign-in office (placeholder).");
          return;
        }
        nudge("Try: “Let’s go to the person search.”");
        return;

      default:
        enqueueVisitor("Okay.");
        return;
    }
  }

  function endConversation() {
    if (!state) return;
    state.stage = "ended";
    if (textInput) textInput.disabled = true;
    if (btnSend) btnSend.disabled = true;
    if (holdToTalk) holdToTalk.disabled = true;
  }

  // -----------------------------
  // Sidebar buttons
  // -----------------------------
  btnDeny?.addEventListener("click", () => {
    if (!state) return;
    pushVisitor(visitorLineResolved("deny_why"));
    state.stage = "deny_reason";
  });

  btnNewScenario?.addEventListener("click", () => {
    if (textInput) textInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
    if (holdToTalk) holdToTalk.disabled = false;
    resetScenario();
  });

  btnReset?.addEventListener("click", () => {
    if (loginModal) loginModal.hidden = false;
    if (textInput) textInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
    if (holdToTalk) holdToTalk.disabled = false;
    history.length = 0;
    renderHistory();
    hideId();
    updateStudentPill();
    if (textInput) textInput.value = "";
  });

  btnReturn?.addEventListener("click", () => pushVisitor("Return (placeholder)."));

  btnPersonSearch?.addEventListener("click", () => {
    if (!state || state.stage === "ended") return;
    enterPersonSearch();
  });

  btnSignIn?.addEventListener("click", () => pushVisitor("Sign-in office (placeholder)."));

  btnReturnId?.addEventListener("click", () => {
    hideId();
    pushVisitor(visitorLineResolved("thanks"));
  });

  // -----------------------------
  // Input
  // -----------------------------
  btnSend?.addEventListener("click", () => {
    if (!state || state.stage === "ended") return;
    const t = (textInput?.value || "").trim();
    if (textInput) textInput.value = "";
    if (state && state.typing) state.typing.student = false;
    renderHistory();
    handleStudent(t);
  });

  textInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend?.click();
  });

  textInput?.addEventListener("input", () => {
    if (!state || !state.typing) return;
    state.typing.student = !!(textInput.value || "").trim();
    renderHistory();
  });

  // -----------------------------
  // Voice
  // -----------------------------
  let recognition = null;
  let isRecognizing = false;

  function setVoiceStatusSafe(text) {
    if (voiceStatus) voiceStatus.textContent = text;
  }

  async function ensureMicPermission() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      console.warn("Mic permission denied or unavailable", e);
      return false;
    }
  }

  function voiceSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setupSpeech() {
    if (!voiceSupported()) {
      setVoiceStatusSafe("Voice: not supported");
      if (holdToTalk) {
        holdToTalk.disabled = true;
        holdToTalk.title = "SpeechRecognition not supported in this browser.";
      }
      return;
    }

    const isLocalhost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const okContext = window.isSecureContext || location.protocol === "https:" || isLocalhost;

    if (!okContext) {
      setVoiceStatusSafe("Voice: use https/localhost");
      if (holdToTalk) {
        holdToTalk.disabled = true;
        holdToTalk.title = "Voice requires https:// or http://localhost (not file://).";
      }
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      if (state && state.typing) {
        state.typing.student = true;
        state.typing.visitor = false;
      }
      renderHistory();
      if (state) state._voiceSessionActive = true;
      setVoiceStatusSafe("Voice: listening…");
      holdToTalk?.classList.add("listening");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const chunk = (res && res[0] && res[0].transcript) ? res[0].transcript : "";
        if (res.isFinal) finalText += chunk;
        else interimText += chunk;
      }
      const combined = String(finalText || interimText || "").trim();
      if (combined && textInput) {
        textInput.value = combined;
      }
    };

    recognition.onerror = (e) => {
      const code = (e && (e.error || e.name)) ? String(e.error || e.name) : "error";
      console.warn("SpeechRecognition error:", code, e);
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");

      if (code.includes("not-allowed") || code.includes("service-not-allowed")) {
        setVoiceStatusSafe("Voice: blocked");
      } else if (code.includes("network")) {
        setVoiceStatusSafe("Voice: network");
      } else if (code.includes("no-speech")) {
        setVoiceStatusSafe("Voice: no speech");
      } else {
        setVoiceStatusSafe("Voice: error");
      }
    };

    recognition.onend = () => {
      setVoiceStatusSafe("Voice: ready");
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");

      if (state && state.typing) state.typing.student = false;
      renderHistory();

      // ✅ FIX: no invalid optional chaining like state?._voiceSessionActive
      if (VOICE_AUTOSEND && state && state._voiceSessionActive) {
        const toSend = (textInput?.value || "").trim();
        if (toSend) {
          handleStudent(toSend);
          if (textInput) textInput.value = "";
        }
      }
      if (state) state._voiceSessionActive = false;
    };
  }

  async function startListen() {
    if (!recognition || isRecognizing) return;
    try {
      const ok = await ensureMicPermission();
      if (!ok) {
        setVoiceStatusSafe("Voice: blocked");
        return;
      }
      recognition.start();
    } catch (err) {
      console.warn("recognition.start() failed", err);
      setVoiceStatusSafe("Voice: blocked");
    }
  }

  function stopListen() {
    if (!recognition || !isRecognizing) return;
    try { recognition.stop(); } catch { /* noop */ }
  }

  // Pointer + mouse/touch fallbacks
  holdToTalk?.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk?.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk?.addEventListener("pointercancel", stopListen);
  holdToTalk?.addEventListener("pointerleave", stopListen);

  if (holdToTalk) {
    let _holdActive = false;
    const _holdStart = (e) => {
      if (_holdActive) return;
      _holdActive = true;
      e?.preventDefault?.();
      startListen();
    };
    const _holdEnd = (e) => {
      if (!_holdActive) return;
      _holdActive = false;
      e?.preventDefault?.();
      stopListen();
    };
    holdToTalk.addEventListener("mousedown", _holdStart);
    holdToTalk.addEventListener("mouseup", _holdEnd);
    holdToTalk.addEventListener("touchstart", _holdStart, { passive: false });
    holdToTalk.addEventListener("touchend", _holdEnd, { passive: false });
    holdToTalk.addEventListener("touchcancel", _holdEnd, { passive: false });
  }

  // -----------------------------
  // Login
  // -----------------------------
  function tryStart() {
    const surname = (studentSurnameInput?.value || "").trim();
    const group = studentGroupSel?.value || "";
    const difficulty = studentDifficultySel?.value || "standard";

    if (!surname || !group) {
      if (loginError) loginError.style.display = "block";
      return;
    }
    if (loginError) loginError.style.display = "none";

    session = { surname, group, difficulty };
    saveStudentPrefill(session);
    updateStudentPill();

    if (loginModal) loginModal.hidden = true;

    // Unlock TTS after gesture
    primeTTS();

    resetScenario();
    textInput?.focus();
  }

  btnStartTraining?.addEventListener("click", tryStart);
  studentSurnameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") tryStart(); });

  // -----------------------------
  // Supervisor events
  // -----------------------------
  btnCloseSupervisor?.addEventListener("click", closeSupervisorModal);
  supervisorModal?.addEventListener("click", (e) => { if (e.target === supervisorModal) closeSupervisorModal(); });
  btnSupervisorCheck?.addEventListener("click", runSupervisorChecks);
  btnReturnToVisitor?.addEventListener("click", () => {
    runSupervisorChecks();
    closeSupervisorModal();
    hideId();
    pushStudent("Okay. Everything checks out. Here is your ID back.");
    pushVisitor(visitorLineResolved("thanks"));
    if (state) state.stage = "why_searched";
  });

  // -----------------------------
  // Boot
  // -----------------------------
  const pre = loadStudentPrefill();
  if (pre && typeof pre === "object") {
    if (pre.surname && studentSurnameInput) studentSurnameInput.value = pre.surname;
    if (pre.group && studentGroupSel) studentGroupSel.value = pre.group;
    if (pre.difficulty && studentDifficultySel) studentDifficultySel.value = pre.difficulty;
  }

  updateStudentPill();
  syncVisitorAvatars();
  setupSpeech();

  // Show login initially
  if (loginModal) loginModal.hidden = false;
  renderHistory();
})();
