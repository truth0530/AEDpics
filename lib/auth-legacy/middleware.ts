import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Skip authentication for public static HTML files
  const pathname = request.nextUrl.pathname;
  if (pathname === "/presentation.html" || pathname === "/tutorial.html") {
    return supabaseResponse;
  }

  // If the env vars are not set, skip middleware check. You can remove this
  // once you setup the project.
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // 로그인 상태에 따른 루트 경로 처리
  if (request.nextUrl.pathname === "/") {
    if (user) {
      // 로그인된 사용자는 대시보드로 리다이렉트
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // 로그아웃된 사용자는 랜딩 페이지 유지 (supabaseResponse 반환)
    return supabaseResponse;
  }

  // 공개 경로 목록 (인증 불필요)
  const publicPaths = [
    "/login",
    "/auth",
    "/api",
    "/tutorial",
    "/map",
    "/aed-guidelines",
    "/aed-storage-specifications",
    "/aed-installation-targets",
    "/aed-battery-lifespan",
    "/presentation",
    "/terms",
    "/privacy"
  ];

  // 인증이 필요한 경로에서 로그인되지 않은 경우
  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname === path ||
    request.nextUrl.pathname.startsWith(path + "/") ||
    request.nextUrl.pathname.startsWith("/" + path.slice(1))
  );

  if (!user && !isPublicPath) {
    // 인증되지 않은 사용자를 로그인 페이지로 리다이렉트 (원래 경로를 쿼리로 전달)
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
