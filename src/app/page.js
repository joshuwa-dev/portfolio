"use client";
// Certifications data (user provided)
const certifications = [
  {
    title: "CompTIA Security+",
    note: "CompTIA",
    img: "/badges/comptia.png",
  },
  {
    title: "Cisco CCNA",
    note: "Cisco",
    img: "/badges/ccna.png",
  },
  {
    title: "Google Associate Cloud Engineer",
    note: "Google Cloud",
    img: "/badges/google-cloud.png",
  },
];

// Tech stack groups definition
let techStackGroups = [
  {
    title: "Cloud & DevOps",
    items: [
      "AWS",
      "Azure",
      "GCP",
      "Terraform",
      "Jenkins",
      "GitHub Actions",
      "Ansible",
      "Docker",
      "Kubernetes",
      "Linux",
      "Windows",
      "Mac",
    ],
  },
  {
    title: "Security & Monitoring",
    items: [
      "Splunk Enterprise",
      "Elastic Cloud",
      "CrowdStrike Falcon EDR",
      "Burp Suite",
      "SonarQube",
      "Nessus",
      "Palo Alto NGFW",
      "Wireshark",
      "Cisco Packet Tracer",
    ],
  },
  {
    title: "Frontend & Web",
    items: [
      "React",
      "Next.js",
      "HTML/CSS",
      "JavaScript",
      "RESTful APIs",
      "Firebase",
    ],
  },
  {
    title: "Backend & Data",
    items: ["Node.js", "Python", "SQL", "PowerShell", "Bash", "JavaScript"],
  },
  {
    title: "Scripting",
    items: ["Python", "Bash", "PowerShell"],
  },
];

import React, { useState, useEffect } from "react";
import Image from "next/image";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faApple,
  faAws,
  faDocker,
  faGithub,
  faGoogle,
  faLinux,
  faMicrosoft,
  faNodeJs,
  faPython,
  faHtml5,
  faJs,
  faReact,
  faWindows,
} from "@fortawesome/free-brands-svg-icons";
import {
  faDatabase,
  faFire,
  faTerminal,
  faServer,
  faShieldHalved,
  faCloud,
  faGear,
  faBug,
  faCode,
} from "@fortawesome/free-solid-svg-icons";

import PortfolioLayout from "../../components/PortfolioLayout";
// TechStackGroups component for toggling show more/less
function TechStackGroups() {
  const [showAll, setShowAll] = useState(false);
  const [groupCount, setGroupCount] = useState(1); // default for SSR (xs)
  const [openGroup, setOpenGroup] = useState(null);
  const [openTooltip, setOpenTooltip] = useState(null);

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 640) {
        setGroupCount(1);
      } else if (window.innerWidth < 768) {
        setGroupCount(2);
      } else if (window.innerWidth < 1024) {
        setGroupCount(3);
      } else {
        setGroupCount(4);
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // close any open 'Others' popover when the user scrolls
  useEffect(() => {
    function handleScroll() {
      if (openGroup) setOpenGroup(null);
      if (openTooltip) setOpenTooltip(null);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [openGroup, openTooltip]);

  let groupsToShow = techStackGroups;
  if (!showAll) {
    groupsToShow = techStackGroups.slice(0, groupCount);
  }
  return (
    <>
      <div className="mt-4 grid gap-2 sm:gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {groupsToShow.map((group) => {
          const { visibleItems, remainingItems } = splitTechItems(group.items);
          return (
            <div
              key={group.title}
              className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 sm:p-5"
            >
              <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
                {group.title}
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:gap-2.5">
                {visibleItems.map((visibleItem) => (
                  <div
                    key={`${group.title}-${visibleItem}`}
                    className="flex flex-col items-center justify-center rounded-xl bg-white px-1.5 py-1.5 sm:px-2 sm:py-2 text-center shadow-sm ring-1 ring-slate-200"
                  >
                    <span className="inline-flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center text-base text-slate-700">
                      <FontAwesomeIcon
                        icon={techIconMap[visibleItem] || faCode}
                      />
                    </span>
                    <span className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-700">
                      {visibleItem}
                    </span>
                  </div>
                ))}
                {remainingItems.length > 0 && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setOpenGroup(
                        openGroup === group.title ? null : group.title,
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        setOpenGroup(
                          openGroup === group.title ? null : group.title,
                        );
                    }}
                    className="group relative flex flex-col items-center justify-center rounded-xl bg-white px-1.5 py-1.5 sm:px-2 sm:py-2 text-center shadow-sm ring-1 ring-slate-200 cursor-pointer"
                  >
                    <span className="inline-flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center text-xs font-bold text-slate-500">
                      +{remainingItems.length}
                    </span>
                    <span className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-slate-700">
                      Others
                    </span>
                    <div
                      className={`absolute left-1/2 top-[5.5rem] z-20 w-56 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-lg transition-opacity ${openGroup === group.title ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none group-hover:opacity-100"}`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                        More in {group.title}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {remainingItems.map((restItem) => (
                          <span
                            key={`${group.title}-${restItem}`}
                            className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                          >
                            {restItem}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {techStackGroups.length > groupCount && (
        <div className="mt-4 flex justify-center">
          <button
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll
              ? "Show less"
              : `Show more (${techStackGroups.length - groupCount})`}
          </button>
        </div>
      )}
    </>
  );
}

// Sort group names and items alphabetically
techStackGroups = techStackGroups
  .map((group) => ({
    ...group,
    items: [...group.items].sort((a, b) => a.localeCompare(b)),
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

const techIconMap = {
  AWS: faAws,
  Azure: faMicrosoft,
  GCP: faGoogle,
  Linux: faLinux,
  Windows: faWindows,
  Mac: faApple,
  Terraform: faCloud,
  Jenkins: faGear,
  "GitHub Actions": faGithub,
  Ansible: faTerminal,
  Docker: faDocker,
  Kubernetes: faServer,
  "Splunk Enterprise": faShieldHalved,
  "Elastic Cloud": faCloud,
  "CrowdStrike Falcon EDR": faShieldHalved,
  "Burp Suite": faBug,
  SonarQube: faBug,
  Nessus: faShieldHalved,
  "Palo Alto NGFW": faShieldHalved,
  Wireshark: faBug,
  "Cisco Packet Tracer": faServer,
  React: faReact,
  "Next.js": faCode,
  "Node.js": faNodeJs,
  "RESTful APIs": faCloud,
  JavaScript: faJs,
  Python: faPython,
  "HTML/CSS": faHtml5,
  SQL: faDatabase,
  Firebase: faFire,
  Bash: faTerminal,
  PowerShell: faTerminal,
};

function splitTechItems(items) {
  const visibleItems = items.slice(0, 3);
  const remainingItems = items.slice(3);
  return { visibleItems, remainingItems };
}

const experiences = [
  {
    role: "Freelance Software Engineer",
    org: "Independent / ɅV",
    period: "2024 - Present",
    impact:
      "Built and iterated full-stack products including ɅV, integrating recommendations, analytics, and cloud-backed services with a security-first architecture.",
  },
  {
    role: "Software Engineer",
    org: "Treekot Solutions",
    period: "2022 - 2024",
    impact:
      "Triaged and remediated 500+ vulnerabilities, improved secure coding practices across teams, and reduced incident response time through stronger monitoring workflows.",
  },
  {
    role: "Network Engineer",
    org: "Ngcom Networks",
    period: "2019 - 2022",
    impact:
      "Operated and secured ISP-grade network environments, administered firewall controls, and maintained high service reliability across multi-site deployments.",
  },
];

// Number of groups to show by default
const MAX_GROUPS = 4;

export default function Portfolio() {
  const [openTooltip, setOpenTooltip] = useState(null);

  useEffect(() => {
    function handleScroll() {
      if (openTooltip) setOpenTooltip(null);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [openTooltip]);
  return (
    <PortfolioLayout>
      <div className="w-full">
        <div className="grid grid-cols-1 gap-y-8">
          <section className="relative overflow-hidden portfolio-reveal portfolio-delay-1 rounded-3xl border border-neutral-200 bg-gradient-to-r from-slate-50/70 to-white p-6 md:p-8 mb-12 shadow-2xl backdrop-blur-lg">
            <div className="pointer-events-none absolute -right-12 -top-10 h-44 w-44 bg-slate-100 rounded-full opacity-60 blur-3xl transform-gpu rotate-12" />
            <div className="pointer-events-none absolute -left-16 -bottom-8 h-36 w-36 bg-slate-100 rounded-full opacity-50 blur-2xl transform-gpu -rotate-6" />
            <div className="relative z-10">
              <div className="flex flex-row items-center gap-6 mt-3">
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  About Me
                </h1>
                <div className="flex flex-row gap-4 items-center">
                  <div className="relative">
                    <a
                      href="https://www.linkedin.com/in/joshuwa-dev/"
                      target="badges"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn profile"
                      onClick={(e) => {
                        if (openTooltip === "profile") {
                          window.open(
                            "https://www.linkedin.com/in/joshuwa-dev/",
                            "badges",
                          );
                          return;
                        }
                        e.preventDefault();
                        setOpenTooltip("profile");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenTooltip(
                            openTooltip === "profile" ? null : "profile",
                          );
                        }
                      }}
                    >
                      <img
                        src="/ogo.jpeg"
                        alt="profile badge"
                        className="h-12 w-12 rounded-full border border-slate-100 bg-white shadow-sm object-cover"
                        width={48}
                        height={48}
                      />
                    </a>
                    <span
                      className={`absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-20 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs font-medium px-2 py-1 transform-gpu transition duration-150 ${
                        openTooltip === "profile"
                          ? "opacity-100 scale-100 pointer-events-auto"
                          : "opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none"
                      }`}
                    >
                      Profile
                    </span>
                  </div>

                  {certifications.map((cert, idx) => {
                    const id = `cert-${idx}`;
                    return (
                      <div key={cert.title} className="relative">
                        {cert.title === "CompTIA Security+" ? (
                          <a
                            href="https://www.credly.com/badges/7aa44928-240d-4336-a62c-fb2714692edb/linked_in_profile"
                            target="badges"
                            rel="noopener noreferrer"
                            aria-label="CompTIA Security+ badge"
                            onClick={(e) => {
                              if (openTooltip === id) {
                                window.open(
                                  "https://www.credly.com/badges/7aa44928-240d-4336-a62c-fb2714692edb/linked_in_profile",
                                  "badges",
                                );
                                return;
                              }
                              e.preventDefault();
                              setOpenTooltip(id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenTooltip(openTooltip === id ? null : id);
                              }
                            }}
                          >
                            <img
                              src={cert.img}
                              alt={cert.title + " badge"}
                              className="h-12 w-12 rounded-full border border-slate-100 bg-white shadow-sm object-cover"
                              width={48}
                              height={48}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23ffffff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%23707b7c">Badge</text></svg>';
                              }}
                            />
                          </a>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setOpenTooltip(id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenTooltip(openTooltip === id ? null : id);
                              }
                            }}
                          >
                            <img
                              src={cert.img}
                              alt={cert.title + " badge"}
                              className="h-12 w-12 rounded-full border border-slate-100 bg-white shadow-sm object-cover"
                              width={48}
                              height={48}
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="100%" height="100%" fill="%23ffffff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="10" fill="%23707b7c">Badge</text></svg>';
                              }}
                            />
                          </div>
                        )}
                        <span
                          className={`absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-20 whitespace-nowrap rounded-md bg-slate-800 text-white text-xs font-medium px-2 py-1 transform-gpu transition duration-150 ${
                            openTooltip === id
                              ? "opacity-100 scale-100 pointer-events-auto"
                              : "opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 pointer-events-none"
                          }`}
                        >
                          {cert.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-4 text-lg text-slate-600 max-w-prose">
                I design and build user-centered, cloud-backed products and own
                their operation in production. I combine product thinking,
                full‑stack engineering, and systems/ops experience to deliver
                reliable, secure, scalable solutions. Seeking a Cloud Engineer
                role to design, deploy, and support scalable cloud
                infrastructure.
              </p>
            </div>
          </section>
        </div>{" "}
        {/* Close flex container here */}
        {/* 2-in-1: Professional Experience | AV Platform (responsive) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <section className="portfolio-reveal portfolio-delay-2 p-6 sm:p-10 bg-white rounded-2xl border border-neutral-200">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">
              Professional Summary
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-3 hover:shadow-lg transform-gpu transition hover:-translate-y-1">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  Product-focused Engineer
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-50 text-slate-700"
                    aria-hidden="true"
                  >
                    <FontAwesomeIcon icon={faGear} />
                  </span>
                </h3>
                <p className="mt-1 text-sm text-slate-700">
                  Designs and ships secure, polished digital products that solve
                  real user problems and scale cleanly.
                </p>
              </article>

              <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-3 hover:shadow-lg transform-gpu transition hover:-translate-y-1">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  Cloud & Infrastructure
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-50 text-slate-700"
                    aria-hidden="true"
                  >
                    <FontAwesomeIcon icon={faCloud} />
                  </span>
                </h3>
                <p className="mt-1 text-sm text-slate-700">
                  Architects scalable cloud systems and CI/CD automation across
                  AWS, GCP, and Azure for reliable delivery.
                </p>
              </article>

              <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col gap-3 hover:shadow-lg transform-gpu transition hover:-translate-y-1">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  Security-first Mindset
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded bg-slate-50 text-slate-700"
                    aria-hidden="true"
                  >
                    <FontAwesomeIcon icon={faShieldHalved} />
                  </span>
                </h3>
                <p className="mt-1 text-sm text-slate-700">
                  Integrates security and monitoring into engineering workflows;
                  experienced in vulnerability triage and incident response.
                </p>
              </article>
            </div>
          </section>

          <section className="portfolio-reveal portfolio-delay-3 p-6 sm:p-10 rounded-2xl border border-neutral-800 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white relative overflow-hidden shadow-lg">
            {/* Removed indigo accent; use AV-style animated blob for pulse motion */}
            <div className="pointer-events-none absolute av-discover-blob av-discover-blob-b z-9" />
            <div className="relative z-20">
              <h2 className="text-2xl font-bold tracking-tight text-white mb-4">
                ɅV Platform
              </h2>
              {/* AV description above the step cards (steps hidden below lg) */}
              <p className="text-sm text-slate-200 mb-4">
                ɅV is an AI-powered travel companion that senses your mood and
                recommends places and experiences tailored to how you feel —
                designed to help you discover moments that lift your spirits.
              </p>

              <div className="hidden lg:block mt-4 mb-6 text-sm text-slate-300">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">
                  ɅV features
                </h4>
                <ul className="grid grid-cols-2 gap-2">
                  <li className="flex items-start gap-2">
                    <span
                      className="inline-flex w-3 h-3 text-white/80 shrink-0 mt-1 items-center justify-center"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </span>
                    <span>Mood detection</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="inline-flex w-3 h-3 text-white/80 shrink-0 mt-1 items-center justify-center"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </span>
                    <span>Adaptive learning</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="inline-flex w-3 h-3 text-white/80 shrink-0 mt-1 items-center justify-center"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </span>
                    <span>Privacy-first controls</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span
                      className="inline-flex w-3 h-3 text-white/80 shrink-0 mt-1 items-center justify-center"
                      aria-hidden="true"
                    >
                      <svg
                        className="w-3 h-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </span>
                    <span>Context-aware suggestions</span>
                  </li>
                </ul>
              </div>

              <div className="mb-4 w-full hidden lg:block">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">
                  How ɅV works
                </h3>

                <div className="w-full flex items-center gap-3">
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/10 p-3 flex flex-col items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 font-bold text-lg">
                      1
                    </span>
                    <span className="mt-1 text-xs text-slate-200 text-center">
                      Select location
                    </span>
                  </div>
                  <div className="flex items-center justify-center text-slate-300 text-xl">
                    ›
                  </div>
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/10 p-3 flex flex-col items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 font-bold text-lg">
                      2
                    </span>
                    <span className="mt-1 text-xs text-slate-200 text-center">
                      Choose mood
                    </span>
                  </div>
                  <div className="flex items-center justify-center text-slate-300 text-xl">
                    ›
                  </div>
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/10 p-3 flex flex-col items-center gap-2">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 font-bold text-lg">
                      3
                    </span>
                    <span className="mt-1 text-xs text-slate-200 text-center">
                      Explore Places
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <a
                  href="/av"
                  target="av-platform"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open("/av", "av-platform");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-white/10 border border-white/20 text-white px-4 py-3 text-sm font-semibold shadow-sm hover:bg-white/20 transition"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full bg-emerald-300 shadow-sm"
                    aria-hidden="true"
                  />
                  Join ɅV
                </a>
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none z-0">
              <svg
                className="w-full h-full"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="g1" x1="0" x2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.02" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#g1)" />
              </svg>
            </div>
          </section>
        </div>
        {/* Tech Stack below both */}
        <section className="portfolio-reveal portfolio-delay-2 p-6 sm:p-10 bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl border border-neutral-200 mb-12">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-4">
            Technical Stack
          </h2>
          <TechStackGroups />
        </section>
        <section className="portfolio-reveal portfolio-delay-3 p-6 sm:p-10 bg-white rounded-2xl border border-neutral-200">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Professional Experience
          </h2>
          <div className="mt-4 grid gap-2 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {experiences.map((item) => (
              <article
                key={`${item.role}-${item.org}`}
                className="rounded-2xl border border-slate-100 bg-white p-3 sm:p-5 shadow-sm transform-gpu transition hover:-translate-y-1 hover:shadow-lg"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {item.period}
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  {item.role}
                </h3>
                <p className="text-sm font-medium text-slate-700">{item.org}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {item.impact}
                </p>
              </article>
            ))}
          </div>
        </section>
        {/* Removed Certifications section as requested */}
      </div>{" "}
      {/* Close main content wrapper */}
    </PortfolioLayout>
  );
}
