import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import { safeCallbackUrl } from "./callback-url";

// The real access checks (CLAUDE.md): every protected page, route handler
// and server action calls one of these. proxy.ts is only a fast pre-check.
export async function requireUser(currentPath: string) {
  const session = await auth();
  if (!session?.user) {
    const callbackUrl = encodeURIComponent(safeCallbackUrl(currentPath));
    redirect(`/sign-in?callbackUrl=${callbackUrl}`);
  }
  return session.user;
}

export async function requireAdmin(currentPath: string) {
  const user = await requireUser(currentPath);
  if (user.role !== "ADMIN") forbidden();
  return user;
}
