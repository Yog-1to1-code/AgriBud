"use client";
import React, { useState } from 'react';
import { Sprout, ShieldCheck, ArrowLeft, UserCircle2, Loader2, Play } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDemo } from '@/contexts/DemoContext';

export default function LoginPage() {
  const router = useRouter();
  const { enableDemoMode } = useDemo();
  const [isGuestLoading, setIsGuestLoading] = useState(false);

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

  const handleGuestLogin = async () => {
    setIsGuestLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      
      router.push('/dashboard');
    } catch (err: any) {
      console.error("Guest login error:", err);
      alert("Guest login failed. Please ensure 'Anonymous Sign-ins' are enabled in your Supabase Auth Providers settings.");
    } finally {
      setIsGuestLoading(false);
    }
  };

  const handleDemoMode = () => {
    enableDemoMode();
    router.push('/dashboard');
  };

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      <main className="main-container" style={{ overflow: 'auto' }}>
        
        {/* Visual Side — Desktop Only */}
        <div className="mobile-hidden" style={{ 
          flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          padding: '3rem', backgroundColor: 'var(--bg-hover)', borderRight: '1.5px solid var(--border)' 
        }}>
          <div style={{ textAlign: 'center' }}>
             <div style={{ 
               width: '100px', height: '100px', backgroundColor: 'white', borderRadius: '50%', 
               display: 'flex', alignItems: 'center', justifyContent: 'center', 
               margin: '0 auto 2rem auto', boxShadow: 'var(--shadow-lg)', 
               border: '3px solid var(--primary-light)' 
             }}>
                <Sprout size={50} color="var(--primary-light)" />
             </div>
             <h2 style={{ fontSize: '2.2rem', color: 'var(--primary)', marginBottom: '1.25rem' }}>Professional Farming</h2>
             <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', maxWidth: '320px', margin: '0 auto' }}>
                Join thousands of Indian farmers using AI to protect their crops.
             </p>
          </div>
        </div>

        {/* Login Side */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center',
          padding: 'clamp(1.5rem, 5vw, 4rem)',
          overflow: 'auto',
          minHeight: 0,
        }}>
          <div className="glass animate-fade-in" style={{ 
            padding: 'clamp(1.5rem, 4vw, 3.5rem)', 
            borderRadius: 'var(--radius-xl)', 
            maxWidth: '420px', 
            width: '100%',
            backgroundColor: 'white',
            border: '1.5px solid var(--border)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.05)'
          }}>
            {/* Mobile-only logo */}
            <div className="mobile-flex" style={{ 
              display: 'none', justifyContent: 'center', marginBottom: '1.5rem' 
            }}>
              <div style={{ 
                width: '56px', height: '56px', backgroundColor: 'var(--bg-hover)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--primary-light)' 
              }}>
                <Sprout size={28} color="var(--primary-light)" />
              </div>
            </div>

            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <h1 style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', marginBottom: '0.6rem' }}>Welcome Back</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Secure access to your agricultural hub.</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Google Login */}
              <button 
                onClick={handleGoogleLogin}
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  backgroundColor: 'white',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'white'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>

              {/* Guest Login */}
              <button 
                onClick={handleGuestLogin}
                disabled={isGuestLoading}
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  backgroundColor: 'var(--bg-surface)',
                  transition: 'all 0.2s',
                  opacity: isGuestLoading ? 0.7 : 1
                }}
                onMouseOver={(e) => { if (!isGuestLoading) { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; } }}
                onMouseOut={(e) => { if (!isGuestLoading) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--bg-surface)'; } }}
              >
                {isGuestLoading ? <Loader2 className="animate-spin" size={20} color="var(--primary)" /> : <UserCircle2 size={20} color="var(--primary)" />}
                Continue as Guest
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', margin: '0.25rem 0' }}>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
                <span style={{ padding: '0 0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>OR</span>
                <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }}></div>
              </div>

              {/* Demo Mode — The Hero Button */}
              <button 
                onClick={handleDemoMode}
                style={{ 
                  width: '100%', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '2px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.8rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: '#b45309',
                  backgroundColor: 'rgba(255, 153, 51, 0.08)',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 153, 51, 0.15)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 153, 51, 0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <Play size={18} fill="#b45309" />
                Launch Demo Mode
              </button>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '-0.25rem' }}>
                No account needed — explore with sample data
              </p>
            </div>
            
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #f3f4f6', textAlign: 'center' }}>
               <Link href="/" style={{ color: 'var(--primary-light)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <ArrowLeft size={16} /> Return to Home
               </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}