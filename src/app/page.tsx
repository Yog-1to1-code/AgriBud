"use client";
import React from 'react';
import Link from 'next/link';
import { Leaf, ArrowRight, ShieldCheck, Zap, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      <main className="main-container" style={{ flexDirection: 'row', alignItems: 'center' }}>
        
        {/* Left Side */}
        <div style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', backgroundColor: 'var(--bg-hover)', borderRight: '1px solid var(--border)' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '600px', textAlign: 'center' }}>
            <div style={{ 
              width: '100%', 
              aspectRatio: '16/10', 
              backgroundColor: 'white', 
              borderRadius: 'var(--radius-xl)', 
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2rem',
              padding: '2rem',
              border: '4px solid var(--primary)'
            }}>
              <Leaf size={120} color="var(--primary)" strokeWidth={1.5} />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1.2rem' }}>Healthy Crops</h4>
                <div style={{ width: '40px', height: '2px', backgroundColor: 'var(--accent)', margin: '0.5rem auto' }} />
                <h4 style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>Prosperous Farms</h4>
              </div>
            </div>
            <div className="glass" style={{ position: 'absolute', top: '-20px', right: '-20px', padding: '1rem 1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <ShieldCheck color="var(--primary-light)" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>99% Accuracy</span>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div style={{ flex: 1, padding: '6rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2rem' }}>
              <div style={{ padding: '0.6rem', backgroundColor: 'var(--primary-glow)', borderRadius: 'var(--radius-md)' }}>
                <Leaf size={24} color="var(--primary-light)" />
              </div>
              <span style={{ color: 'var(--primary)', fontWeight: 700, letterSpacing: '2px', fontSize: '0.9rem', textTransform: 'uppercase' }}>{t('appName')} Assistant</span>
            </div>

            <h1 style={{ fontSize: '4rem', marginBottom: '2rem', maxWidth: '600px' }}>
              AI-Based Crop Disease <span style={{ color: 'var(--primary-light)' }}>Diagnosis</span> & Treatment
            </h1>
            
            <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '3.5rem', lineHeight: 1.6, maxWidth: '550px' }}>
              Empowering Indian farmers with instant, expert-level insights. 
              Bridging the gap between detection and treatment using next-gen Gemini AI.
            </p>

            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <Link href="/login" className="btn-primary" style={{ padding: '1.2rem 3rem', fontSize: '1.1rem' }}>
                Start Free Diagnosis <ArrowRight size={22} />
              </Link>
            </div>

            <div style={{ marginTop: '5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '3rem' }}>
              <div>
                <Zap size={28} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>Instant Result</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Diagnosis in under 5 seconds for critical care.</p>
              </div>
              <div>
                <Globe size={28} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>Multilingual</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Support for all major Indian languages.</p>
              </div>
              <div>
                <ShieldCheck size={28} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)' }}>Grounded AI</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>Verified suggestions against expert databases.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
