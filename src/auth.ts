import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { sendMagicLink } from "@/lib/auth/magic-link-email";
import { prisma } from "@/lib/db/prisma";

const ONE_DAY_SECONDS = 24 * 60 * 60;

// Google needs real OAuth credentials; without them the button is hidden
// rather than failing at click time.
export const isGoogleConfigured = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // Database sessions so signing out deletes the session row (PRD US-8).
  session: { strategy: "database" },
  providers: [
    ...(isGoogleConfigured ? [Google] : []),
    Resend({
      // Our sendVerificationRequest does the sending; the key is read there.
      apiKey: process.env.AUTH_RESEND_KEY ?? "unused-in-development",
      from: process.env.EMAIL_FROM,
      maxAge: ONE_DAY_SECONDS,
      sendVerificationRequest: ({ identifier, url }) =>
        sendMagicLink(
          { to: identifier, url },
          {
            nodeEnv: process.env.NODE_ENV,
            apiKey: process.env.AUTH_RESEND_KEY,
            from: process.env.EMAIL_FROM,
          },
        ),
    }),
  ],
  pages: { signIn: "/sign-in", verifyRequest: "/sign-in", error: "/sign-in" },
  callbacks: {
    // Role comes from the database row on every request, never from the client.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role ?? "SHOPPER";
      return session;
    },
  },
});
