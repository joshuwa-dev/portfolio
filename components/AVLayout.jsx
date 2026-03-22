"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../lib/Firebase";
import { logUserEvent, upsertCanonicalUserProfile } from "../lib/userIdentity";
import {
  CityselectContext,
  CityselectProvider,
} from "../context/CityselectProvider";
import AVSearchCountry from "./AVSearchCountry";

function LocationPinIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M12 21C12 21 5 14.5 5 9.5C5 5.35786 8.35786 2 12.5 2C16.6421 2 20 5.35786 20 9.5C20 14.5 13 21 13 21H12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12.5"
        cy="9.5"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function MoodToneIcon({ tone, className = "h-5 w-5" }) {
  const mouthPathByTone = {
    positive:
      "M8.5 14.25C9.4 15.45 10.7 16 12 16C13.3 16 14.6 15.45 15.5 14.25",
    neutral: "M9 14H15",
    negative:
      "M8.75 15.25C9.55 14.2 10.72 13.7 12 13.7C13.28 13.7 14.45 14.2 15.25 15.25",
  };

  const mouthPath = mouthPathByTone[tone] || mouthPathByTone.positive;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
      <path
        d={mouthPath}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Navbar() {
  const EMAIL_LINK_STORAGE_KEY = "av_email_link_pending_email";
  const EMAIL_LINK_REMEMBER_KEY = "av_email_link_remember";

  const router = useRouter();
  const pathname = usePathname();
  const {
    selectedCity,
    selectedCountry,
    selectedMood,
    selectedMoodTone,
    moodComplete,
    setRequestMoodEdit,
    loginPromptTick,
  } = useContext(CityselectContext);
  const [showCountrySearch, setShowCountrySearch] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [loginMethod, setLoginMethod] = useState("options");
  const [authLoading, setAuthLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", remember: true });
  const [loginError, setLoginError] = useState("");
  const [loginNotice, setLoginNotice] = useState("");
  const [authTransitionNotice, setAuthTransitionNotice] = useState("");
  const [pendingEmailLinkUrl, setPendingEmailLinkUrl] = useState("");
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [userPhotoUrl, setUserPhotoUrl] = useState("");
  const lastTrackedUidRef = useRef(null);
  const postLoginRequestedRef = useRef(false);
  const successToastTimeoutRef = useRef(null);
  const optionsMenuRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    return () => {
      if (successToastTimeoutRef.current) {
        clearTimeout(successToastTimeoutRef.current);
      }
    };
  }, []);

  function showSignedInConfirmation() {
    setShowLoginSuccess(true);
    if (successToastTimeoutRef.current) {
      clearTimeout(successToastTimeoutRef.current);
    }
    successToastTimeoutRef.current = setTimeout(() => {
      setShowLoginSuccess(false);
    }, 3500);
  }

  function formatAuthError(error) {
    const code = String(error?.code || "");
    if (code === "auth/popup-blocked") {
      return "Popup was blocked by your browser. Allow popups and try again.";
    }
    if (code === "auth/popup-closed-by-user") {
      return "Sign-in popup was closed before finishing.";
    }
    if (code === "auth/unauthorized-domain") {
      return "This domain is not authorized in Firebase Auth. Add it in Firebase Console > Authentication > Settings > Authorized domains.";
    }
    if (code === "auth/operation-not-allowed") {
      return "Google sign-in is not enabled in Firebase Auth. Enable Google provider in Firebase Console > Authentication > Providers.";
    }
    return error?.message || "Unable to continue with that provider.";
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void (async () => {
        if (user) {
          setAuthTransitionNotice("");
          setIsLoggedIn(true);
          setUserEmail(user.email || user.displayName || "Signed in");
          setUserPhotoUrl(user.photoURL || "");

          try {
            await upsertCanonicalUserProfile(user);

            if (lastTrackedUidRef.current !== user.uid) {
              await logUserEvent({
                uid: user.uid,
                eventName: "login_success",
                metadata: {
                  providers: (user.providerData || [])
                    .map((entry) => entry?.providerId)
                    .filter(Boolean),
                },
              });

              if (postLoginRequestedRef.current) {
                postLoginRequestedRef.current = false;
                closeLoginModal();
                showSignedInConfirmation();

                if (pathname !== "/av") {
                  router.push("/av");
                }
              }
            }
          } catch (error) {
            console.error("Failed to sync canonical user profile", error);
          }

          lastTrackedUidRef.current = user.uid;
        } else {
          setAuthTransitionNotice("");
          setIsLoggedIn(false);
          setUserEmail("");
          setUserPhotoUrl("");
          setLoginNotice("");
          setPendingEmailLinkUrl("");
          lastTrackedUidRef.current = null;
        }
      })();
    });

    return unsubscribe;
  }, []);

  function handleLoginChange(field, value) {
    setLoginForm((current) => ({ ...current, [field]: value }));
  }

  function closeLoginModal() {
    setShowLoginModal(false);
    setLoginMethod("options");
    setLoginError("");
    setLoginNotice("");
  }

  useEffect(() => {
    if (!showLoginModal) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        closeLoginModal();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showLoginModal]);

  useEffect(() => {
    if (!loginPromptTick || isLoggedIn) return;
    setShowCountrySearch(false);
    setLoginMethod("options");
    setLoginError("");
    setLoginNotice("Sign in to select a destination.");
    setPendingEmailLinkUrl("");
    setShowLoginModal(true);
  }, [isLoggedIn, loginPromptTick]);

  useEffect(() => {
    if (!showOptionsMenu) return;

    function handleClickOutside(event) {
      if (
        optionsMenuRef.current &&
        !optionsMenuRef.current.contains(event.target)
      ) {
        setShowOptionsMenu(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setShowOptionsMenu(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showOptionsMenu]);

  useEffect(() => {
    if (!showCountrySearch) return;

    function handleCloseOnScroll() {
      setShowCountrySearch(false);
    }

    window.addEventListener("scroll", handleCloseOnScroll, { passive: true });
    window.addEventListener("wheel", handleCloseOnScroll, { passive: true });
    window.addEventListener("touchstart", handleCloseOnScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleCloseOnScroll);
      window.removeEventListener("wheel", handleCloseOnScroll);
      window.removeEventListener("touchstart", handleCloseOnScroll);
    };
  }, [showCountrySearch]);

  function handleSavedPlacesClick() {
    setShowOptionsMenu(false);
    router.push("/av/saved-places");
  }

  function handleDashboardClick() {
    setShowOptionsMenu(false);
    router.push("/av/dashboard");
  }

  async function handleEmailLinkSubmit(event) {
    event.preventDefault();

    const email = String(loginForm.email || "").trim();

    if (!email) {
      setLoginError("Enter your email address.");
      return;
    }

    if (!email.includes("@")) {
      setLoginError("Enter a valid email address.");
      return;
    }

    try {
      setAuthLoading(true);
      setLoginError("");
      setLoginNotice("");
      postLoginRequestedRef.current = true;

      if (pendingEmailLinkUrl) {
        await setPersistence(
          auth,
          loginForm.remember
            ? browserLocalPersistence
            : browserSessionPersistence,
        );

        await signInWithEmailLink(auth, email, pendingEmailLinkUrl);
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        window.localStorage.removeItem(EMAIL_LINK_REMEMBER_KEY);
        setPendingEmailLinkUrl("");
        setLoginNotice("Email link verified. You are signed in.");
        showSignedInConfirmation();
        closeLoginModal();
        router.replace("/av");
        return;
      }

      const actionCodeSettings = {
        url: `${window.location.origin}/av`,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
      window.localStorage.setItem(
        EMAIL_LINK_REMEMBER_KEY,
        loginForm.remember ? "local" : "session",
      );

      setLoginNotice("Check your email for a secure sign-in link.");
      setLoginError("");
      setLoginForm({ email, remember: loginForm.remember });
    } catch (error) {
      postLoginRequestedRef.current = false;
      setLoginError(error?.message || "Unable to send sign-in link right now.");
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    if (!isClient) return;
    if (!isSignInWithEmailLink(auth, window.location.href)) return;

    const storedEmail =
      window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY) || "";
    const rememberMode =
      window.localStorage.getItem(EMAIL_LINK_REMEMBER_KEY) || "local";

    if (!storedEmail) {
      setPendingEmailLinkUrl(window.location.href);
      setShowLoginModal(true);
      setLoginMethod("email");
      setLoginNotice(
        "Enter the same email used to request this link to complete sign-in.",
      );
      return;
    }

    void (async () => {
      try {
        setAuthLoading(true);
        setLoginError("");
        await setPersistence(
          auth,
          rememberMode === "session"
            ? browserSessionPersistence
            : browserLocalPersistence,
        );

        await signInWithEmailLink(auth, storedEmail, window.location.href);
        window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
        window.localStorage.removeItem(EMAIL_LINK_REMEMBER_KEY);
        setPendingEmailLinkUrl("");
        setLoginNotice("Email link verified. You are signed in.");
        showSignedInConfirmation();
        router.replace("/av");
      } catch (error) {
        setLoginError(
          error?.message || "Unable to complete email link sign-in.",
        );
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [isClient, router]);

  async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();

    try {
      setAuthLoading(true);
      setLoginError("");
      setLoginNotice("");
      setAuthTransitionNotice("Opening Google sign-in...");
      postLoginRequestedRef.current = true;

      // Close the app modal before launching provider auth to avoid dual-layer UX.
      setShowLoginModal(false);

      await setPersistence(
        auth,
        loginForm.remember
          ? browserLocalPersistence
          : browserSessionPersistence,
      );

      await signInWithPopup(auth, provider);
      closeLoginModal();
    } catch (error) {
      postLoginRequestedRef.current = false;
      setAuthTransitionNotice("");
      setShowLoginModal(true);
      setLoginMethod("options");
      setLoginError(formatAuthError(error));
    } finally {
      setAuthTransitionNotice("");
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setShowOptionsMenu(false);
    setLoginNotice("");
    setPendingEmailLinkUrl("");

    try {
      const currentUid = auth.currentUser?.uid;
      if (currentUid) {
        await logUserEvent({
          uid: currentUid,
          eventName: "logout_click",
        });
      }
    } catch (error) {
      console.error("Failed to log logout event", error);
    }

    await signOut(auth);
  }

  const moodToneStyles = {
    positive: "border-emerald-200 bg-emerald-50 hover:bg-emerald-100",
    neutral: "border-amber-200 bg-amber-50 hover:bg-amber-100",
    negative: "border-rose-200 bg-rose-50 hover:bg-rose-100",
  };

  const moodButtonStyle =
    moodToneStyles[selectedMoodTone] ||
    "border-cyan-200 bg-cyan-50 hover:bg-cyan-100";

  const displayedMood = String(selectedMood || "")
    .replace(/\bfeeling\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");

  const userInitial =
    String(userEmail || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  return (
    <nav className="fixed inset-x-0 top-0 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/65 text-slate-500 z-[130] border-b border-slate-200/80">
      <div className="container mx-auto px-3 flex items-center py-4 gap-4">
        {/* Left */}
        <div className="text-xl font-semibold tracking-tight">
          {pathname === "/av" ? (
            <span className="cursor-default text-slate-500">ɅV</span>
          ) : (
            <a href="/av" className="text-slate-500 hover:text-slate-700">
              ɅV
            </a>
          )}
        </div>

        <div className="grow flex justify-center">
          {moodComplete && selectedCity && selectedCountry ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCountrySearch((current) => !current)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 flex items-center gap-2 min-w-0"
              >
                <LocationPinIcon className="h-5 w-5 text-slate-500" />
                <span className="truncate md:hidden max-w-[8ch]">
                  {selectedCity}
                </span>
                <span className="hidden md:inline">
                  {selectedCity}, {selectedCountry}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCountrySearch(false);
                  setRequestMoodEdit(true);
                }}
                className={`rounded-full border px-3 py-2 text-sm font-medium text-slate-500 flex items-center gap-2 ${moodButtonStyle}`}
              >
                <span className="flex items-center gap-2 md:hidden min-w-0">
                  <MoodToneIcon
                    tone={selectedMoodTone}
                    className="h-5 w-5 text-slate-500"
                  />
                  <span className="truncate max-w-[8ch] text-slate-500">
                    {displayedMood || "Set mood"}
                  </span>
                </span>
                <span className="hidden md:flex items-center gap-2">
                  <MoodToneIcon
                    tone={selectedMoodTone}
                    className="h-5 w-5 text-slate-500"
                  />
                  <span>Mood: {displayedMood || "Set mood"}</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <div className="relative" ref={optionsMenuRef}>
              <button
                type="button"
                onClick={() => setShowOptionsMenu((current) => !current)}
                className="flex h-9 w-9 min-w-9 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white p-0 text-xs font-semibold text-slate-700 leading-none shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 hover:shadow-md"
                aria-haspopup="menu"
                aria-expanded={showOptionsMenu}
                aria-label="Open account options"
              >
                {userPhotoUrl ? (
                  <img
                    src={userPhotoUrl}
                    alt="Account profile"
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{userInitial}</span>
                )}
              </button>

              {showOptionsMenu ? (
                <div
                  className="absolute right-0 top-full z-[120] mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
                  role="menu"
                  aria-label="Account options"
                >
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                    {userEmail || "Signed in"}
                  </div>

                  <button
                    type="button"
                    className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                    onClick={handleDashboardClick}
                    role="menuitem"
                  >
                    Dashboard
                  </button>

                  <button
                    type="button"
                    className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                    onClick={handleSavedPlacesClick}
                    role="menuitem"
                  >
                    Saved places
                  </button>

                  <button
                    type="button"
                    className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
                    onClick={handleLogout}
                    role="menuitem"
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {!isLoggedIn ? (
            <button
              type="button"
              onClick={() => {
                setShowCountrySearch(false);
                setLoginMethod("options");
                setLoginError("");
                setLoginNotice("");
                setPendingEmailLinkUrl("");
                setShowLoginModal(true);
              }}
              className="flex h-9 w-9 min-w-9 items-center justify-center rounded-full border border-slate-400 bg-white p-0 text-slate-700 leading-none shadow-sm ring-1 ring-slate-200/70 transition hover:border-slate-500 hover:text-slate-900 hover:bg-slate-50 hover:shadow-md"
              aria-label="Open login"
            >
              <svg
                className="w-6 h-6"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM4 20a8 8 0 0 1 16 0v1H4v-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {moodComplete && selectedCity && selectedCountry && showCountrySearch ? (
        <div className="fixed left-1/2 top-16 z-50 mt-2 w-[90vw] max-w-md -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-lg overflow-visible">
          <AVSearchCountry
            compact
            onSelectionComplete={() => setShowCountrySearch(false)}
          />
        </div>
      ) : null}

      {showLoginModal && isClient
        ? createPortal(
            <div
              className="fixed inset-0 grid place-items-center bg-slate-950/50 px-4 backdrop-blur-sm"
              style={{ zIndex: 9999 }}
              onClick={closeLoginModal}
            >
              <div
                className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                style={{ zIndex: 10000 }}
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Login"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-900/80">
                        Secure Access
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                        Welcome back
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Sign in to save trip ideas and continue your mood-based
                        travel flow.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="flex h-9 w-9 min-w-9 items-center justify-center rounded-full border border-slate-200 bg-white p-0 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
                      onClick={closeLoginModal}
                      aria-label="Close login"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={loginForm.remember}
                        onChange={(event) =>
                          handleLoginChange("remember", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      />
                      Keep me signed in on this device
                    </label>

                    {loginMethod === "options" ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                          onClick={handleGoogleLogin}
                          disabled={authLoading}
                        >
                          Continue with Google
                        </button>

                        <div className="flex items-center gap-3 py-1">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">
                            or
                          </span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <button
                          type="button"
                          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          onClick={() => setLoginMethod("email")}
                          disabled={authLoading}
                        >
                          Continue with Email Link
                        </button>
                      </div>
                    ) : (
                      <form
                        className="space-y-4"
                        onSubmit={handleEmailLinkSubmit}
                      >
                        <label className="block text-sm font-medium text-slate-700">
                          Email
                          <input
                            type="email"
                            value={loginForm.email}
                            onChange={(event) =>
                              handleLoginChange("email", event.target.value)
                            }
                            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                            placeholder="you@example.com"
                            autoComplete="email"
                          />
                        </label>

                        <div className="pt-1 flex gap-2">
                          <button
                            type="button"
                            className="flex h-10 w-10 min-w-10 items-center justify-center rounded-full border border-slate-300 bg-white p-0 text-slate-700 leading-none transition hover:bg-slate-100"
                            onClick={() => setLoginMethod("options")}
                            disabled={authLoading}
                            aria-label="Cancel email sign-in"
                          >
                            ✕
                          </button>
                          <button
                            type="submit"
                            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                            disabled={authLoading}
                          >
                            {authLoading
                              ? pendingEmailLinkUrl
                                ? "Completing sign-in..."
                                : "Sending link..."
                              : pendingEmailLinkUrl
                                ? "Complete sign-in"
                                : "Send sign-in link"}
                          </button>
                        </div>
                      </form>
                    )}

                    {loginError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {loginError}
                      </p>
                    ) : null}

                    {loginNotice ? (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {loginNotice}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {showLoginSuccess ? (
        <div className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 shadow-sm">
          Signed in successfully
        </div>
      ) : null}

      {authTransitionNotice ? (
        <div className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-md border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-800 shadow-sm">
          {authTransitionNotice}
        </div>
      ) : null}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200/80 bg-white/70 py-5 text-center text-sm text-slate-600">
      <p>
        © {new Date().getFullYear()} ɅV. Mood-based Travel - designed by{" "}
        <a
          href="https://joshuwa.dev"
          className="text-blue-600 font-bold underline hover:text-blue-700"
          target="_blank"
          rel="noopener noreferrer"
        >
          Joshuwa.dev
        </a>
      </p>
    </footer>
  );
}

export default function AVLayout({ children }) {
  return (
    <CityselectProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="grow container mx-auto px-3 pt-24">{children}</main>
        <Footer />
      </div>
    </CityselectProvider>
  );
}
