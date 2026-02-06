import random
import difflib
import datetime as dt
from dataclasses import dataclass
import tempfile
import os

import pandas as pd
import streamlit as st

# Voice input (mic recorder) + offline transcription (faster-whisper)
from streamlit_mic_recorder import mic_recorder
from faster_whisper import WhisperModel

# ============================================================
# VIVA (Veiligheid & Vakmanschap) — Entry Control English Trainer
# Class-proof v3
#
# Features:
# - Difficulty levels (Basic / Standard / Advanced)
# - Voice input (record → transcribe) with automatic send
# - Visitor details are NOT shown upfront; info is revealed gradually
# - ID card appears after "request_id" with DOB/nationality/address/ID no./expiry
# - Scenario generator enforces purpose-topic consistency
# - Quick feedback shown only after finishing (not during run)
# - CSV export (SUMMARY + CHECKLIST + CHAT_LOG)
# ============================================================

# ----------------------------
# Helpers
# ----------------------------

def norm(s: str) -> str:
    return " ".join((s or "").lower().strip().split())

def fuzzy_intent_match(user_text: str, phrases: list[str], threshold: float) -> bool:
    t = norm(user_text)
    for p in phrases:
        p2 = norm(p)
        if not p2:
            continue
        if p2 in t:
            return True
        ratio = difflib.SequenceMatcher(None, t, p2).ratio()
        if ratio >= threshold:
            return True
    return False

def now_iso():
    return dt.datetime.now().replace(microsecond=0).isoformat()

def fmt_check(ok: bool) -> str:
    return "✅" if ok else "⬜"

@st.cache_resource
def get_whisper_model():
    # "base" is a good tradeoff for classroom use
    return WhisperModel("base", device="cpu", compute_type="int8")

def transcribe_wav_bytes(wav_bytes: bytes) -> str:
    model = get_whisper_model()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
        f.write(wav_bytes)
        tmp_path = f.name
    try:
        segments, _info = model.transcribe(tmp_path, language="en")
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return text
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

# ----------------------------
# Difficulty profiles
# ----------------------------

DIFFICULTY = {
    "Basic": {"threshold": 0.68, "notes": "Forgiving matching. Best for starters."},
    "Standard": {"threshold": 0.72, "notes": "Balanced matching. Recommended default."},
    "Advanced": {"threshold": 0.78, "notes": "Stricter matching. Be clear & specific."},
}

# ----------------------------
# Scenario generation (coherent purpose-topic)
# ----------------------------

FIRST_NAMES = ["Mark", "Sarah", "James", "Nina", "Tom", "Aisha", "Lucas", "Emma", "Daan", "Sofia"]
LAST_NAMES  = ["Jensen", "Bakker", "Williams", "De Vries", "Khan", "Smit", "Brown", "Visser", "Johnson", "Martens"]
ORG_NAMES   = ["NetSecure BV", "NorthRail", "TriCom Systems", "BlueShield Contractors", "AeroTech Services", "MedLogistics"]
HOSTS       = ["Captain De Vries", "Lt. Van Dijk", "Major Jansen", "Sgt. De Boer", "Captain Smit"]
TIMES       = ["09:00", "10:30", "13:00", "14:30", "15:15"]

PURPOSE_TO_TOPICS = {
    "a delivery": ["equipment delivery", "spare parts delivery", "package delivery"],
    "maintenance work": ["network maintenance", "equipment repair", "HVAC maintenance"],
    "an inspection": ["fire safety inspection", "vehicle inspection", "safety compliance inspection"],
    "a briefing": ["training coordination", "security briefing", "project briefing"],
    "a meeting": ["IT audit meeting", "contractor meeting", "planning meeting"],
}

TWISTS = [
    ("vague_time", "The visitor is vague about the appointment time unless asked clearly."),
    ("no_appointment", "The visitor says they have no appointment (requires escalation mindset)."),
    ("annoyed", "The visitor is annoyed and short in responses."),
    ("typo_name", "The visitor gives a name that is easy to misspell; student should confirm spelling."),
    ("sharp_object", "The visitor has a small sharp object (e.g., pocket knife) and must surrender it."),
    ("alcohol", "The visitor has alcohol in a bag and must surrender it."),
]

NATIONALITIES = ["Dutch", "German", "Belgian", "British", "French", "Spanish", "Polish", "Italian"]
STREET_NAMES = ["Oak Street", "Main Street", "Station Road", "Maple Avenue", "Church Lane", "Parkstraat", "Wilhelminastraat"]
CITIES = ["Ede", "Arnhem", "Utrecht", "Apeldoorn", "Zwolle", "Amersfoort"]
POSTCODES = ["6711 AB", "6811 CD", "3511 EF", "7311 GH", "8011 JK", "3811 LM"]

def make_id_number(rnd: random.Random) -> str:
    return f"ID-{rnd.randint(100000, 999999)}-{rnd.randint(10,99)}"

def make_dob(rnd: random.Random) -> str:
    year = rnd.randint(dt.datetime.now().year - 60, dt.datetime.now().year - 18)
    month = rnd.randint(1, 12)
    day = rnd.randint(1, 28)
    return dt.date(year, month, day).strftime("%d %b %Y")

def generate_visitor_card(seed=None):
    rnd = random.Random(seed)
    first = rnd.choice(FIRST_NAMES)
    last = rnd.choice(LAST_NAMES)
    name = f"{first} {last}"
    org = rnd.choice(ORG_NAMES)
    host = rnd.choice(HOSTS)

    purpose = rnd.choice(list(PURPOSE_TO_TOPICS.keys()))
    topic = rnd.choice(PURPOSE_TO_TOPICS[purpose])
    time = rnd.choice(TIMES)

    twist_key, twist_desc = rnd.choice(TWISTS)

    dob = make_dob(rnd)
    nationality = rnd.choice(NATIONALITIES)
    address = f"{rnd.choice(STREET_NAMES)} {rnd.randint(1, 199)}, {rnd.choice(POSTCODES)} {rnd.choice(CITIES)}"
    id_no = make_id_number(rnd)
    expiry_year = dt.datetime.now().year + rnd.randint(1, 8)
    expiry = dt.date(expiry_year, rnd.randint(1, 12), rnd.randint(1, 28)).strftime("%d %b %Y")

    return {
        "name": name,
        "org": org,
        "host": host,
        "purpose": purpose,
        "topic": topic,
        "time": time,
        "twist_key": twist_key,
        "twist_desc": twist_desc,
        "id": {
            "id_no": id_no,
            "dob": dob,
            "nationality": nationality,
            "address": address,
            "expiry": expiry,
        }
    }

# ----------------------------
# Intents & phrases
# ----------------------------

INTENT_PHRASES = {
    "ask_identity": [
        "who are you", "what is your name", "your name please", "identify yourself",
        "may i have your name", "can you tell me your name"
    ],
    "ask_purpose": [
        "what are you doing here", "what is the purpose", "why are you here",
        "reason for your visit", "what brings you here", "what is your reason for visiting"
    ],
    "ask_host": [
        "who are you meeting", "who do you have an appointment with", "with whom do you have a meeting",
        "who is your host", "who is expecting you"
    ],
    "ask_time": [
        "what time is the appointment", "what time is your meeting", "appointment time",
        "when is the appointment", "what time is it scheduled"
    ],
    "ask_topic": [
        "what is the appointment about", "what is the meeting about", "topic of the appointment",
        "what is it regarding", "what is the purpose of the meeting"
    ],

    "request_id": [
        "can i see your id", "show me your id", "id please", "identification please",
        "may i see your identification", "could you show your id"
    ],
    "control_question": [
        "date of birth", "what is your date of birth", "what is your birthday",
        "what is your address", "what is your postcode", "what is your zip code", "nationality"
    ],
    "contact_supervisor": [
        "i will contact my supervisor", "i will call my supervisor",
        "one moment i will contact my supervisor", "please wait i will contact",
        "i will check with my supervisor"
    ],

    "inform_search_threat": [
        "heightened threat", "increased threat", "security level", "you will be searched",
        "for security reasons you will be searched", "due to a higher threat level"
    ],
    "prohibited_items": [
        "no weapons", "no drugs", "no alcohol", "prohibited items", "weapons drugs or alcohol",
        "you are not allowed to bring weapons", "you are not allowed to bring drugs", "you are not allowed to bring alcohol"
    ],
    "request_surrender": [
        "please hand them over", "you must surrender", "give them to me",
        "you have to hand it over", "hand it over"
    ],

    "explain_patdown": [
        "i will pat you down", "i am going to search you", "i will frisk you",
        "i will conduct a security search", "i will perform a pat-down"
    ],
    "ask_sharp": [
        "sharp objects", "anything sharp", "needles", "anything that can hurt",
        "do you have anything sharp", "any sharp items"
    ],
    "empty_pockets": [
        "empty your pockets", "take everything out of your pockets",
        "put your items on the table", "place your belongings in the tray"
    ],
    "remove_jacket": [
        "remove your jacket", "take off your jacket", "remove your coat",
        "remove your outerwear"
    ],
    "announce_armpits": ["under your armpits", "armpits"],
    "announce_waist": ["around your waist", "waistline"],
    "announce_private": ["private parts", "groin area", "around your private parts"],
    "leg_instruction": [
        "place your foot on your knee", "rest your ankle on your knee",
        "lift your leg and place it", "put your foot on your knee"
    ],

    "issue_visitor_pass_rule": [
        "here is your visitor pass", "visitor badge", "wear it visibly", "visible at all times",
        "you must wear it", "keep it visible"
    ],
    "return_pass_rule": [
        "return it at the end", "hand it in at the end", "give it back when you leave",
        "return the pass", "return the badge"
    ],
    "alarm_rally_point": [
        "if the alarm sounds", "assembly area", "rally point", "muster point",
        "go to the assembly area", "go to the rally point"
    ],
    "closing_time": [
        "we close at four", "closing time is 16:00", "visitors must leave by 4 pm",
        "the base closes for visitors at 4", "all visitors must leave by four"
    ],
}

# ----------------------------
# Steps
# ----------------------------

@dataclass
class Step:
    key: str
    title: str
    visitor_opening: list[str]
    required_intents: list[str]
    failure_response: str
    hint: str

def build_steps():
    return [
        Step(
            key="gate",
            title="1) Gate interview (5W’s + appointment details)",
            visitor_opening=["Good morning.", "I need to enter the base."],
            required_intents=["ask_identity", "ask_purpose", "ask_host", "ask_topic", "ask_time"],
            failure_response="Sorry—what exactly do you need to know?",
            hint="Ask: name, purpose, host, topic, and appointment time."
        ),
        Step(
            key="id_check",
            title="2) ID-check + control question + contact supervisor",
            visitor_opening=["Sure. Where do you want me to go?"],
            required_intents=["request_id", "control_question", "contact_supervisor"],
            failure_response="Why do you need that?",
            hint="Request ID, ask one control question (DOB/address/nationality), then contact supervisor."
        ),
        Step(
            key="threat_rules",
            title="3) Entry decision: search warning + prohibited items (weapons/drugs/alcohol)",
            visitor_opening=["Can I go in now?"],
            required_intents=["inform_search_threat", "prohibited_items", "request_surrender"],
            failure_response="I don’t understand—what do you mean?",
            hint="Explain the search due to threat. State prohibited items. Ask to surrender them."
        ),
        Step(
            key="patdown",
            title="4) Pat-down / search instructions (with 3 mandatory announcements)",
            visitor_opening=["Alright. What do I need to do?"],
            required_intents=[
                "explain_patdown", "ask_sharp", "empty_pockets", "remove_jacket",
                "announce_armpits", "announce_waist", "announce_private", "leg_instruction"
            ],
            failure_response="Could you give me a clear instruction, please?",
            hint="Explain pat-down, ask sharp objects, empty pockets, remove jacket, announce armpits/waist/private parts, and give leg instruction."
        ),
        Step(
            key="registration_rules",
            title="5) Registration + base rules briefing",
            visitor_opening=["Okay. Am I good to go?"],
            required_intents=["issue_visitor_pass_rule", "return_pass_rule", "alarm_rally_point", "closing_time"],
            failure_response="Sorry, can you repeat that more clearly?",
            hint="Visitor pass rules, return rule, rally point, and closing time."
        ),
    ]

# ----------------------------
# Reveal logic + visitor responses
# ----------------------------

REVEAL_BY_INTENT = {
    "ask_identity": ["name", "org"],
    "ask_purpose": ["purpose"],
    "ask_host": ["host"],
    "ask_topic": ["topic"],
    "ask_time": ["time"],
    "request_id": ["id"],
}

def reveal_from_card(intent: str, card: dict):
    revealed = st.session_state.revealed
    for field in REVEAL_BY_INTENT.get(intent, []):
        if field == "id":
            revealed["id"] = card["id"]
        else:
            revealed[field] = card[field]

def response_for_control_question(user_text: str, card: dict) -> str:
    t = norm(user_text)
    if "date of birth" in t or "birthday" in t or "birth" in t:
        return f"My date of birth is {card['id']['dob']}."
    if "address" in t:
        return f"My address is {card['id']['address']}."
    if "postcode" in t or "zip" in t:
        parts = card['id']['address'].split(",")
        if len(parts) >= 2:
            post = parts[1].strip().split(" ")
            if len(post) >= 2:
                return f"My postcode is {post[0]} {post[1]}."
        return "My postcode is on the ID."
    if "nationality" in t:
        return f"My nationality is {card['id']['nationality']}."
    return "It’s written on the ID."

def visitor_response_for_intent(intent: str, user_text: str, card: dict) -> str:
    twist = card["twist_key"]

    if intent == "ask_identity":
        return f"My name is {card['name']}… that’s J-e-n-s-e-n." if twist == "typo_name" else f"My name is {card['name']}."
    if intent == "ask_purpose":
        return f"I'm here for {card['purpose']}."
    if intent == "ask_host":
        return "Uh… I don't actually have an appointment. I was told I could come by." if twist == "no_appointment" else f"I'm meeting {card['host']}."
    if intent == "ask_topic":
        return f"It's about {card['topic']}."
    if intent == "ask_time":
        return "I think it's sometime this afternoon… I'm not sure." if twist == "vague_time" else f"It's at {card['time']}."

    if intent == "request_id":
        return "Sure, here is my ID."
    if intent == "control_question":
        return response_for_control_question(user_text, card)
    if intent == "contact_supervisor":
        return "Okay, I'll wait."

    if intent == "inform_search_threat":
        return "Fine. Let's just get this over with." if twist == "annoyed" else "Understood."
    if intent == "prohibited_items":
        if twist == "sharp_object":
            return "I do have a small pocket knife in my bag."
        if twist == "alcohol":
            return "I have a bottle of wine as a gift."
        return "I don't have any of those."
    if intent == "request_surrender":
        return "Alright, I will hand it over." if twist in ("sharp_object", "alcohol") else "Okay."

    if intent == "explain_patdown":
        return "Okay."
    if intent == "ask_sharp":
        return "I already mentioned the pocket knife—nothing else." if twist == "sharp_object" else "No."
    if intent == "empty_pockets":
        return "Alright, I'm emptying them now."
    if intent == "remove_jacket":
        return "Sure, jacket is off."
    if intent in ("announce_armpits", "announce_waist", "announce_private"):
        return "Okay."
    if intent == "leg_instruction":
        return "Like this?"

    if intent in ("issue_visitor_pass_rule", "return_pass_rule", "alarm_rally_point", "closing_time"):
        return "Understood."

    return "Okay."

# ----------------------------
# App state
# ----------------------------

def ensure_state():
    if "difficulty" not in st.session_state: st.session_state.difficulty = "Standard"
    if "student_name" not in st.session_state: st.session_state.student_name = ""
    if "class_name" not in st.session_state: st.session_state.class_name = ""
    if "use_voice" not in st.session_state: st.session_state.use_voice = False

    if "card" not in st.session_state: st.session_state.card = generate_visitor_card(seed=42)
    if "revealed" not in st.session_state: st.session_state.revealed = {}
    if "steps" not in st.session_state: st.session_state.steps = build_steps()
    if "step_index" not in st.session_state: st.session_state.step_index = 0
    if "done_intents" not in st.session_state: st.session_state.done_intents = {}
    if "log" not in st.session_state: st.session_state.log = []
    if "nl_briefing" not in st.session_state: st.session_state.nl_briefing = ""
    if "opened" not in st.session_state: st.session_state.opened = set()
    if "run_id" not in st.session_state: st.session_state.run_id = "run_42"
    if "started_at" not in st.session_state: st.session_state.started_at = now_iso()
    if "finished_at" not in st.session_state: st.session_state.finished_at = ""
    if "export_ready" not in st.session_state: st.session_state.export_ready = False

def reset_run():
    seed = random.randint(1, 10_000_000)
    st.session_state.card = generate_visitor_card(seed=seed)
    st.session_state.revealed = {}
    st.session_state.steps = build_steps()
    st.session_state.step_index = 0
    st.session_state.done_intents = {}
    st.session_state.log = []
    st.session_state.nl_briefing = ""
    st.session_state.opened = set()
    st.session_state.run_id = f"run_{seed}"
    st.session_state.started_at = now_iso()
    st.session_state.finished_at = ""
    st.session_state.export_ready = False

def add_log(speaker: str, text: str):
    st.session_state.log.append({"ts": now_iso(), "speaker": speaker, "text": text})

def build_export_frames():
    steps = st.session_state.steps
    done = st.session_state.done_intents

    checklist_rows = []
    for s in steps:
        for intent in s.required_intents:
            checklist_rows.append({
                "run_id": st.session_state.run_id,
                "started_at": st.session_state.started_at,
                "finished_at": st.session_state.finished_at,
                "class": st.session_state.class_name,
                "student": st.session_state.student_name,
                "difficulty": st.session_state.difficulty,
                "step": s.key,
                "intent": intent,
                "completed": bool(done.get(intent, False)),
            })
    checklist_df = pd.DataFrame(checklist_rows)

    log_df = pd.DataFrame(st.session_state.log)
    if not log_df.empty:
        for col, val in [
            ("run_id", st.session_state.run_id),
            ("class", st.session_state.class_name),
            ("student", st.session_state.student_name),
            ("difficulty", st.session_state.difficulty),
            ("started_at", st.session_state.started_at),
            ("finished_at", st.session_state.finished_at),
        ]:
            log_df.insert(0, col, val)

    all_required = [i for s in steps for i in s.required_intents]
    completed = sum(1 for i in all_required if done.get(i, False))
    total = len(all_required)

    summary_df = pd.DataFrame([{
        "run_id": st.session_state.run_id,
        "started_at": st.session_state.started_at,
        "finished_at": st.session_state.finished_at,
        "class": st.session_state.class_name,
        "student": st.session_state.student_name,
        "difficulty": st.session_state.difficulty,
        "completed_intents": completed,
        "total_intents": total,
        "completion_rate": (completed / total) if total else 0.0,
        "nl_briefing": st.session_state.nl_briefing.strip(),
    }])

    return summary_df, checklist_df, log_df

def build_export_csv_bytes():
    summary_df, checklist_df, log_df = build_export_frames()
    lines = []

    def add_section(title, df):
        lines.append(f"### {title}")
        lines.append(df.to_csv(index=False))
        lines.append("")

    add_section("SUMMARY", summary_df)
    add_section("CHECKLIST", checklist_df)
    if log_df is not None and not log_df.empty:
        add_section("CHAT_LOG", log_df)
    else:
        lines += ["### CHAT_LOG", "No chat log recorded.", ""]

    return "\n".join(lines).encode("utf-8")

def process_user_line(user_text: str):
    steps = st.session_state.steps
    idx = st.session_state.step_index
    step = steps[idx]
    done = st.session_state.done_intents
    threshold = DIFFICULTY[st.session_state.difficulty]["threshold"]

    add_log("YOU", user_text)

    remaining = [i for i in step.required_intents if not done.get(i, False)]
    matched = None
    for intent in remaining:
        if fuzzy_intent_match(user_text, INTENT_PHRASES.get(intent, []), threshold):
            matched = intent
            break

    if matched:
        done[matched] = True
        reveal_from_card(matched, st.session_state.card)
        add_log("VISITOR", visitor_response_for_intent(matched, user_text, st.session_state.card))
    else:
        add_log("VISITOR", "Could you be more specific, please?" if st.session_state.difficulty == "Advanced" else step.failure_response)

    step_done = all(done.get(i, False) for i in step.required_intents)
    if step.key == "id_check" and step_done and len(st.session_state.nl_briefing.strip()) < 20:
        step_done = False
        add_log("SYSTEM", "Note: first fill in the NL 5W briefing (short but complete).")

    if step_done:
        add_log("SYSTEM", "Step complete. Proceed to next step.")
        if st.session_state.step_index < len(steps) - 1:
            st.session_state.step_index += 1
        else:
            st.session_state.finished_at = now_iso()
            st.session_state.export_ready = True
            add_log("SYSTEM", "All steps completed. Export is now available in the sidebar.")

# ----------------------------
# UI
# ----------------------------

st.set_page_config(page_title="VIVA Entry Control English Trainer", layout="wide")
ensure_state()

st.title("VIVA — Entry Control English Trainer")

with st.sidebar:
    st.header("Session setup")
    st.session_state.class_name = st.text_input("Class / group", value=st.session_state.class_name, placeholder="e.g., VIVA-2A")
    st.session_state.student_name = st.text_input("Student name", value=st.session_state.student_name, placeholder="e.g., Lisa")

    diff = st.selectbox("Difficulty", list(DIFFICULTY.keys()), index=list(DIFFICULTY.keys()).index(st.session_state.difficulty))
    st.session_state.difficulty = diff
    st.caption(DIFFICULTY[diff]["notes"])

    st.session_state.use_voice = st.toggle("🎙️ Voice input (record → transcribe)", value=st.session_state.use_voice)
    st.caption("Voice uses an offline Whisper model on the machine running the app.")

    st.divider()
    cA, cB = st.columns(2)
    with cA:
        if st.button("🧹 Reset run", use_container_width=True):
            reset_run(); st.rerun()
    with cB:
        if st.button("🔄 New scenario", use_container_width=True):
            reset_run(); st.rerun()

    st.divider()
    st.header("Known so far (revealed)")
    if st.session_state.revealed:
        st.write({k: v for k, v in st.session_state.revealed.items() if k != "id"})
    else:
        st.caption("Nothing revealed yet. Ask the correct questions to reveal details.")

    st.divider()
    st.header("Export")
    if st.session_state.export_ready:
        filename = f"{st.session_state.class_name or 'class'}_{st.session_state.student_name or 'student'}_{st.session_state.run_id}.csv"
        st.download_button("⬇️ Download CSV export", data=build_export_csv_bytes(), file_name=filename, mime="text/csv", use_container_width=True)
    else:
        st.caption("Finish the run to enable CSV export.")

left, right = st.columns([1.25, 0.75])

steps = st.session_state.steps
idx = st.session_state.step_index
step = steps[idx]
done = st.session_state.done_intents
threshold = DIFFICULTY[st.session_state.difficulty]["threshold"]

with left:
    st.subheader(step.title)

    if step.key not in st.session_state.opened:
        for line in step.visitor_opening:
            add_log("VISITOR", line)
        st.session_state.opened.add(step.key)

    if "id" in st.session_state.revealed:
        with st.expander("🪪 ID Card (revealed)", expanded=(step.key == "id_check")):
            idd = st.session_state.revealed["id"]
            name = st.session_state.revealed.get("name", "—")
            st.markdown(f"**Name:** {name}")
            st.markdown(f"**Nationality:** {idd.get('nationality','—')}")
            st.markdown(f"**Date of birth:** {idd.get('dob','—')}")
            st.markdown(f"**Address:** {idd.get('address','—')}")
            st.markdown(f"**ID No.:** {idd.get('id_no','—')}")
            st.markdown(f"**Expiry:** {idd.get('expiry','—')}")
            st.caption("Fictional training ID.")

    st.markdown("### Conversation")
    chat = st.container(height=360)
    with chat:
        for e in st.session_state.log[-80:]:
            if e["speaker"] == "VISITOR":
                st.markdown(f"**VISITOR:** {e['text']}")
            elif e["speaker"] == "YOU":
                st.markdown(f"**YOU:** {e['text']}")
            else:
                st.info(e["text"])

    st.markdown("### Your line")
    if st.button("Hint", use_container_width=False):
        st.info(step.hint)

    # Voice input (auto send)
    if st.session_state.use_voice:
        audio = mic_recorder(
            start_prompt="Start recording",
            stop_prompt="Stop",
            just_once=True,
            use_container_width=True,
            key=f"mic_{step.key}"
        )
        if audio and isinstance(audio, dict) and audio.get("bytes"):
            transcript = transcribe_wav_bytes(audio["bytes"])
            if transcript:
                st.success(f"Transcript: {transcript}")
                process_user_line(transcript)
                st.rerun()
            else:
                st.warning("No speech detected. Try again.")

    # Typed input
    typed_key = f"typed_{step.key}"
    typed = st.text_input("Type (or use voice above) in English…", key=typed_key)
    if st.button("Send ➤", use_container_width=True) and typed.strip():
        process_user_line(typed.strip())
        st.session_state[typed_key] = ""
        st.rerun()

    if step.key == "id_check":
        st.markdown("### Supervisor call (Dutch 5W briefing)")
        st.caption("After contacting your supervisor, write a short Dutch 5W briefing (NL).")
        st.session_state.nl_briefing = st.text_area(
            "NL briefing (5W)",
            value=st.session_state.nl_briefing,
            height=120,
            placeholder="Naam, doel, contactpersoon, tijd, onderwerp… (kort)"
        )

with right:
    st.subheader("Progress & checklist")
    st.markdown("#### Current step requirements")
    for intent in step.required_intents:
        st.write(f"{fmt_check(done.get(intent, False))} {intent}")

    st.divider()
    all_required = [i for s in steps for i in s.required_intents]
    total = len(all_required)
    completed = sum(1 for i in all_required if done.get(i, False))
    st.metric("Completed intents", f"{completed} / {total}")
    st.progress(completed / total if total else 0.0)

    if st.session_state.export_ready:
        st.divider()
        st.subheader("End-of-run feedback (after finish)")
        completeness = completed / total if total else 0.0
        you_lines = [e["text"] for e in st.session_state.log if e["speaker"] == "YOU"]
        please_hits = sum(1 for t in you_lines if "please" in norm(t))
        please_rate = please_hits / max(1, len(you_lines))

        # Order check: announcements after pat-down explanation
        order_ok = True
        if done.get("announce_armpits") or done.get("announce_waist") or done.get("announce_private"):
            seen = set()
            for e in st.session_state.log:
                if e["speaker"] != "YOU":
                    continue
                t = e["text"]
                for intent in ("explain_patdown", "announce_armpits", "announce_waist", "announce_private"):
                    if fuzzy_intent_match(t, INTENT_PHRASES[intent], threshold):
                        seen.add(intent)
                        if intent.startswith("announce_") and "explain_patdown" not in seen:
                            order_ok = False
                            break
                if not order_ok:
                    break

        st.write(f"- **Completeness:** {completeness:.0%}")
        st.write(f"- **Procedure order:** {'✅' if order_ok else '⚠️'}")
        st.write(f"- **Politeness (optional):** 'please' used in ~{please_rate:.0%} of lines (nice to have).")

st.caption("GitHub cannot run Streamlit by itself. For a public URL, deploy via Streamlit Community Cloud.")
