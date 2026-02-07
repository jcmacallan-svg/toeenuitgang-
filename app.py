import random
import difflib
import datetime as dt
from dataclasses import dataclass
import tempfile
import os
import json
from pathlib import Path

import pandas as pd
import streamlit as st
from PIL import Image, ImageDraw, ImageFont

from streamlit_mic_recorder import mic_recorder
from faster_whisper import WhisperModel

# ============================================================
# VIVA Entry Control English Trainer (v6)
# Privacy-focused classroom mode:
# - On screen: show ONLY the latest VISITOR answer (not full conversation).
# - If TTS is enabled: show answer while speaking, then auto-hide 5s after speech ends.
# - When the student asks the next question, the previous answer is replaced.
# - Full internal log is still kept for CSV export (teacher).
#
# Phrasebank:
# - phrasebank.json must be in the SAME folder as app.py
# - Add extra intent phrases via sidebar to improve recognition over time
# ============================================================

def norm(s: str) -> str:
    return " ".join((s or "").lower().strip().split())

def now_iso() -> str:
    return dt.datetime.now().replace(microsecond=0).isoformat()

def fmt_check(ok: bool) -> str:
    return "✅" if ok else "⬜"

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

@st.cache_resource
def get_whisper_model():
    return WhisperModel("base", device="cpu", compute_type="int8")

def transcribe_wav_bytes(wav_bytes: bytes) -> str:
    model = get_whisper_model()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
        f.write(wav_bytes)
        tmp_path = f.name
    try:
        segments, _info = model.transcribe(tmp_path, language="en")
        return " ".join(seg.text.strip() for seg in segments).strip()
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

DIFFICULTY = {
    "Basic": {"threshold": 0.68, "notes": "Forgiving matching. Best for starters."},
    "Standard": {"threshold": 0.72, "notes": "Balanced matching. Recommended default."},
    "Advanced": {"threshold": 0.78, "notes": "Stricter matching. Be clear & specific."},
}

PHRASEBANK_PATH = Path(__file__).with_name("phrasebank.json")

DEFAULT_PHRASEBANK = {
    "smalltalk": [
        {"name": "how_are_you", "patterns": ["how are you", "how're you", "how are u", "how do you do"],
         "response": "I'm good, thank you. How can I help you?"},
        {"name": "greeting", "patterns": ["hello", "hi", "good morning", "good afternoon", "good evening"],
         "response": "Hello. How can I help you today?"},
        {"name": "thanks", "patterns": ["thank you", "thanks", "cheers"],
         "response": "You're welcome."}
    ],
    "off_script": {"reflect_question_template": "Just to confirm: are you asking '{q}'?"},
    "intents": {}
}

def load_phrasebank() -> dict:
    if PHRASEBANK_PATH.exists():
        try:
            return json.loads(PHRASEBANK_PATH.read_text(encoding="utf-8"))
        except Exception:
            return DEFAULT_PHRASEBANK
    return DEFAULT_PHRASEBANK

def try_save_phrasebank(pb: dict) -> bool:
    try:
        PHRASEBANK_PATH.write_text(json.dumps(pb, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False

def pb_match(text: str, entries: list[dict]) -> dict | None:
    t = norm(text)
    for e in entries:
        for p in (e.get("patterns", []) or []):
            if norm(p) and norm(p) in t:
                return e
    return None

def smalltalk_response(text: str, pb: dict) -> str | None:
    hit = pb_match(text, pb.get("smalltalk", []))
    return hit.get("response") if hit else None

def off_script_reflect(user_text: str, pb: dict) -> str:
    cleaned = (user_text or "").strip()
    if not cleaned:
        return "Sorry—what exactly do you need to know?"
    tpl = (pb.get("off_script", {}) or {}).get("reflect_question_template") or DEFAULT_PHRASEBANK["off_script"]["reflect_question_template"]
    q = cleaned if cleaned.endswith("?") else cleaned + "?"
    return tpl.format(q=q)

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
    ("no_appointment", "The visitor says they have no appointment."),
    ("annoyed", "The visitor is annoyed and short in responses."),
    ("typo_name", "The visitor gives a name that is easy to misspell."),
    ("sharp_object", "The visitor has a small sharp object and must surrender it."),
    ("alcohol", "The visitor has alcohol and must surrender it."),
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

def compute_age(dob_str: str) -> int | None:
    try:
        dob = dt.datetime.strptime(dob_str, "%d %b %Y").date()
        today = dt.date.today()
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    except Exception:
        return None

def list_local_photos():
    folder = Path(__file__).with_name("assets") / "photos"
    if not folder.exists():
        return []
    exts = {".jpg", ".jpeg", ".png", ".webp"}
    return [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in exts]

def generate_visitor_card(seed=None):
    rnd = random.Random(seed)
    name = f"{rnd.choice(FIRST_NAMES)} {rnd.choice(LAST_NAMES)}"
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

    photos = list_local_photos()
    photo_path = str(rnd.choice(photos)) if photos else None

    return {
        "name": name, "org": org, "host": host,
        "purpose": purpose, "topic": topic, "time": time,
        "twist_key": twist_key, "twist_desc": twist_desc,
        "photo_path": photo_path,
        "id": {"id_no": id_no, "dob": dob, "nationality": nationality, "address": address, "expiry": expiry}
    }

INTENT_PHRASES_BASE = {
    "ask_identity": ["who are you", "what is your name", "your name please", "identify yourself", "may i have your name", "can you tell me your name"],
    "ask_purpose": ["what are you doing here", "what is the purpose", "why are you here", "reason for your visit", "what brings you here", "what is your reason for visiting"],
    "ask_appointment": ["do you have an appointment", "have you got an appointment", "do you have a meeting scheduled", "do you have an appointment scheduled", "are you expected", "do you have a booking"],
    "ask_host": ["who are you meeting", "who do you have an appointment with", "with whom do you have a meeting", "who is your host", "who is expecting you"],
    "ask_time": ["what time is the appointment", "what time is your meeting", "appointment time", "when is the appointment", "what time is it scheduled",
                 "what time is that", "what time is that delivery", "what time is the delivery", "what time is your delivery", "what time is your inspection",
                 "what time is that inspection", "what time is that meeting", "what time is that appointment"],
    "ask_topic": ["what is the appointment about", "what is the meeting about", "topic of the appointment", "what is it regarding", "what is the purpose of the meeting"],
    "request_id": ["can i see your id", "show me your id", "id please", "identification please", "may i see your identification", "could you show your id"],
    "control_question": ["date of birth", "what is your date of birth", "what is your birthday", "what is your address", "what is your postcode", "what is your zip code",
                         "nationality", "how old are you", "what is your age", "where do you live"],
    "contact_supervisor": ["i will contact my supervisor", "i will call my supervisor", "one moment i will contact my supervisor", "please wait i will contact", "i will check with my supervisor"],
    "inform_search_threat": ["heightened threat", "increased threat", "security level", "you will be searched", "for security reasons you will be searched", "due to a higher threat level"],
    "prohibited_items": ["no weapons", "no drugs", "no alcohol", "prohibited items", "weapons drugs or alcohol", "you are not allowed to bring weapons", "you are not allowed to bring drugs", "you are not allowed to bring alcohol"],
    "request_surrender": ["please hand them over", "you must surrender", "give them to me", "you have to hand it over", "hand it over"],
    "explain_patdown": ["i will pat you down", "i am going to search you", "i will frisk you", "i will conduct a security search", "i will perform a pat-down"],
    "ask_sharp": ["sharp objects", "anything sharp", "needles", "anything that can hurt", "do you have anything sharp", "any sharp items"],
    "empty_pockets": ["empty your pockets", "take everything out of your pockets", "put your items on the table", "place your belongings in the tray"],
    "remove_jacket": ["remove your jacket", "take off your jacket", "remove your coat", "remove your outerwear"],
    "announce_armpits": ["under your armpits", "armpits"],
    "announce_waist": ["around your waist", "waistline"],
    "announce_private": ["private parts", "groin area", "around your private parts"],
    "leg_instruction": ["place your foot on your knee", "rest your ankle on your knee", "lift your leg and place it", "put your foot on your knee"],
    "issue_visitor_pass_rule": ["here is your visitor pass", "visitor badge", "wear it visibly", "visible at all times", "you must wear it", "keep it visible"],
    "return_pass_rule": ["return it at the end", "hand it in at the end", "give it back when you leave", "return the pass", "return the badge"],
    "alarm_rally_point": ["if the alarm sounds", "assembly area", "rally point", "muster point", "go to the assembly area", "go to the rally point"],
    "closing_time": ["we close at four", "closing time is 16:00", "visitors must leave by 4 pm", "the base closes for visitors at 4", "all visitors must leave by four"],
}
ALL_INTENTS = list(INTENT_PHRASES_BASE.keys())


# Example sentences for feedback (shown at the end)
EXAMPLE_BY_INTENT = {
    "ask_identity": "Could you tell me your name, please?",
    "ask_purpose": "What are you doing here today?",
    "ask_appointment": "Do you have an appointment?",
    "ask_host": "With whom do you have an appointment?",
    "ask_time": "What time is your appointment?",
    "ask_topic": "What is the appointment about?",
    "request_id": "May I see your ID, please?",
    "control_question": "Can you tell me your date of birth, please?",
    "contact_supervisor": "One moment, I will contact my supervisor.",
    "inform_search_threat": "Due to an increased threat level, you will be searched before entry.",
    "prohibited_items": "You are not allowed to bring weapons, drugs, or alcohol onto the base.",
    "request_surrender": "If you have any prohibited items, please hand them over now.",
    "explain_patdown": "I will conduct a security search (a pat-down).",
    "ask_sharp": "Do you have any sharp objects on you?",
    "empty_pockets": "Please empty your pockets and place the items in the tray.",
    "remove_jacket": "Please remove your jacket/coat.",
    "announce_armpits": "I am searching under your armpits.",
    "announce_waist": "I am searching around your waist.",
    "announce_private": "I am searching around your private parts.",
    "leg_instruction": "Please place your foot on your knee.",
    "issue_visitor_pass_rule": "Here is your visitor pass. Wear it visibly at all times.",
    "return_pass_rule": "Please return the visitor pass at the end of your visit.",
    "alarm_rally_point": "If the alarm sounds, go to the assembly area (rally point).",
    "closing_time": "The base is closed to visitors after 16:00. All visitors must have left by then.",
}

def merged_intent_phrases(pb: dict) -> dict:
    merged = {k: list(v) for k, v in INTENT_PHRASES_BASE.items()}
    extra = (pb.get("intents", {}) or {})
    for intent, items in extra.items():
        merged.setdefault(intent, [])
        if isinstance(items, list):
            for p in items:
                if isinstance(p, str) and p.strip():
                    merged[intent].append(p.strip())
    return merged

@dataclass
class Step:
    key: str
    title: str
    visitor_opening: list[str]
    required_intents: list[str]
    hint: str

def build_steps():
    return [
        Step("gate", "1) Gate interview (appointment intake)", ["Good morning.", "I need to enter the base."],
             ["ask_identity", "ask_purpose", "ask_appointment", "ask_host", "ask_time", "ask_topic"],
             "Ask: name, purpose, appointment, who with, what time, and what it is about."),
        Step("id_check", "2) ID-check + control question + contact supervisor", ["Sure. Where do you want me to go?"],
             ["request_id", "control_question", "contact_supervisor"],
             "Request ID, ask one control question, then contact supervisor."),
        Step("threat_rules", "3) Entry decision: search warning + prohibited items", ["Can I go in now?"],
             ["inform_search_threat", "prohibited_items", "request_surrender"],
             "Explain search due to threat. State prohibited items. Ask to surrender them."),
        Step("patdown", "4) Pat-down / search instructions", ["Alright. What do I need to do?"],
             ["explain_patdown", "ask_sharp", "empty_pockets", "remove_jacket", "announce_armpits", "announce_waist", "announce_private", "leg_instruction"],
             "Explain pat-down, ask sharp objects, empty pockets, remove jacket, announce areas, leg instruction."),
        Step("registration_rules", "5) Registration + base rules briefing", ["Okay. Am I good to go?"],
             ["issue_visitor_pass_rule", "return_pass_rule", "alarm_rally_point", "closing_time"],
             "Visitor pass rules, return rule, rally point, and closing time."),
    ]

REVEAL_BY_INTENT = {
    "ask_identity": ["name", "org"],
    "ask_purpose": ["purpose"],
    "ask_host": ["host"],
    "ask_time": ["time"],
    "ask_topic": ["topic"],
    "request_id": ["id"],
}

def reveal_from_card(intent: str, card: dict):
    for field in REVEAL_BY_INTENT.get(intent, []):
        if field == "id":
            st.session_state.revealed["id"] = card["id"]
        else:
            st.session_state.revealed[field] = card[field]

def response_for_control_question(user_text: str, card: dict) -> str:
    t = norm(user_text)
    if "age" in t or "how old" in t:
        age = compute_age(card["id"]["dob"])
        return f"I am {age} years old." if age is not None else "My age is on my ID."
    if ("where" in t and "live" in t) or "address" in t:
        return f"I live at {card['id']['address']}."
    if "postcode" in t or "zip" in t:
        parts = card["id"]["address"].split(",")
        if len(parts) >= 2:
            post = parts[1].strip().split(" ")
            if len(post) >= 2:
                return f"My postcode is {post[0]} {post[1]}."
        return "My postcode is on the ID."
    if "nationality" in t:
        return f"My nationality is {card['id']['nationality']}."
    if "date of birth" in t or "birthday" in t or "birth" in t:
        return f"My date of birth is {card['id']['dob']}."
    return "It’s written on the ID."

def visitor_response_for_intent(intent: str, user_text: str, card: dict) -> str:
    twist = card["twist_key"]
    t = norm(user_text)
    if "how do you spell" in t or ("spell" in t and "name" in t):
        spelled = " ".join(list(card["name"].replace(" ", "")))
        return f"It is spelled: {spelled}."
    if intent == "ask_identity":
        return f"My name is {card['name']}… that’s J-e-n-s-e-n." if twist == "typo_name" else f"My name is {card['name']}."
    if intent == "ask_purpose":
        return f"I'm here for {card['purpose']}."
    if intent == "ask_appointment":
        return "No, I don't have an appointment." if twist == "no_appointment" else "Yes, I have an appointment."
    if intent == "ask_host":
        return "Uh… I don't actually have an appointment. I was told I could come by." if twist == "no_appointment" else f"I'm meeting {card['host']}."
    if intent == "ask_time":
        return "I think it's sometime this afternoon… I'm not sure." if twist == "vague_time" else f"It's at {card['time']}."
    if intent == "ask_topic":
        return f"It's about {card['topic']}."
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
    if intent == "ask_sharp":
        return "I already mentioned the pocket knife—nothing else." if twist == "sharp_object" else "No."
    if intent in ("explain_patdown", "empty_pockets", "remove_jacket", "announce_armpits", "announce_waist", "announce_private", "leg_instruction"):
        return "Okay."
    if intent in ("issue_visitor_pass_rule", "return_pass_rule", "alarm_rally_point", "closing_time"):
        return "Understood."
    return "Okay."

def render_id_card_image(card: dict, revealed: dict):
    idd = card["id"]
    name = revealed.get("name", "—")
    org = revealed.get("org", "—")

    W, H = 900, 560
    img = Image.new("RGB", (W, H), (245, 245, 245))
    draw = ImageDraw.Draw(img)

    border = (40, 40, 40)
    header_bg = (30, 60, 120)
    light = (230, 230, 230)

    draw.rectangle([10, 10, W - 10, H - 10], outline=border, width=4)
    draw.rectangle([10, 10, W - 10, 110], fill=header_bg)

    try:
        font_big = ImageFont.truetype("DejaVuSans.ttf", 42)
        font_mid = ImageFont.truetype("DejaVuSans.ttf", 28)
        font_sm = ImageFont.truetype("DejaVuSans.ttf", 22)
    except Exception:
        font_big = font_mid = font_sm = ImageFont.load_default()

    draw.text((30, 30), "TRAINING ID CARD", fill=(255, 255, 255), font=font_big)
    draw.text((30, 78), "Fictional document for classroom practice", fill=(210, 220, 245), font=font_sm)

    box = (30, 140, 260, 410)
    draw.rectangle(box, fill=light, outline=border, width=3)

    photo_path = card.get("photo_path")
    pasted = False
    if photo_path and Path(photo_path).exists():
        try:
            ph = Image.open(photo_path).convert("RGB")
            ph = ph.resize((box[2]-box[0], box[3]-box[1]))
            img.paste(ph, (box[0], box[1]))
            pasted = True
        except Exception:
            pasted = False

    if not pasted:
        draw.ellipse([90, 180, 200, 290], outline=(90, 90, 90), width=5)
        draw.rectangle([105, 285, 185, 380], outline=(90, 90, 90), width=5)

    draw.text((55, 420), "PHOTO", fill=(90, 90, 90), font=font_sm)

    x0, y0 = 300, 150
    line_h = 52
    fields = [
        ("Name", name),
        ("Company", org),
        ("Nationality", idd.get("nationality", "—")),
        ("Date of birth", idd.get("dob", "—")),
        ("Age", str(compute_age(idd.get("dob", "")) or "—")),
        ("Address", idd.get("address", "—")),
        ("ID No.", idd.get("id_no", "—")),
        ("Expiry", idd.get("expiry", "—")),
    ]

    for i, (k, v) in enumerate(fields):
        y = y0 + i * line_h
        draw.text((x0, y), f"{k}:", fill=(0, 0, 0), font=font_mid)
        if k == "Address" and len(str(v)) > 42:
            parts = str(v).split(",")
            v1 = parts[0].strip()
            v2 = ",".join(parts[1:]).strip()
            draw.text((x0 + 210, y), v1, fill=(0, 0, 0), font=font_mid)
            draw.text((x0 + 210, y + 30), v2, fill=(0, 0, 0), font=font_sm)
        else:
            draw.text((x0 + 210, y), str(v), fill=(0, 0, 0), font=font_mid)

    draw.rectangle([10, H - 70, W - 10, H - 10], fill=(240, 240, 240))
    draw.text((30, H - 55), "Reminder: prohibited items include weapons, drugs, and alcohol.", fill=(60, 60, 60), font=font_sm)
    return img

def ensure_state():
    if "phrasebank" not in st.session_state:
        st.session_state.phrasebank = load_phrasebank()
    if "difficulty" not in st.session_state:
        st.session_state.difficulty = "Standard"
    if "student_name" not in st.session_state:
        st.session_state.student_name = ""
    if "class_name" not in st.session_state:
        st.session_state.class_name = ""
    if "use_voice" not in st.session_state:
        st.session_state.use_voice = False
    if "hide_spoken_student_line" not in st.session_state:
        st.session_state.hide_spoken_student_line = True
    if "use_tts" not in st.session_state:
        st.session_state.use_tts = False
    if "display_visitor_text" not in st.session_state:
        st.session_state.display_visitor_text = ""
    if "display_msg_id" not in st.session_state:
        st.session_state.display_msg_id = 0
    if "nl_briefing" not in st.session_state:
        st.session_state.nl_briefing = ""
    if "nl_briefing_sent" not in st.session_state:
        st.session_state.nl_briefing_sent = False
    if "card" not in st.session_state:
        st.session_state.card = generate_visitor_card(seed=42)
    if "revealed" not in st.session_state:
        st.session_state.revealed = {}
    if "steps" not in st.session_state:
        st.session_state.steps = build_steps()
    if "step_index" not in st.session_state:
        st.session_state.step_index = 0
    if "done_intents" not in st.session_state:
        st.session_state.done_intents = {}
    if "log" not in st.session_state:
        st.session_state.log = []
    if "opened" not in st.session_state:
        st.session_state.opened = set()
    if "run_id" not in st.session_state:
        st.session_state.run_id = "run_42"
    if "started_at" not in st.session_state:
        st.session_state.started_at = now_iso()
    if "finished_at" not in st.session_state:
        st.session_state.finished_at = ""
    if "export_ready" not in st.session_state:
        st.session_state.export_ready = False

def reset_run():
    seed = random.randint(1, 10_000_000)
    st.session_state.card = generate_visitor_card(seed=seed)
    st.session_state.revealed = {}
    st.session_state.steps = build_steps()
    st.session_state.step_index = 0
    st.session_state.done_intents = {}
    st.session_state.log = []
    st.session_state.opened = set()
    st.session_state.run_id = f"run_{seed}"
    st.session_state.started_at = now_iso()
    st.session_state.finished_at = ""
    st.session_state.export_ready = False
    st.session_state.display_visitor_text = ""
    st.session_state.display_msg_id = 0
    st.session_state.nl_briefing = ""
    st.session_state.nl_briefing_sent = False

def add_log(speaker: str, text: str):
    st.session_state.log.append({"ts": now_iso(), "speaker": speaker, "text": text})
    if speaker == "VISITOR":
        st.session_state.display_visitor_text = text
        st.session_state.display_msg_id += 1

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

def process_user_line(user_text: str, log_user: bool = True):
    pb = st.session_state.phrasebank
    intent_phrases = merged_intent_phrases(pb)
    step = st.session_state.steps[st.session_state.step_index]
    done = st.session_state.done_intents
    threshold = DIFFICULTY[st.session_state.difficulty]["threshold"]

    st_resp = smalltalk_response(user_text, pb)
    if st_resp:
        if log_user:
            add_log("YOU", user_text)
        add_log("VISITOR", st_resp)
        return

    if log_user:
        add_log("YOU", user_text)

    remaining = [i for i in step.required_intents if not done.get(i, False)]
    matched = None
    for intent in remaining:
        if fuzzy_intent_match(user_text, intent_phrases.get(intent, []), threshold):
            matched = intent
            break

    if matched:
        done[matched] = True
        reveal_from_card(matched, st.session_state.card)
        add_log("VISITOR", visitor_response_for_intent(matched, user_text, st.session_state.card))
    else:
        add_log("VISITOR", "Could you be more specific, please?" if st.session_state.difficulty == "Advanced" else off_script_reflect(user_text, pb))

    step_done = all(done.get(i, False) for i in step.required_intents)
    if step.key == "id_check" and step_done and not st.session_state.nl_briefing_sent:
        step_done = False
        add_log("SYSTEM", "Note: first send the NL 5W briefing.")

    if step_done:
        add_log("SYSTEM", "Step complete. Proceed to next step.")
        if st.session_state.step_index < len(st.session_state.steps) - 1:
            st.session_state.step_index += 1
        else:
            st.session_state.finished_at = now_iso()
            st.session_state.export_ready = True
            add_log("SYSTEM", "All steps completed. Export is now available in the sidebar.")

def render_spoken_answer_box():
    text = st.session_state.display_visitor_text
    msg_id = st.session_state.display_msg_id
    use_tts = st.session_state.use_tts

    if not text:
        st.info("Ask your next question in English. (Student writes answers in their notebook.)")
        return

    st.components.v1.html(
        f"""
        <div id="answerbox-{msg_id}" style="
            border: 2px solid #3b82f6;
            border-radius: 12px;
            padding: 14px 16px;
            background: rgba(59,130,246,0.08);
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            font-size: 18px;">
          <b>VISITOR:</b> <span>{text}</span>
        </div>
        <script>
        (function() {{
          const useTTS = {str(use_tts).lower()};
          const box = document.getElementById("answerbox-{msg_id}");
          const answer = {json.dumps(text)};
          if (!box) return;
          if (useTTS && window.speechSynthesis && window.SpeechSynthesisUtterance) {{
            try {{
              const u = new SpeechSynthesisUtterance(answer);
              u.lang = "en-US";
              u.onend = function() {{
                setTimeout(() => {{
                  if (box) box.style.display = "none";
                }}, 5000);
              }};
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(u);
            }} catch(e) {{}}
          }}
        }})();
        </script>
        """,
        height=95,
    )

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

    st.divider()
    st.subheader("Voice & TTS")
    st.session_state.use_voice = st.toggle("🎙️ Voice input", value=st.session_state.use_voice)
    st.session_state.hide_spoken_student_line = st.toggle("Hide spoken student line", value=st.session_state.hide_spoken_student_line)
    st.session_state.use_tts = st.toggle("🔊 Speak visitor responses (TTS)", value=st.session_state.use_tts)
    st.caption("Privacy mode: only the latest visitor answer is shown.")
    st.divider()

    cA, cB = st.columns(2)
    with cA:
        if st.button("🧹 Reset run", use_container_width=True):
            reset_run()
            st.rerun()
    with cB:
        if st.button("🔄 New scenario", use_container_width=True):
            reset_run()
            st.rerun()

    st.divider()
    st.header("Phrasebank (Teacher)")
    pb = st.session_state.phrasebank

    st.download_button(
        "⬇️ Download phrasebank.json",
        data=json.dumps(pb, indent=2, ensure_ascii=False).encode("utf-8"),
        file_name="phrasebank.json",
        mime="application/json",
        use_container_width=True
    )

    uploaded = st.file_uploader("Upload phrasebank.json", type=["json"])
    if uploaded is not None:
        try:
            pb2 = json.loads(uploaded.read().decode("utf-8"))
            st.session_state.phrasebank = pb2
            saved = try_save_phrasebank(pb2)
            st.success("Phrasebank loaded." + (" Saved to server." if saved else " (Cannot save on server; keep your downloaded copy.)"))
        except Exception:
            st.error("Could not load JSON.")

    st.markdown("### Improve recognition")
    with st.form("add_intent_phrase", clear_on_submit=True):
        intent = st.selectbox("Intent", ALL_INTENTS)
        new_phrase = st.text_input("New phrase/pattern", placeholder="e.g., what time is that delivery")
        add_btn = st.form_submit_button("Add phrase to intent")

    if add_btn and new_phrase.strip():
        pb.setdefault("intents", {}).setdefault(intent, [])
        pb["intents"][intent].append(new_phrase.strip())
        st.session_state.phrasebank = pb
        saved = try_save_phrasebank(pb)
        st.success("Added." + (" Saved to server." if saved else " (Cannot save on server; download phrasebank to keep changes.)"))

    st.divider()
    st.header("Export")
    if st.session_state.export_ready:
        filename = f"{st.session_state.class_name or 'class'}_{st.session_state.student_name or 'student'}_{st.session_state.run_id}.csv"
        st.download_button(
            "⬇️ Download CSV export",
            data=build_export_csv_bytes(),
            file_name=filename,
            mime="text/csv",
            use_container_width=True
        )
    else:
        st.caption("Finish the run to enable CSV export.")

main = st.container()

steps = st.session_state.steps
step = steps[st.session_state.step_index]
done = st.session_state.done_intents

with main:
    st.subheader(step.title)

    # Opening lines once per step
    if step.key not in st.session_state.opened:
        for line in step.visitor_opening:
            add_log("VISITOR", line)
        st.session_state.opened.add(step.key)

    # ID Card
    if "id" in st.session_state.revealed:
        with st.expander("🪪 ID Card (revealed)", expanded=(step.key == "id_check")):
            img = render_id_card_image(st.session_state.card, st.session_state.revealed)
            st.image(img, use_container_width=True)
            st.caption("Tip: add rights-cleared photos in assets/photos/ to replace the placeholder.")

    st.markdown("### Visitor answer (privacy mode)")
    render_spoken_answer_box()

    st.markdown("### Your line")
    if st.session_state.use_voice:
        audio = mic_recorder(
            start_prompt="🎙️ Record",
            stop_prompt="Stop",
            just_once=True,
            use_container_width=True,
            key=f"mic_{step.key}"
        )
        if audio and isinstance(audio, dict) and audio.get("bytes"):
            transcript = transcribe_wav_bytes(audio["bytes"])
            if transcript:
                process_user_line(transcript, log_user=(not st.session_state.hide_spoken_student_line))
                st.rerun()
            else:
                st.warning("No speech detected. Try again.")

    with st.form(key=f"typed_form_{step.key}", clear_on_submit=True):
        typed = st.text_input("Type in English…")
        submitted = st.form_submit_button("Send ➤", use_container_width=True)
    if submitted and typed.strip():
        process_user_line(typed.strip(), log_user=True)
        st.rerun()

    if step.key == "id_check":
        st.markdown("### Supervisor call (NL 5W briefing)")
        st.session_state.nl_briefing = st.text_area(
            "NL briefing (short)",
            value=st.session_state.nl_briefing,
            height=110,
            placeholder="Wie / Wat / Met wie / Hoe laat / Waarover"
        )
        if st.button("📨 Send briefing", use_container_width=True):
            st.session_state.nl_briefing_sent = True
            add_log("SYSTEM", "NL briefing sent to supervisor (training).")
            st.rerun()

    st.divider()

    # Manual step advance (teacher can assess later using feedback)
    c1, c2 = st.columns([1, 1])
    with c1:
        if st.button("✅ I'm done with this step (continue)", use_container_width=True):
            add_log("SYSTEM", f"Student ended step '{step.key}' manually.")
            if st.session_state.step_index < len(st.session_state.steps) - 1:
                st.session_state.step_index += 1
                st.rerun()
            else:
                st.session_state.finished_at = now_iso()
                st.session_state.export_ready = True
                add_log("SYSTEM", "Run ended. Export and feedback are now available.")
                st.rerun()
    with c2:
        if st.button("💡 Show step hint", use_container_width=True):
            st.info(step.hint)

    # End-of-run feedback
    if st.session_state.export_ready:
        st.subheader("Feedback (what to improve next time)")
        missing_any = False
        for s in steps:
            missing = [i for i in s.required_intents if not done.get(i, False)]
            if missing:
                missing_any = True
                st.markdown(f"**{s.title}**")
                for intent in missing:
                    example = EXAMPLE_BY_INTENT.get(intent, "")
                    if example:
                        st.write(f"- **{intent}** → e.g., “{example}”")
                    else:
                        st.write(f"- **{intent}**")
        if not missing_any:
            st.success("Nice work — you completed all required parts for every step.")

st.caption("Deploy note: GitHub Pages cannot run Streamlit. Use Streamlit Community Cloud for a public URL.")
