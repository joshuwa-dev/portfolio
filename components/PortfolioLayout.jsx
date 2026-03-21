"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { faEnvelope } from "@fortawesome/free-regular-svg-icons";
import { faGithub, faLinkedin } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Portfolio" },
    { href: "/contact", label: "Contact" },
  ];

  return (
    <nav className="fixed inset-x-0 top-0 z-[130] px-2 pt-3 sm:px-4 sm:pt-4 h-16 sm:h-20 flex items-center">
      <div className="mx-auto flex max-w-6xl w-full items-center justify-between rounded-2xl border border-white/50 bg-white/80 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 shadow-lg backdrop-blur h-full gap-2 sm:gap-4">
        <div>
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Joshua Oyebode
          </p>
          <p className="text-sm sm:text-base font-bold text-slate-900">
            Software & Security Engineer
          </p>
        </div>

        <ul className="flex items-center gap-1.5 sm:gap-2 rounded-full border border-slate-200 bg-white p-1 sm:p-1.5">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`block rounded-full px-2 py-1 text-sm sm:text-base font-semibold transition md:px-4 ${
                  pathname === link.href
                    ? "bg-slate-900 !text-white visited:!text-white active:!text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default function PortfolioLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 antialiased text-slate-800">
      <Navbar />

      <main className="relative mx-auto max-w-6xl w-full px-4 pb-14 pt-28 md:px-6 lg:pt-32">
        {children}
      </main>

      <footer className="w-full">
        <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 lg:px-8 pb-6 sm:pb-10">
          <div className="rounded-2xl border border-slate-200/40 bg-white/80 px-4 sm:px-6 py-3 sm:py-4 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-2 sm:gap-4 max-sm:flex-col max-sm:items-start">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                Building secure and useful products with clarity.
              </p>

              <div className="flex items-center gap-2 sm:gap-3 text-slate-700">
                <a href="mailto:cobargram@gmail.com" aria-label="Email">
                  <span className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:-translate-y-0.5">
                    <FontAwesomeIcon icon={faEnvelope} />
                  </span>
                </a>
                <a
                  href="https://www.linkedin.com/in/joshuwa-dev/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:-translate-y-0.5">
                    <FontAwesomeIcon icon={faLinkedin} />
                  </span>
                </a>
                <a
                  href="https://github.com/joshuwa-dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white transition hover:-translate-y-0.5">
                    <FontAwesomeIcon icon={faGithub} />
                  </span>
                </a>
              </div>
            </div>

            <p className="mt-2 sm:mt-4 text-[10px] sm:text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
              © 2026 Joshua Oyebode. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
