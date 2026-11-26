import { connection } from "next/server";
import { auth } from "@/auth";

// Auth.js draws random values before it reads the session cookie. Under
// cacheComponents that must wait for the request, not run during prerender.
export async function getSession() {
  await connection();
  return auth();
}
