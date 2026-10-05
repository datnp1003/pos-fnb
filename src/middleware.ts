import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const MODULE_ROUTES: Record<string, string> = {
  "/order": "order",
  "/inventory": "inventory",
  "/cash": "cash",
  "/reports": "reports",
  "/settings": "settings",
  "/dashboard": "dashboard",
};

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  // Allow public routes
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/_next")) {
    return NextResponse.next();
  }

  // Redirect to login if not authenticated
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check module permission
  const session = token;
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
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|logo.png|banner.png|manifest.json).*)"],
};
