"use client";
import React from 'react';
import Link from 'next/link';
import { Leaf, ArrowRight, ShieldCheck, Zap, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Home() {
  const { t } = useLanguage();

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      <main className="main-container" style={{ overflow: 'auto' }}>
        
        {/* Left Visual Panel — Desktop Only */}
        <div className="mobile-hidden" style={{ 
          flex: 1, 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          padding: '3rem', 
          backgroundColor: 'var(--bg-hover)', 
          borderRight: '1px solid var(--border)' 
        }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
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
              gap: '1.5rem',
              padding: '2rem',
              border: '4px solid var(--primary)'
            }}>
              <Leaf size={100} color="var(--primary)" strokeWidth={1.5} />
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1.1rem' }}>Healthy Crops</h4>
                <div style={{ width: '40px', height: '2px', backgroundColor: 'var(--accent)', margin: '0.5rem auto' }} />
                <h4 style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>Prosperous Farms</h4>
              </div>
            </div>
            <div className="glass" style={{ 
              position: 'absolute', top: '-15px', right: '-15px', 
              padding: '0.8rem 1.2rem', borderRadius: 'var(--radius-lg)', 
              display: 'flex', alignItems: 'center', gap: '0.6rem' 
            }}>
              <ShieldCheck color="var(--primary-light)" size={18} />
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>99% Accuracy</span>
            </div>
          </div>
        </div>

        {/* Right Content — Main content on mobile */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          alignItems: 'center',
          padding: 'clamp(1.5rem, 5vw, 6rem)',
          overflow: 'auto',
          minHeight: 0,
        }}>
          <div className="animate-fade-in" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center',
            textAlign: 'center',
            width: '100%',
            maxWidth: '600px',
          }}>
            {/* Badge */}
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '0.6rem', 
              marginBottom: '1.5rem' 
            }}>
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--primary-glow)', borderRadius: 'var(--radius-md)' }}>
                <Leaf size={22} color="var(--primary-light)" />
              </div>
              <span style={{ 
                color: 'var(--primary)', fontWeight: 700, letterSpacing: '2px', 
                fontSize: '0.8rem', textTransform: 'uppercase' 
              }}>
                {t('appName')} Assistant
              </span>
            </div>

            {/* Headline */}
            <h1 style={{ 
              fontSize: 'clamp(1.8rem, 5vw, 3.5rem)', 
              marginBottom: '1.5rem', 
              lineHeight: 1.15,
            }}>
              AI-Based Crop Disease{' '}
              <span style={{ color: 'var(--primary-light)' }}>Diagnosis</span>{' '}
              & Treatment
            </h1>
            
            {/* Subtitle */}
            <p style={{ 
              fontSize: 'clamp(0.95rem, 2vw, 1.15rem)', 
              color: 'var(--text-muted)', 
              marginBottom: '2.5rem', 
              lineHeight: 1.6, 
              maxWidth: '500px' 
            }}>
              Empowering Indian farmers with instant, expert-level insights. 
              Bridging the gap between detection and treatment using next-gen Gemini AI.
            </p>

            {/* CTA */}
            <Link href="/login" className="btn-primary" style={{ 
              padding: '1rem 2.5rem', 
              fontSize: '1.05rem' 
            }}>
              Start Free Diagnosis <ArrowRight size={20} />
            </Link>

            {/* Features Grid */}
            <div style={{ 
              marginTop: 'clamp(2rem, 4vw, 4rem)', 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
              gap: '1.5rem', 
              borderTop: '1px solid var(--border)', 
              paddingTop: '2rem', 
              width: '100%',
              textAlign: 'center',
            }}>
              <div>
                <Zap size={24} color="var(--accent)" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)', fontSize: '0.95rem' }}>Instant Result</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Diagnosis in under 5 seconds for critical care.</p>
              </div>
              <div>
                <Globe size={24} color="var(--accent)" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)', fontSize: '0.95rem' }}>Multilingual</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Support for all major Indian languages.</p>
              </div>
              <div>
                <ShieldCheck size={24} color="var(--accent)" style={{ marginBottom: '0.75rem' }} />
                <h4 style={{ color: 'var(--primary)', marginBottom: '0.4rem', fontFamily: 'var(--font-serif)', fontSize: '0.95rem' }}>Grounded AI</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>Verified suggestions against expert databases.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
