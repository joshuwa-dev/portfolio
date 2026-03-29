"use client";
import { useState } from "react";
import { faCheckCircle } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function GetUsers() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    const body = {
      name: e.target.name.value,
      email: e.target.email.value,
      message: e.target.message.value,
      interest: e.target.interest.value,
    };

    if (!body.message.trim()) {
      setError("⚠️ Please enter a message.");
      return;
    }
    setError("");
    setStatus("loading");

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setStatus("success");
        e.target.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.message || data?.error || "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  function handleCancel(e) {
    e.preventDefault();
    const form = e.target.closest("form");
    if (form) form.reset();
    setError("");
    setStatus("idle");
  }

  if (status === "success") {
    return (
      <div className="p-6 text-center bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-black">
          <FontAwesomeIcon
            className="w-6 h-6 text-5xl text-emerald-600"
            icon={faCheckCircle}
          />
          <br />
          <br />
          Thank you for your message!
        </h2>
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 rounded-md bg-gray-800 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-black"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="portfolio-reveal portfolio-delay-4 p-6 sm:p-10 bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-neutral-200 mb-8">
      <form onSubmit={handleSubmit} method="post" className="space-y-6">
        <div className="border-b border-t border-white pb-6">
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
            <div className="md:col-span-1">
              <label htmlFor="name" className="block text-sm md:text-md font-bold">
                Your Name
              </label>
              <input
                required
                id="name"
                name="name"
                type="text"
                placeholder="Enter Preferred Name"
                disabled={status === "loading"}
                className="text-sm md:text-md mt-2 block w-full rounded-md bg-white px-3 py-3.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-1 focus:-outline-offset-2 focus:outline-gray-600 sm:text-sm/6 disabled:opacity-60"
              />
            </div>

            <div className="md:col-span-1">
              <label htmlFor="email" className="block text-sm md:text-md font-bold">
                Email Address
              </label>
              <input
                required
                id="email"
                name="email"
                type="email"
                placeholder="Enter Email Address"
                autoComplete="email"
                disabled={status === "loading"}
                className="text-sm md:text-md mt-2 block w-full rounded-md bg-white px-3 py-3.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-1 focus:-outline-offset-2 focus:outline-gray-600 sm:text-sm/6 disabled:opacity-60"
              />
            </div>

            <div className="col-span-full">
              <label htmlFor="message" className="block text-sm md:text-md font-bold">
                Your Message
              </label>
              <textarea
                id="message"
                name="message"
                rows="6"
                disabled={status === "loading"}
                className="text-sm md:text-md mt-2 block w-full rounded-md bg-white px-3 py-3.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-1 focus:-outline-offset-2 focus:outline-gray-600 sm:text-sm/6 disabled:opacity-60"
              />
              {error ? (
                <p className="mt-1 text-xs md:text-md text-red-600">{error}</p>
              ) : (
                <p className="mt-1 text-xs md:text-md text-gray-600">This information will be shared with me only</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <p className="mt-1 text-sm md:text-md">Push Notifications</p>
          <div className="flex items-center gap-x-3">
            <input
              id="collaboration"
              type="radio"
              name="interest"
              value="collaboration"
              defaultChecked
              disabled={status === "loading"}
              className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-gray-800 checked:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800 disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto forced-colors:before:hidden"
            />
            <label htmlFor="collaboration" className="text-sm md:text-md font-bold text-slate-900">
              I am interested to work with you
            </label>
          </div>
          <div className="flex items-center gap-x-3">
            <input
              id="airvery"
              type="radio"
              name="interest"
              value="airvery"
              disabled={status === "loading"}
              className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-gray-800 checked:bg-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-800 disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto forced-colors:before:hidden"
            />
            <label htmlFor="airvery" className="text-sm md:text-md font-bold text-slate-900">
              Notify me when <span className="text-slate-900">ɅV</span> is live
            </label>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-center gap-x-6 border-b border-white pb-6">
          <button
            type="submit"
            disabled={status === "loading"}
            className={`rounded-md px-3 py-2 text-sm md:text-md font-semibold text-white shadow-xs ${
              status === "loading" ? "bg-gray-400 cursor-not-allowed" : "bg-gray-800 hover:bg-black"
            }`}
          >
            {status === "loading" ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
