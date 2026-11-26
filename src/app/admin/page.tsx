import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/guards";

// Placeholder until the admin dashboard (US-9); here to prove the role check.
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10">
      <h1 className="font-display text-[34px] font-bold">Admin</h1>
      <Suspense fallback={<p className="mt-2 text-muted">Loading…</p>}>
        <AdminContent />
      </Suspense>
    </main>
  );
}

async function AdminContent() {
  const admin = await requireAdmin("/admin");
  return (
    <p className="mt-2 text-muted">
      Signed in as {admin.email} with the admin role.
    </p>
  );
}
