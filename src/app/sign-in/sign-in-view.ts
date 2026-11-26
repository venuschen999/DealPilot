import { z } from "zod";
import { safeCallbackUrl } from "@/lib/auth/callback-url";

export const emailSignInSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  callbackUrl: z
    .unknown()
    .optional()
    .transform((value) => safeCallbackUrl(value)),
});

type Param = string | string[] | undefined;
export type SignInParams = {
  sent?: Param;
  error?: Param;
  callbackUrl?: Param;
};

export type SignInView =
  | { kind: "signed-in" | "check-email" | "link-expired"; callbackUrl: string }
  | { kind: "form"; callbackUrl: string; formError?: "email" | "generic" };

const first = (value: Param) => (Array.isArray(value) ? value[0] : value);

// Auth.js redirects every failure to /sign-in?error=<code>; Verification is
// the code for an expired or already-used magic link.
export function resolveSignInView(
  params: SignInParams,
  signedIn: boolean,
): SignInView {
  const callbackUrl = safeCallbackUrl(first(params.callbackUrl));
  const error = first(params.error);

  if (signedIn) return { kind: "signed-in", callbackUrl };
  if (error === "Verification") return { kind: "link-expired", callbackUrl };
  if (error === "EmailInvalid")
    return { kind: "form", callbackUrl, formError: "email" };
  if (error) return { kind: "form", callbackUrl, formError: "generic" };
  if (first(params.sent) === "1") return { kind: "check-email", callbackUrl };
  return { kind: "form", callbackUrl };
}
