import { Suspense } from "react";
import { requireUser } from "@/lib/auth/guards";

// Placeholder until the wishlist (US-7); here to prove the sign-in guard.
export default function WishlistPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10">
      <h1 className="font-display text-[34px] font-bold">Wishlist</h1>
      <Suspense fallback={<p className="mt-2 text-muted">Loading…</p>}>
        <WishlistContent />
      </Suspense>
    </main>
  );
}

async function WishlistContent() {
  const user = await requireUser("/wishlist");
  return (
    <p className="mt-2 text-muted">
      Signed in as {user.email}. Saved products will appear here.
    </p>
  );
}
