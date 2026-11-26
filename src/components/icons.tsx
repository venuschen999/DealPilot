// Decorative stroke icons; callers give the surrounding control its label.
type IconProps = { className?: string };

export function LogoMark({ className = "size-7" }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-lg bg-primary ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="white" strokeWidth="2.2">
        <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" strokeLinejoin="round" />
        <path d="m10 13 4.5-4.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function HeartIcon({ className = "size-4", filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ className = "size-4" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className = "size-6" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className = "size-6" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5v.01" strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon({ className = "size-6" }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinejoin="round" />
    </svg>
  );
}
