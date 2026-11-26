import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions/auth";
import { auth } from "@/auth";
import { initialsFor } from "@/lib/auth/initials";
import { HeartIcon, LogoMark, ShieldIcon } from "./icons";
import { NavLinks } from "./NavLinks";

export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link href="/" className="flex min-h-11 items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold text-ink">
            DealPilot
          </span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <NavLinks />
          {/* Reading the session is request-time data, so it streams in
              (cacheComponents); the placeholder keeps the layout steady. */}
          <Suspense
            fallback={
              <span className="inline-block h-11 w-24" aria-hidden="true" />
            }
          >
            <AccountNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccountNav() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="ml-2 inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-[15px] font-semibold text-white hover:bg-primary-hover"
      >
        Sign in
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/wishlist"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium text-ink-3 hover:text-ink"
      >
        <HeartIcon className="size-4 text-heart" />
        Wishlist
      </Link>
      {user.role === "ADMIN" && (
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-medium text-ink-3 hover:text-ink"
        >
          <ShieldIcon />
          Admin
        </Link>
      )}
      <span
        title={user.email ?? undefined}
        className="ml-1 inline-flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary"
      >
        <span className="sr-only">Signed in as {user.email}</span>
        <span aria-hidden="true">{initialsFor(user.name, user.email)}</span>
      </span>
      <form action={signOutAction}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-control px-3 text-[15px] font-medium text-ink-3 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </>
  );
}
