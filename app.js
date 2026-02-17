// app.js (phrasebank-enabled)
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // -------- Config / Build --------
  const CFG = window.CONFIG || {};
  const BUILD = window.BUILD || { version: "dev", name: "VEVA Trainer", date: "" };

  const ASSET_BASE = CFG.assetBase || "assets/photos";
  const HEADSHOT_PREFIX = CFG.headshotPrefix || "headshot_";
  const HEADSHOT_COUNT = Number(CFG.headshotCount || 10);

  const _voiceCfg = (CFG.voiceAutosend !== undefined) ? CFG.voiceAutosend
                  : (CFG.voiceAutoSend !== undefined) ? CFG.voiceAutoSend
                  : undefined;
  const VOICE_AUTOSEND = (_voiceCfg === undefined) ? true : !!_voiceCfg;

  const MAX_VISIBLE_BUBBLES = 4;

  const TRANSPARENT_PX =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  // -------- UI --------
  const versionPill = $("#versionPill");
  const studentPill = $("#studentPill");
  const voiceStatus = $("#voiceStatus");
  const debugPill = $("#debugPill");

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
  const idBarcode2 = $("#idBarcode2");

  const hintBand = $("#hintBand");
  const hintBandText = $("#hintBandText");

  // Supervisor modal (optional)
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

  // Chat slots
  const slotEls = [
    { row: $("#slot0"), av: $("#slot0Avatar"), txt: $("#slot0Text"), meta: $("#slot0Meta") },
    { row: $("#slot1"), av: $("#slot1Avatar"), txt: $("#slot1Text"), meta: $("#slot1Meta") },
    { row: $("#slot2"), av: $("#slot2Avatar"), txt: $("#slot2Text"), meta: $("#slot2Meta") },
    { row: $("#slot3"), av: $("#slot3Avatar"), txt: $("#slot3Text"), meta: $("#slot3Meta") },
    { row: $("#slot4"), av: $("#slot4Avatar"), txt: $("#slot4Text"), meta: $("#slot4Meta") },
    { row: $("#slot5"), av: $("#slot5Avatar"), txt: $("#slot5Text"), meta: $("#slot5Meta") },
  ];
  const MAX_SLOTS = slotEls.length;

  // -------- Version banner --------
  const __assetVer = String(window.__ASSET_VER__ || "");
  const __assetShort = __assetVer ? __assetVer.slice(-6) : "";
  if (versionPill) versionPill.textContent = `v${BUILD.version}${__assetShort ? " · " + __assetShort : ""}`;
  document.title = `${BUILD.name} v${BUILD.version}${__assetShort ? " (" + __assetShort + ")" : ""}`;

  // -------- Helpers --------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pad2 = (n) => String(n).padStart(2, "0");

  function pick(arr){
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function fillVars(template){
    const vars = {
      name: state?.visitor?.name || ID_DATA?.name || "",
      first: state?.visitor?.first || ID_DATA?.first || "",
      last: state?.visitor?.last || ID_DATA?.last || "",
      dob: state?.visitor?.dob || ID_DATA?.dob || "",
      nat: state?.visitor?.nat || ID_DATA?.nat || "",
      idNo: state?.visitor?.idNo || ID_DATA?.idNo || "",
      meetingTime: (state?.facts?.meetingTime) || "",
      claimedName: state?.claimed?.name || state?.visitor?.name || ID_DATA?.name || "",
      claimedFirst: state?.claimed?.first || state?.visitor?.first || ID_DATA?.first || "",
      claimedLast: state?.claimed?.last || state?.visitor?.last || ID_DATA?.last || ""
    };
    return String(template || "").replace(/\{(\w+)\}/g, (_,k)=> (vars[k]!==undefined ? String(vars[k]) : ""));
  }


  function normalize(s){
    return String(s || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}: ]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // -------- Assets / Avatars --------
  const soldierAvatar = new Image();
  soldierAvatar.src = `${ASSET_BASE}/soldier.png`;
  soldierAvatar.onerror = () => { soldierAvatar.src = TRANSPARENT_PX; };

  const visitorAvatar = portraitPhoto || { src: "" };

  // -------- Session (student) --------
  const STUDENT_KEY = "veva.student.v2";
  let session = { surname:"", group:"", difficulty:"standard" };

  function loadStudentPrefill(){
    try{ return JSON.parse(localStorage.getItem(STUDENT_KEY) || "null"); } catch { return null; }
  }
  function saveStudentPrefill(v){
    try{ localStorage.setItem(STUDENT_KEY, JSON.stringify(v)); } catch {}
  }
  function updateStudentPill(){
    if (!studentPill) return;
    if (!session.surname || !session.group){
      studentPill.textContent = "Student: —";
      return;
    }
    const cap = (s) => (s||"").charAt(0).toUpperCase() + (s||"").slice(1);
    studentPill.textContent = `Student: ${session.surname} | Group: ${session.group} | ${cap(session.difficulty)}`;
  }

  // -------- ID + Visitor (MALE ONLY) --------
  function headshotPath(index){
    return `${ASSET_BASE}/${HEADSHOT_PREFIX}${pad2(index)}.png`;
  }

  function makeRandomId(){
    const idx = randInt(1, HEADSHOT_COUNT);
    const FIRST = ["Liam","Noah","James","Oliver","Lucas","Milan","Daan","Sem","Jayden","Finn","Benjamin","Ethan","Jack","Thomas"];
    const LAST  = ["Miller","Bakker","de Vries","Jansen","Visser","Smit","Bos","van Dijk","de Jong","Meijer"];
    const NATS  = ["Dutch","German","Belgian","French","British"];
    const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    const first = pick(FIRST);
    const last  = pick(LAST);
    const year  = randInt(1976, 2002);
    const month = MONTHS[randInt(0, MONTHS.length - 1)];
    const day   = pad2(randInt(1, 28));
    const nat   = pick(NATS);
    const idNo  = (nat === "Dutch" ? "NL-" : nat === "German" ? "DE-" : nat === "Belgian" ? "BE-" : nat === "French" ? "FR-" : "UK-")
                  + randInt(100000, 999999);

    return {
      first, last,
      name: `${first} ${last}`,
      dob: `${day} ${month} ${year}`,
      nat, idNo,
      headshotIndex: idx,
      photoSrc: headshotPath(idx)
    };
  }

  // -------- Appointment contact (POC) --------
  function makeContact(){
    const RANKS = ["Sergeant","Corporal","Lieutenant","Captain"];
    const LASTS = ["Burke","Berk","Berg","de Vries","Jansen","Smit","Miller","Visser","Bos","van Dijk"];
    const rank = pick(RANKS);
    // Pick a base surname; for "sounds like" we generate 2 nearby variants
    const baseLast = pick(LASTS);
    const variants = Array.from(new Set([
      baseLast,
      baseLast.replace(/e/gi,"e"),
      baseLast.replace(/e/gi,""),
      baseLast.replace(/u/gi,"e"),
      baseLast.replace(/k$/i,"ke"),
      baseLast.replace(/ke$/i,"k"),
      baseLast.replace(/g$/i,"k"),
      baseLast.replace(/k$/i,"g"),
    ])).filter(Boolean).slice(0,4);
    const alt1 = variants[1] || baseLast;
    const alt2 = variants[2] || alt1;
    const lastAlt = (Math.random() < 0.5) ? alt1 : alt2;

    return {
      rank,
      last: baseLast,
      lastAlt,
      full: `${rank} ${baseLast}`
    };
  }


  let ID_DATA = makeRandomId();

  function syncVisitorAvatars(){
    if (portraitPhoto) portraitPhoto.src = ID_DATA.photoSrc;
    visitorAvatar.src = ID_DATA.photoSrc;
    if (idPhoto) idPhoto.src = ID_DATA.photoSrc;
  }

  // -------- Mood --------
  const MOODS = [
    { key:"relaxed",  line:"The visitor looks relaxed.",  liarBias:0.08 },
    { key:"neutral",  line:"The visitor looks neutral.",  liarBias:0.12 },
    { key:"mixed",    line:"The visitor looks a bit uneasy.", liarBias:0.22 },
    { key:"nervous",  line:"The visitor looks nervous.",  liarBias:0.35 },
    { key:"irritated",line:"The visitor looks irritated.",liarBias:0.28 }
  ];
  let currentMood = MOODS[1];
  function syncMoodUI(){
    if (portraitMood) portraitMood.textContent = currentMood?.line || "";
  }

  // -------- Phrasebank integration --------
  const PS = window.PS_PATCH || null;

  function currentBand(){
    try{
      const k = currentMood?.key || "neutral";
      return (PS && typeof PS.bandFromMoodKey === "function") ? (PS.bandFromMoodKey(k) || "cautious") : "cautious";
    }catch{
      return "cautious";
    }
  }

  function placeholderMap(){
    const v = (state?.visitor) ? state.visitor : ID_DATA;
    const meetingTime = (state?.facts?.meetingTime && /^\d{2}:\d{2}$/.test(state.facts.meetingTime))
      ? state.facts.meetingTime
      : (state ? getMeetingTimeHHMM() : "");

    const claimed = state?.claimed || { name: v.name, first: v.first, last: v.last };

    return {
      name: v?.name || "",
      first: v?.first || "",
      last: v?.last || "",
      dob: v?.dob || "",
      nat: v?.nat || "",
      idNo: v?.idNo || "",
      meetingTime: meetingTime || "",
      claimedName: claimed?.name || (v?.name || ""),
      claimedFirst: claimed?.first || (v?.first || ""),
      claimedLast: claimed?.last || (v?.last || ""),
      contactName: v?.contact?.full || "",
      contactRank: v?.contact?.rank || "",
      contactLast: v?.contact?.last || "",
      contactLastAlt: v?.contact?.lastAlt || (v?.contact?.last || ""),
    };
  }

  function resolvePlaceholders(s){
    const map = placeholderMap();
    return String(s || "").replace(/\{([A-Za-z0-9_]+)\}/g, (m, key) => {
      return (map[key] !== undefined) ? String(map[key]) : m;
    });
  }

    function pickBank(key, fallbackArr, opts={}){
    const bank = window.PS_PATCH?.QA?.[key];
    if (!bank){
      state._lastBankBand = null;
      state._lastBankKey = null;
      return pick(fallbackArr) || "Okay.";
    }

    let band = window.PS_PATCH.bandFromMoodKey(currentMood?.key);
    if (opts.forceNonEvasive && band === "evasive") band = "cautious";
    if (opts.forceBand && bank[opts.forceBand]) band = opts.forceBand;

    const arr = bank[band] || bank.cautious || bank.open || bank.evasive || [];
    const line = pick(arr) || "Okay.";

    state._lastBankBand = band;
    state._lastBankKey = key;

    return fillVars(line);
  }

  function pickBankNonEvasive(key, fallbackArr){
    // If the mood maps to evasive, pick a non-evasive band so the training can always progress.
    return pickBank(key, fallbackArr, { forceNonEvasive: true });
  }

  const PRESS_HINT_TEXT =
    'Press for an answer: "I need an answer to that question, otherwise entry will be denied."';

  function showPressHint(){
    if (!hintBand || !shouldShowHints() || state?.idVisible) return;
    if (state?._pressHintLock) return;
    state._pressHintLock = true;
    hintBand.hidden = false;
    hintBand.style.display = "";
    setHintText(PRESS_HINT_TEXT);
  }

  function clearPressHint(){
    if (!hintBand) return;
    if (!state?._pressHintLock) return;
    state._pressHintLock = false;
    updateHintBand();
  }

  // -------- ID card show/hide --------
  let state = null;

  function showId(){
    if (!idCardWrap || !state?.visitor) return;

    if (idName) idName.textContent = state.visitor.name || "";
    if (idSurname) idSurname.textContent = state.visitor.last || "";
    if (idDob) idDob.textContent = state.visitor.dob || "";
    if (idNat) idNat.textContent = state.visitor.nat || "";
    if (idNo) idNo.textContent = state.visitor.idNo || "";
    if (idPhoto) idPhoto.src = state.visitor.photoSrc || TRANSPARENT_PX;
    if (idBarcode2) idBarcode2.textContent = `VEVA|${state.visitor.idNo}|${state.visitor.dob}|${state.visitor.nat}`;

    idCardWrap.hidden = false;
    idCardWrap.style.display = "";
    state.idVisible = true;

    if (hintBand) hintBand.hidden = true;
  }

  function hideId(){
    if (idCardWrap){
      idCardWrap.hidden = true;
      idCardWrap.style.display = "none";
    }
    if (state) state.idVisible = false;
    updateHintBand(true);
  }

  // -------- Hint band (optional) --------
  function shouldShowHints(){
    return (session?.difficulty || "standard") !== "advanced";
  }
  function setHintText(t){
    if (!hintBandText) return;
    hintBandText.textContent = t || "";
  }
  function getNextHint(){
    const f = state?.facts || {};
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
  function updateHintBand(force=false){
    if (!hintBand) return;
    if (!shouldShowHints()){
      hintBand.hidden = true;
      hintBand.style.display = "none";
      return;
    }
    if (state?.idVisible){
      hintBand.hidden = true;
      hintBand.style.display = "none";
      return;
    }

    const diff = (session?.difficulty || "standard");
    const canShow = force || diff === "basic" || (diff === "standard" && (state?.misses || 0) >= 2);

    if (!canShow){
      hintBand.hidden = true;
      hintBand.style.display = "none";
      return;
    }

    hintBand.hidden = false;
    hintBand.style.display = "";
    setHintText(getNextHint());
  }
  function nudge(t){
    if (!state) return;
    state.misses = (state.misses || 0) + 1;
    if (!shouldShowHints() || state?.idVisible) return;
    setHintText(t || getNextHint());
    if (hintBand){
      hintBand.hidden = false;
      hintBand.style.display = "";
    }
  }

  // -------- Chat history --------
  let history = []; // newest first: {side, text}

  function hardHideRow(slot){
    if (!slot?.row) return;
    slot.row.hidden = true;
    slot.row.style.display = "none";

    if (slot.av){
      slot.av.hidden = true;
      slot.av.style.display = "none";
      slot.av.src = TRANSPARENT_PX;
      slot.av.alt = "";
    }
    if (slot.txt){
      slot.txt.classList.remove("typing");
      slot.txt.textContent = "";
    }
    if (slot.meta) slot.meta.textContent = "";
  }

  function showRow(slot){
    if (!slot?.row) return;
    slot.row.hidden = false;
    slot.row.style.display = "";
    if (slot.av){
      slot.av.hidden = false;
      slot.av.style.display = "";
    }
  }

  function renderHistory(){
    const base = history.slice(0, Math.min(MAX_VISIBLE_BUBBLES, MAX_SLOTS));
    const typingMsg =
      (state?.typing?.visitor) ? { side:"visitor", typing:true } :
      (state?.typing?.student) ? { side:"student", typing:true } :
      null;

    const view = typingMsg ? [typingMsg, ...base].slice(0, Math.min(MAX_VISIBLE_BUBBLES, MAX_SLOTS)) : base;

    for (let i = 0; i < MAX_SLOTS; i++){
      const msg = view[i];
      const slot = slotEls[i];
      if (!slot?.row) continue;

      if (!msg){
        hardHideRow(slot);
        continue;
      }

      showRow(slot);

      slot.row.classList.toggle("left", msg.side === "visitor");
      slot.row.classList.toggle("right", msg.side === "student");

      // avatar
      if (slot.av){
        if (msg.side === "visitor"){
          slot.av.src = visitorAvatar.src || TRANSPARENT_PX;
          slot.av.alt = "Visitor";
        } else {
          slot.av.src = soldierAvatar.src || TRANSPARENT_PX;
          slot.av.alt = "Soldier";
        }
      }

      if (slot.meta) slot.meta.textContent = "";

      if (slot.txt){
        slot.txt.classList.toggle("typing", !!msg.typing);
        if (msg.typing){
          slot.txt.innerHTML =
            '<span class="typingDots" aria-label="Typing"><span></span><span></span><span></span></span>';
        } else {
          slot.txt.textContent = msg.text || "";
        }
      }
    }
  }

  function pushVisitor(text){
    const t = String(text || "").trim();
    if (!t) return;
    history.unshift({ side:"visitor", text:t });
    history = history.slice(0, MAX_VISIBLE_BUBBLES);
    if (state) state.misses = 0;
    renderHistory();
  setDebugPill(`Intent: — · Stage: ${state.stage}`);
    updateHintBand();
    speakVisitor(t);
  }

  function pushStudent(text){
    const t = String(text || "").trim();
    if (!t) return;
    if (state?.typing) state.typing.student = false;
    history.unshift({ side:"student", text:t });
    history = history.slice(0, MAX_VISIBLE_BUBBLES);
    if (state) state.misses = 0;
    renderHistory();
    updateHintBand();
  }

  // Visitor delayed replies with typing dots
  const VISITOR_REPLY_DELAY_MS = 900;
  const VISITOR_APPROACH_DELAY_MS = 5000;
  const _visitorQueue = [];
  let _approachTimer = null;

  let _visitorTimer = null;

  function enqueueVisitor(text){
    const t = String(text || "").trim();
    if (!t) return;
    _visitorQueue.push(t);
    drainVisitorQueue();
  }

  function drainVisitorQueue(){
    if (_visitorTimer) return;
    if (!_visitorQueue.length) return;

    if (state?.typing){
      state.typing.visitor = true;
      state.typing.student = false;
    }
    renderHistory();

    _visitorTimer = setTimeout(() => {
      _visitorTimer = null;
      if (state?.typing) state.typing.visitor = false;

      const next = _visitorQueue.shift();
      if (next) pushVisitor(next);

      if (_visitorQueue.length) drainVisitorQueue();
    }, VISITOR_REPLY_DELAY_MS);
  }

  // -------- Meeting time helper --------
  function getMeetingTimeHHMM(){
    state.facts = state.facts || {};
    if (state.facts.meetingTime && /^\d{2}:\d{2}$/.test(state.facts.meetingTime)) return state.facts.meetingTime;
    const now = new Date();
    const offsetMin = randInt(15, 25);
    const dt = new Date(now.getTime() + offsetMin * 60 * 1000);
    const hhmm = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    state.facts.meetingTime = hhmm;
    return hhmm;
  }

  function spellLastName(){
    const full = (ID_DATA?.name) ? String(ID_DATA.name) : "Miller";
    const parts = full.trim().split(/\s+/).filter(Boolean);
    const ln = parts.length ? parts[parts.length - 1] : full;
    const letters = ln.replace(/[^A-Za-z]/g, "").toUpperCase().split("");
    return letters.length ? letters.join("-") : ln.toUpperCase();
  }

  // -------- Fallback visitor lines (only when phrasebank lacks a key) --------
  const VISITOR_FALLBACK = {
    greeting: ["Hello."],
    need_help: ["I… need help."],
    need_base: ["I need to get onto the base."],
    appointment_yes: ["Yes, I have an appointment."],
    who_meeting: ["I’m meeting Sergeant de Vries."],
    about_meeting: ["It’s a delivery for the workshop—tools and spare parts."],
    search_why: ["Why am I being searched?"],
    illegal_what: ["What do you mean by illegal items?"],
    deny_why: ["Why are you denying me?"],
    thanks: ["Thanks."]
  };

    // -------- Intents (loaded via patches) --------

  function getIntentList(){
    const list = window.VEVA_INTENTS;
    return Array.isArray(list) ? list : [];
  }

    function detectIntent(text){
    const raw = String(text || "");
    const n = normalize(raw);

    // Priority disambiguation (fixes "With whom..." being misread as appointment yes/no)
    if (/\bwith\s+who(m)?\b/i.test(n) || /\bwho\s+are\s+you\s+(meeting|seeing)\b/i.test(n) || /\bappointment\s+with\b/i.test(n)){
      return "who_meeting";
    }
    if (/\bwhat\s+time\b/i.test(n) || (/\bwhen\b/i.test(n) && /\b(appointment|meeting)\b/i.test(n))){
      return "time_meeting";
    }
    if (/\b(what\s+is|what's)\b/i.test(n) && /\b(appointment|meeting)\b/i.test(n) && /\babout\b/i.test(n)){
      return "about_meeting";
    }

    // Generic intent matchers (loaded from intents_patch_en.js or other patches)
    for (const it of getIntentList()){
      try{
        if (it && it.rx && it.rx.test(raw)) return it.key;
      }catch{}
    }
    return "unknown";
  }

  // -------- Scenario state --------
  function resetScenario(){
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    syncMoodUI();

    ID_DATA = makeRandomId();
    syncVisitorAvatars();

    history.length = 0;

    state = {
      stage: "approach",
      askCounts: {},
      misses: 0,
      askCounts: { purpose: 0 },
      typing: { visitor:false, student:false },
      contraband: { weapons:false, drugs:false, alcohol:false },
      idVisible: false,
      idChecked: false,
      visitor: { ...ID_DATA, contact: makeContact() },
      claimed: { name: ID_DATA.name, first: ID_DATA.first, last: ID_DATA.last },
      facts: { name:"", purpose:"", appt:"", who:"", time:"", about:"", meetingTime:"" }
    };

    hideId();
    updateHintBand(true);

    // Start: show an "approach" cue first, then greet after a delay (gives students time)
    if (portraitMood){
      const moodLine = currentMood?.line || "";
      portraitMood.textContent = `A visitor walks up to the gate. ${moodLine}`;
    }
    const hello = pickBank("greeting", VISITOR_FALLBACK.greeting);

    // clear any previous scheduled greeting
    if (_approachTimer) { try{ clearTimeout(_approachTimer); }catch{} _approachTimer = null; }
    _approachTimer = setTimeout(() => {
      _approachTimer = null;
      if (state) state.stage = "start";
      pushVisitor(hello);
    }, VISITOR_APPROACH_DELAY_MS);
  }

  // -------- Dialogue --------
  function handleStudent(raw){
    const clean = String(raw || "").trim();
    if (!clean || !state || state.stage === "ended") return;

    // During the approach delay we ignore input (prevents weird pre-greeting dialogue)
    if (state.stage === "approach") return;

    pushStudent(clean);

    const intent = detectIntent(clean);

    // Open the Supervisor Check (5W/H) modal
    if (intent === "contact_supervisor"){
      openSupervisorModal();
      return;
    }

    const QUESTION_INTENTS = new Set(["ask_name","purpose","has_appointment","who_meeting","time_meeting","about_meeting"]);
    if (QUESTION_INTENTS.has(intent)) state.lastAsked = intent;

    // If the visitor was evasive, the student can "press for an answer".
    if (intent === "press_for_answer" || intent === "insist_reason" || intent === "ultimatum_reason"){
      const map = {
        ask_name: "ask_name",
        purpose: "purpose",
        has_appointment: "has_appointment_yes",
        who_meeting: "who_meeting",
        time_meeting: "time_meeting",
        about_meeting: "about_meeting"
      };
      const key = map[state.lastEvasiveFor] || map[state.lastAsked] || null;
      if (key){
        const forced = pickBank(key, null, { forceBand: "open", forceNonEvasive: true });
        enqueueVisitor(forced);

        // Mark info as gathered so the hint logic progresses
        if (state.lastAsked === "ask_name") state.facts.name = state.visitor.name;
        if (state.lastAsked === "purpose") state.facts.purpose = "known";
        if (state.lastAsked === "has_appointment") state.facts.appt = "yes";
        if (state.lastAsked === "who_meeting") state.facts.who = "known";
        if (state.lastAsked === "time_meeting") state.facts.time = "known";
        if (state.lastAsked === "about_meeting") state.facts.about = "known";

        state.lastEvasiveFor = null;
        clearPressHint();
        return;
      }
      enqueueVisitor("Understood.");
      clearPressHint();
      return;
    }


    // Track how many times each intent/question was asked
    state.askCounts = state.askCounts || {};
    if (intent && intent !== "unknown"){
      state.askCounts[intent] = (state.askCounts[intent] || 0) + 1;
    }

    // ---- Global 5W: name should ALWAYS be answerable (fix for "who are you?") ----
    // Students often ask the name early. Previously, some stages didn't handle ask_name,
    // which made the visitor dodge unintentionally. We answer consistently.
    if (intent === "ask_name"){
      // Progress tracking
      state.facts = state.facts || {};
      state.facts.name = state.visitor?.name || "known";

      const q = clean.toLowerCase();
      const first = state.visitor?.first || (state.visitor?.name || "").split(/\s+/)[0] || "";
      const last  = state.visitor?.last  || "";
      const full  = state.visitor?.name  || [first, last].filter(Boolean).join(" ");

      // If they explicitly ask for FULL name / surname, give full; otherwise just first name.
      if (/\b(full\s+name|surname|last\s+name)\b/i.test(q)){
        enqueueVisitor(full ? `My name is ${full}.` : "My name is on the ID.");
      } else {
        enqueueVisitor(first ? `My first name is ${first}.` : "My name is on the ID.");
      }
      return;
    }

    // Debug info
    setDebugPill(`Intent: ${intent} · Stage: ${state.stage}`);

    // progress tracking (for hints)
    if (intent === "ask_name") state.facts.name = state.visitor.name;
    if (intent === "purpose") state.facts.purpose = "known";
    if (intent === "has_appointment") state.facts.appt = "yes";
    if (intent === "who_meeting") state.facts.who = "known";
    if (intent === "time_meeting") state.facts.time = "known";
    if (intent === "about_meeting") state.facts.about = "known";
    if (intent === "ask_id") state.idChecked = true;

    switch(state.stage){
      case "start":
        if (intent === "greet"){
          state.stage = "help";
          enqueueVisitor(pickBank("need_help", VISITOR_FALLBACK.need_help));
          return;
        }
        if (intent === "help_open"){
          state.stage = "purpose";
          state.facts.purpose = "pending";
          const line = pickBank("purpose", VISITOR_FALLBACK.need_base);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "purpose"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        nudge("Try greeting first.");
        return;

      case "help":
        if (intent === "help_open"){
          state.stage = "purpose";
          const line = pickBank("purpose", VISITOR_FALLBACK.need_base);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "purpose"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        if (intent === "greet"){
          enqueueVisitor(pickBank("greeting", VISITOR_FALLBACK.greeting));
          return;
        }
        nudge('Try: “How can I help you?”');
        return;

      case "purpose":
        if (intent === "purpose"){
          state.askCounts = state.askCounts || { purpose: 0 };
          state.askCounts.purpose = (state.askCounts.purpose || 0) + 1;

          // First answer may be evasive depending on mood; on 2nd ask we force a clear reason so training can continue.
          if (state.askCounts.purpose >= 2){
            state.facts.purpose = "known";
            enqueueVisitor(pickBankNonEvasive("purpose", ["I have an appointment on base."]));
          } else {
            const line = pickBank("purpose", ["I have an appointment on base."]);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "purpose"; showPressHint(); } else { clearPressHint(); }
          }
          return;
        }

        // If student insists / gives an ultimatum, visitor will comply with a clear purpose
        if (intent === "insist_reason" || intent === "ultimatum_reason"){
          state.askCounts = state.askCounts || { purpose: 0 };
          state.askCounts.purpose = Math.max(2, state.askCounts.purpose || 0);
          state.facts.purpose = "known";
          enqueueVisitor(pickBankNonEvasive("purpose", ["I have an appointment on base."]));
          return;
        }
        if (intent === "has_appointment"){
          state.facts.appt = "yes";
          const line = pickBank("has_appointment_yes", VISITOR_FALLBACK.appointment_yes);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "has_appointment"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        if (intent === "who_meeting"){
          const line = pickBank("who_meeting", VISITOR_FALLBACK.who_meeting);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "who_meeting"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        if (intent === "time_meeting"){
          const t = getMeetingTimeHHMM();
          state.facts.meetingTime = t;
          const line = pickBank("time_meeting", [`At ${t}.`]);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "time_meeting"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        if (intent === "about_meeting"){
          const line = pickBank("about_meeting", VISITOR_FALLBACK.about_meeting);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "about_meeting"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        if (intent === "ask_id"){
          showId();
          state.stage = "control_q";
          const line = pickBank("ask_id", ["Sure. Here you go."]);
          enqueueVisitor(line);
          if (state._lastBankBand === "evasive") { state.lastEvasiveFor = "ask_id"; showPressHint(); } else { clearPressHint(); }
          return;
        }
        nudge("Try 5W questions, or ask for ID.");
        return;

      case "control_q":
        if (intent === "dob_q"){
          enqueueVisitor(pickBank("dob_q", [`My date of birth is ${ID_DATA.dob}.`]));
          return;
        }
        if (intent === "nat_q"){
          enqueueVisitor(pickBank("nat_q", [`My nationality is ${ID_DATA.nat}.`]));
          return;
        }
        if (intent === "spell_last_name"){
          enqueueVisitor(pickBank("spell_last_name", [spellLastName()]));
          return;
        }
        if (intent === "return_id"){
          hideId();
          enqueueVisitor(pickBank("return_id", VISITOR_FALLBACK.thanks));
          state.stage = "search_announce";
          return;
        }
        nudge("Try a control question, or return the ID.");
        return;

      case "search_announce":
        if (intent === "we_search_you"){
          state.stage = "why_searched";
          enqueueVisitor(pick(VISITOR_FALLBACK.search_why));
          return;
        }
        nudge('Try: “You will be searched.”');
        return;

      case "why_searched":
        if (intent === "everyone_searched" || intent === "due_threat"){
          state.stage = "illegal_items";
          enqueueVisitor("Okay.");
          return;
        }
        nudge("Explain: routine search / heightened security.");
        return;

      case "illegal_items":
        if (intent === "illegal_items"){
          state.stage = "clarify_illegal";
          enqueueVisitor(pick(VISITOR_FALLBACK.illegal_what));
          return;
        }
        nudge("Ask: illegal items / contraband.");
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
            enqueueVisitor(`Anything about ${missing.join(", ")}?`);
          } else {
            state.stage = "direction";
            enqueueVisitor("No. Tell me where to go.");
          }
          return;
        }
        enqueueVisitor("Clarify: drugs, weapons and alcohol.");
        return;
      }

      case "direction":
        if (intent === "go_person_search"){
          enqueueVisitor("Okay.");
          return;
        }
        nudge("Try: “Go to person search.”");
        return;

      default:
        enqueueVisitor("Okay.");
        return;
    }
  }

  // -------- Sidebar buttons --------
  btnDeny?.addEventListener("click", () => {
    enqueueVisitor(pickBank("deny_why", VISITOR_FALLBACK.deny_why));
  });

  btnNewScenario?.addEventListener("click", () => {
    if (!textInput || !btnSend || !holdToTalk) return;
    // Ensure TTS can play even if the scenario is started from this button.
    ensureTTSUnlocked();
    textInput.disabled = false;
    btnSend.disabled = false;
    holdToTalk.disabled = false;
    resetScenario();
  });

  btnReset?.addEventListener("click", () => {
    loginModal.hidden = false;
    if (textInput) textInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
    if (holdToTalk) holdToTalk.disabled = false;

    history.length = 0;
    renderHistory();
    hideId();
    updateStudentPill();
    if (textInput) textInput.value = "";
  });

  btnReturn?.addEventListener("click", () => enqueueVisitor("Return (placeholder)."));
  btnPersonSearch?.addEventListener("click", () => enqueueVisitor("Person search (placeholder)."));
  btnSignIn?.addEventListener("click", () => enqueueVisitor("Sign-in office (placeholder)."));

  btnReturnId?.addEventListener("click", () => {
    hideId();
    enqueueVisitor(pickBank("return_id", VISITOR_FALLBACK.thanks));
  });

  // -------- Input --------
  btnSend?.addEventListener("click", () => {
    if (!state || state.stage === "ended") return;
    const t = (textInput?.value || "").trim();
    if (textInput) textInput.value = "";
    handleStudent(t);
  });

  textInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend?.click();
  });

  textInput?.addEventListener("input", () => {
    if (!state?.typing) return;
    state.typing.student = !!(textInput.value || "").trim();
    renderHistory();
  });

  // -------- Voice (SpeechRecognition) --------
  let recognition = null;
  let isRecognizing = false;

  
  // -------- Debug pill (intent/stage) --------
  const DEBUG_ENABLED = (CFG.debug !== undefined) ? !!CFG.debug : true;

  function setDebugPill(text){
    if (!debugPill) return;
    if (!DEBUG_ENABLED){
      debugPill.hidden = true;
      return;
    }
    debugPill.hidden = false;
    debugPill.textContent = text || "Debug: —";
  }

function setVoiceStatusSafe(text){
    if (voiceStatus) voiceStatus.textContent = text;
  }

  async function ensureMicPermission(){
    try{
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return true;
    }catch{
      return false;
    }
  }

  function voiceSupported(){
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function setupSpeech(){
    if (!voiceSupported()){
      setVoiceStatusSafe("Voice: not supported");
      if (holdToTalk){
        holdToTalk.disabled = true;
        holdToTalk.title = "SpeechRecognition not supported in this browser.";
      }
      return;
    }

    const isLocalhost = (location.hostname === "localhost" || location.hostname === "127.0.0.1");
    const okContext = window.isSecureContext || location.protocol === "https:" || isLocalhost;
    if (!okContext){
      setVoiceStatusSafe("Voice: use https/localhost");
      if (holdToTalk){
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
      if (state?.typing){
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
      for (let i = event.resultIndex; i < event.results.length; i++){
        const res = event.results[i];
        const chunk = (res && res[0] && res[0].transcript) ? res[0].transcript : "";
        if (res.isFinal) finalText += chunk;
        else interimText += chunk;
      }
      const combined = String(finalText || interimText || "").trim();
      if (combined && textInput) textInput.value = combined;
    };

    recognition.onerror = () => {
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");
      setVoiceStatusSafe("Voice: error");
    };

    recognition.onend = () => {
      setVoiceStatusSafe("Voice: ready");
      isRecognizing = false;
      holdToTalk?.classList.remove("listening");
      if (state?.typing) state.typing.student = false;
      renderHistory();

      if (VOICE_AUTOSEND && state && state._voiceSessionActive){
        const toSend = (textInput?.value || "").trim();
        if (toSend){
          handleStudent(toSend);
          if (textInput) textInput.value = "";
        }
      }

      if (state) state._voiceSessionActive = false;
    };
  }

  async function startListen(){
    if (!recognition || isRecognizing) return;
    const ok = await ensureMicPermission();
    if (!ok){
      setVoiceStatusSafe("Voice: blocked");
      return;
    }
    try { recognition.start(); } catch {}
  }

  function stopListen(){
    if (!recognition || !isRecognizing) return;
    try { recognition.stop(); } catch {}
  }

  holdToTalk?.addEventListener("pointerdown", (e) => { e.preventDefault(); startListen(); });
  holdToTalk?.addEventListener("pointerup", (e) => { e.preventDefault(); stopListen(); });
  holdToTalk?.addEventListener("pointercancel", stopListen);
  holdToTalk?.addEventListener("pointerleave", stopListen);

  // -------- Visitor TTS (male-ish) --------
  let VISITOR_TTS_ENABLED = true;
  let _ttsReady = false;

  // Some browsers (notably Chrome) will block audio output until *after* a user gesture.
  // We "unlock" TTS on the first pointer/key interaction and also when starting a scenario.
  function ensureTTSUnlocked(){
    if (_ttsReady) return;
    primeTTS();
  }

  function pickMaleishVoice(){
    try{
      const voices = window.speechSynthesis?.getVoices?.() || [];
      const preferred = voices.find(v =>
        /en(-|_)(GB|US|AU|IE|NZ)/i.test(v.lang) &&
        /male|daniel|george|arthur|fred|guy/i.test(v.name)
      );
      return preferred || voices.find(v => /en/i.test(v.lang)) || null;
    }catch{
      return null;
    }
  }

  function primeTTS(){
    try{
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume?.();
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.lang = "en-GB";
      window.speechSynthesis.speak(u);
      window.speechSynthesis.cancel();
      _ttsReady = true;
    }catch{}
  }

  function speakVisitor(text){
    try{
      if (!VISITOR_TTS_ENABLED) return;
      if (!("speechSynthesis" in window)) return;
      if (!_ttsReady) return;

      const t = String(text || "").trim();
      if (!t) return;

      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      const v = pickMaleishVoice();
      if (v) u.voice = v;

      u.lang = (v?.lang) || "en-GB";
      u.rate = 1.0;
      u.pitch = 0.75;
      u.volume = 1.0;

      window.speechSynthesis.speak(u);
    }catch{}
  }

  // -------- Login --------
  function tryStart(){
    const surname = (studentSurnameInput?.value || "").trim();
    const group = studentGroupSel?.value;
    const difficulty = studentDifficultySel?.value || "standard";

    if (!surname || !group){
      if (loginError) loginError.style.display = "block";
      return;
    }
    if (loginError) loginError.style.display = "none";

    session = { surname, group, difficulty };
    saveStudentPrefill(session);
    updateStudentPill();

    if (loginModal) loginModal.hidden = true;

    primeTTS();

    resetScenario();
    textInput?.focus();
  }

  btnStartTraining?.addEventListener("click", tryStart);
  studentSurnameInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") tryStart(); });

  // -------- Boot --------
  const pre = loadStudentPrefill();
  if (pre && typeof pre === "object"){
    if (pre.surname && studentSurnameInput) studentSurnameInput.value = pre.surname;
    if (pre.group && studentGroupSel) studentGroupSel.value = pre.group;
    if (pre.difficulty && studentDifficultySel) studentDifficultySel.value = pre.difficulty;
    session = { ...session, ...pre };
  }

  updateStudentPill();
  syncVisitorAvatars();
  hideId();
  setupSpeech();

  // Unlock TTS on first user gesture (Chrome/Edge autoplay policy).
  // This makes sure visitor lines are spoken even if the first spoken line is delayed.
  document.addEventListener("pointerdown", ensureTTSUnlocked, { once:true });
  document.addEventListener("keydown", ensureTTSUnlocked, { once:true });

  if (loginModal) loginModal.hidden = false;

  history.length = 0;
  state = {
    stage: "idle",
    askCounts: {},
    askCounts: {},
    askCounts: {},
    typing: { visitor:false, student:false },
    visitor: { ...ID_DATA, contact: makeContact() },
    claimed: { name: ID_DATA.name, first: ID_DATA.first, last: ID_DATA.last },
    facts: {},
    misses: 0,
    askCounts: { purpose: 0 }
  };
  renderHistory();

})();