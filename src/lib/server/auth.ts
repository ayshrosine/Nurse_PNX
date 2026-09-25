import 'server-only';
import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import type {} from '@auth/core/jwt';
import type { Role } from '@/types';
import * as userService from './services/userService';

declare module 'next-auth' {
  interface Session {
    user: { id: string; role: Role } & DefaultSession['user'];
  }
}
declare module '@auth/core/jwt' {
  interface JWT {
    uid?: string;
    // Cached for UX only (e.g. proxy redirects). Every authorization decision re-reads the role from Postgres.
    role?: Role;
  }
}

/**
 * Email-only login for local development and automated tests, because Google OAuth needs real credentials
 * and a public callback URL. It can never be active in production builds, and it can only sign in as an
 * existing user or create a STUDENT — it never grants ADMIN.
 */
export const devLoginEnabled = process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_LOGIN === 'true';
export const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const devCredentials = z.object({ email: z.email().max(254), name: z.string().max(100).optional() });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    ...(devLoginEnabled
      ? [
          Credentials({
            id: 'dev',
            name: 'Development login',
            credentials: { email: {}, name: {} },
            async authorize(raw) {
              const parsed = devCredentials.safeParse(raw);
              if (!parsed.success) return null;
              const user = await userService.upsertForDevLogin(parsed.data.email.toLowerCase(), parsed.data.name);
              if (!user || user.status !== 'ACTIVE') return null;
              return { id: user.id, name: user.name, email: user.email };
            },
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'google') {
        // Only Google-verified identities are accepted; email/sub come from the verified ID token.
        if (!profile?.email || profile.email_verified !== true || !account.providerAccountId) return false;
        const user = await userService.upsertFromGoogle({
          googleId: account.providerAccountId,
          email: profile.email.toLowerCase(),
          name: typeof profile.name === 'string' ? profile.name : '',
        });
        if (!user || user.status !== 'ACTIVE') return '/login?error=AccessDenied';
        return true;
      }
      return account?.provider === 'dev' && devLoginEnabled;
    },
    async jwt({ token, account, user }) {
      if (account) {
        const dbUser =
          account.provider === 'google'
            ? await userService.findByGoogleId(account.providerAccountId)
            : user?.id
              ? await userService.findById(user.id)
              : null;
        if (!dbUser) return null;
        token.uid = dbUser.id;
        token.role = dbUser.role;
        token.name = dbUser.name;
        token.email = dbUser.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid;
        session.user.role = token.role ?? 'STUDENT';
      }
      return session;
    },
  },
});
