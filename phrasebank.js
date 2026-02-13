// phrasebank.js
// Person Search / dialogue phrasebank (EN) with mood bands: cautious / evasive / open
// Placeholders resolved by app.js:
// {name} {first} {last} {dob} {nat} {idNo} {meetingTime}
// Optional scenario placeholders:
// {claimedName} {claimedFirst} {claimedLast}

window.PS_PATCH = {
  bandFromMoodKey(moodKey){
    if (moodKey === "relaxed") return "open";
    if (moodKey === "neutral") return "cautious";
    if (moodKey === "mixed") return "cautious";
    if (moodKey === "nervous") return "evasive";
    if (moodKey === "irritated") return "evasive";
    return "cautious";
  },

  QA: {
    ask_name: {
      cautious: [
        "{claimedName}.",
        "My name is {claimedName}.",
        "It’s {claimedName}.",
        "{claimedLast}. {claimedFirst}.",
        "{claimedName}, yes."
      ],
      evasive: [
        "Why do you need my name?",
        "It should be on my ID.",
        "Do you ask everyone that?",
        "I’d rather keep that private. It’s on the document.",
        "Can you just check my ID?"
      ],
      open: [
        "Of course. {claimedName}.",
        "Sure — my name is {claimedName}.",
        "{claimedName}. How can I help?",
        "Absolutely — {claimedName}.",
        "Yes, {claimedName}. Thanks."
      ]
    },

    spell_last_name: {
      cautious: [
        "It’s {claimedLast}.",
        "My surname is {claimedLast}.",
        "It’s the same as on the ID: {claimedLast}.",
        "{claimedLast}.",
        "Surname: {claimedLast}."
      ],
      evasive: [
        "It’s on the ID.",
        "Do I really need to spell it?",
        "Can you read it off the card?",
        "I already told you my name.",
        "Why is spelling necessary?"
      ],
      open: [
        "Sure — {claimedLast}.",
        "Of course — {claimedLast}.",
        "Yes, {claimedLast}.",
        "No problem — {claimedLast}.",
        "{claimedLast}, yes."
      ]
    },

    dob_q: {
      cautious: [
        "{dob}.",
        "My date of birth is {dob}.",
        "It’s {dob}.",
        "{dob}. That’s my DOB.",
        "Date of birth: {dob}."
      ],
      evasive: [
        "Do you really need my date of birth?",
        "I’d rather not say that out loud.",
        "It’s on the ID — can you check it there?",
        "Why is my DOB relevant?",
        "Is that required for entry?"
      ],
      open: [
        "Sure — {dob}.",
        "Of course: {dob}.",
        "My date of birth is {dob}.",
        "{dob}, yes.",
        "DOB is {dob}."
      ]
    },

    nat_q: {
      cautious: [
        "{nat}.",
        "My nationality is {nat}.",
        "I’m {nat}.",
        "{nat} nationality.",
        "{nat}."
      ],
      evasive: [
        "Why does nationality matter?",
        "The ID is valid — that’s what matters.",
        "Isn’t the passport enough?",
        "I’m here legally. That should be enough.",
        "Can we stick to the procedure?"
      ],
      open: [
        "{nat} — yes.",
        "I’m {nat}.",
        "{nat}.",
        "My nationality is {nat}.",
        "{nat}, that’s correct."
      ]
    },

    ask_id: {
      cautious: [
        "Alright. Here you go.",
        "Yes — here is my ID.",
        "Sure. Here you are.",
        "Okay. One moment… here.",
        "Yes. I have it with me."
      ],
      evasive: [
        "Do you really need my ID?",
        "I don’t like handing it over.",
        "Can I show it without giving it to you?",
        "Why do you need to see it again?",
        "I’ve shown it already."
      ],
      open: [
        "Absolutely — here’s my ID.",
        "Of course. Please take a look.",
        "Sure — here you go.",
        "No problem — here it is.",
        "Yes, officer. Here’s my ID."
      ]
    },

    return_id: {
      cautious: ["Thank you.", "Thanks.", "Alright, thanks.", "Okay, thanks.", "Thank you, officer."],
      evasive: ["Finally.", "About time.", "Thanks… can I go now?", "Right. Are we done?", "Okay."],
      open: ["Thank you very much.", "Thanks — I appreciate it.", "Great, thank you.", "Thanks for your help.", "Thank you. Have a good day."]
    },

    purpose: {
      cautious: [
        "I’m here for a meeting.",
        "I have an appointment on base.",
        "I’m visiting for work.",
        "I need access for an appointment.",
        "I’m here to see someone inside."
      ],
      evasive: [
        "Just visiting.",
        "It’s personal.",
        "I was told to come here.",
        "I don’t see why I need to explain.",
        "I’m not comfortable discussing details."
      ],
      open: [
        "I have an appointment on base.",
        "I’m here for a scheduled meeting.",
        "I’m here for a contractor appointment.",
        "I’m visiting for official business.",
        "I’m expected and need entry."
      ]
    },

    has_appointment_yes: {
      cautious: ["Yes.", "Yes, I do.", "Yes — it’s scheduled.", "Yes, I’m expected.", "Yes, I have an appointment."],
      evasive: ["Yes… but I’m in a hurry.", "Do you always ask that?", "Yes. Can we move on?", "Yeah. It’s arranged.", "Yes — obviously."],
      open: ["Yes, I have an appointment.", "Yes — it’s scheduled.", "Yes, I’m expected at reception.", "Yes, I have a meeting booked.", "Absolutely — yes."]
    },

    has_appointment_no: {
      cautious: [
        "No, I don’t have an appointment.",
        "No — I was told to report here.",
        "No. I need to check in at reception.",
        "No appointment. I’m here to ask for information.",
        "No — I’m not sure who to see yet."
      ],
      evasive: [
        "No. And I don’t see why that matters.",
        "No appointment — but I was told I can enter.",
        "No… can’t you just let me through?",
        "No. This is a waste of time.",
        "No. Can we sort this out quickly?"
      ],
      open: [
        "No, I don’t have an appointment. I’m here to check in first.",
        "No — I was instructed to go to the sign-in office.",
        "No appointment. I need to speak to reception.",
        "No, I’m here to arrange access at reception.",
        "No — but I can call my contact if needed."
      ]
    },

    
    who_meeting: {
      cautious: [
        "I’m meeting my contact at reception.",
        "I’m meeting {contactName}.",
        "I’m expected by {contactName}.",
        "I’m meeting a staff member inside — {contactName}.",
        "I’m here to see {contactRank} {contactLast}."
      ],
      evasive: [
        "Someone inside.",
        "I don’t remember the exact name.",
        "It’s arranged — that’s all.",
        "I was told to ask at reception.",
        "I don’t want to say names out loud."
      ],
      open: [
        "I’m meeting {contactName}.",
        "I’m expected by {contactName}.",
        "I have an appointment with {contactName}.",
        "I’m here to see {contactRank} {contactLast}.",
        "My point of contact is {contactName}."
      ]
    },

    // If the student asks again and the visitor is evasive:
    who_meeting_evasive2: {
      cautious: [],
      open: [],
      evasive: [
        "Uh… I think it’s {contactRank}. The name sounds like {contactLastAlt}… something like that.",
        "I’m meeting a {contactRank}. The surname is… {contactLastAlt}? I’m not 100% sure.",
        "{contactRank}. I can’t remember the exact spelling — maybe {contactLastAlt}.",
        "It’s a {contactRank} at reception. The name sounds like {contactLastAlt}.",
        "Look, I’m meeting a {contactRank}. I think the name is {contactLastAlt}."
      ]
    },
time_meeting: {
      cautious: ["Soon.", "In a few minutes.", "At {meetingTime}.", "Around {meetingTime}.", "It’s scheduled for {meetingTime}."],
      evasive: ["I don’t know exactly.", "It’s on the email.", "I don’t have the time in my head.", "Can we just call my contact?", "I was told to come today."],
      open: ["At {meetingTime}.", "The appointment is at {meetingTime}.", "I’m expected at {meetingTime}.", "It’s scheduled for {meetingTime}.", "I’m due at {meetingTime}."]
    },

    about_meeting: {
      cautious: ["It’s about work.", "It’s a meeting.", "It’s about access today.", "It’s about paperwork.", "It’s about an inspection."],
      evasive: ["Work stuff.", "It’s not important.", "Just a meeting — okay?", "I’d rather not discuss it here.", "Private business."],
      open: ["It’s about contractor access today.", "It’s a scheduled appointment for work on site.", "It’s an inspection meeting arranged in advance.", "It’s about paperwork and access.", "It’s about official business on base."]
    },

    appointment_proof: {
      cautious: [
        "I have an email confirmation.",
        "I can show you the email.",
        "I have a message with the details.",
        "I can show you my appointment notice.",
        "It’s on my phone."
      ],
      evasive: [
        "I don’t have to show you my phone.",
        "It’s private.",
        "Why do you need proof? It’s scheduled.",
        "This is getting excessive.",
        "Can’t you just call reception?"
      ],
      open: [
        "Sure — I can show the confirmation email.",
        "Yes, I have the appointment email here.",
        "Of course — here’s the confirmation on my phone.",
        "I can show you the details right now.",
        "Yes — I have the confirmation ready."
      ]
    },

    confront_name_mismatch: {
      cautious: [
        "Oh — I use a different surname sometimes.",
        "That’s my old name. I’m using my current details today.",
        "It might be a mistake in the system.",
        "I… I may have said it wrong. My ID is correct.",
        "Sorry — the ID has the correct spelling."
      ],
      evasive: [
        "That’s none of your business.",
        "I said my name — stop nitpicking.",
        "Why are you accusing me?",
        "This is ridiculous.",
        "I’m not discussing that."
      ],
      open: [
        "You’re right — I misspoke. The ID is correct.",
        "Sorry — I gave you the wrong surname. My ID is the right one.",
        "Thanks for spotting that. Please use the name on the ID.",
        "My mistake. The ID details are correct.",
        "Apologies — please go by the ID name."
      ]
    },

    confront_dob_mismatch: {
      cautious: [
        "Sorry — I answered too fast. The ID has the correct DOB.",
        "I mixed up the numbers. Please check the ID.",
        "That was a mistake — the ID is correct.",
        "I misspoke. My DOB is as shown on the ID.",
        "Sorry — my ID has the right details."
      ],
      evasive: [
        "Why are you interrogating me?",
        "I already told you. It’s on the ID.",
        "This is too much.",
        "I’m not comfortable with this.",
        "I don’t like being questioned like that."
      ],
      open: [
        "You’re right — I gave the wrong date. The ID is correct.",
        "Apologies — please use the DOB shown on the ID.",
        "Thanks for catching that. My ID has the right DOB.",
        "Sorry — I misspoke. The ID is correct.",
        "My mistake — the ID shows the correct DOB."
      ]
    },

    id_expired_ack: {
      cautious: [
        "Oh. I didn’t realize it expired.",
        "That’s surprising. I thought it was still valid.",
        "I may need to renew it.",
        "I wasn’t aware it was expired.",
        "I’m sorry — I didn’t check the date."
      ],
      evasive: [
        "That’s not possible.",
        "It was valid last time.",
        "This is a mistake.",
        "Are you sure?",
        "That can’t be right."
      ],
      open: [
        "I understand. What’s the procedure for an expired ID?",
        "Okay — can I contact reception to resolve this?",
        "Understood. I can go to the sign-in office to sort it out.",
        "Thanks for letting me know. What do you need from me?",
        "Okay — I’ll comply with the procedure."
      ]
    },

    no_id: {
      cautious: [
        "I… I don’t have it with me.",
        "I forgot my ID.",
        "I left it in the car.",
        "I don’t have my ID on me right now.",
        "I can’t find it at the moment."
      ],
      evasive: [
        "I don’t have to show you anything.",
        "Why do you need it?",
        "This is unnecessary.",
        "I’m not giving you my documents.",
        "I don’t carry it all the time."
      ],
      open: [
        "I don’t have my ID with me — what’s the procedure?",
        "I forgot my ID. Can I go to reception to verify my identity?",
        "I can call my contact to confirm my identity.",
        "I don’t have it — how can we resolve this properly?",
        "I understand. What are my options without ID?"
      ]
    },

    deny_why: {
      cautious: ["Why can’t I enter?", "What’s the problem?", "Why am I being denied?", "Is there an issue?", "What changed?"],
      evasive: ["This is unfair.", "You can’t be serious.", "Why are you stopping me?!", "This is ridiculous.", "What’s going on?"],
      open: [
        "Can you explain why I’m being denied entry?",
        "Is there anything I can do to fix this?",
        "What do you need from me to proceed?",
        "Could you clarify the reason for denial?",
        "Okay — what’s the next step?"
      ]
    },

    ps_direct_signin: {
      cautious: ["Okay — where do I sign in?", "Where is the sign-in office?", "Alright — where do I go to sign in?", "Do I need to check in first?", "Okay — which way to reception?"],
      evasive: ["Why can’t I just go in?", "Do I really have to sign in?", "This is too much bureaucracy.", "Can’t you just let me pass?", "Fine — where is it then?"],
      open: ["Okay. I’ll go to the sign-in office now.", "No problem — I’ll sign in at reception.", "Understood. I’ll check in first.", "Sure — I’ll head to the sign-in office.", "Okay — thanks. I’ll go sign in."]
    }
  }
};