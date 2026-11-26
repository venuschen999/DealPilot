"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { emailSignInSchema, SIGN_IN_EMAIL_COOKIE } from "./sign-in-view";

const signInUrl = (query: string, callbackUrl: string) =>
  `/sign-in?${query}&callbackUrl=${encodeURIComponent(callbackUrl)}`;

export async function emailSignIn(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl"));
  const parsed = emailSignInSchema.safeParse({
    email: formData.get("email"),
    callbackUrl,
  });
  if (!parsed.success) redirect(signInUrl("error=EmailInvalid", callbackUrl));

  const { email } = parsed.data;
  (await cookies()).set(SIGN_IN_EMAIL_COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/sign-in",
    maxAge: 24 * 60 * 60,
  });

  try {
    await signIn("resend", { email, redirectTo: callbackUrl, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(signInUrl(`error=${error.type}`, callbackUrl));
    }
    throw error;
  }
  redirect(signInUrl("sent=1", callbackUrl));
}

export async function googleSignIn(formData: FormData) {
  // signIn throws Next's redirect to Google; it must not be caught here.
  await signIn("google", {
    redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
  });
}
