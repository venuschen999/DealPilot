import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInCard } from "./SignInCard";

export const metadata: Metadata = { title: "Sign in · DealPilot" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="flex flex-1 justify-center px-6 py-14">
      {/* Query params and the session are request-time data (cacheComponents). */}
      <Suspense
        fallback={
          <div className="h-[560px] w-full max-w-[440px] rounded-card border border-border bg-surface" />
        }
      >
        <SignInCard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
