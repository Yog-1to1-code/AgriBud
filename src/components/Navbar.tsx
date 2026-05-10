"use client";
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Leaf, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav style={{
      width: '80px',
      height: '100vh',
      backgroundColor: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 0',
      zIndex: 10
    }}>
      <Link href="/dashboard" style={{ marginBottom: '3rem' }}>
        <Leaf size={32} color="var(--primary)" />
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1 }}>
        <Link href="/dashboard" title="Dashboard">
          <div style={{
            padding: '0.8rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: pathname.includes('/dashboard') ? 'var(--primary-light)' : 'transparent',
            color: pathname.includes('/dashboard') ? 'var(--primary)' : 'var(--border)',
            transition: 'all 0.2s'
          }}>
            <LayoutDashboard size={24} />
          </div>
        </Link>
        <Link href="/settings" title="Settings">
          <div style={{
            padding: '0.8rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: pathname.includes('/settings') ? 'var(--primary-light)' : 'transparent',
            color: pathname.includes('/settings') ? 'var(--primary)' : 'var(--border)',
            transition: 'all 0.2s'
          }}>
            <Settings size={24} />
          </div>
        </Link>
      </div>

      <button onClick={handleSignOut} title="Sign Out" style={{ color: 'var(--border)' }}>
        <LogOut size={24} />
      </button>
    </nav>
  );
}
