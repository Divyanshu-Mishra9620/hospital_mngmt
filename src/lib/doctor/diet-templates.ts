import type { DIET_TYPES, Meals } from "@/lib/constants";

export type DietTemplate = {
  calories: number | null;
  meals: Meals;
  include: string;
  avoid: string;
  hydration: string;
  exercise: string;
  lifestyle: string;
  sleep: string;
};

/**
 * Starting points for the doctor's diet & lifestyle plan. The doctor edits
 * them freely in the consultation workspace before saving.
 */
export const DIET_TEMPLATES: Record<(typeof DIET_TYPES)[number], DietTemplate> = {
  "Balanced (general)": {
    calories: null,
    meals: {
      earlyMorning: "A glass of warm water; 4–5 soaked almonds",
      breakfast: "Idli / dosa / poha / oats with a protein source (eggs, sprouts or milk)",
      midMorning: "1 seasonal fruit",
      lunch: "2 rotis or 1 cup rice, dal, a vegetable sabzi, salad and curd",
      evening: "Roasted chana or a handful of nuts with tea",
      dinner: "Light, early dinner — rotis with dal/paneer/fish and vegetables",
    },
    include: "A variety of fruits and vegetables, whole grains, pulses, dairy, nuts and seeds",
    avoid: "Excess sugar, deep-fried snacks and ultra-processed or packaged foods",
    hydration: "2.5–3 litres of water a day.",
    exercise: "30 minutes of brisk walking or any activity on most days of the week.",
    lifestyle: "Limit screen time; if desk-bound, take a short walk every hour.",
    sleep: "7–8 hours at regular times.",
  },
  "Diabetic (low glycaemic)": {
    calories: 1800,
    meals: {
      earlyMorning: "Warm water with soaked methi seeds; 5 almonds + 2 walnuts",
      breakfast: "2 besan / moong dal chillas or vegetable oats upma; tea without sugar",
      midMorning: "1 guava or 1 small apple with skin",
      lunch: "2 multigrain rotis, 1 bowl dal, 1 bowl green vegetables, large salad, curd",
      evening: "Roasted chana (30 g) or sprouts chaat; green tea",
      dinner: "1–2 rotis or ½ cup brown rice, paneer/tofu or grilled fish, sautéed vegetables",
      bedtime: "Warm turmeric milk without sugar (only if fasting sugar is controlled)",
    },
    include: "Millets, oats, brown rice, dals and legumes, leafy greens, low-GI fruits (guava, apple, pear, berries), curd, nuts, seeds",
    avoid: "Sugar, sweets, honey and jaggery; fruit juices; maida and white bread; fried snacks; sugary drinks; large portions of potato and rice",
    hydration: "2.5–3 litres of water a day. Buttermilk or lemon water without sugar are good options.",
    exercise: "Brisk walk 30–40 minutes daily (ideally after dinner) plus light resistance exercise 3 days a week.",
    lifestyle: "Eat at fixed times and never skip meals. Check feet daily for cuts or blisters. Carry a glucose tablet for low-sugar episodes.",
    sleep: "7–8 hours; avoid screens an hour before bed.",
  },
  "DASH (low salt, heart healthy)": {
    calories: 1900,
    meals: {
      earlyMorning: "Lukewarm water; 4–5 soaked almonds",
      breakfast: "Vegetable poha or oats with skimmed milk; 1 fruit",
      midMorning: "1 bowl papaya or 1 orange",
      lunch: "2 rotis, dal, mixed vegetables with minimal salt, cucumber–tomato salad, low-fat curd",
      evening: "Roasted makhana or unsalted peanuts; herbal tea",
      dinner: "Vegetable khichdi or grilled fish / paneer with sautéed vegetables",
      bedtime: "Warm low-fat milk",
    },
    include: "Fresh fruits and vegetables, whole grains, low-fat dairy, nuts, seeds, fish; small amounts of mustard or olive oil",
    avoid: "Pickles, papads, chips, namkeen, processed and packaged foods, extra table salt, red meat, excess butter and ghee",
    hydration: "2–2.5 litres a day unless fluids are restricted.",
    exercise: "30 minutes of moderate walking at least 5 days a week. Avoid heavy lifting until reviewed.",
    lifestyle: "Keep salt under 5 g a day (1 teaspoon). Stop smoking, limit alcohol. Record BP twice a week.",
    sleep: "7–8 hours; get assessed if you snore loudly.",
  },
  "Renal (low protein, low potassium)": {
    calories: 1800,
    meals: {
      breakfast: "Poha / upma / 2 idlis with coconut-free chutney",
      midMorning: "1 small apple or pear",
      lunch: "Rice or 2 rotis, ½ bowl leached dal, leached vegetables (bottle gourd, ridge gourd)",
      evening: "Puffed rice or rice flakes snack",
      dinner: "2 rotis with leached vegetables",
    },
    include: "Measured protein, leached low-potassium vegetables, rice and rotis",
    avoid: "Banana, coconut water, oranges, excess tomatoes, salt substitutes, packaged foods, extra salt",
    hydration: "As advised — usually 1–1.5 litres a day including tea, soups and dal.",
    exercise: "Gentle walking 20–30 minutes daily.",
    lifestyle: "Avoid over-the-counter painkillers (ibuprofen, diclofenac). Check BP and weight daily.",
    sleep: "7–8 hours.",
  },
  "Low fat / cardiac": {
    calories: 1800,
    meals: {
      breakfast: "Oats or daliya with skimmed milk; 1 fruit",
      midMorning: "Buttermilk or a fruit",
      lunch: "2 rotis, dal, green vegetables, salad",
      evening: "Sprouts or roasted chana",
      dinner: "Vegetable soup, 1–2 rotis, sabzi",
    },
    include: "High-fibre foods, oats, fruits, vegetables, fish, flaxseeds, walnuts",
    avoid: "Fried foods, red and processed meat, full-cream dairy, bakery items, trans fats",
    hydration: "2–2.5 litres a day.",
    exercise: "Walk 30 minutes daily; breathing exercises 10 minutes a day.",
    lifestyle: "Limit tea/coffee to 1–2 cups. Practise relaxation daily. No smoking.",
    sleep: "7–8 hours.",
  },
  "High protein (recovery)": {
    calories: 2200,
    meals: {
      earlyMorning: "Soaked almonds and walnuts",
      breakfast: "2–3 egg omelette or paneer bhurji with multigrain toast; a glass of milk",
      midMorning: "Greek yoghurt or sprouts salad",
      lunch: "Rotis/rice, dal, chicken/fish/paneer curry, vegetables, curd",
      evening: "Roasted chana, peanut chikki or a protein smoothie",
      dinner: "Grilled chicken/fish/tofu with vegetables and 1–2 rotis",
      bedtime: "Warm milk",
    },
    include: "Eggs, dairy, paneer, dals, soya, chicken, fish, nuts and seeds — some protein at every meal",
    avoid: "Empty-calorie snacks, sugary drinks, alcohol",
    hydration: "3 litres a day.",
    exercise: "Physiotherapy as advised; gradually increase walking.",
    lifestyle: "Eat every 3–4 hours. Take supplements as prescribed.",
    sleep: "8 hours — rest helps healing.",
  },
  "Soft / bland (GI)": {
    calories: null,
    meals: {
      breakfast: "Idli with thin sambar or suji upma; weak tea",
      midMorning: "Banana or tender coconut water",
      lunch: "Soft rice with moong dal, lauki/tinda sabzi, curd",
      evening: "Toast or rusk with buttermilk",
      dinner: "Moong dal khichdi with curd",
    },
    include: "Soft home-cooked food, moong dal, rice, curd, banana, boiled vegetables, soups",
    avoid: "Spicy, oily and fried food; raw salads for now; coffee, aerated drinks and alcohol; late-night meals",
    hydration: "Sip water frequently — at least 2.5–3 litres a day, more with fever.",
    exercise: "Rest while unwell; resume light walks once symptoms settle.",
    lifestyle: "Small, frequent meals. Don't lie down within 2 hours of eating.",
    sleep: "8 hours of rest.",
  },
  "Weight management": {
    calories: 1500,
    meals: {
      earlyMorning: "Warm water with lemon",
      breakfast: "Vegetable omelette (2 whites + 1 egg) or moong chilla; black coffee or green tea",
      midMorning: "1 fruit",
      lunch: "1 roti + 1 small bowl rice, dal, sabzi, large salad",
      evening: "Roasted makhana / chana; green tea",
      dinner: "Grilled paneer/chicken/fish with vegetables, or soup with 1 roti — before 8 PM",
    },
    include: "High-protein, high-fibre foods; vegetables at every meal; portion-controlled whole grains",
    avoid: "Sugary drinks, sweets, fried snacks, bakery items, late-night eating, large rice portions",
    hydration: "3 litres a day.",
    exercise: "150–200 minutes a week of brisk walking or cycling plus strength training twice a week.",
    lifestyle: "Weigh yourself weekly, use a smaller plate, eat slowly and mindfully.",
    sleep: "7–8 hours; poor sleep increases hunger.",
  },
  "Pregnancy & lactation": {
    calories: 2200,
    meals: {
      earlyMorning: "Soaked almonds and walnuts",
      breakfast: "Stuffed paratha with curd or vegetable upma with a glass of milk",
      midMorning: "Seasonal fruit + coconut water",
      lunch: "2–3 rotis, dal, green leafy vegetables, curd, salad",
      evening: "Sprouts chaat / peanut chikki / dates",
      dinner: "Rice or rotis with paneer / egg / fish curry and vegetables",
      bedtime: "Warm milk",
    },
    include: "Iron-rich foods (greens, dates), dairy, eggs, fruits, nuts and adequate protein",
    avoid: "Raw papaya, unpasteurised milk, raw or undercooked meat/eggs, excess caffeine, alcohol",
    hydration: "3 litres of fluid a day.",
    exercise: "30 minutes of walking daily and prenatal yoga as advised.",
    lifestyle: "Take supplements regularly and attend every antenatal visit.",
    sleep: "8 hours plus an afternoon rest, preferably on the left side.",
  },
  Paediatric: {
    calories: null,
    meals: {
      breakfast: "Milk with ragi porridge or idli",
      midMorning: "Fruit (banana / apple)",
      lunch: "Soft rice, dal, vegetables, curd",
      evening: "Milk or a homemade snack",
      dinner: "Khichdi or chapati with dal and vegetables",
    },
    include: "Home-cooked meals, fruits, milk, eggs",
    avoid: "Packaged juices, chips, chocolates and cold drinks while unwell",
    hydration: "Offer water frequently; ORS if there are loose stools.",
    exercise: "Normal play once the fever has settled.",
    lifestyle: "Hand-washing before meals; keep vaccinations up to date.",
    sleep: "10–12 hours.",
  },
};
