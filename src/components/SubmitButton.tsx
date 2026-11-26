"use client";

import { useFormStatus } from "react-dom";

const VARIANTS = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-ink hover:bg-bg",
};

// Client component only for the pending state, so double submits can't send
// two magic links.
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: keyof typeof VARIANTS;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex min-h-12 w-full items-center justify-center rounded-control px-5 text-[15px] font-semibold disabled:opacity-60 ${VARIANTS[variant]}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
