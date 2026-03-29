"use client";
import { useContext, useEffect, useState } from "react";
import Image from "next/image";
import { collection, getDocs, query, where } from "firebase/firestore";
import { CityselectContext } from "../context/CityselectProvider";
import { auth, db } from "../src/lib/Firebase";
import { logUserEvent } from "../src/lib/userIdentity";
import AVMoodFlowModal from "./AVMoodFlowModal";

function getPlaceSaveKey(place, city, country) {
  const rawParts = [
    String(place?.id || ""),
    String(place?.name || ""),
    String(city || ""),
    String(country || ""),
  ].map((part) => part.trim());

  if (!rawParts.some(Boolean)) return "";

  return rawParts.join("::").toLowerCase();
}

function SaveIcon({ saved }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={saved ? "currentColor" : "none"}
      xmlns="http://www.w3.org/2000/svg"
      className={`h-4 w-4 transition-transform duration-200 ${saved ? "scale-110" : "scale-100"}`}
      aria-hidden="true"
    >
      <path
        d="M12 20.2l-1.45-1.32C5.4 14.2 2 11.12 2 7.35 2 4.27 4.42 2 7.5 2c1.74 0 3.41.81 4.5 2.09A6.02 6.02 0 0 1 16.5 2C19.58 2 22 4.27 22 7.35c0 3.77-3.4 6.85-8.55 11.54L12 20.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function eventTimeToMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = Number(new Date(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

const RELATED_INITIAL_VISIBLE = 8;
const RELATED_MAX_VISIBLE = 12;

export default function AVExplore() {
  const {
    selectedCity,
    selectedCountry,
    setSelectedCity,
    selectedMood,
    selectedMoodTone,
    selectedMoodAnswers,
    setSelectedCountry,
    moodComplete,
    setMoodComplete,
    setSelectedMood,
    setSelectedMoodTone,
    setSelectedMoodAnswers,
    requestMoodEdit,
    setRequestMoodEdit,
    requestLoginPrompt,
  } = useContext(CityselectContext);
  const [currentTemp, setCurrentTemp] = useState("");
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [places, setPlaces] = useState([]);
  const [relatedPlaces, setRelatedPlaces] = useState([]);
  const [primaryKeywords, setPrimaryKeywords] = useState([]);
  const [relatedKeywords, setRelatedKeywords] = useState([]);
  const [relatedVisibleCount, setRelatedVisibleCount] = useState(
    RELATED_INITIAL_VISIBLE,
  );
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState("");
  const [primarySource, setPrimarySource] = useState("");
  const [savedPlaceKeys, setSavedPlaceKeys] = useState(new Set());
  const [savingPlaceKeys, setSavingPlaceKeys] = useState(new Set());

  function trackUserEvent(eventName, metadata = {}) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    void logUserEvent({
      uid,
      eventName,
      metadata,
      city: selectedCity || null,
      country: selectedCountry || null,
      mood: selectedMood || null,
      moodTone: selectedMoodTone || null,
    });
  }

  function selectTopCity(city, country) {
    if (!auth.currentUser) {
      requestLoginPrompt?.();
      return;
    }

    trackUserEvent("top_city_selected", { city, country });
    setSelectedCity(city);
    setSelectedCountry(country);

    const hasMoodProfile =
      (Array.isArray(selectedMoodAnswers) && selectedMoodAnswers.length > 0) ||
      Boolean(selectedMood) ||
      Boolean(selectedMoodTone);

    if (hasMoodProfile) {
      setMoodComplete(true);
    } else {
      setMoodComplete(false);
      setSelectedMood("");
      setSelectedMoodTone("");
      setSelectedMoodAnswers([]);
    }

    setShowMoodModal(false);
  }

  async function toggleSavePlace(place, section = "primary") {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      requestLoginPrompt?.();
      return;
    }

    const saveKey = getPlaceSaveKey(place, selectedCity, selectedCountry);
    if (!saveKey || savingPlaceKeys.has(saveKey)) {
      return;
    }

    const currentlySaved = savedPlaceKeys.has(saveKey);
    const nextEventName = currentlySaved ? "place_unsaved" : "place_saved";

    setSavingPlaceKeys((current) => new Set(current).add(saveKey));

    try {
      await logUserEvent({
        uid,
        eventName: nextEventName,
        metadata: {
          section,
          placeId: place?.id || null,
          placeName: place?.name || null,
          category: place?.category || null,
          address: place?.address || null,
          rating: place?.rating || null,
          mapUrl: place?.mapUrl || null,
          imageUrl: place?.imageUrl || null,
          city: selectedCity || null,
          country: selectedCountry || null,
        },
        city: selectedCity || null,
        country: selectedCountry || null,
        mood: selectedMood || null,
        moodTone: selectedMoodTone || null,
      });

      setSavedPlaceKeys((current) => {
        const next = new Set(current);
        if (currentlySaved) {
          next.delete(saveKey);
        } else {
          next.add(saveKey);
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to toggle save place", error);
    } finally {
      setSavingPlaceKeys((current) => {
        const next = new Set(current);
        next.delete(saveKey);
        return next;
      });
    }
  }

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setSavedPlaceKeys(new Set());
      setSavingPlaceKeys(new Set());
      return;
    }

    let cancelled = false;

    async function loadSavedPlaces() {
      try {
        const eventsRef = collection(db, "users", uid, "events");
        const [savedSnapshot, unsavedSnapshot] = await Promise.all([
          getDocs(query(eventsRef, where("eventName", "==", "place_saved"))),
          getDocs(query(eventsRef, where("eventName", "==", "place_unsaved"))),
        ]);

        if (cancelled) return;

        const latestByKey = new Map();

        const allDocs = [
          ...savedSnapshot.docs.map((docSnapshot) => ({
            docSnapshot,
            eventName: "place_saved",
          })),
          ...unsavedSnapshot.docs.map((docSnapshot) => ({
            docSnapshot,
            eventName: "place_unsaved",
          })),
        ];

        allDocs.forEach(({ docSnapshot, eventName }) => {
          const data = docSnapshot.data() || {};
          const metadata = data.metadata || {};
          const eventCity = String(metadata.city || data.city || "").trim();
          const eventCountry = String(
            metadata.country || data.country || "",
          ).trim();
          const key = getPlaceSaveKey(
            {
              id: metadata.placeId,
              name: metadata.placeName,
            },
            eventCity,
            eventCountry,
          );
          if (!key) return;

          const existing = latestByKey.get(key);
          const currentTime = eventTimeToMillis(data.createdAt);

          if (!existing || currentTime >= existing.time) {
            latestByKey.set(key, {
              eventName,
              time: currentTime,
            });
          }
        });

        const nextKeys = new Set();
        latestByKey.forEach((value, key) => {
          if (value.eventName === "place_saved") {
            nextKeys.add(key);
          }
        });

        setSavedPlaceKeys(nextKeys);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load saved places", error);
        }
      }
    }

    void loadSavedPlaces();

    return () => {
      cancelled = true;
    };
  }, [requestLoginPrompt]);

  useEffect(() => {
    if (!selectedCity) return;
    if (!moodComplete) {
      setShowMoodModal(true);
    }
    setRequestMoodEdit(false);
  }, [selectedCity, moodComplete, setRequestMoodEdit]);

  useEffect(() => {
    if (!selectedCity || !requestMoodEdit) return;
    setShowMoodModal(true);
    setRequestMoodEdit(false);
  }, [requestMoodEdit, selectedCity]);

  function formatMoodLabel(answers = []) {
    if (!Array.isArray(answers) || answers.length < 2) return "";
    // Index 1 is stage 2 (the actual mood), not the final selection
    const moodSelection = answers[1] || "";
    return moodSelection;
  }

  function formatRating(rating) {
    if (rating === null || rating === undefined || rating === "") {
      return null;
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating)) return null;
    return `Rating: ${numericRating.toFixed(1)}/10`;
  }

  function formatOpenStatus(openNow) {
    if (openNow === true) return "Open now";
    if (openNow === false) return "Closed now";
    return null;
  }

  function openMap(url, place, section = "primary") {
    if (!url) return;

    trackUserEvent("place_opened_in_maps", {
      section,
      placeId: place?.id || null,
      placeName: place?.name || null,
      category: place?.category || null,
    });

    window.open(url, "_blank", "noopener,noreferrer");
  }

  useEffect(() => {
    if (!selectedCity) return;

    async function getWeather() {
      try {
        const response = await fetch(
          `/api/cityweather?city=${encodeURIComponent(selectedCity)}`,
        );
        if (!response.ok) {
          throw new Error(`Failed to fetch weather ${response.status}`);
        }
        const data = await response.json();
        console.log(
          `🌤️ The current temperature in ${selectedCity} is ${data.current.temp_c}°C`,
        );
        setCurrentTemp(data.current.temp_c);
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }
    }

    getWeather();
  }, [selectedCity]); // re-run when selected city changes

  useEffect(() => {
    if (!selectedCity) {
      setPlaces([]);
      setRelatedPlaces([]);
      setPrimaryKeywords([]);
      setRelatedKeywords([]);
      setPlacesError("");
      setPrimarySource("");
      return;
    }

    if (!moodComplete) {
      setPlaces([]);
      setRelatedPlaces([]);
      setPrimaryKeywords([]);
      setRelatedKeywords([]);
      setPlacesError("");
      setPrimarySource("");
      return;
    }

    async function getPlaces() {
      setPlacesLoading(true);
      setPlacesError("");
      trackUserEvent("place_suggestions_requested", {
        selectedMoodAnswersCount: Array.isArray(selectedMoodAnswers)
          ? selectedMoodAnswers.length
          : 0,
      });

      try {
        const response = await fetch("/api/place-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            city: selectedCity,
            country: selectedCountry,
            mood: selectedMood,
            moodTone: selectedMoodTone,
            moodAnswers: selectedMoodAnswers,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch places ${response.status}`);
        }

        const data = await response.json();
        const primaryPlaces = Array.isArray(data?.primary?.places)
          ? data.primary.places
          : Array.isArray(data?.places)
            ? data.places
            : [];

        const relatedSectionPlaces = Array.isArray(data?.related?.places)
          ? data.related.places
          : [];

        const primarySectionKeywords = Array.isArray(data?.primary?.keywords)
          ? data.primary.keywords
          : Array.isArray(data?.keywords)
            ? data.keywords
            : [];

        const relatedSectionKeywords = Array.isArray(data?.related?.keywords)
          ? data.related.keywords
          : [];

        const nextPrimarySource = String(
          data?.primary?.source || data?.source || "",
        ).toLowerCase();

        setPlaces(primaryPlaces);
        setRelatedPlaces(relatedSectionPlaces);
        setPrimaryKeywords(primarySectionKeywords);
        setRelatedKeywords(relatedSectionKeywords);
        setPrimarySource(nextPrimarySource);
        setRelatedVisibleCount(RELATED_INITIAL_VISIBLE);
        trackUserEvent("place_suggestions_loaded", {
          primaryCount: primaryPlaces.length,
          relatedCount: relatedSectionPlaces.length,
          primaryKeywordCount: primarySectionKeywords.length,
          relatedKeywordCount: relatedSectionKeywords.length,
        });
      } catch (error) {
        setPlaces([]);
        setRelatedPlaces([]);
        setPrimaryKeywords([]);
        setRelatedKeywords([]);
        setPrimarySource("");
        setRelatedVisibleCount(RELATED_INITIAL_VISIBLE);
        setPlacesError(error?.message || "Unable to load recommendations");
        trackUserEvent("place_suggestions_failed", {
          errorMessage: error?.message || "Unknown error",
        });
      } finally {
        setPlacesLoading(false);
      }
    }

    getPlaces();
  }, [
    selectedCity,
    selectedCountry,
    selectedMood,
    selectedMoodTone,
    selectedMoodAnswers,
    moodComplete,
  ]);

  const visibleRelatedPlaces = relatedPlaces.slice(0, relatedVisibleCount);
  const canLoadMoreRelated = relatedPlaces.length > relatedVisibleCount;

  function loadMoreRelatedPlaces() {
    trackUserEvent("related_places_load_more", {
      from: relatedVisibleCount,
      total: relatedPlaces.length,
    });
    setRelatedVisibleCount((current) =>
      Math.min(
        current + (RELATED_MAX_VISIBLE - RELATED_INITIAL_VISIBLE),
        RELATED_MAX_VISIBLE,
        relatedPlaces.length,
      ),
    );
  }

  const topCities = [
    {
      src: "/portugal.jpg",
      city: "Lisbon",
      country: "Portugal",
      highlight: "Atlantic coast energy",
    },
    {
      src: "/france.jpg",
      city: "Paris",
      country: "France",
      highlight: "Art, cafes, and old streets",
    },
    {
      src: "/ghana.jpg",
      city: "Accra",
      country: "Ghana",
      highlight: "Warm culture and bold flavors",
    },
    {
      src: "/germany.jpg",
      city: "Berlin",
      country: "Germany",
      highlight: "Design-forward city escapes",
    },
  ];

  return (
    <div className="text-gray-900">
      {selectedCity ? (
        <>
          <section className="relative overflow-hidden rounded-3xl p-5 sm:p-7">
            <div className="av-discover-gradient absolute inset-0" />
            <div className="av-discover-gradient-overlay absolute inset-0" />
            <div className="av-discover-blob av-discover-blob-a" />
            <div className="av-discover-blob av-discover-blob-b" />
            <div className="av-discover-blob av-discover-blob-c" />
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute left-0 top-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-cyan-300/20 blur-2xl" />

            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/90">
                Discover Mode
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Explore in {selectedCity}
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white">
                  {selectedCountry || "Country not set"}
                </span>
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium text-white">
                  {Number.isFinite(Number(currentTemp))
                    ? `${Math.round(currentTemp)}°C`
                    : "Weather loading"}
                </span>
              </div>
            </div>
          </section>

          {placesLoading ? (
            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-medium text-sky-900">
              Finding places that match your mood...
            </div>
          ) : null}

          {placesError ? (
            <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {placesError}
            </p>
          ) : null}

          {places.length > 0 && primarySource !== "fallback" ? (
            <section className="mt-8">
              <div className="flex items-end justify-between gap-3">
                <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                  Top matches
                </h3>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  {places.length} picks
                </p>
              </div>

              {primaryKeywords.length > 0 ? (
                <div className="mt-3 hidden md:block">
                  <div className="flex flex-wrap gap-2">
                    {primaryKeywords.map((keyword) => (
                      <span
                        key={`primary-keyword-${keyword}`}
                        className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-800"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-12 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {places.map((place) => (
                  <article
                    key={place.id}
                    className="col-span-12 md:col-span-1 group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                      <button
                        type="button"
                        className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition ${
                          savedPlaceKeys.has(
                            getPlaceSaveKey(
                              place,
                              selectedCity,
                              selectedCountry,
                            ),
                          )
                            ? "border-rose-200 bg-rose-50 text-rose-600 ring-2 ring-rose-200/60"
                            : "border-white/80 bg-white/90 text-slate-700 hover:bg-white"
                        }`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void toggleSavePlace(place, "primary");
                        }}
                        aria-label="Toggle saved place"
                      >
                        <SaveIcon
                          saved={savedPlaceKeys.has(
                            getPlaceSaveKey(
                              place,
                              selectedCity,
                              selectedCountry,
                            ),
                          )}
                        />
                      </button>
                      <img
                        src={place.imageUrl || "/germany.jpg"}
                        alt={place.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.src = "/germany.jpg";
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-lg font-semibold leading-tight text-slate-900">
                        {place.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        {place.category}
                      </p>
                      <p className="mt-2 truncate text-sm font-light text-slate-700">
                        {place.address}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {formatRating(place.rating) ? (
                          <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900">
                            {formatRating(place.rating)}
                          </span>
                        ) : null}
                        {place.priceTier ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            {place.priceTier}
                          </span>
                        ) : null}
                        {formatOpenStatus(place.openNow) ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatOpenStatus(place.openNow)}
                          </span>
                        ) : null}
                      </div>

                      {place.mapUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            openMap(place.mapUrl, place, "primary")
                          }
                          className="mt-3 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open map
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {relatedPlaces.length > 0 ? (
            <section className="mt-10">
              {primarySource === "fallback" ? (
                <p className="mb-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Showing fallback recommendations based on your top-match
                  keywords
                </p>
              ) : null}

              <h3 className="text-xl font-semibold tracking-tight text-slate-900">
                More suggestions in {selectedCity}, {selectedCountry}
              </h3>

              {relatedKeywords.length > 0 ? (
                <div className="mt-3 hidden md:block">
                  <div className="flex flex-wrap gap-2">
                    {relatedKeywords.map((keyword) => (
                      <span
                        key={`related-keyword-${keyword}`}
                        className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-12 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleRelatedPlaces.map((place) => (
                  <article
                    key={`related-${place.id}`}
                    className="col-span-12 md:col-span-1 group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                      <button
                        type="button"
                        className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition ${
                          savedPlaceKeys.has(
                            getPlaceSaveKey(
                              place,
                              selectedCity,
                              selectedCountry,
                            ),
                          )
                            ? "border-rose-200 bg-rose-50 text-rose-600 ring-2 ring-rose-200/60"
                            : "border-white/80 bg-white/90 text-slate-700 hover:bg-white"
                        }`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void toggleSavePlace(place, "related");
                        }}
                        aria-label="Toggle saved place"
                      >
                        <SaveIcon
                          saved={savedPlaceKeys.has(
                            getPlaceSaveKey(
                              place,
                              selectedCity,
                              selectedCountry,
                            ),
                          )}
                        />
                      </button>
                      <img
                        src={place.imageUrl || "/germany.jpg"}
                        alt={place.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.src = "/germany.jpg";
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <p className="text-lg font-semibold leading-tight text-slate-900">
                        {place.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        {place.category}
                      </p>
                      <p className="mt-2 truncate text-sm font-light text-slate-700">
                        {place.address}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {formatRating(place.rating) ? (
                          <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900">
                            {formatRating(place.rating)}
                          </span>
                        ) : null}
                        {place.priceTier ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            {place.priceTier}
                          </span>
                        ) : null}
                        {formatOpenStatus(place.openNow) ? (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatOpenStatus(place.openNow)}
                          </span>
                        ) : null}
                      </div>

                      {place.mapUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            openMap(place.mapUrl, place, "related")
                          }
                          className="mt-3 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open map
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>

              {canLoadMoreRelated ? (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={loadMoreRelatedPlaces}
                    className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Load more places
                  </button>
                </div>
              ) : null}
            </section>
          ) : null}

          {!placesLoading &&
          !placesError &&
          places.length === 0 &&
          relatedPlaces.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-700">
              {moodComplete ? (
                <>
                  No places to show yet. Try changing city or{" "}
                  <button
                    type="button"
                    onClick={() => setShowMoodModal(true)}
                    className="font-semibold text-cyan-700 underline underline-offset-2 hover:text-cyan-800"
                  >
                    mood
                  </button>
                  .
                </>
              ) : (
                <>
                  No places to show yet. Select a{" "}
                  <button
                    type="button"
                    onClick={() => setShowMoodModal(true)}
                    className="font-semibold text-cyan-700 underline underline-offset-2 hover:text-cyan-800"
                  >
                    mood
                  </button>
                  .
                </>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <section className="p-1 sm:p-2">
            <div>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">
                Top Countries
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-light text-slate-600 sm:text-base">
                Pick a city to unlock recommendations tailored to how you feel
                right now.
              </p>
            </div>
          </section>

          <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {topCities.map((entry, index) => (
              <button
                type="button"
                key={`${entry.city}-${entry.country}-${index}`}
                onClick={() => selectTopCity(entry.city, entry.country)}
                className="text-left"
              >
                <div className="group relative cursor-pointer overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                  <Image
                    className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    src={entry.src}
                    alt={`${entry.city}, ${entry.country}`}
                    width={380}
                    height={480}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-xl font-semibold tracking-tight">
                      {entry.city}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-cyan-100">
                      {entry.country}
                    </p>
                    <p className="mt-1 text-xs font-medium text-cyan-100/90">
                      {entry.highlight}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <AVMoodFlowModal
        city={selectedCity}
        open={showMoodModal}
        onClose={() => setShowMoodModal(false)}
        onComplete={(result) => {
          trackUserEvent("mood_flow_completed", {
            answersCount: Array.isArray(result?.answers)
              ? result.answers.length
              : 0,
            tone: (result?.answers?.[0] || "").toLowerCase() || null,
          });
          setSelectedMood(formatMoodLabel(result.answers));
          setSelectedMoodTone((result.answers?.[0] || "").toLowerCase());
          setSelectedMoodAnswers(
            Array.isArray(result.answers) ? result.answers : [],
          );

          setMoodComplete(true);
          setShowMoodModal(false);
        }}
      />
    </div>
  );
}
