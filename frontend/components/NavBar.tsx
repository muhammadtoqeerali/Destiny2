"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export default function NavBar({
  section,
  links,
}: {
  section: "doctor" | "admin";
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  const accent = section === "doctor" ? "fjord" : "teal";

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/85 border-b border-fjord-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5 group">
            <span
              className={clsx(
                "h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-card",
                accent === "fjord" ? "bg-fjord-600" : "bg-teal-600"
              )}
            >
              FI
            </span>
            <span className="font-semibold text-fjord-950 tracking-tight">
              Frailty Insight
              <span className="text-fjord-700/50 font-normal">
                {" "}
                / {section === "doctor" ? "Clinician" : "Admin"}
              </span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={clsx(
                    "px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? accent === "fjord"
                        ? "bg-fjord-50 text-fjord-700"
                        : "bg-teal-50 text-teal-700"
                      : "text-fjord-700/70 hover:text-fjord-900 hover:bg-sand-100"
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/"
            className="text-sm text-fjord-700/60 hover:text-fjord-900 transition-colors"
          >
            ← Home
          </Link>
        </div>
      </div>
    </header>
  );
}
