import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "regent_session";

/**
 * Edge-safe gate: unauthenticated requests (no session cookie) are redirected to
 * /login; the real signature check + permission enforcement happen in the Node
 * layout/route handlers. Also stamps x-pathname so the server layout can gate the
 * route by permission.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const headers = new Headers(req.headers);
  headers.set("x-pathname", pathname);

  const isPublic = pathname === "/login" || pathname.startsWith("/api/auth");
  const isApi = pathname.startsWith("/api");
  if (!isPublic && !isApi && !req.cookies.get(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
