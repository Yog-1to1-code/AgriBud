'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function signInWithGoogle(formData?: FormData) {
  const supabase = await createClient()

  // Retrieve origin for the callback URL securely
  // To avoid headers() issues, it's often safer to rely on NEXT_PUBLIC_SITE_URL or default to localhost
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  })

  if (error) {
    console.error('OAuth Error:', error)
    return; // Return void instead of an object to satisfy form action types
  }

  if (data.url) {
    redirect(data.url) // Navigate to Google Consent Screen
  }
}
