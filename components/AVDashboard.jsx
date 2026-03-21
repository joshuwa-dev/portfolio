"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getCountFromServer,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/Firebase";

function sortTopEntries(counterMap) {
  return Array.from(counterMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 10);
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function LatencyCard({ loading, queryLatencyMs }) {
  let statusLabel = "Pending";
  let statusStyle = "bg-slate-100 text-slate-800";

  if (!loading && typeof queryLatencyMs === "number") {
    if (queryLatencyMs < 80) {
      statusLabel = "Very low";
      statusStyle = "bg-amber-100 text-amber-900";
    } else if (queryLatencyMs <= 1200) {
      statusLabel = "Healthy";
      statusStyle = "bg-emerald-100 text-emerald-900";
    } else if (queryLatencyMs <= 2500) {
      statusLabel = "Elevated";
      statusStyle = "bg-amber-100 text-amber-900";
    } else {
      statusLabel = "High";
      statusStyle = "bg-orange-100 text-orange-900";
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        Dashboard Query Latency
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-3xl font-semibold text-slate-900">
          {loading ? "..." : `${queryLatencyMs || 0} ms`}
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle}`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function TopList({ title, emptyMessage, entries }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {entries.map((entry, index) => (
            <li
              key={`${title}-${entry.name}`}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="text-sm font-medium text-slate-800">
                {index + 1}. {entry.name}
              </span>
              <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-900">
                {entry.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function AVDashboard() {
  const router = useRouter();
  const adminUidList = useMemo(() => {
    const raw = String(process.env.NEXT_PUBLIC_DASHBOARD_ADMIN_UIDS || "");
    return raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, []);

  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [accessNotice, setAccessNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState(30); // days
  const [totalUsers, setTotalUsers] = useState(0);
  const [newUsers, setNewUsers] = useState(0);
  const [uniqueCities, setUniqueCities] = useState(0);
  const [uniqueCountries, setUniqueCountries] = useState(0);
  const [topCities, setTopCities] = useState([]);
  const [topCountries, setTopCountries] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [queryLatencyMs, setQueryLatencyMs] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    projectId: db.app.options.projectId,
    uid: null,
    errorCode: null,
    errorMessage: null,
  });

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return "-";
    return new Date(lastUpdated).toLocaleString();
  }, [lastUpdated]);

  async function loadStatsFromUserSubcollections(cutoffDate) {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const topCityCounts = new Map();
    const topCountryCounts = new Map();
    const uniqueCitiesSet = new Set();
    const uniqueCountriesSet = new Set();

    for (const userDoc of usersSnapshot.docs) {
      const eventsRef = collection(db, "users", userDoc.id, "events");
      const eventsQuery = query(
        eventsRef,
        where("createdAt", ">=", cutoffDate),
      );
      const eventsSnapshot = await getDocs(eventsQuery);

      eventsSnapshot.forEach((docSnapshot) => {
        const eventData = docSnapshot.data() || {};
        const eventName = String(eventData.eventName || "");
        const metadata = eventData.metadata || {};
        const city = String(metadata.city || eventData.city || "").trim();
        const country = String(
          metadata.country || eventData.country || "",
        ).trim();

        if (eventName === "top_city_selected") {
          if (city) {
            topCityCounts.set(city, (topCityCounts.get(city) || 0) + 1);
            uniqueCitiesSet.add(city);
          }
          if (country) {
            topCountryCounts.set(
              country,
              (topCountryCounts.get(country) || 0) + 1,
            );
            uniqueCountriesSet.add(country);
          }
        } else if (eventName === "place_suggestions_requested") {
          if (city) {
            topCityCounts.set(city, (topCityCounts.get(city) || 0) + 1);
            uniqueCitiesSet.add(city);
          }
          if (country) {
            topCountryCounts.set(
              country,
              (topCountryCounts.get(country) || 0) + 1,
            );
            uniqueCountriesSet.add(country);
          }
        }
      });
    }

    setUniqueCities(uniqueCitiesSet.size);
    setUniqueCountries(uniqueCountriesSet.size);
    setTopCities(sortTopEntries(topCityCounts));
    setTopCountries(sortTopEntries(topCountryCounts));
  }

  async function loadDashboardStats() {
    setLoading(true);
    setError("");
    const loadStart = performance.now();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - timeRange);

      // Total all users (not filtered by time)
      const usersCountSnapshot = await getCountFromServer(
        collection(db, "users"),
      );
      setTotalUsers(usersCountSnapshot.data().count || 0);

      // New users in time range
      const newUsersSnapshot = await getDocs(
        query(collection(db, "users"), where("createdAt", ">=", cutoffDate)),
      );
      setNewUsers(newUsersSnapshot.size);

      // Always use subcollection fallback path (no index required)
      await loadStatsFromUserSubcollections(cutoffDate);

      setLastUpdated(Date.now());
    } catch (statsError) {
      console.error("Failed to load dashboard stats", statsError);
      const code = String(statsError?.code || "");
      const message = String(statsError?.message || "");

      setDebugInfo((prev) => ({
        ...prev,
        errorCode: code,
        errorMessage: message,
      }));

      if (code.includes("permission-denied")) {
        setError(
          "Firestore read is blocked (permission-denied). Publish rules that allow signed-in reads for users and users/{uid}/events in the same Firebase project.",
        );
      } else if (code.includes("unauthenticated")) {
        setError(
          "You are not authenticated. Sign in again and reopen the dashboard.",
        );
      } else {
        setError(
          `Unable to load dashboard stats (${code || "unknown-error"}). ${message || "Check Firestore rules and index status."}`,
        );
      }
    } finally {
      setQueryLatencyMs(Math.max(1, Math.round(performance.now() - loadStart)));
      setLoading(false);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const enforceAdmin = adminUidList.length > 0;
        const adminAllowed = !enforceAdmin || adminUidList.includes(user.uid);
        setIsAuthorized(adminAllowed);
        setAccessNotice(
          adminAllowed
            ? enforceAdmin
              ? "Admin access enabled"
              : "Admin list not configured; signed-in access is enabled"
            : "You are signed in but not allowed to view this dashboard.",
        );
        setDebugInfo((prev) => ({
          ...prev,
          uid: user.uid,
        }));
      } else {
        setIsAuthorized(false);
        setDebugInfo((prev) => ({
          ...prev,
          uid: null,
        }));
        router.replace("/av");
      }
      setAuthChecking(false);
    });

    return unsubscribe;
  }, [adminUidList, router]);

  useEffect(() => {
    if (authChecking || !isAuthorized) return;
    void loadDashboardStats();
  }, [authChecking, isAuthorized, timeRange]);

  if (authChecking) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm font-medium text-slate-700">
        Checking access...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-sm font-medium text-amber-800">
        {debugInfo.uid
          ? "Access denied. This dashboard is admin-only in production mode."
          : "Redirecting to discover. Please sign in to view the dashboard."}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-cyan-900 to-blue-900 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">
                ɅV Insights
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-cyan-100/90">
                Track signups and most-selected destinations from your mood and
                city activity.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadDashboardStats()}
              className="rounded-full border border-white/40 bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-cyan-100">
              Time Range:
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="rounded-lg border border-white/30 bg-white/15 px-3 py-1 text-sm font-medium text-white hover:bg-white/25"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
              <option value={180}>180 days</option>
              <option value={365}>365 days</option>
            </select>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
        {accessNotice}
      </div>

      <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-mono text-slate-700">
        <div>Project: {debugInfo.projectId}</div>
        <div>Auth UID: {debugInfo.uid || "not-authenticated"}</div>
        {debugInfo.errorCode ? (
          <>
            <div>Error Code: {debugInfo.errorCode}</div>
            <div className="mt-1 break-words">
              Error Message: {debugInfo.errorMessage}
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total users (all time)"
          value={loading ? "..." : totalUsers}
        />
        <StatCard
          label={`New users (${timeRange} days)`}
          value={loading ? "..." : newUsers}
        />
        <StatCard
          label={`Unique cities (${timeRange} days)`}
          value={loading ? "..." : uniqueCities}
        />
        <StatCard
          label={`Unique countries (${timeRange} days)`}
          value={loading ? "..." : uniqueCountries}
        />
      </div>

      <div className="mt-2 text-xs text-slate-500">
        Last updated: {formattedLastUpdated}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LatencyCard loading={loading} queryLatencyMs={queryLatencyMs} />
        <StatCard label="Last error" value={debugInfo.errorCode || "none"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopList
          title="Top 10 Cities Selected"
          emptyMessage="No city selection data yet. Select cities in discover mode to populate this list."
          entries={topCities}
        />

        <TopList
          title="Top 10 Countries Selected"
          emptyMessage="No country selection data yet. Select cities in discover mode to populate this list."
          entries={topCountries}
        />
      </div>
    </div>
  );
}
