// app.js
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // UI refs
  const visitorBubble = $("#visitorBubble");
  const studentBubble = $("#studentBubble");
  const moodLine = $("#moodLine");
  const hintBox = $("#hintBox");
  const difficultySel = $("#difficulty");
  const voiceStatus = $("#voiceStatus");

  const textInput = $("#textInput");
  const btnSend = $("#btnSend");
  const holdToTalk = $("#holdToTalk");

  const btnReset = $("#btnReset");
  const btnReturn = $("#btnReturn");
  const btnPersonSearch = $("#btnPersonSearch");
  const btnDeny = $("#btnDeny");

  const screenTraining = $("#screenTraining");
  const screenPersonSearch = $("#screenPersonSearch");
  const screenReturn = $("#screenReturn");
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

  // Config
  const CFG = window.CONFIG || { voiceAutoSend: true, defaultDifficulty: "standard", headshotCount: 10 };

  // ---------- Data ----------
  const ID_DATA = makeRandomId();

  function makeRandomId(){
    const headshotIndex = randInt(1, CFG.headshotCount); // 1..10
    const dob = "21 Mar 1982"; // DD Mon YYYY
    return {
      name: "Jordan Miller",
      dob,
      nat: "Dutch",
      idNo: "NL-" + randInt(100000, 999999),
      photoSrc: `assets/headshots/headshot_${String(headshotIndex).padStart(2,"0")}.png`
    };
  }

  function syncVisitorAvatarToId(){
    // Visitor avatar MUST be exactly the same image as the ID headshot
    if (visitorAvatar) visitorAvatar.src = ID_DATA.photoSrc;
  }

  // Visitor “mood”
  const MOODS = [
    { key:"neutral", line:"The visitor looks neutral.", liarBias: 0.10 },
    { key:"nervous", line:"The visitor looks nervous.", liarBias: 0.30 },
    { key:"relaxed", line:"The visitor looks relaxed.", liarBias: 0.05 },
    { key:"angry",   line:"The visitor looks irritated.", liarBias: 0.35 }
  ];
  let currentMood = MOODS[0];

  // ---------- State ----------
  let state;

  function resetAll(){
    currentMood = MOODS[randInt(0, MOODS.length - 1)];
    moodLine.textContent = currentMood.line;

    state = {
      stage: "start",
      misses: 0,
      idVisible: false
    };

    // last-bubble-only
    visitorBubble.textContent = "Hello.";
    studentBubble.textContent = "Hold-to-talk or type below.";
    hideHint();
    hideId();
    setActiveScreen("training");

    // new ID each reset
    const fresh = makeRandomId();
    ID_DATA.name = fresh.name;
    ID_DATA.dob = fresh.dob;
    ID_DATA.nat = fresh.nat;
    ID_DATA.idNo = fresh.idNo;
    ID_DATA.photoSrc = fresh.photoSrc;

    syncVisitorAvatarToId();
  }

  // ---------- Screens ----------
  function setActiveScreen(name){
    [screenTraining, screenPersonSearch, screenReturn].forEach(s => s.classList.remove("screen--active"));
    if (name === "training") screenTraining.classList.add("screen--active");
    if (name === "personSearch") screenPersonSearch.classList.add("screen--active");
    if (name === "return") screenReturn.classList.add("screen--active");
  }

  // ---------- ID ----------
  function showId(){
    idPhoto.src = ID_DATA.photoSrc;
    idName.textContent = ID_DATA.name;
    idDob.textContent  = ID_DATA.dob;
    idNat.textContent  = ID_DATA.nat;
    idNo.textContent   = ID_DATA.idNo;

    idCardWrap.hidden = false;
    idSlotHint.hidden = true;
    state.idVisible = true;

    // keep synced (in case you later change ID mid-flow)
    syncVisitorAvatarToId();
  }

  function hideId(){
    idCardWrap.hidden = true;
    idSlotHint.hidden = false;
    state.idVisible = false;
  }

  // ---------- Hints ----------
  function setDifficulty(value){
    difficultySel.value = value;
  }
  function showHint(text){
    if (difficultySel.value === "advanced") return;
    hintBox.hidden = false;
    hintBox.textContent = text;
  }
  function hideHint(){
    hintBox.hidden = true;
    hintBox.textContent = "";
  }

  function maybeHint(){
    const diff = difficultySel.value;
    if (diff === "advanced") return;

    const hint = getHintForStage(state.stage);
    if (!hint) return;

    if (diff === "basic"){
      showHint(hint);
      return;
    }
    if (state.misses >= 2){
      showHint(hint);
    }
  }

  function getHintForStage(stage){
    switch(stage){
      case "start":
      case "greet":
        return "Try: “Good morning. How can I help you?”";
      case "help":
        return "Try: “How can I help you today?” / “What do you need?”";
      case "purpose":
        return "Try 5W: “Who are you meeting?” “What is your appointment about?” “What time is it?”";
      case "control_q":
        return "Control questions: “What is your date of birth?” “What is your nationality?”";
      default:
        return "";
    }
  }

  // ---------- Intents ----------
  const INTENTS = compileIntents();

  function compileIntents(){
    const rx = (s) => new RegExp(s, "i");
    return [
      { key:"greet", rx: rx("\\b(hi|hello|good\\s*(morning|afternoon|evening))\\b") },
      { key:"help_open", rx: rx("\\b(how\\s+can\\s+i\\s+help(\\s+you(\\s+today)?)?|what\\s+do\\s+you\\s+need|how\\s+may\\s+i\\s+help)\\b") },
      { key:"ask_mood", rx: rx("\\b(how\\s+are\\s+you\\s+feeling\\s+today|are\\s+you\\s+okay|how\\s+do\\s+you\\s+feel)\\b") },
      { key:"purpose", rx: rx("\\b(what\\s+is\\s+the\\s+purpose|why\\s+are\\s+you\\s+here|where\\s+are\\s+you\\s+going)\\b") },
      { key:"who_meeting", rx: rx("\\b(who\\s+are\\s+you\\s+(meeting|seeing|talking\\s+to)|who\\s+is\\s+your\\s+(host|contact)|with\\s+whom\\s+is\\s+your\\s+appointment)\\b") },
      { key:"time_meeting", rx: rx("\\b(what\\s+time\\s+is\\s+(the\\s+)?(meeting|appointment)|when\\s+are\\s+you\\s+(expected|due)|when\\s+is\\s+your\\s+appointment)\\b") },
      { key:"about_meeting", rx: rx("\\b(what\\s+is\\s+(the\\s+)?(meeting|appointment)\\s+about|what\\s+are\\s+you\\s+delivering|what\\s+is\\s+inside|what\\s+is\\s+the\\s+delivery)\\b") },
      { key:"ask_id", rx: rx("\\b(can\\s+i\\s+see\\s+your\\s+id|may\\s+i\\s+see\\s+your\\s+id|show\\s+me\\s+your\\s+id|id\\s+please|identification\\s+please)\\b") },
      { key:"dob_q", rx: rx("\\b(date\\s+of\\s+birth|dob|when\\s+were\\s+you\\s+born)\\b") },
      { key:"nat_q", rx: rx("\\b(nationality|what\\s+is\\s+your\\s+nationality|where\\s+are\\s+you\\s+from)\\b") },
      { key:"contact_supervisor", rx: rx("\\b(i\\s+will\\s+contact\\s+my\\s+supervisor|i\\s+need\\s+to\\s+contact\\s+my\\s+supervisor|let\\s+me\\s+call\\s+my\\s+supervisor)\\b") },
      { key:"return_id", rx: rx("\\b(here\\'?s\\s+your\\s+id\\s+back|return\\s+your\\s+id|you\\s+can\\s+have\\s+your\\s+id\\s+back)\\b") },
      { key:"deny", rx: rx("\\b(deny\\s+entrance|you\\s+cannot\\s+enter|access\\s+denied|you\\s+are\\s+not\\s+allowed\\s+to\\s+enter)\\b") },
    ];
  }

  function detectIntent(text){
    for (const it of INTENTS){
      if (it.rx.test(text)) return it.key;
    }
    return "unknown";
  }

  // ---------- Dialogue engine ----------
  function handleStudent(text){
    const clean = (text || "").trim();
    if (!clean) return;

    studentBubble.textContent = clean;
    const intent = detectIntent(clean);

    // global actions
    if (intent === "return_id"){
      hideId();
      visitorBubble.textContent = "Thank you.";
      return;
    }
    if (intent === "deny"){
      visitorBubble.textContent = "Why? I need to get in.";
      return;
    }
    if (intent === "contact_supervisor"){
      visitorBubble.textContent = "Okay. I can wait.";
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
        } else {
          miss("Try greeting first.");
        }
        break;

      case "help":
        if (intent === "help_open"){
          state.stage = "purpose";
          state.misses = 0;
          hideHint();
          visitorBubble.textContent = "I need to get onto the base.";
        } else if (intent === "greet"){
          visitorBubble.textContent = "Hello.";
        } else {
          miss();
        }
        break;

      case "purpose":
        if (intent === "ask_mood"){
          visitorBubble.textContent = moodReply();
          state.misses = 0;
          hideHint();
          break;
        }

        if (intent === "who_meeting"){
          visitorBubble.textContent = maybeInconsistent("I am meeting Sergeant de Vries.", "I am meeting Mr. de Vries.");
          state.misses = 0; hideHint();
          break;
        }

        if (intent === "time_meeting"){
          visitorBubble.textContent = maybeInconsistent("At 14:00.", "At 15:00.");
          state.misses = 0; hideHint();
          break;
        }

        if (intent === "about_meeting"){
          visitorBubble.textContent = "It is a delivery for the workshop. Tools and spare parts.";
          state.misses = 0; hideHint();
          break;
        }

        if (intent === "ask_id"){
          state.stage = "control_q";
          state.misses = 0;
          hideHint();
          visitorBubble.textContent = "Sure. Here you go.";
          showId();
          break;
        }

        if (intent === "purpose"){
          visitorBubble.textContent = "I have an appointment on base.";
          state.misses = 0; hideHint();
          break;
        }

        miss();
        break;

      case "control_q":
        if (intent === "dob_q"){
          visitorBubble.textContent = maybeInconsistent(`My date of birth is ${ID_DATA.dob}.`, `My date of birth is 22 Mar 1982.`);
          state.misses = 0; hideHint();
          break;
        }
        if (intent === "nat_q"){
          visitorBubble.textContent = maybeInconsistent(`My nationality is ${ID_DATA.nat}.`, "My nationality is German.");
          state.misses = 0; hideHint();
          break;
        }
        if (intent === "ask_id"){
          visitorBubble.textContent = "I already gave you my ID.";
          showId();
          state.misses = 0; hideHint();
          break;
        }
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
    if (!custom){
      visitorBubble.textContent = visitorBubble.textContent || "…";
    }
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

  // ---------- Voice: hold-to-talk (Web Speech API) ----------
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
      if (live) studentBubble.textContent = live;
    };

    recognition.onerror = () => {
      voiceStatus.textContent = "Voice: error";
      isRecognizing = false;
    };

    recognition.onend = () => {
      const spoken = (studentBubble.textContent || "").trim();
      voiceStatus.textContent = "Voice: ready";
      isRecognizing = false;

      if (CFG.voiceAutoSend && spoken && spoken !== "Hold-to-talk or type below."){
        handleStudent(spoken);
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

  // ---------- Events ----------
  btnSend.addEventListener("click", () => {
    handleStudent(textInput.value);
    textInput.value = "";
    textInput.focus();
  });

  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend.click();
  });

  holdToTalk.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startListen();
  });
  holdToTalk.addEventListener("pointerup", (e) => {
    e.preventDefault();
    stopListen();
  });
  holdToTalk.addEventListener("pointercancel", stopListen);
  holdToTalk.addEventListener("pointerleave", () => stopListen());

  btnReturnId.addEventListener("click", () => {
    hideId();
    visitorBubble.textContent = "Thank you.";
  });

  btnReset.addEventListener("click", resetAll);

  btnPersonSearch.addEventListener("click", () => setActiveScreen("personSearch"));
  btnReturn.addEventListener("click", () => setActiveScreen("return"));
  btnDeny.addEventListener("click", () => {
    visitorBubble.textContent = "Why? I need to get in.";
  });

  btnBackToTraining.addEventListener("click", () => setActiveScreen("training"));
  btnBackReturn.addEventListener("click", () => setActiveScreen("training"));

  difficultySel.addEventListener("change", () => {
    hideHint();
    state.misses = 0;
    if (difficultySel.value === "basic"){
      const h = getHintForStage(state.stage);
      if (h) showHint(h);
    }
  });

  // ---------- Utils ----------
  function randInt(min, max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ---------- Boot ----------
  setDifficulty(CFG.defaultDifficulty || "standard");
  setupSpeech();
  // ensure avatar is synced even before first reset
  syncVisitorAvatarToId();
  resetAll();
})();
