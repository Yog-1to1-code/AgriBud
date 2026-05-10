"use client";
import React from 'react';
import { Sprout, ShieldCheck, ArrowLeft } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function LoginPage() {
  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const origin = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
      },
    });
  };

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      <main className="main-container" style={{ flexDirection: 'row', alignItems: 'center' }}>
        
        {/* Visual Side */}
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', backgroundColor: 'var(--bg-hover)', borderRight: '1.5px solid var(--border)' }}>
          <div style={{ textAlign: 'center' }}>
             <div style={{ width: '120px', height: '120px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2.5rem auto', boxShadow: 'var(--shadow-lg)', border: '3px solid var(--primary-light)' }}>
                <Sprout size={60} color="var(--primary-light)" />
             </div>
             <h2 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '1.5rem' }}>Professional Farming</h2>
             <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '350px', margin: '0 auto' }}>
                Join thousands of Indian farmers using AI to protect their crops.
             </p>
          </div>
        </div>

        {/* Login Side */}
        <div style={{ flex: 1, padding: '4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div className="glass animate-fade-in" style={{ 
            padding: '4rem', 
            borderRadius: 'var(--radius-xl)', 
            maxWidth: '450px', 
            width: '100%',
            backgroundColor: 'white',
            border: '1.5px solid var(--border)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.05)'
          }}>
            <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
              <h1 style={{ fontSize: '2.2rem', marginBottom: '0.8rem' }}>Welcome Back</h1>
              <p style={{ color: 'var(--text-muted)' }}>Secure access to your agricultural hub.</p>
            </div>

            <button 
              onClick={handleGoogleLogin}
              style={{ 
                width: '100%', 
                padding: '1.2rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1.5px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                fontSize: '1.05rem',
                fontWeight: 600,
                color: 'var(--text-main)',
                backgroundColor: 'white',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'white'; }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            
            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
               <Link href="/" style={{ color: 'var(--primary-light)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <ArrowLeft size={18} /> Return to Home
               </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
