import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_OPTIONS, cookieLife, supabaseKey, supabaseUrl } from "@/lib/config";

/**
 * Before every page: keeps the organiser's session fresh (Supabase renews it here), sends anyone
 * signed out to the sign-in page, and a signed-in organiser past it. Only the first line of
 * defence: each page and action checks again, and the database checks last.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const sb = createServerClient(supabaseUrl(), supabaseKey(), {
    cookieOptions: COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, cookieLife(options)));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });
  const {
    data: { user },
  } = await sb.auth.getUser();

  const path = request.nextUrl.pathname;
  const signInPage = path === "/login";
  const to = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };
  if (!user && !signInPage) {
    const back = path + request.nextUrl.search;
    return to("/login", path === "/" ? "" : `?next=${encodeURIComponent(back)}`);
  }
  if (user && signInPage) return to("/");
  return response;
}

export const config = {
  // Everything but the app's own files and images
  matcher: ["/((?!_next/static|_next/image|assets/|favicon\\.ico).*)"],
};
