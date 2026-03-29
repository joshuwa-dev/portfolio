"use client";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { CityselectContext } from "../context/CityselectProvider";
import { auth } from "../src/lib/Firebase";

export default function AVSearchCountry({
  compact = false,
  onSelectionComplete,
}) {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { setSelectedCity, setSelectedCountry, requestLoginPrompt } =
    useContext(CityselectContext);

  var requestOptions = {
    method: "GET",
    redirect: "follow",
  };

  const getCountries = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        "https://countriesnow.space/api/v0.1/countries",
        requestOptions,
      );
      if (!response.ok) {
        throw new Error(`Cannot Fetch Data: Status ${response.status}`);
      }
      const data = await response.json();
      setCountries(data.data);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getCountries();
  }, []);

  const [typedCountry, setTypedCountry] = useState("");

  const CapFirstLetterTypedCountry = (value) => {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const cityCountryPairs = useMemo(() => {
    return countries.flatMap((countryObj) => {
      const countryName = countryObj.country;
      const cityList = Array.isArray(countryObj.cities)
        ? countryObj.cities
        : [];

      return cityList.map((city) => ({
        key: `${city}-${countryName}`,
        city,
        country: countryName,
        label: `${city}, ${countryName}`,
      }));
    });
  }, [countries]);

  const filteredSuggestions = useMemo(() => {
    const query = typedCountry.trim().toLowerCase();
    if (!query) return [];

    const startsWithMatches = cityCountryPairs.filter((entry) =>
      entry.city.toLowerCase().startsWith(query),
    );

    const includesMatches = cityCountryPairs.filter(
      (entry) =>
        !entry.city.toLowerCase().startsWith(query) &&
        (entry.city.toLowerCase().includes(query) ||
          entry.country.toLowerCase().includes(query) ||
          entry.label.toLowerCase().includes(query)),
    );

    return [...startsWithMatches, ...includesMatches].slice(0, 8);
  }, [cityCountryPairs, typedCountry]);

  const handleSelectSuggestion = (entry) => {
    if (!auth.currentUser) {
      requestLoginPrompt?.();
      return;
    }

    setSelectedCity(entry.city);
    setSelectedCountry(entry.country);
    setTypedCountry("");
    onSelectionComplete?.(entry);
  };

  return (
    <>
      <div className="relative mx-auto w-full max-w-md overflow-visible">
        <input
          type="text"
          value={typedCountry}
          onChange={(e) =>
            setTypedCountry(CapFirstLetterTypedCountry(e.target.value))
          }
          placeholder="Search city, country"
          className={
            compact
              ? "text-sm w-full py-2 pl-9 pr-3 rounded-lg border bg-white border-slate-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-700"
              : "text-xl lg:text-2xl text-center w-full py-3 pl-10 pr-4 rounded-xl border bg-white/95 border-cyan-100 shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-700"
          }
        />
        <svg
          className={`absolute top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 ${
            compact ? "left-3" : "left-5"
          }`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"
          />
        </svg>

        {typedCountry.length > 0 && (
          <div className="absolute w-full top-full mt-2 bg-white text-slate-700 border border-slate-200 shadow-lg rounded-lg z-50 overflow-visible">
            <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {filteredSuggestions.length > 0 ? (
                filteredSuggestions.map((entry) => (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(entry)}
                      className="block w-full text-left px-4 py-2 hover:bg-cyan-50"
                    >
                      {entry.label}
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-4 py-2 text-slate-500">No matches found.</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {!compact ? (
        <div className="mt-3 text-sm text-cyan-50">
          {loading ? (
            <p>Loading destinations...</p>
          ) : errorMessage ? (
            <p className="text-red-200">Error: {errorMessage}</p>
          ) : (
            <p>{countries.length} cities worldwide</p>
          )}
        </div>
      ) : null}
    </>
  );
}
