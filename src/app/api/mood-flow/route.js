import { NextResponse } from "next/server";
import {
  PREDEFINED_STAGE2_MOODS,
  labelMapDisplay,
  toneMapDisplay,
} from "../../../../lib/moodConstants";

function buildFallbackStep(city, answers = []) {
  if (answers.length === 0) {
    return {
      done: false,
      question: `How is your mood in ${city} today?`,
      options: ["Positive", "Neutral", "Negative"],
    };
  }

  const first = (answers[0] || "").toLowerCase();

  if (answers.length === 1) {
    if (first === "positive") {
      return {
        done: false,
        question: "Nice. Which positive vibe fits you best right now?",
        options: [
          "Excited",
          "Calm",
          "Curious",
          "Romantic",
          "Confident",
          "Playful",
        ],
      };
    }

    if (first === "neutral") {
      return {
        done: false,
        question: "Understood. Which neutral state is closest right now?",
        options: [
          "Balanced",
          "Unsure",
          "Focused",
          "Low energy",
          "Reflective",
          "Open",
        ],
      };
    }

    return {
      done: false,
      question: "Thanks for sharing. Which negative vibe is closest?",
      options: [
        "Stressed",
        "Tired",
        "Anxious",
        "Burnt out",
        "Overwhelmed",
        "Lonely",
      ],
    };
  }

  if (answers.length === 2) {
    const second = normalizeStage2Mood(answers[1]);

    // Check if stage 2 selection is predefined or AI-generated
    const isPredefinedStage2 = PREDEFINED_STAGE2_MOODS.has(second);

    // Use labelMapDisplay if stage 2 is predefined, otherwise use toneMapDisplay
    const stage3Options = isPredefinedStage2
      ? labelMapDisplay[second] ||
        toneMapDisplay[first] || ["Attractions", "Parks", "Restaurants"]
      : toneMapDisplay[first] || ["Attractions", "Parks", "Restaurants"];

    if (first === "positive") {
      return {
        done: false,
        question: "Great. What kind of experience do you want next?",
        options: stage3Options,
      };
    }

    return {
      done: false,
      question: "Got it. What would help you reset most?",
      options: stage3Options,
    };
  }

  return {
    done: true,
    summary: `Selections: ${answers.join(" -> ")}`,
    question: "Perfect, your trip preferences are ready.",
    options: [],
  };
}

function normalizeStage2Mood(value = "") {
  return stripFeelingLabel(value).toLowerCase();
}

function extractOpenAIText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  const outputItems = Array.isArray(payload?.output) ? payload.output : [];

  for (const item of outputItems) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const block of content) {
      if (block?.type === "output_text" && typeof block?.text === "string") {
        chunks.push(block.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function dedupeOptions(options = [], maxCount = 10) {
  const seen = new Set();
  const out = [];

  for (const option of options) {
    const value = String(option || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= maxCount) break;
  }

  return out;
}

function stripFeelingLabel(option = "") {
  return String(option)
    .trim()
    .replace(/^feeling\s+/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}

function toFeelingOption(option = "") {
  const keyword = stripFeelingLabel(option);
  if (!keyword) return "";
  const normalized = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  return `Feeling "${normalized}"`;
}

function pickRandomOptions(options = [], count = 3) {
  const unique = dedupeOptions(options, 50);
  const shuffled = [...unique];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.max(0, count));
}

function mergeRandomMix(
  predefinedOptions = [],
  aiOptions = [],
  totalCount = 6,
) {
  const seeded = dedupeOptions(predefinedOptions, 50);
  const generated = dedupeOptions(aiOptions, 50).filter(
    (item) => !seeded.some((seed) => seed.toLowerCase() === item.toLowerCase()),
  );

  const pickedPredefined = pickRandomOptions(seeded, 3);
  const pickedAI = pickRandomOptions(generated, 3);

  // Keep a stable list of fallback seeds (up to 3) for downstream related-keyword use.
  if (pickedPredefined.length < 3) {
    const used = new Set(pickedPredefined.map((item) => item.toLowerCase()));
    for (const option of seeded) {
      const key = option.toLowerCase();
      if (used.has(key)) continue;
      pickedPredefined.push(option);
      used.add(key);
      if (pickedPredefined.length >= 3) break;
    }
  }

  const merged = [...pickedPredefined, ...pickedAI];

  if (merged.length < totalCount) {
    const used = new Set(merged.map((item) => item.toLowerCase()));
    for (const option of seeded) {
      const key = option.toLowerCase();
      if (used.has(key)) continue;
      merged.push(option);
      used.add(key);
      if (merged.length >= totalCount) break;
    }
  }

  return {
    mixed: pickRandomOptions(merged, totalCount),
    fallbackSeedOptions: pickedPredefined.slice(0, 3),
  };
}

function sanitizeNeutralOptions(options = [], totalCount = 6) {
  const bannedTokens = [
    "sunny",
    "rainy",
    "cloudy",
    "stormy",
    "snowy",
    "happy",
    "joyful",
    "excited",
    "euphoric",
  ];

  const neutralBackfill = [
    "Balanced",
    "Steady",
    "Reflective",
    "Composed",
    "Measured",
    "Grounded",
    "Open",
    "Curious",
  ];

  const clean = dedupeOptions(
    options.filter((option) => {
      const text = String(option || "").toLowerCase();
      return !bannedTokens.some((token) => text.includes(token));
    }),
    totalCount,
  );

  if (clean.length >= totalCount) {
    return clean.slice(0, totalCount);
  }

  for (const fallback of neutralBackfill) {
    if (clean.some((item) => item.toLowerCase() === fallback.toLowerCase())) {
      continue;
    }
    clean.push(fallback);
    if (clean.length >= totalCount) break;
  }

  return clean.slice(0, totalCount);
}

async function buildLocationAIOptions(
  city,
  answers = [],
  existingOptions = [],
  count = 3,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const isStage2 = answers.length === 1;
  const stage2Suffix = isStage2
    ? `
For Stage 2 mood options, follow these additional rules:
- Each option MUST sound like a mood or emotional state.
- Keep options to 1-2 words maximum.
- Examples: "Adventurous", "Cozy", "Inspired", "Mellow", "Energized".
`
    : "";

  const prompt = `
You generate short mood option buttons for a travel app.

City: ${city}
Answer chain: ${JSON.stringify(answers)}
Existing options already shown: ${JSON.stringify(existingOptions)}

Rules:
- Return JSON only.
- Output shape: {"options":["Option One","Option Two"]}
- Produce exactly ${count} short options.
- Keep each option 1-3 words.
- Options must feel location-aware for the city.
- Options must not duplicate existing options.
- If the first answer is "Neutral", avoid weather terms (sunny/rainy/etc.) and avoid strongly positive emotion words.
${stage2Suffix}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: prompt,
      temperature: 0.5,
      max_output_tokens: 180,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed ${response.status}`);
  }

  const payload = await response.json();
  const text = extractOpenAIText(payload);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse AI response");
    parsed = JSON.parse(jsonMatch[0]);
  }

  const aiOptions = Array.isArray(parsed?.options)
    ? dedupeOptions(
        parsed.options.map((item) => String(item)),
        count,
      )
    : [];

  const existing = new Set(
    existingOptions.map((item) => String(item).toLowerCase()),
  );
  return aiOptions
    .filter((item) => !existing.has(item.toLowerCase()))
    .slice(0, count);
}

async function buildStage3AIPlaceOptions(
  city,
  stage1Tone,
  stage2Mood,
  existingOptions = [],
  count = 3,
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return [];
  }

  const prompt = `
You generate short place keyword option buttons for a travel app.

City: ${city}
Stage 1 tone: ${stage1Tone}
Stage 2 mood: ${stage2Mood}
Existing options already shown: ${JSON.stringify(existingOptions)}

Rules:
- Return JSON only.
- Output shape: {"options":["Option One","Option Two"]}
- Produce exactly ${count} short options.
- Keep each option 1-3 words.
- Options must be place-related keywords or venue types that can help resolve the mood.
- Options must feel location-aware for the city.
- Options must not duplicate existing options.
- Do not output emotion words.
`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: prompt,
      temperature: 0.5,
      max_output_tokens: 180,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed ${response.status}`);
  }

  const payload = await response.json();
  const text = extractOpenAIText(payload);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not parse AI response");
    parsed = JSON.parse(jsonMatch[0]);
  }

  const aiOptions = Array.isArray(parsed?.options)
    ? dedupeOptions(
        parsed.options.map((item) => String(item)),
        count,
      )
    : [];

  const existing = new Set(
    existingOptions.map((item) => String(item).toLowerCase()),
  );
  return aiOptions
    .filter((item) => !existing.has(item.toLowerCase()))
    .slice(0, count);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const city = String(body?.city || "your city").trim();
    const answers = Array.isArray(body?.answers)
      ? body.answers.map((item) => String(item)).slice(0, 5)
      : [];

    const step = buildFallbackStep(city, answers);

    if (
      (answers.length === 1 || answers.length === 2) &&
      Array.isArray(step.options) &&
      step.options.length > 0
    ) {
      const predefinedOptions = dedupeOptions(step.options, 20);
      let aiOptions = [];

      try {
        aiOptions = await buildLocationAIOptions(
          city,
          answers,
          predefinedOptions,
          3,
        );
      } catch {
        aiOptions = [];
      }

      if (answers.length === 2) {
        const stage1Tone = String(answers[0] || "")
          .toLowerCase()
          .trim();
        const stage2Mood = normalizeStage2Mood(answers[1]);
        const isPredefinedStage2 = PREDEFINED_STAGE2_MOODS.has(stage2Mood);

        // Stage 3 always returns a 3 + 3 mix:
        // 3 fallback place keywords + 3 AI place keywords to resolve mood.
        const fallbackStage3Keywords = isPredefinedStage2
          ? pickRandomOptions(
              labelMapDisplay[stage2Mood] || [
                "Attractions",
                "Parks",
                "Restaurants",
              ],
              3,
            )
          : pickRandomOptions(
              toneMapDisplay[stage1Tone] || [
                "Attractions",
                "Parks",
                "Restaurants",
              ],
              3,
            );

        let stage3AIPlaceKeywords = [];
        try {
          stage3AIPlaceKeywords = await buildStage3AIPlaceOptions(
            city,
            stage1Tone,
            stage2Mood,
            fallbackStage3Keywords,
            3,
          );
        } catch {
          stage3AIPlaceKeywords = [];
        }

        const mixed = mergeRandomMix(
          fallbackStage3Keywords,
          stage3AIPlaceKeywords,
          6,
        );
        step.options = mixed.mixed;
      } else {
        // Stage 2 (answers.length === 1)
        const mixed = mergeRandomMix(predefinedOptions, aiOptions, 6);
        if ((answers[0] || "").toLowerCase() === "neutral") {
          step.options = pickRandomOptions(
            sanitizeNeutralOptions(mixed.mixed, 6),
            6,
          );
        } else {
          step.options = mixed.mixed;
        }

        // Stage 2 options are shown as: Feeling "Keyword"
        step.options = dedupeOptions(
          step.options.map((option) => toFeelingOption(option)),
          6,
        );
      }
    }

    return NextResponse.json(step);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to build mood flow" },
      { status: 500 },
    );
  }
}
