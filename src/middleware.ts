import NextAuth from "next-auth";
import authConfig from "./lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const MODULE_ROUTES: Record<string, string> = {
  "/order": "order",
  "/inventory": "inventory",
  "/cash": "cash",
  "/reports": "reports",
  "/settings": "settings",
  "/dashboard": "dashboard",
};

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check module permission
  const session = req.auth.user;
  const permissions: string[] = (() => {
    try { return JSON.parse(session.permissions || "[]"); } catch { return []; }
  })();
  const scopes: string[] = (() => {
    try { return JSON.parse(session.scopes || "[]"); } catch { return []; }
  })();

  // "*" means admin — allow all
  if (permissions.includes("*") || scopes.includes("*")) {
    return NextResponse.next();
  }

  // Find target module
  let targetModule = "";
  for (const [prefix, mod] of Object.entries(MODULE_ROUTES)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      targetModule = mod;
      break;
    }
  }

  // No specific module → allow
  if (!targetModule) return NextResponse.next();

  // Check scope access
  if (!scopes.includes(targetModule)) {
    const firstModule = scopes[0];
    const fallback = firstModule ? `/${firstModule}` : "/order";
    if (pathname === fallback || pathname.startsWith(fallback + "/")) return NextResponse.next();
    return NextResponse.redirect(new URL(fallback, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|banner.png|manifest.json).*)"],
};
