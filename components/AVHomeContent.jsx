"use client";

import { useContext } from "react";
import AVExplore from "./AVExplore";
import AVSearchCountry from "./AVSearchCountry";
import { CityselectContext } from "../context/CityselectProvider";

export default function AVHomeContent() {
  const { selectedCity, hasHydrated } = useContext(CityselectContext);
  const normalizedCity = String(selectedCity || "")
    .trim()
    .toLowerCase();
  const hasSelectedCity =
    normalizedCity.length > 0 &&
    normalizedCity !== "undefined" &&
    normalizedCity !== "null";
  const showHero = hasHydrated && !hasSelectedCity;

  return (
    <main>
      {showHero ? (
        <>
          <div className="relative h-[44vh] overflow-visible rounded-3xl px-6 text-center text-white">
            <div className="absolute inset-0 overflow-hidden rounded-3xl border border-cyan-100 shadow-xl">
              <div className="av-discover-gradient absolute inset-0" />
              <div className="av-discover-gradient-overlay absolute inset-0" />
              <div className="av-discover-blob av-discover-blob-a" />
              <div className="av-discover-blob av-discover-blob-b" />
              <div className="av-discover-blob av-discover-blob-c" />
              <div className="absolute -left-16 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -right-12 bottom-0 h-40 w-40 rounded-full bg-cyan-200/20 blur-2xl" />
            </div>

            <div className="relative flex h-full flex-col items-center justify-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/90">
                ɅV
              </p>
              <div className="mt-2 text-4xl lg:text-6xl py-1 font-extrabold tracking-tight">
                Discover
                <br />
                Destinations.
              </div>
              <p className="mt-3 max-w-2xl text-sm font-light text-cyan-50 sm:text-base">
                Enter a city and let your mood shape where you go next.
              </p>

              <div className="mt-7 w-full max-w-xl text-2xl">
                <AVSearchCountry />
              </div>
            </div>
          </div>
          <br />
        </>
      ) : null}

      <AVExplore />
    </main>
  );
}
