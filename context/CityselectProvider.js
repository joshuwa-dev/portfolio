"use client";
import { createContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/Firebase";

export const CityselectContext = createContext();

const ANON_STORAGE_KEY = "av_cityselect_state_v1::anon";

function getStorageKeyForUid(uid) {
  return uid ? `av_cityselect_state_v1::uid::${uid}` : ANON_STORAGE_KEY;
}

export function CityselectProvider({ children }) {
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedMood, setSelectedMood] = useState("");
  const [selectedMoodTone, setSelectedMoodTone] = useState("");
  const [selectedMoodAnswers, setSelectedMoodAnswers] = useState([]);
  const [moodComplete, setMoodComplete] = useState(false);
  const [requestMoodEdit, setRequestMoodEdit] = useState(false);
  const [loginPromptTick, setLoginPromptTick] = useState(0);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [storageKey, setStorageKey] = useState(ANON_STORAGE_KEY);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const nextKey = getStorageKeyForUid(user?.uid || "");
      setStorageKey((currentKey) => {
        if (currentKey !== nextKey) {
          setHasHydrated(false);
          return nextKey;
        }
        return currentKey;
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const resetState = () => {
      setSelectedCity("");
      setSelectedCountry("");
      setSelectedMood("");
      setSelectedMoodTone("");
      setSelectedMoodAnswers([]);
      setMoodComplete(false);
    };

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSelectedCity(String(parsed?.selectedCity || ""));
        setSelectedCountry(String(parsed?.selectedCountry || ""));
        setSelectedMood(String(parsed?.selectedMood || ""));
        setSelectedMoodTone(String(parsed?.selectedMoodTone || ""));
        setSelectedMoodAnswers(
          Array.isArray(parsed?.selectedMoodAnswers)
            ? parsed.selectedMoodAnswers
            : [],
        );
        setMoodComplete(Boolean(parsed?.moodComplete));
      } else {
        resetState();
      }
    } catch {
      // Ignore malformed cached state and fall back to clean defaults.
      resetState();
    } finally {
      setHasHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hasHydrated) return;

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          selectedCity,
          selectedCountry,
          selectedMood,
          selectedMoodTone,
          selectedMoodAnswers,
          moodComplete,
        }),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [
    selectedCity,
    selectedCountry,
    selectedMood,
    selectedMoodTone,
    selectedMoodAnswers,
    moodComplete,
    hasHydrated,
    storageKey,
  ]);

  function requestLoginPrompt() {
    setLoginPromptTick((current) => current + 1);
  }

  return (
    <CityselectContext.Provider
      value={{
        selectedCity,
        setSelectedCity,
        selectedCountry,
        setSelectedCountry,
        selectedMood,
        setSelectedMood,
        selectedMoodTone,
        setSelectedMoodTone,
        selectedMoodAnswers,
        setSelectedMoodAnswers,
        moodComplete,
        setMoodComplete,
        requestMoodEdit,
        setRequestMoodEdit,
        loginPromptTick,
        requestLoginPrompt,
        hasHydrated,
      }}
    >
      {children}
    </CityselectContext.Provider>
  );
}
