import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="flex flex-1 justify-center px-6 py-14">
      <section className="w-full max-w-[440px] self-start rounded-card border border-border bg-surface p-8 text-center">
        <p className="text-sm font-semibold text-deal">403</p>
        <h1 className="mt-2 font-display text-[26px] font-bold">
          You don&apos;t have access to this page
        </h1>
        <p className="mt-2 text-base text-muted">
          This area is for DealPilot admins only.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-12 items-center rounded-control bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-hover"
        >
          Back to search
        </Link>
      </section>
    </main>
  );
}
