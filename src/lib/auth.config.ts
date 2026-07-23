import type { NextAuthConfig } from "next-auth";

export default {
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.username = user.username!;
        token.role = user.role!;
        token.permissions = user.permissions!;
        token.scopes = user.scopes!;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id!;
        session.user.username = token.username!;
        session.user.role = token.role!;
        session.user.permissions = token.permissions!;
        session.user.scopes = token.scopes!;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
} satisfies NextAuthConfig;
