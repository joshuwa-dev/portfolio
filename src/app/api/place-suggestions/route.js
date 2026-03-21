import { NextResponse } from "next/server";
import {
  labelMapSearch,
  toneMapSearch,
  getPrimaryFallbackKeywords as getSharedFallbackKeywords,
} from "../../../../lib/moodConstants";

function getRandomToneKeywords(stage1Tone, count = 8) {
  const toneMapKeys = {
    positive: [
      "attractions",
      "city highlights",
      "food market",
      "live music",
      "nightlife",
      "party",
      "dance club",
      "rooftop bar",
      "entertainment venue",
      "social hotspot",
    ],
    neutral: [
      "bookstore",
      "library",
      "local market",
      "museum",
      "quiet cafe",
      "scenic walk",
      "community space",
      "cultural hub",
    ],
    negative: [
      "botanical garden",
      "nature trail",
      "quiet park",
      "spa",
      "tea house",
      "wellness center",
      "healing space",
      "tranquil retreat",
    ],
  };

  const toneLower = String(stage1Tone || "")
    .toLowerCase()
    .trim();
  const availableKeywords = toneMapKeys[toneLower] || toneMapKeys.positive;

  // Shuffle and return random selection
  const shuffled = [...availableKeywords];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function normalizeKeywords(rawKeywords = [], maxCount = 8) {
  const normalized = [];

  for (const item of rawKeywords) {
    const keyword = String(item || "")
      .trim()
      .toLowerCase();
    if (!keyword) continue;
    if (keyword.length > 40) continue;
    if (normalized.includes(keyword)) continue;
    normalized.push(keyword);
    if (normalized.length >= maxCount) break;
  }

  return normalized;
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

function getPrimaryFallbackKeywords(stage2Selection, stage1Tone) {
  // Use the shared constants (search format) with isSearchContext=true
  return getSharedFallbackKeywords(stage2Selection, stage1Tone, true);
}

function normalizeMoodLabel(value = "") {
  return String(value || "")
    .trim()
    .replace(/^feeling\s+/i, "")
    .replace(/^"|"$/g, "")
    .trim();
}

async function buildAIKeywords({
  city,
  country,
  mood,
  moodTone,
  moodAnswers = [],
  maxCount = 8,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `
You generate search keywords for place discovery.

City: ${city}
Country: ${country || "unknown"}
Mood label: ${mood || "unknown"}
Mood tone: ${moodTone || "unknown"}
Mood answer chain: ${Array.isArray(moodAnswers) && moodAnswers.length > 0 ? moodAnswers.join(" -> ") : "unknown"}

Rules:
- Return JSON only.
- Output shape: {"keywords":["keyword 1","keyword 2"]}
- Produce exactly 8 concise search keywords.
- Keep each keyword 1 to 3 words.
- Mix specific and broad intents.
- No hashtags, no punctuation-heavy strings, no duplicates.
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
      max_output_tokens: 220,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI keyword request failed ${response.status}`);
  }

  const payload = await response.json();
  const text = extractOpenAIText(payload);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI keyword response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  const keywords = normalizeKeywords(parsed?.keywords || [], maxCount);
  if (keywords.length < 4) {
    return null;
  }

  return keywords;
}

async function buildAISynonymKeywords({ placeType, city, country }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const prompt = `
You generate 7 similar or synonymous search keywords for a place type.

Place type: ${placeType || "venues"}
City: ${city || "unknown"}
Country: ${country || "unknown"}

Rules:
- Return JSON only.
- Output shape: {"keywords":["keyword 1","keyword 2",...,"keyword 7"]}
- Generate exactly 7 keywords synonymous or similar to: ${placeType}
- Keep each keyword 1 to 3 words.
- All keywords should be searchable place types.
- No hashtags, no punctuation-heavy strings, no duplicates.
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
      temperature: 0.7,
      max_output_tokens: 180,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI synonym request failed ${response.status}`);
  }

  const payload = await response.json();
  const text = extractOpenAIText(payload);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse AI synonym response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  const keywords = normalizeKeywords(parsed?.keywords || [], 7);
  if (keywords.length < 5) {
    return null;
  }

  return keywords;
}

function toAddress(place) {
  const parts = [
    place?.location?.address,
    place?.location?.locality || place?.locality,
    place?.location?.region || place?.region,
    place?.location?.country || place?.country,
  ].filter(Boolean);

  return parts.join(", ") || "Address not available";
}

function categoryIconUrl(place) {
  const prefix = place?.categories?.[0]?.icon?.prefix;
  const suffix = place?.categories?.[0]?.icon?.suffix;
  if (!prefix || !suffix) return "";
  return `${prefix}120${suffix}`;
}

function seededImageUrl(seed) {
  const normalized = encodeURIComponent(String(seed || "airvery-place"));
  return `https://picsum.photos/seed/${normalized}/900/600`;
}

function buildGoogleMapsUrl({ latitude, longitude, name, address }) {
  const textQuery = [name, address].filter(Boolean).join(", ").trim();
  if (textQuery) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(textQuery)}`;
  }

  if (typeof latitude === "number" && typeof longitude === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
  }

  return "";
}

function normalizeRating(rawRating) {
  const numericRating = Number(rawRating);
  if (!Number.isFinite(numericRating)) return null;

  const clamped = Math.max(0, Math.min(10, numericRating));
  return Math.round(clamped * 10) / 10;
}

function normalizePriceTier(rawPrice) {
  if (rawPrice === null || rawPrice === undefined) return null;

  if (typeof rawPrice === "number" && Number.isFinite(rawPrice)) {
    const tier = Math.max(1, Math.min(4, Math.round(rawPrice)));
    return "$".repeat(tier);
  }

  const nestedTier = Number(rawPrice?.tier);
  if (Number.isFinite(nestedTier)) {
    const tier = Math.max(1, Math.min(4, Math.round(nestedTier)));
    return "$".repeat(tier);
  }

  return null;
}

function normalizeOpenNow(place) {
  if (typeof place?.hours?.open_now === "boolean") {
    return place.hours.open_now;
  }

  if (typeof place?.hours?.is_open === "boolean") {
    return place.hours.is_open;
  }

  if (typeof place?.closed_bucket === "string") {
    const bucket = place.closed_bucket.toLowerCase();
    if (bucket.includes("open")) return true;
    if (bucket.includes("closed")) return false;
  }

  return null;
}

function normalizeFSQPlace(place, keyword) {
  const lat = place?.latitude;
  const lng = place?.longitude;
  const placeId = String(
    place?.fsq_place_id ||
      place?.fsq_id ||
      `${place?.name || "place"}-${keyword}`,
  );
  const name = String(place?.name || "Recommended spot");
  const address = toAddress(place);
  const iconUrl = categoryIconUrl(place);
  const rating = normalizeRating(place?.rating ?? place?.stats?.rating);
  const priceTier = normalizePriceTier(place?.price);
  const openNow = normalizeOpenNow(place);
  const mapUrl = buildGoogleMapsUrl({
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lng === "number" ? lng : null,
    name,
    address,
  });

  return {
    id: placeId,
    name,
    category: String(place?.categories?.[0]?.name || "Place"),
    address,
    matchedKeyword: keyword,
    reason: `Matches your ${keyword} vibe`,
    rating,
    priceTier,
    openNow,
    mapUrl,
    imageUrl: iconUrl || seededImageUrl(`${placeId}-${keyword}`),
    latitude: typeof lat === "number" ? lat : null,
    longitude: typeof lng === "number" ? lng : null,
    source: "foursquare",
  };
}

function buildFallbackPlaces(city, country, keywords) {
  const locationLabel = [city, country].filter(Boolean).join(", ");

  return keywords.map((keyword, index) => ({
    id: `fallback-${keyword}-${index}`,
    name: `${keyword} in ${city || "your area"}`,
    category: "Curated suggestion",
    address: locationLabel || "Search near your city",
    reason: `Good fit for your ${keyword} mood signal`,
    rating: null,
    priceTier: null,
    openNow: null,
    mapUrl: buildGoogleMapsUrl({
      name: `${keyword} in ${city || "your area"}`,
      address: locationLabel,
    }),
    imageUrl: seededImageUrl(`fallback-${city}-${keyword}-${index}`),
    source: "fallback",
  }));
}

async function fetchFoursquarePlaces({
  city,
  country,
  keywords,
  limitPerKeyword = 4,
  maxResults = 24,
}) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const placesApiVersion =
    process.env.FOURSQUARE_PLACES_API_VERSION || "2025-06-17";
  const near = [city, country].filter(Boolean).join(", ");
  const perKeywordResults = new Map();

  for (const keyword of keywords) {
    const params = new URLSearchParams({
      query: keyword,
      near,
      limit: String(limitPerKeyword),
      sort: "RELEVANCE",
    });

    const response = await fetch(
      `https://places-api.foursquare.com/places/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "X-Places-Api-Version": placesApiVersion,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      continue;
    }

    const payload = await response.json();
    const results = Array.isArray(payload?.results) ? payload.results : [];
    const normalized = results.map((place) =>
      normalizeFSQPlace(place, keyword),
    );
    perKeywordResults.set(keyword, normalized);
  }

  if (perKeywordResults.size === 0) {
    return [];
  }

  const deduped = [];
  const seen = new Set();

  const activeKeywords = keywords.filter((keyword) => {
    const bucket = perKeywordResults.get(keyword);
    return Array.isArray(bucket) && bucket.length > 0;
  });

  let cursor = 0;
  while (deduped.length < maxResults && activeKeywords.length > 0) {
    const keyword = activeKeywords[cursor % activeKeywords.length];
    const bucket = perKeywordResults.get(keyword) || [];
    const nextItem = bucket.shift();

    if (!nextItem) {
      const index = activeKeywords.indexOf(keyword);
      if (index >= 0) {
        activeKeywords.splice(index, 1);
      }
      continue;
    }

    if (!seen.has(nextItem.id)) {
      seen.add(nextItem.id);
      deduped.push(nextItem);
    }

    cursor += 1;
  }

  return deduped;
}

async function fetchFoursquarePlaceDetails(placeId, apiKey, placesApiVersion) {
  if (!placeId || !apiKey) return null;

  const response = await fetch(
    `https://places-api.foursquare.com/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Places-Api-Version": placesApiVersion,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload;
}

function extractDetailFields(detailPayload) {
  const detail = detailPayload?.result || detailPayload;
  if (!detail || typeof detail !== "object") return null;

  return {
    rating: normalizeRating(detail?.rating ?? detail?.stats?.rating),
    priceTier: normalizePriceTier(detail?.price),
    openNow: normalizeOpenNow(detail),
  };
}

async function enrichPlacesWithFoursquareDetails(
  places = [],
  { maxToEnrich = 24, concurrency = 6 } = {},
) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey || !Array.isArray(places) || places.length === 0) {
    return places;
  }

  const placesApiVersion =
    process.env.FOURSQUARE_PLACES_API_VERSION || "2025-06-17";

  const enrichCandidates = places
    .filter(
      (place) =>
        place?.source === "foursquare" &&
        typeof place?.id === "string" &&
        !place.id.startsWith("fallback-") &&
        (place?.rating === null ||
          place?.priceTier === null ||
          place?.openNow === null),
    )
    .slice(0, Math.max(0, maxToEnrich));

  if (enrichCandidates.length === 0) {
    return places;
  }

  const detailsById = new Map();

  for (let i = 0; i < enrichCandidates.length; i += Math.max(1, concurrency)) {
    const batch = enrichCandidates.slice(i, i + Math.max(1, concurrency));

    const results = await Promise.all(
      batch.map(async (place) => {
        try {
          const payload = await fetchFoursquarePlaceDetails(
            place.id,
            apiKey,
            placesApiVersion,
          );
          const detailFields = extractDetailFields(payload);
          return [place.id, detailFields];
        } catch {
          return [place.id, null];
        }
      }),
    );

    for (const [id, detailFields] of results) {
      if (detailFields) {
        detailsById.set(id, detailFields);
      }
    }
  }

  if (detailsById.size === 0) {
    return places;
  }

  return places.map((place) => {
    const detailFields = detailsById.get(place?.id);
    if (!detailFields) return place;

    return {
      ...place,
      rating: place?.rating ?? detailFields.rating,
      priceTier: place?.priceTier ?? detailFields.priceTier,
      openNow: place?.openNow ?? detailFields.openNow,
    };
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const city = String(body?.city || "").trim();
    const country = String(body?.country || "").trim();
    const mood = String(body?.mood || "").trim();
    const moodTone = String(body?.moodTone || "").trim();
    const moodAnswers = Array.isArray(body?.moodAnswers)
      ? body.moodAnswers
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 8)
      : [];

    const stage3Selection =
      moodAnswers.length > 0 ? moodAnswers[moodAnswers.length - 1] : mood;

    const previousSelections =
      moodAnswers.length > 1
        ? moodAnswers.slice(0, moodAnswers.length - 1)
        : [];

    const relatedMoodLabel =
      previousSelections.length > 0
        ? previousSelections[previousSelections.length - 1]
        : stage3Selection;

    if (!city) {
      return NextResponse.json({ error: "City is required" }, { status: 400 });
    }

    const stage1Tone =
      moodAnswers.length > 0
        ? String(moodAnswers[0] || "")
            .toLowerCase()
            .trim()
        : "positive";

    // Primary keywords: Stage 3 selection + 7 AI-generated synonyms
    const stage3Normalized = String(stage3Selection || "")
      .toLowerCase()
      .trim();
    let primaryKeywords = [stage3Normalized];
    let primaryKeywordSource = "stage3-only";

    try {
      const synonymKeywords = await buildAISynonymKeywords({
        placeType: stage3Selection,
        city,
        country,
      });

      if (Array.isArray(synonymKeywords) && synonymKeywords.length > 0) {
        primaryKeywords = [stage3Normalized, ...synonymKeywords];
        primaryKeywordSource = "stage3+synonyms";
      }
    } catch {
      // If AI fails, just use stage 3 selection alone
    }

    primaryKeywords = normalizeKeywords(primaryKeywords, 8);

    // Related keywords: 8 random keywords from stage 1 tone
    let relatedKeywords = getRandomToneKeywords(stage1Tone, 8);

    // Remove any keywords from related that appear in primary
    const primaryKeywordSet = new Set(
      primaryKeywords.map((k) => String(k).toLowerCase().trim()),
    );
    relatedKeywords = relatedKeywords.filter(
      (keyword) => !primaryKeywordSet.has(String(keyword).toLowerCase().trim()),
    );

    // If deduplication removed all related keywords, get more random ones
    if (relatedKeywords.length === 0) {
      relatedKeywords = getRandomToneKeywords(stage1Tone, 8);
      relatedKeywords = relatedKeywords.filter(
        (keyword) =>
          !primaryKeywordSet.has(String(keyword).toLowerCase().trim()),
      );
    }

    const primaryMaxResults = 8;
    const relatedMaxResults = 12;

    let primaryPlaces = await fetchFoursquarePlaces({
      city,
      country,
      keywords: primaryKeywords,
      limitPerKeyword: 3,
      maxResults: primaryMaxResults,
    });
    let primarySource = "foursquare";

    // If primary fails, use fallback places
    if (!primaryPlaces || primaryPlaces.length === 0) {
      primaryPlaces = buildFallbackPlaces(city, country, primaryKeywords).slice(
        0,
        primaryMaxResults,
      );
      primarySource = "fallback";
    }

    primaryPlaces = await enrichPlacesWithFoursquareDetails(primaryPlaces, {
      maxToEnrich: primaryMaxResults,
      concurrency: 6,
    });

    // More suggestions are always curated from keyword sets.
    if (primarySource === "fallback") {
      // When Top matches has no Foursquare data, mirror its keyword set.
      relatedKeywords =
        primaryKeywords.length > 0 ? primaryKeywords : relatedKeywords;
    }

    const relatedPlaces = buildFallbackPlaces(
      city,
      country,
      relatedKeywords,
    ).slice(0, relatedMaxResults);
    const relatedSource = "fallback";

    return NextResponse.json({
      city,
      country,
      mood: stage3Selection,
      moodTone,
      moodAnswers,
      previousSelections,
      primary: {
        title: "Top matches",
        keywords: primaryKeywords,
        keywordSource: primaryKeywordSource,
        source: primarySource,
        places: primaryPlaces,
      },
      related: {
        title: `More places to visit in ${city}, ${country || "your area"}`,
        keywords: relatedKeywords,
        keywordSource: "fallback-map",
        source: relatedSource,
        places: relatedPlaces,
      },
      keywords: primaryKeywords,
      keywordSource: primaryKeywordSource,
      source: primarySource,
      places: primaryPlaces,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to build place suggestions" },
      { status: 500 },
    );
  }
}
