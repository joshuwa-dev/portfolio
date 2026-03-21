"use client";
import { useState } from "react";
import { faCheckCircle } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function GetUsers() {
  // ── Global form state machine: "idle" (before) | "loading" (during) | "success"/"error" (after)
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(""); // field/server/network error message

  // ── Submit handler (transitions: idle -> loading -> success/error)
  async function handleSubmit(e) {
    e.preventDefault();

    const body = {
      name: e.target.name.value,
      email: e.target.email.value,
      message: e.target.message.value,
      interest: e.target.interest.value,
    };

    // ── BEFORE SUBMIT (idle): client-side validation
    if (!body.message.trim()) {
      setError("⚠️ Please enter a message.");
      return; // stay in "idle"
    }
    setError("");
    setStatus("loading"); // ── DURING SUBMIT (loading)

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setStatus("success"); // ── AFTER SUBMIT (success)
        e.target.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Something went wrong.");
        setStatus("error"); // ── AFTER SUBMIT (error)
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus("error"); // ── AFTER SUBMIT (error)
    }
  }

  // ── Cancel resets to BEFORE SUBMIT (idle)
  function handleCancel(e) {
    e.preventDefault();
    const form = e.target.closest("form");
    if (form) form.reset();
    setError("");
    setStatus("idle");
  }

  // ── AFTER SUBMIT (success): replace form with confirmation UI
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
        {/* Optional: allow another submission (transition back to idle) */}
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 rounded-md bg-gray-800 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-black"
        >
          Send another message
        </button>
      </div>
    );
  }

  // ── BEFORE/DURING SUBMIT: show the form (disabled while loading)
  return (
    <div className="portfolio-reveal portfolio-delay-4 p-6 sm:p-10 bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-neutral-200 mb-8">
      <form onSubmit={handleSubmit} method="post" className="space-y-6">
        <div className="border-b border-t border-white pb-6">
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
            {/* Name */}
            <div className="md:col-span-1">
              <label
                htmlFor="name"
                className="block text-sm md:text-md font-bold"
              >
                Your Name
              </label>
              <input
                required
                id="name"
                name="name"
                type="text"
                placeholder="Enter Preferred Name"
                disabled={status === "loading"} // ── DURING SUBMIT: prevent edits
                className="text-sm md:text-md mt-2 block w-full rounded-md bg-white px-3 py-3.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 
              placeholder:text-gray-400 focus:outline-1 focus:-outline-offset-2 focus:outline-gray-600 sm:text-sm/6 disabled:opacity-60"
              />
            </div>

            {/* Email */}
            <div className="md:col-span-1">
              <label
                htmlFor="email"
                className="block text-sm md:text-md font-bold"
              >
                Email Address
              </label>
              <input
                required
                id="email"
                name="email"
                type="email"
                placeholder="Enter Email Address"
                autoComplete="email"
                disabled={status === "loading"} // ── DURING SUBMIT
                className="text-sm md:text-md mt-2 block w-full rounded-md bg-white px-3 py-3.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 
              placeholder:text-gray-400 focus:outline-1 focus:-outline-offset-2 focus:outline-gray-600 sm:text-sm/6 disabled:opacity-60"
              />
            </div>

            {/* Message */}
            <div className="col-span-full">
              <label
                htmlFor="message"
                className="block text-sm md:text-md font-bold"
              >
                Your Message
              </label>
              <textarea
                id="message"
                name="message"
                rows="6"
                disabled={status === "loading"} // ── DURING SUBMIT
                className="text-sm md:text-md mt-2 block w-full rounded-md bg-white px-3 py-3.5 text-gray-900 outline-1 -outline-offset-1 outline-gray-300 
              placeholder:text-gray-400 focus:outline-1 focus:-outline-offset-2 focus:outline-gray-600 sm:text-sm/6 disabled:opacity-60"
              />
              {/* Field/server error messaging */}
              {error ? (
                <p className="mt-1 text-xs md:text-md text-red-600">{error}</p>
              ) : (
                <p className="mt-1 text-xs md:text-md text-gray-600">
                  This information will be shared with me only
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Interest */}
        <div className="space-y-6">
          <p className="mt-1 text-sm md:text-md">Push Notifications</p>
          <div className="flex items-center gap-x-3">
            <input
              id="collaboration"
              type="radio"
              name="interest"
              value="collaboration"
              defaultChecked
              disabled={status === "loading"} // ── DURING SUBMIT
              className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white
        before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden
        checked:border-gray-800 checked:bg-gray-800 focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-gray-800 disabled:border-gray-300
        disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto
        forced-colors:before:hidden"
            />
            <label
              htmlFor="collaboration"
              className="text-sm md:text-md font-bold text-slate-900"
            >
              I am interested to work with you
            </label>
          </div>
          <div className="flex items-center gap-x-3">
            <input
              id="airvery"
              type="radio"
              name="interest"
              value="airvery"
              disabled={status === "loading"} // ── DURING SUBMIT
              className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white
        before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden
        checked:border-gray-800 checked:bg-gray-800 focus-visible:outline-2
        focus-visible:outline-offset-2 focus-visible:outline-gray-800 disabled:border-gray-300
        disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto
        forced-colors:before:hidden"
            />
            <label
              htmlFor="airvery"
              className="text-sm md:text-md font-bold text-slate-900"
            >
              Notify me when <span className="text-slate-900">ɅV</span> is live
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-12 flex items-center justify-center gap-x-6 border-b border-white pb-6">
          {/* <button
          type="button"
          onClick={handleCancel}
          disabled={status === "loading"} // ── DURING SUBMIT
          className="text-sm font-semibold text-gray-600 disabled:opacity-60"
        >
          Cancel
        </button> */}
          <button
            type="submit"
            disabled={status === "loading"} // ── DURING SUBMIT
            className={`rounded-md px-3 py-2 text-sm md:text-md font-semibold text-white shadow-xs ${
              status === "loading"
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gray-800 hover:bg-black"
            }`}
          >
            {status === "loading" ? "Sending..." : "Send"}
          </button>
        </div>

        {/* AFTER SUBMIT (error): form remains visible with error inline */}
        {/* If you’d prefer a full-page error state, render a separate block when status === "error" */}
      </form>
    </div>
  );
}

// "use client";
// import { useState } from "react";
// import { faCheckCircle } from "@fortawesome/free-regular-svg-icons";
// import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// export default function GetUsers() {
//   const [status, setStatus] = useState("");
//   const [submitted, setSubmitted] = useState(false);

//   async function handleSubmit(e) {
//     e.preventDefault();

//     const body = {
//       name: e.target.name.value,
//       email: e.target.email.value,
//       message: e.target.message.value,
//       interest: e.target.interest.value, // "collaboration" or "airvery"
//     };

//     try {
//       const res = await fetch("/api/users", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(body),
//       });

//       const data = await res.json();

//       if (res.ok) {
//         setSubmitted(true);
//         // setStatus(`✅ Saved! Document ID: ${data.id}`);
//         e.target.reset(); // ✅ Clear form after submit
//       } else {
//         setStatus(`❌ Error: ${data.error}`);
//       }
//     } catch (err) {
//       setStatus(`❌ Network error: ${err.message}`);
//     }
//   }

//   function handleCancel(e) {
//     e.preventDefault();
//     const form = e.target.closest("form"); // get parent form
//     if (form) form.reset();
//     setStatus("");
//   }
//   if (submitted) {
//     return (
//       <div className="p-6 text-center bg-white rounded-lg shadow-md">
//         <h2 className="text-xl font-bold text-black">
//           Thank you for your message <br />
//           <br />
//           <FontAwesomeIcon
//             className="text-black w-6 h-6 text-5xl text-emerald-600"
//             icon={faCheckCircle}
//           />
//         </h2>
//         {/* <button
//           onClick={() => setSubmitted(false)}
//           className="mt-4 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-500"
//         >
//           Send another message
//         </button> */}
//       </div>
//     );
//   }

//   return (
//     <form onSubmit={handleSubmit} method="post">
//       <div className="space-y-12">
//         <div className="border-b border-white pb-12">
//           <p className="mt-1 text-sm/6 text-gray-700">
//             This information will be shared with me only.
//           </p>

//           <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
//             <div className="md:col-span-1">
//               <label htmlFor="name" className="block text-sm font-bold">
//                 Your Name
//               </label>
//               <div className="mt-2">
//                 <div
//                   className="flex items-center rounded-md bg-white pl-3 outline-1 -outline-offset-1 outline-gray-300
//         focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-emerald-600"
//                 >
//                   <div className="shrink-0 text-base text-gray-500 select-none sm:text-sm/6">
//                     cobary.com/
//                   </div>
//                   <input
//                     required
//                     id="name"
//                     type="text"
//                     name="name"
//                     placeholder="Preferred Name"
//                     className="block rounded-md min-w-0 grow bg-white py-1.5 pr-3 pl-1 text-base text-gray-900 placeholder:text-gray-400
//           focus:outline-none sm:text-sm/6"
//                   />
//                 </div>
//               </div>
//             </div>

//             <div className="md:col-span-1">
//               <label htmlFor="email" className="block text-sm font-bold">
//                 Email address
//               </label>
//               <div className="mt-2">
//                 <input
//                   required
//                   id="email"
//                   type="email"
//                   name="email"
//                   autoComplete="email"
//                   className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300
//         placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-emerald-600 sm:text-sm/6"
//                 />
//               </div>
//             </div>

//             <div className="col-span-full">
//               <label htmlFor="message" className="block text-sm font-bold">
//                 Your Message
//               </label>
//               <div className="mt-2">
//                 <textarea
//                   id="message"
//                   name="message"
//                   rows="5"
//                   className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300
//         placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-emerald-600 sm:text-sm/6"
//                 ></textarea>
//               </div>
//               <p className="mt-3 text-sm text-gray-600">
//                 Shoot a shot at me ;-{")"}
//               </p>
//             </div>
//           </div>
//         </div>

//         <div className="mt-6 space-y-6">
//           <p className="mt-1 text-sm text-gray-700">Push Notifications</p>

//           <div className="flex items-center gap-x-3">
//             <input
//               id="collaboration"
//               type="radio"
//               name="interest"
//               value="collaboration"
//               defaultChecked
//               className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white
//         before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden
//         checked:border-emerald-600 checked:bg-emerald-600 focus-visible:outline-2
//         focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:border-gray-300
//         disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto
//         forced-colors:before:hidden"
//             />
//             <label
//               htmlFor="collaboration"
//               className="block text-sm font-bold text-white"
//             >
//               Hi Joshua, I am interested in working with you
//             </label>
//           </div>

//           <div className="flex items-center gap-x-3">
//             <input
//               id="airvery"
//               type="radio"
//               name="interest"
//               value="airvery"
//               className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white
//         before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden
//         checked:border-emerald-600 checked:bg-emerald-600 focus-visible:outline-2
//         focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:border-gray-300
//         disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto
//         forced-colors:before:hidden"
//             />
//             <label
//               htmlFor="airvery"
//               className="block text-sm font-bold text-white"
//             >
//               Notify me when <span className="text-emerald-600">airVERY</span>{" "}
//               goes LIVE!
//             </label>
//           </div>
//         </div>
//       </div>

//       <div className="mt-6 flex items-center justify-center gap-x-6">
//         <button
//           type="button"
//           onClick={handleCancel}
//           className="text-sm font-semibold text-gray-600"
//         >
//           Cancel
//         </button>
//         <button
//           type="submit"
//           className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
//         >
//           Send
//         </button>
//       </div>
//     </form>
//   );
// }
