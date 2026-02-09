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
  const visitorBubble = $("#visitorBubble");
  const studentBubble = $("#studentBubble");
  const moodLine = $("#moodLine");
  const hintBox = $("#hintBox");

  const textInput = $("#textInput");
  const btnSend = $("#btnSend");
  const holdToTalk = $("#holdToTalk");

  // Sidebar buttons
  const btnReset = $("#btnReset");
  const btnReturn = $("#btnReturn");
  const btnPersonSearch = $("#btnPersonSearch");
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
      case "purpose": return "Try 5W: “Who are you meeting?” “What is your appointment about?” “What time is it?”";
      case "control_q": return "Control questions: “What is your date of birth?” “What is your nationality?”";
      default: return "";
    }
  }

  // ---------- Intents ----------
  const INTENTS = (() => {
    const rx = (s) => new RegExp(s, "i");
    return [
      { key:"greet", rx: rx("\\b(hi|hello|good\\s*(morning|afternoon|evening))\\b") },
      { key:"help_open", rx: rx("\\b(how\\s+can\\s+i\\s+help(\\s+you(\\s+today)?)?|what\\s+do\\s+you\\s+need|how\\s+may\\s+i\\s+help)\\b") },
      { key:"ask_name", rx: rx("\\b(what\\s+is\\s+your\\s+name|what\\'s\\s+your\\s+name|may\\s+i\\s+have\\s+your\\s+name|your\\s+name\\s+please)\\b") },
      { key:"ask_mood", rx: rx("\\b(how\\s+are\\s+you\\s+feeling\\s+today|are\\s+you\\s+okay|how\\s+do\\s+you\\s+feel)\\b") },
      { key:"purpose", rx: rx("\\b(what\\s+is\\s+the\\s+purpose|why\\s+are\\s+you\\s+here|where\\s+are\\s+you\\s+going)\\b") },
      { key:"who_meeting", rx: rx("\\b(who\\s+are\\s+you\\s+(meeting|seeing|talking\\s+to)|who\\s+is\\s+your\\s+(host|contact)|with\\s+whom\\s+do\\s+you\\s+have\\s+an\\s+appointment|who\\s+do\\s+you\\s+have\\s+an\\s+appointment\\s+with)\\b") },
      { key:"time_meeting", rx: rx("\\b(what\\s+time\\s+is\\s+(the\\s+)?(meeting|appointment)|when\\s+are\\s+you\\s+(expected|due)|when\\s+is\\s+your\\s+appointment)\\b") },
      { key:"about_meeting", rx: rx("\\b(what\\s+is\\s+(the\\s+)?(meeting|appointment)\\s+about|what\\s+are\\s+you\\s+delivering|what\\s+is\\s+inside|what\\s+is\\s+the\\s+delivery)\\b") },
      { key:"ask_id", rx: rx("\\b(do\\s+you\\s+have\\s+(an\\s+)?id|have\\s+you\\s+got\\s+id|can\\s+i\\s+see\\s+your\\s+id|may\\s+i\\s+see\\s+your\\s+id|show\\s+me\\s+your\\s+id|id\\s+please|identification\\s+please|identity\\s+card|passport)\\b") },
      { key:"dob_q", rx: rx("\\b(date\\s+of\\s+birth|dob|when\\s+were\\s+you\\s+born)\\b") },
      { key:"nat_q", rx: rx("\\b(nationality|what\\s+is\\s+your\\s+nationality|where\\s+are\\s+you\\s+from)\\b") },
      { key:"contact_supervisor", rx: rx("\\b(i\\s+will\\s+contact\\s+my\\s+supervisor|i\\s+need\\s+to\\s+contact\\s+my\\s+supervisor|let\\s+me\\s+call\\s+my\\s+supervisor)\\b") },
      { key:"return_id", rx: rx("\\b(here\\'?s\\s+your\\s+id\\s+back|return\\s+your\\s+id|you\\s+can\\s+have\\s+your\\s+id\\s+back)\\b") },
      { key:"deny", rx: rx("\\b(deny\\s+entrance|you\\s+cannot\\s+enter|access\\s+denied|you\\s+are\\s+not\\s+allowed\\s+to\\s+enter)\\b") },
    ];
  })();

  function detectIntent(text){
    for (const it of INTENTS){
      if (it.rx.test(text)) return it.key;
    }
    return "unknown";
  }

  // ---------- Dialogue ----------
  function handleStudent(text){
    const clean = (text || "").trim();
    if (!clean) return;

    studentBubble.textContent = clean;
    const intent = detectIntent(clean);

    if (intent === "return_id"){ hideId(); visitorBubble.textContent = "Thank you."; return; }
    if (intent === "deny"){ visitorBubble.textContent = "Why? I need to get in."; return; }
    if (intent === "contact_supervisor"){ visitorBubble.textContent = "Okay. I can wait."; return; }

    if (intent === "ask_name"){
      visitorBubble.textContent = `My name is ${ID_DATA.name}.`;
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
          visitorBubble.textContent = "Can you help me?";
        } else miss("Try greeting first.");
        break;

      case "help":
        if (intent === "help_open"){
          state.stage = "purpose";
          state.misses = 0;
          hideHint();
          visitorBubble.textContent = "I need to get onto the base.";
        } else if (intent === "greet"){
          visitorBubble.textContent = "Hello.";
        } else miss();
        break;

      case "purpose":
        if (intent === "ask_mood"){ visitorBubble.textContent = moodReply(); state.misses=0; hideHint(); break; }
        if (intent === "who_meeting"){ visitorBubble.textContent = maybeInconsistent("I am meeting Sergeant de Vries.", "I am meeting Mr. de Vries."); state.misses=0; hideHint(); break; }
        if (intent === "time_meeting"){ visitorBubble.textContent = maybeInconsistent("At 14:00.", "At 15:00."); state.misses=0; hideHint(); break; }
        if (intent === "about_meeting"){ visitorBubble.textContent = "It is a delivery for the workshop. Tools and spare parts."; state.misses=0; hideHint(); break; }
        if (intent === "ask_id"){
          state.stage = "control_q"; state.misses=0; hideHint();
          visitorBubble.textContent = "Sure. Here you go.";
          showId();
          break;
        }
        if (intent === "purpose"){ visitorBubble.textContent = "I have an appointment on base."; state.misses=0; hideHint(); break; }
        miss();
        break;

      case "control_q":
        if (intent === "dob_q"){ visitorBubble.textContent = maybeInconsistent(`My date of birth is ${ID_DATA.dob}.`, `My date of birth is 22 Mar 1982.`); state.misses=0; hideHint(); break; }
        if (intent === "nat_q"){ visitorBubble.textContent = maybeInconsistent(`My nationality is ${ID_DATA.nat}.`, "My nationality is German."); state.misses=0; hideHint(); break; }
        if (intent === "ask_id"){ visitorBubble.textContent = "I already gave you my ID."; showId(); state.misses=0; hideHint(); break; }
        miss("Try a control question (DOB / nationality), or return the ID.");
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

  function maybeInconsistent(a, b){
    return Math.random() < currentMood.liarBias ? b : a;
  }

  // ---------- Reset training (does NOT bypass login) ----------
  function resetTrainingOnly(){
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    moodLine.textContent = currentMood.line;

    state = { stage:"start", misses:0, idVisible:false };

    visitorBubble.textContent = "Hello.";
    studentBubble.textContent = "Hold-to-talk or type below.";
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
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isRecognizing = true;
      interim = "";
      voiceStatus.textContent = "Voice: listening…";
    };

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++){
        const res = event.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalText += t;
        else interim += t;
      }
      const live = (finalText || interim || "").trim();
      if (live) textInput.value = live;
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

  btnReturnId.addEventListener("click", () => { hideId(); visitorBubble.textContent = "Thank you."; });

  btnReset.addEventListener("click", () => {
    setActiveScreen("login");
    hideId();
    hideHint();
    updateStudentPill();
  });

  btnPersonSearch.addEventListener("click", () => setActiveScreen("personSearch"));
  btnReturn.addEventListener("click", () => setActiveScreen("return"));
  btnDeny.addEventListener("click", () => { visitorBubble.textContent = "Why? I need to get in."; });

  btnBackToTraining?.addEventListener("click", () => setActiveScreen("training"));
  btnBackReturn?.addEventListener("click", () => setActiveScreen("training"));

  // ---------- Boot ----------
  const pre = loadStudentPrefill();
  if (pre){
    if (pre.surname) studentSurnameInput.value = pre.surname;
    if (pre.group) studentGroupSel.value = pre.group;
    if (pre.difficulty) studentDifficultySel.value = pre.difficulty;
  }

  hideId();                // enforce hidden on boot
  updateStudentPill();
  setupSpeech();
  syncAvatarAndIdPhoto();
  setActiveScreen("login");
})();
