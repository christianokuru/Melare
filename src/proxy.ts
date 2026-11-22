import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Optimistic gate only. Real authorization happens on the server in every page, action and route.
export function proxy(req: NextRequest) {
  if (getSessionCookie(req)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/admin")) return new NextResponse("Not found", { status: 404 }); // don't reveal admin to guests
  const url = new URL("/sign-in", req.url);
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/account/:path*", "/admin/:path*"] };
