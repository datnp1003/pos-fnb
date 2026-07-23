import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";
import authConfig from "./auth.config";
import "./auth-types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const { username, password } = credentials as {
          username: string;
          password: string;
        };

        const user = await db.user.findUnique({
          where: { username },
          include: { role: true },
        });

        if (!user) return null;

        const isValid = await compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role.name,
          permissions: user.role.permissions,
          scopes: user.role.scopes || "[]",
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) {
      try {
        await db.loginLog.create({
          data: { userId: user.id, username: user.username || user.name || "unknown", success: true },
        });
      } catch { /* silent */ }
    },
  },
});
