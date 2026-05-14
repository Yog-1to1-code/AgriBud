import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-browser cookies.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes — always accessible
  const publicPaths = ['/', '/login', '/auth']
  const isPublicRoute = publicPaths.some(p => 
    request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + '/')
  )

  if (isPublicRoute) {
    return supabaseResponse
  }

  // Protected routes — need auth OR demo mode
  if (!user) {
    // API routes: return 401 (demo mode doesn't call real APIs)
    if (request.nextUrl.pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Page routes: allow if demo mode is likely active
    // We check via a custom header or cookie set by client-side demo activation
    // Since localStorage isn't available in middleware, we set a cookie when demo starts
    const demoFlag = request.cookies.get('agribud_demo_mode')?.value
    if (demoFlag === 'true') {
      return supabaseResponse
    }
    
    // Not authenticated and not demo — redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
