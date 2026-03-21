"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import countries from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { CircleFlag } from "react-circle-flags";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../../../lib/Firebase";
import { logUserEvent } from "../../../../lib/userIdentity";
import AVLayout from "../../../../components/AVLayout";

const PAGE_SIZE = 12;

countries.registerLocale(enLocale);

function getCountryCode(countryName) {
  const raw = String(countryName || "").trim();
  if (!raw || raw.toLowerCase() === "unknown") return null;

  const aliases = {
    USA: "United States",
    UK: "United Kingdom",
    UAE: "United Arab Emirates",
  };

  const normalized = aliases[raw] || raw;
  const alpha2 = countries.getAlpha2Code(normalized, "en");
  return alpha2 ? alpha2.toLowerCase() : null;
}

function CountryFlag({ country, size = 18 }) {
  const code = getCountryCode(country);

  if (!code) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-600">
        •
      </span>
    );
  }

  return <CircleFlag countryCode={code} height={size} />;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000;
  }
  if (value instanceof Date) return value.getTime();
  const parsed = Number(new Date(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSaveKey(place) {
  const rawParts = [
    String(place.placeId || ""),
    String(place.name || ""),
    String(place.city || ""),
    String(place.country || ""),
  ].map((part) => part.trim());

  if (!rawParts.some(Boolean)) return "";

  return rawParts.join("::").toLowerCase();
}

export default function SavedPlacesPage() {
  const router = useRouter();
  const [authChecking, setAuthChecking] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [placeVisibleCount, setPlaceVisibleCount] = useState(PAGE_SIZE);
  const [busyKeys, setBusyKeys] = useState(new Set());
  const [deletingCountries, setDeletingCountries] = useState(new Set());
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/av");
      }
      setAuthChecking(false);
    });

    return unsubscribe;
  }, [router]);

  useEffect(() => {
    if (authChecking) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let cancelled = false;

    async function loadSavedPlaces() {
      setLoading(true);
      setError("");

      try {
        const eventsRef = collection(db, "users", uid, "events");
        const [savedSnapshot, unsavedSnapshot] = await Promise.all([
          getDocs(query(eventsRef, where("eventName", "==", "place_saved"))),
          getDocs(query(eventsRef, where("eventName", "==", "place_unsaved"))),
        ]);

        if (cancelled) return;

        const allEvents = [
          ...savedSnapshot.docs.map((docSnapshot) => ({
            docSnapshot,
            eventName: "place_saved",
          })),
          ...unsavedSnapshot.docs.map((docSnapshot) => ({
            docSnapshot,
            eventName: "place_unsaved",
          })),
        ].sort((a, b) => {
          const aData = a.docSnapshot.data() || {};
          const bData = b.docSnapshot.data() || {};
          return toMillis(aData.createdAt) - toMillis(bData.createdAt);
        });

        const activeByKey = new Map();

        allEvents.forEach(({ docSnapshot, eventName }) => {
          const data = docSnapshot.data() || {};
          const metadata = data.metadata || {};

          const place = {
            placeId: String(metadata.placeId || "").trim(),
            name: String(metadata.placeName || "").trim(),
            category: String(metadata.category || "").trim(),
            address: String(metadata.address || "").trim(),
            mapUrl: String(metadata.mapUrl || "").trim(),
            imageUrl: String(metadata.imageUrl || "").trim(),
            city: String(metadata.city || data.city || "").trim(),
            country: String(metadata.country || data.country || "").trim(),
            rating: metadata.rating,
            savedAtMs: toMillis(data.createdAt),
          };

          const saveKey = getSaveKey(place);
          if (!saveKey) return;

          if (eventName === "place_saved") {
            activeByKey.set(saveKey, place);
          } else {
            activeByKey.delete(saveKey);
          }
        });

        const deduped = Array.from(activeByKey.values()).sort(
          (a, b) => b.savedAtMs - a.savedAtMs || a.name.localeCompare(b.name),
        );

        setSavedPlaces(deduped);
      } catch (loadError) {
        if (!cancelled) {
          const message = String(
            loadError?.message || "Unable to load saved places.",
          );
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSavedPlaces();

    return () => {
      cancelled = true;
    };
  }, [authChecking]);

  async function unsavePlace(place) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      router.replace("/av");
      return;
    }

    const saveKey = getSaveKey(place);
    if (!saveKey || busyKeys.has(saveKey)) return;

    setBusyKeys((current) => new Set(current).add(saveKey));

    try {
      await logUserEvent({
        uid,
        eventName: "place_unsaved",
        metadata: {
          placeId: place.placeId || null,
          placeName: place.name || null,
          category: place.category || null,
          address: place.address || null,
          mapUrl: place.mapUrl || null,
          imageUrl: place.imageUrl || null,
          city: place.city || null,
          country: place.country || null,
          rating: place.rating ?? null,
        },
        city: place.city || null,
        country: place.country || null,
        mood: null,
        moodTone: null,
      });

      setSavedPlaces((current) =>
        current.filter((entry) => getSaveKey(entry) !== saveKey),
      );
    } catch (saveError) {
      console.error("Failed to unsave place", saveError);
    } finally {
      setBusyKeys((current) => {
        const next = new Set(current);
        next.delete(saveKey);
        return next;
      });
    }
  }

  async function deleteCountryPlaces(countryName) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      router.replace("/av");
      return;
    }

    const normalizedCountry = String(countryName || "").trim() || "Unknown";
    if (deletingCountries.has(normalizedCountry)) return;

    const placesToRemove = savedPlaces.filter(
      (place) => (place.country || "Unknown") === normalizedCountry,
    );
    if (placesToRemove.length === 0) return;

    setDeletingCountries((current) => new Set(current).add(normalizedCountry));

    try {
      await Promise.all(
        placesToRemove.map((place) =>
          logUserEvent({
            uid,
            eventName: "place_unsaved",
            metadata: {
              placeId: place.placeId || null,
              placeName: place.name || null,
              category: place.category || null,
              address: place.address || null,
              mapUrl: place.mapUrl || null,
              imageUrl: place.imageUrl || null,
              city: place.city || null,
              country: place.country || null,
              rating: place.rating ?? null,
            },
            city: place.city || null,
            country: place.country || null,
            mood: null,
            moodTone: null,
          }),
        ),
      );

      setSavedPlaces((current) =>
        current.filter(
          (entry) => (entry.country || "Unknown") !== normalizedCountry,
        ),
      );
    } catch (deleteError) {
      console.error("Failed to delete country places", deleteError);
    } finally {
      setDeletingCountries((current) => {
        const next = new Set(current);
        next.delete(normalizedCountry);
        return next;
      });
    }
  }

  const countryBuckets = useMemo(() => {
    const counter = new Map();

    savedPlaces.forEach((place) => {
      const country = place.country || "Unknown";
      counter.set(country, (counter.get(country) || 0) + 1);
    });

    return Array.from(counter.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => a.country.localeCompare(b.country));
  }, [savedPlaces]);

  const previewCountries = countryBuckets.slice(0, 3);
  const hasMoreCountries = countryBuckets.length > previewCountries.length;

  useEffect(() => {
    if (!selectedCountry && countryBuckets.length > 0) {
      setSelectedCountry(countryBuckets[0].country);
    }

    if (
      selectedCountry &&
      !countryBuckets.some((entry) => entry.country === selectedCountry)
    ) {
      setSelectedCountry(countryBuckets[0]?.country || "");
    }
  }, [countryBuckets, selectedCountry]);

  const placesForSelectedCountry = useMemo(() => {
    if (!selectedCountry) return [];

    return savedPlaces
      .filter((place) => (place.country || "Unknown") === selectedCountry)
      .sort(
        (a, b) => b.savedAtMs - a.savedAtMs || a.name.localeCompare(b.name),
      );
  }, [savedPlaces, selectedCountry]);

  useEffect(() => {
    setPlaceVisibleCount(PAGE_SIZE);
  }, [selectedCountry]);

  const visiblePlaces = placesForSelectedCountry.slice(0, placeVisibleCount);
  const canLoadMorePlaces =
    placesForSelectedCountry.length > visiblePlaces.length;

  if (authChecking) {
    return (
      <AVLayout>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-700">
          Checking access...
        </div>
      </AVLayout>
    );
  }

  return (
    <AVLayout>
      <main className="pb-10">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-900 p-6 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
            ɅV
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Saved Places
          </h1>
          <p className="mt-2 text-sm text-cyan-100/90">
            Browse your saved places by country. Open any place to continue
            planning.
          </p>
        </section>

        {loading ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            Loading saved places...
          </div>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        ) : null}

        {!loading && !error && savedPlaces.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-700">
            No saved places yet. Save places from recommendations to see them
            here.
          </div>
        ) : null}

        {!loading && !error && savedPlaces.length > 0 ? (
          <>
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Countries
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {previewCountries.map((entry) => {
                  const active = entry.country === selectedCountry;
                  const isDeleting = deletingCountries.has(entry.country);
                  return (
                    <div
                      key={entry.country}
                      className={`rounded-xl border p-4 transition ${
                        active
                          ? "border-cyan-300 bg-cyan-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2 text-center">
                        <CountryFlag country={entry.country} size={26} />
                        <p className="text-sm font-semibold text-slate-900">
                          ({entry.count}) {entry.country}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedCountry(entry.country)}
                          className="flex-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void deleteCountryPlaces(entry.country)
                          }
                          disabled={isDeleting}
                          className="flex-1 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {hasMoreCountries ? (
                  <button
                    type="button"
                    onClick={() => setIsCountryModalOpen(true)}
                    className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:bg-slate-100"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      +{countryBuckets.length - previewCountries.length} more
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      View all countries
                    </p>
                  </button>
                ) : null}
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CountryFlag country={selectedCountry} size={20} />
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedCountry || "Selected Country"}
                  </h2>
                </div>
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  {placesForSelectedCountry.length} place
                  {placesForSelectedCountry.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visiblePlaces.map((place) => (
                  <article
                    key={`${place.placeId || place.name}-${place.city}-${place.country}`}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                      <button
                        type="button"
                        onClick={() => void unsavePlace(place)}
                        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                        aria-label="Remove saved place"
                        disabled={busyKeys.has(getSaveKey(place))}
                      >
                        ✕
                      </button>
                      <Image
                        src={place.imageUrl || "/germany.jpg"}
                        alt={place.name || "Saved place"}
                        width={640}
                        height={400}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    <div className="p-4">
                      <p className="text-lg font-semibold leading-tight text-slate-900">
                        {place.name || "Unnamed place"}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">
                        {place.category || "Place"}
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {place.city ? `${place.city}, ` : ""}
                        {place.country || "Unknown country"}
                      </p>
                      <p className="mt-1 truncate text-sm font-light text-slate-600">
                        {place.address || "Address unavailable"}
                      </p>

                      {place.mapUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              place.mapUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
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

              {canLoadMorePlaces ? (
                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() =>
                      setPlaceVisibleCount((count) => count + PAGE_SIZE)
                    }
                    className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Load more places
                  </button>
                </div>
              ) : null}
            </section>

            {isCountryModalOpen ? (
              <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      All Saved Countries
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsCountryModalOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-700 hover:bg-slate-50"
                      aria-label="Close countries modal"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                    {countryBuckets.map((entry) => {
                      const active = entry.country === selectedCountry;
                      const isDeleting = deletingCountries.has(entry.country);
                      return (
                        <div
                          key={`modal-${entry.country}`}
                          className={`rounded-xl border px-3 py-2 ${
                            active
                              ? "border-cyan-300 bg-cyan-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <CountryFlag country={entry.country} size={18} />
                              <p className="text-sm font-semibold text-slate-900">
                                ({entry.count}) {entry.country}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCountry(entry.country);
                                  setIsCountryModalOpen(false);
                                }}
                                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void deleteCountryPlaces(entry.country)
                                }
                                disabled={isDeleting}
                                className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isDeleting ? "Deleting..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </main>
    </AVLayout>
  );
}
