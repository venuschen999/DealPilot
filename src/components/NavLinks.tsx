"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Search" },
  { href: "/results", label: "Results" },
  { href: "/compare", label: "Compare" },
];

// Client component only to know the current path for the active pill.
export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map(({ href, label }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium ${
              active ? "bg-primary-soft text-primary" : "text-ink-3 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
