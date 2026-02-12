// v7_4_12_patch_person_search_en.js
window.PS_PATCH = {
  // map jouw mood keys -> 3 banden
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
      cautious: ["Miller.", "John Miller."],
      evasive: ["Why do you need my name?", "Do we really have to do this?"],
      open: ["Of course. My name is John Michael Miller.", "Sure — John Miller."]
    },
    spell_last_name: {
      cautious: ["M-I-L-L-E-R."],
      evasive: ["It's on the ID.", "I already told you."],
      open: ["M-I-L-L-E-R."]
    },
    dob_q: {
      cautious: ["1991.", "12 February 1991."],
      evasive: ["I'd rather not share that.", "Is date of birth required?"],
      open: ["12 February 1991.", "It’s the twelfth of February, nineteen ninety-one."]
    },
    nat_q: {
      cautious: ["Dutch."],
      evasive: ["Why does nationality matter?", "It’s valid, that’s what matters."],
      open: ["Dutch nationality.", "Dutch. I live near the border but I’m Dutch."]
    },
    ask_id: {
      cautious: ["Alright. Here you go."],
      evasive: ["Do you really need my ID?", "I don’t like handing it over."],
      open: ["Absolutely. Here is my passport.", "Sure — here’s my ID."]
    },
    purpose: {
      cautious: ["A meeting.", "Business."],
      evasive: ["Just visiting.", "It’s personal."],
      open: ["I have an appointment on base.", "I’m here for a scheduled meeting."]
    },
    has_appointment: {
      cautious: ["Yes."],
      evasive: ["Do you always ask that?", "I’m in a hurry."],
      open: ["Yes, I have an appointment.", "Yes — my visit is scheduled."]
    },
    who_meeting: {
      cautious: ["Sergeant de Vries."],
      evasive: ["Someone inside.", "I don’t remember the name."],
      open: ["Sergeant de Vries in Operations.", "I’m meeting Sergeant de Vries."]
    },
    time_meeting: {
      cautious: ["Soon.", "In a few minutes."],
      evasive: ["I don’t know exactly.", "I was just told to come."],
      open: ["At {meetingTime}.", "The appointment is at {meetingTime}."]
    },
    about_meeting: {
      cautious: ["A delivery."],
      evasive: ["Work stuff.", "It’s not important."],
      open: ["A delivery for the workshop — tools and spare parts."]
    },
    ps_ready: {
      cautious: ["Am I cleared now?"],
      evasive: ["Can we hurry up?", "Are we done yet?"],
      open: ["Is everything in order now?", "Great — what’s the next step?"]
    },
    ps_direct_signin: {
      cautious: ["Where is that?"],
      evasive: ["Why can’t I just go in?"],
      open: ["Okay. I’ll go to the sign-in office now."]
    }
  }
};
