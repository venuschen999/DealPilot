import { cookies } from "next/headers";
import Link from "next/link";
import { auth, isGoogleConfigured } from "@/auth";
import { AlertIcon, CheckIcon, MailIcon } from "@/components/icons";
import { SubmitButton } from "@/components/SubmitButton";
import { emailSignIn, googleSignIn } from "./actions";
import {
  resolveSignInView,
  SIGN_IN_EMAIL_COOKIE,
  type SignInParams,
} from "./sign-in-view";

const card =
  "w-full max-w-[440px] self-start rounded-card border border-border bg-surface p-8";
const link = "font-medium text-primary hover:text-primary-hover";

export async function SignInCard({
  searchParams,
}: {
  searchParams: Promise<SignInParams>;
}) {
  const [params, session, cookieStore] = await Promise.all([
    searchParams,
    auth(),
    cookies(),
  ]);
  const view = resolveSignInView(params, Boolean(session?.user));
  const email =
    session?.user?.email ?? cookieStore.get(SIGN_IN_EMAIL_COOKIE)?.value ?? "";

  switch (view.kind) {
    case "signed-in":
      return <SignedIn email={email} callbackUrl={view.callbackUrl} />;
    case "check-email":
      return <CheckEmail email={email} callbackUrl={view.callbackUrl} />;
    case "link-expired":
      return <LinkExpired email={email} callbackUrl={view.callbackUrl} />;
    default:
      return (
        <SignInForm callbackUrl={view.callbackUrl} formError={view.formError} />
      );
  }
}

function SignInForm({
  callbackUrl,
  formError,
}: {
  callbackUrl: string;
  formError?: "email" | "generic";
}) {
  return (
    <section className={card} aria-labelledby="sign-in-title">
      {callbackUrl !== "/" && (
        <p className="mb-6 rounded-xl border border-primary-tint-border bg-primary-tint px-4 py-3 text-sm text-ink-2">
          Sign in to continue. You&apos;ll return to where you were right after.
        </p>
      )}
      <h1 id="sign-in-title" className="font-display text-[30px] font-bold">
        Sign in to DealPilot
      </h1>
      <p className="mt-2 text-base text-muted">
        New here? Signing in creates your account. Save products, keep your
        ranking preferences and see your recent searches on any device.
      </p>
      {formError === "generic" && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-deal-soft px-4 py-3 text-sm text-deal"
        >
          Something went wrong signing you in. Please try again.
        </p>
      )}

      {isGoogleConfigured && (
        <>
          <form action={googleSignIn} className="mt-6">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <SubmitButton variant="secondary" pendingLabel="Opening Google…">
              Continue with Google
            </SubmitButton>
          </form>
          <div className="my-5 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <EmailForm
        callbackUrl={callbackUrl}
        invalid={formError === "email"}
        label="Email me a sign-in link"
        className={isGoogleConfigured ? "" : "mt-6"}
      />
      <p className="mt-3 text-[13px] text-muted">
        No password needed. The link works once and expires in 24 hours.
      </p>

      <div className="mt-6 border-t border-border pt-6">
        <Link href="/" className={`text-[15px] ${link}`}>
          Continue as guest →
        </Link>
        <p className="mt-3 text-[13px] text-muted">
          Guests can search, rank and compare. By continuing you agree to the
          Terms and Privacy Policy.
        </p>
      </div>
    </section>
  );
}

function EmailForm({
  callbackUrl,
  invalid = false,
  defaultEmail = "",
  label,
  className = "",
}: {
  callbackUrl: string;
  invalid?: boolean;
  defaultEmail?: string;
  label: string;
  className?: string;
}) {
  return (
    <form action={emailSignIn} className={className} noValidate>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label htmlFor="email" className="block text-sm font-semibold text-ink-3">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={defaultEmail}
        placeholder="you@example.com"
        aria-invalid={invalid}
        aria-describedby={invalid ? "email-error" : undefined}
        className="mt-2 block min-h-12 w-full rounded-control border border-border-strong px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft aria-invalid:border-deal"
      />
      {invalid && (
        <p id="email-error" className="mt-2 text-sm text-deal">
          Enter a valid email address.
        </p>
      )}
      <div className="mt-4">
        <SubmitButton pendingLabel="Sending link…">{label}</SubmitButton>
      </div>
    </form>
  );
}

function StatusIcon({
  tone,
  children,
}: {
  tone: "match" | "deal" | "primary";
  children: React.ReactNode;
}) {
  const tones = {
    match: "bg-match-soft text-match",
    deal: "bg-deal-soft text-deal",
    primary: "bg-primary-soft text-primary",
  };
  return (
    <span
      className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function CheckEmail({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}) {
  return (
    <section className={`${card} text-center`} aria-labelledby="check-title">
      <StatusIcon tone="primary">
        <MailIcon />
      </StatusIcon>
      <h1 id="check-title" className="mt-5 font-display text-[26px] font-bold">
        Check your email
      </h1>
      <p className="mt-2 text-base text-muted" role="status">
        We sent a sign-in link to{" "}
        <strong className="text-ink">{email || "your email address"}</strong>.
        Open the link to finish signing in. It works once and expires in 24
        hours.
      </p>
      <Link
        href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className={`mt-6 inline-flex min-h-11 items-center ${link}`}
      >
        Use a different email
      </Link>
    </section>
  );
}

function LinkExpired({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}) {
  return (
    <section className={card} aria-labelledby="expired-title">
      <div className="text-center">
        <StatusIcon tone="deal">
          <AlertIcon />
        </StatusIcon>
        <h1
          id="expired-title"
          className="mt-5 font-display text-[26px] font-bold"
        >
          This link no longer works
        </h1>
        <p className="mt-2 text-base text-muted">
          Sign-in links work once and expire after 24 hours. Send yourself a new
          one.
        </p>
      </div>
      <EmailForm
        callbackUrl={callbackUrl}
        defaultEmail={email}
        label="Send a new link"
        className="mt-6"
      />
      <p className="mt-4 text-center">
        <Link
          href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className={`inline-flex min-h-11 items-center ${link}`}
        >
          Other sign-in options
        </Link>
      </p>
    </section>
  );
}

function SignedIn({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}) {
  const label = callbackUrl.startsWith("/results")
    ? "Continue to results"
    : "Continue";
  return (
    <section
      className={`${card} text-center`}
      aria-labelledby="signed-in-title"
    >
      <StatusIcon tone="match">
        <CheckIcon />
      </StatusIcon>
      <h1
        id="signed-in-title"
        className="mt-5 font-display text-[26px] font-bold"
      >
        You&apos;re signed in
      </h1>
      <p className="mt-2 text-base text-muted">
        Signed in as <strong className="text-ink">{email}</strong>.
      </p>
      <Link
        href={callbackUrl}
        className="mt-6 inline-flex min-h-12 items-center rounded-control bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-hover"
      >
        {label}
      </Link>
      <p className="mt-3 text-sm text-muted">You can also close this tab.</p>
    </section>
  );
}
