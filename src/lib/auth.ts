import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { DEFAULT_PASSWORD, hashPassword, verifyPassword } from "@/lib/password";
import type { Role } from "@/types";

export function isAllowedEmail(email: string, domain: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  return email.slice(at + 1).toLowerCase() === domain.toLowerCase();
}

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "vti.com.vn";

export async function authorizeCredentials(
  email: unknown,
  password: unknown,
): Promise<{ id: string; email: string; name: string | null; role: Role } | null> {
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return null;
  }
  if (!isAllowedEmail(email, ALLOWED_DOMAIN)) return null;

  const user = await db.user.findUnique({ where: { email } });
  if (!user?.password) return null;

  const valid = await verifyPassword(password, user.password);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

export async function backfillPasswordForNewUser(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { password: await hashPassword(DEFAULT_PASSWORD) },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db as never),
  // Trust the request host ONLY when explicitly enabled for the deployment
  // (self-hosted behind a trusted reverse proxy / internal network). Defaults
  // off so an untrusted host cannot spoof the Host header to hijack OAuth
  // callback URLs. Set AUTH_TRUST_HOST=true in that environment.
  trustHost: process.env.AUTH_TRUST_HOST === "true",
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: (credentials) => authorizeCredentials(credentials?.email, credentials?.password),
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ user }) {
      return !!user.email && isAllowedEmail(user.email, ALLOWED_DOMAIN);
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: Role }).role ?? "MEMBER";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as Role) ?? "MEMBER";
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id) await backfillPasswordForNewUser(user.id);
    },
  },
});
