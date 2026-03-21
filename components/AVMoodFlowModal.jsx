"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

export default function AVMoodFlowModal({ city, open, onClose, onComplete }) {
  const INITIAL_VISIBLE_OPTIONS = 4;
  const OPTIONS_INCREMENT = 4;

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [visibleOptionCount, setVisibleOptionCount] = useState(
    INITIAL_VISIBLE_OPTIONS,
  );

  function shuffleOptions(items = []) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async function loadStep(answerHistory = []) {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/mood-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, answers: answerHistory }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to continue mood onboarding");
      }

      if (data.done) {
        onComplete?.({
          city,
          answers: answerHistory,
          summary:
            data.summary || `Mood profile: ${answerHistory.join(" -> ")}`,
        });
        onClose?.();
        return;
      }

      setQuestion(data.question || "How are you feeling today?");
      setOptions(
        Array.isArray(data.options) ? shuffleOptions(data.options) : [],
      );
      setVisibleOptionCount(INITIAL_VISIBLE_OPTIONS);
    } catch (error) {
      setErrorMessage(error?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !city) return;
    setAnswers([]);
    loadStep([]);
  }, [open, city]);

  function selectOption(option) {
    const nextAnswers = [...answers, option];
    setAnswers(nextAnswers);
    loadStep(nextAnswers);
  }

  function showMoreOptions() {
    setVisibleOptionCount((current) =>
      Math.min(current + OPTIONS_INCREMENT, options.length),
    );
  }

  function goBackStep() {
    if (loading || answers.length === 0) return;
    const previousAnswers = answers.slice(0, -1);
    setAnswers(previousAnswers);
    loadStep(previousAnswers);
  }

  const visibleOptions = options.slice(0, visibleOptionCount);
  const hasMoreOptions = options.length > visibleOptionCount;

  return (
    <Dialog open={open} onClose={onClose} className="relative z-20">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-gray-900/40 transition-opacity data-closed:opacity-0"
      />

      <div className="fixed inset-0 z-30 grid place-items-center p-4">
        <DialogPanel className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="border-b border-gray-100 px-6 py-4">
            <DialogTitle className="text-xl font-semibold text-gray-900">
              Quick Mood Check
            </DialogTitle>
            <p className="text-sm text-slate-600">Tailored for {city}</p>
          </div>

          <div className="px-6 py-5">
            {loading ? (
              <p className="text-sm text-slate-500">
                Building your mood profile...
              </p>
            ) : null}
            {errorMessage ? (
              <p className="text-sm text-red-600">{errorMessage}</p>
            ) : null}

            {!loading && !errorMessage ? (
              <>
                <p className="mb-4 text-base font-medium text-gray-800">
                  {question}
                </p>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {visibleOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectOption(option)}
                      className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-sm font-medium text-cyan-900 hover:bg-cyan-100"
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {hasMoreOptions ? (
                  <button
                    type="button"
                    onClick={showMoreOptions}
                    className="mt-3 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    More options
                  </button>
                ) : null}
              </>
            ) : null}

            <div className="mt-4 text-xs text-gray-500">
              {answers.length > 0
                ? `Selected: ${answers.join(" -> ")}`
                : "Choose an option to continue"}
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 px-6 py-3">
            {answers.length > 0 ? (
              <button
                type="button"
                onClick={goBackStep}
                className="mr-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={loading}
              >
                Go back
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-cyan-900 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800"
            >
              Close
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
