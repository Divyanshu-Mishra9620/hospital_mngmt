/** Editorial content for the public website (health library, facilities, FAQs). */

export type Article = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  authorCode: string;
  date: string;
  readMins: number;
  body: { h?: string; p?: string; list?: string[] }[];
};

export const ARTICLES: Article[] = [
  {
    slug: "heart-attack-warning-signs",
    title: "Heart attack warning signs you should never ignore",
    excerpt: "Chest pain isn't the only symptom. Learn the subtle signs — especially in women and people with diabetes — and what to do in the first golden hour.",
    category: "Heart health",
    author: "Dr. Ananya Rao",
    authorCode: "DOC-1001",
    date: "2026-10-28",
    readMins: 5,
    body: [
      { p: "Every minute counts during a heart attack. The sooner a blocked artery is opened, the more heart muscle can be saved. Yet many people delay coming to hospital because their symptoms don't match the dramatic chest-clutching image they expect." },
      { h: "Classic symptoms" },
      { list: ["Pressure, squeezing or heaviness in the centre of the chest lasting more than a few minutes", "Pain spreading to the left arm, jaw, neck or back", "Breathlessness, with or without chest discomfort", "Cold sweat, nausea or light-headedness"] },
      { h: "Atypical symptoms are common" },
      { p: "Women, older adults and people living with diabetes often experience vague symptoms: unusual fatigue, indigestion-like discomfort, or breathlessness on mild exertion. Diabetes can dull pain signals, so a heart attack may be almost painless." },
      { h: "What to do immediately" },
      { list: ["Call our emergency line or an ambulance — don't drive yourself", "Chew one regular aspirin (300 mg) if you aren't allergic and a doctor hasn't told you to avoid it", "Sit down, stay calm and loosen tight clothing", "Note the time symptoms began — the treating team will ask"] },
      { p: "At Medora, our cath lab is ready 24×7 for primary angioplasty. If you have risk factors such as diabetes, high BP, high cholesterol, smoking or a family history, a yearly cardiac risk assessment is a sensible investment." },
    ],
  },
  {
    slug: "managing-diabetes-diet",
    title: "Eating well with diabetes: a practical Indian plate",
    excerpt: "You don't need to give up rotis or rice. Portion size, food order and fibre make the biggest difference to your sugar readings.",
    category: "Diabetes",
    author: "Dr. Rajesh Agarwal",
    authorCode: "DOC-1015",
    date: "2026-10-18",
    readMins: 6,
    body: [
      { p: "Good diabetes control is built meal by meal. The goal isn't a perfect diet — it's a sustainable pattern that keeps your sugar within range and your energy steady." },
      { h: "Build your plate" },
      { list: ["Half the plate: non-starchy vegetables and salad", "One quarter: protein — dal, paneer, eggs, fish, chicken or sprouts", "One quarter: whole grains — 1–2 multigrain rotis or ½ cup brown rice/millets", "A small bowl of curd or buttermilk"] },
      { h: "Small habits, big results" },
      { list: ["Eat vegetables and protein first, carbohydrates last", "Prefer whole fruits (guava, apple, pear) over juices", "Walk for 10–15 minutes after your largest meal", "Don't skip meals if you take sulphonylureas or insulin — it risks low sugar"] },
      { p: "Your doctor can attach a personalised diet and lifestyle plan to your prescription — you'll find it under “Diet & lifestyle” in the Medora patient app." },
    ],
  },
  {
    slug: "when-to-choose-video-consultation",
    title: "Video consultation or hospital visit? How to choose",
    excerpt: "Video consults are ideal for follow-ups, report reviews and many common problems. Here's when to book one — and when you must come in.",
    category: "Patient guide",
    author: "Dr. Deepak Chawla",
    authorCode: "DOC-1020",
    date: "2026-10-05",
    readMins: 4,
    body: [
      { p: "Video consultations save travel and waiting time, and at ₹350 they cost less than an in-person OPD visit. For many situations they're just as effective." },
      { h: "Great for video" },
      { list: ["Follow-ups for diabetes, BP, thyroid and cholesterol", "Reviewing lab or imaging reports", "Medicine adjustments and refills", "Skin rashes (with good lighting), mild fevers, allergies", "Mental-health and lifestyle counselling"] },
      { h: "Come to the hospital instead" },
      { list: ["Chest pain, breathlessness, fainting or stroke symptoms — go to Emergency", "Injuries, fractures or wounds", "Problems that need a physical examination (abdominal pain, lumps)", "Babies under 3 months with fever"] },
      { p: "If the doctor feels you need to be examined after a video consult, you can book an in-person visit from the same app." },
    ],
  },
  {
    slug: "knee-pain-when-to-see-a-doctor",
    title: "Knee pain: exercises that help and signs you need a specialist",
    excerpt: "Most knee pain improves with strengthening and weight management. Know which symptoms mean it's time for an orthopaedic opinion.",
    category: "Bones & joints",
    author: "Dr. Rohan Desai",
    authorCode: "DOC-1005",
    date: "2026-09-22",
    readMins: 5,
    body: [
      { p: "Knee osteoarthritis is the most common cause of knee pain after 45. Strong thigh muscles act as shock absorbers and reduce pain more than most medicines." },
      { h: "Three daily exercises" },
      { list: ["Straight-leg raises — 3 sets of 10 each leg", "Static quadriceps — press the back of the knee into a towel, hold 10 seconds, repeat 15 times", "Wall sits to a comfortable angle — hold 20 seconds, 5 times"] },
      { h: "See a specialist if" },
      { list: ["The knee locks, gives way or swells repeatedly", "Pain wakes you at night", "You can't walk 500 metres despite 3 months of exercises and medicines"] },
    ],
  },
  {
    slug: "monsoon-fevers-dengue",
    title: "Monsoon fevers: dengue, malaria and typhoid explained",
    excerpt: "How to tell common viral fever from dengue, the warning signs that need urgent care, and simple steps to protect your family.",
    category: "Infections",
    author: "Dr. Asha Fernandes",
    authorCode: "DOC-1021",
    date: "2026-09-08",
    readMins: 6,
    body: [
      { p: "Fever with body ache is common after the rains. Most cases are viral and settle in 3–5 days, but dengue and malaria need prompt testing." },
      { h: "Warning signs — come to Emergency" },
      { list: ["Severe abdominal pain or persistent vomiting", "Bleeding from gums or nose, black stools", "Drowsiness, restlessness or confusion", "Reduced urine output"] },
      { h: "Prevention" },
      { list: ["Empty stagnant water around the home weekly", "Use mosquito repellent and nets", "Drink boiled or filtered water", "Avoid self-medicating with painkillers like ibuprofen during fever — paracetamol is safer"] },
    ],
  },
  {
    slug: "healthy-pregnancy-checklist",
    title: "A trimester-by-trimester checklist for a healthy pregnancy",
    excerpt: "Scans, supplements, vaccines and warning signs — everything to plan for from the first positive test to delivery day.",
    category: "Women's health",
    author: "Dr. Priya Menon",
    authorCode: "DOC-1009",
    date: "2026-08-30",
    readMins: 7,
    body: [
      { h: "First trimester (weeks 1–13)" },
      { list: ["Start folic acid if you haven't already", "Dating scan and NT scan at 11–13 weeks", "Blood tests: CBC, thyroid, blood group, sugar"] },
      { h: "Second trimester (weeks 14–27)" },
      { list: ["Anomaly scan at 18–20 weeks", "Glucose tolerance test at 24–28 weeks", "Begin iron and calcium supplements"] },
      { h: "Third trimester (weeks 28–40)" },
      { list: ["Growth scans and regular BP checks", "Tdap vaccine", "Plan your birth preferences and hospital bag"] },
      { p: "Call us immediately for bleeding, leaking fluid, severe headache or reduced baby movements." },
    ],
  },
];

export const FACILITIES = [
  { title: "24×7 Emergency & Trauma", text: "A 30-bed emergency department with triage, resuscitation bays, a dedicated trauma team and helipad-to-OT access.", icon: "Siren" },
  { title: "Critical care", text: "82 ICU beds across medical, surgical, cardiac, neuro and neonatal ICUs with 1:1 nursing for ventilated patients.", icon: "HeartPulse" },
  { title: "Cath lab & cardiac OT", text: "Bi-plane cath lab ready round the clock for primary angioplasty, with modular cardiac theatres.", icon: "Activity" },
  { title: "Advanced imaging", text: "3 Tesla MRI, 128-slice CT, digital mammography, DEXA and 4D ultrasound with reports in hours.", icon: "Scan" },
  { title: "Laboratory & blood bank", text: "Fully automated lab running 24×7 with a component-separation blood bank.", icon: "FlaskConical" },
  { title: "Robotic & minimal-access surgery", text: "Robotic-assisted joint replacement and laparoscopic suites for faster recovery and shorter stays.", icon: "Sparkles" },
  { title: "Dialysis unit", text: "20 haemodialysis stations with dedicated stations for infection-positive patients, open 24×7.", icon: "Droplets" },
  { title: "In-house pharmacy", text: "A 24×7 pharmacy with batch-tracked, cold-chain-controlled medicines, pickup and home delivery.", icon: "Pill" },
  { title: "Ambulance network", text: "Advanced life-support ambulances with paramedics and GPS tracking across the city.", icon: "Ambulance" },
  { title: "Rehabilitation", text: "Physiotherapy, occupational therapy, cardiac and pulmonary rehab under one roof.", icon: "Dumbbell" },
] as const;

export const FAQS = [
  { q: "How do I book an appointment?", a: "Book online in under a minute from the website or patient app, call our appointment desk, or walk in to the OPD registration counter. Online booking shows each doctor's live slots and confirms instantly." },
  { q: "What is a UHID?", a: "Your Unique Health ID is created when you first register with us — online or at the hospital. It links all your appointments, prescriptions, reports and bills. Keep it handy for every visit." },
  { q: "How much does a consultation cost?", a: "Standard specialist consultations are ₹500 in person and ₹350 by video. Fees are shown before you pay; some senior consultants may differ." },
  { q: "How do video consultations work?", a: "Book a video slot and pay online. On the day, open the appointment in the patient app and tap “Join video call” up to 15 minutes before. Your digital prescription and diet plan appear in the app after the call." },
  { q: "Can I cancel or reschedule?", a: "Yes — from the patient app. Cancellations more than 2 hours before the slot are refunded in full to the original payment method within 3–5 working days." },
  { q: "Can I buy my prescribed medicines from the hospital pharmacy?", a: "Yes. Add medicines from your prescription to the cart in the app for pickup or home delivery, or show your prescription at the 24×7 pharmacy counter." },
  { q: "Do you accept health insurance?", a: "We offer cashless treatment with most major insurers and TPAs. Bring your policy card and a photo ID to the insurance desk at admission. For planned procedures, request pre-authorisation 3–5 days in advance." },
  { q: "What are the visiting hours?", a: "General wards: 11:00 AM – 1:00 PM and 5:00 PM – 7:00 PM, one visitor at a time. ICU visits are limited to 15 minutes at 12:00 PM and 6:00 PM." },
];
