"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Save, LogOut, MessageCircle, ArrowLeft, ShieldCheck, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemo } from '@/contexts/DemoContext';
import { Language } from '@/i18n/translations';

const AI_LANGUAGES = [
  { label: 'Auto (Same as prompt)', value: 'auto' },
  { label: 'English', value: 'English' },
  { label: 'Hindi (हिंदी)', value: 'Hindi' },
  { label: 'Bengali (বাংলা)', value: 'Bengali' },
  { label: 'Telugu (తెలుగు)', value: 'Telugu' },
  { label: 'Marathi (मराठी)', value: 'Marathi' },
  { label: 'Tamil (தமிழ்)', value: 'Tamil' },
  { label: 'Urdu (اردو)', value: 'Urdu' },
  { label: 'Gujarati (ગુજરાતી)', value: 'Gujarati' },
  { label: 'Kannada (ಕನ್ನಡ)', value: 'Kannada' },
  { label: 'Malayalam (മലയാളം)', value: 'Malayalam' },
  { label: 'Punjabi (ਪੰਜਾਬੀ)', value: 'Punjabi' },
];

const UI_LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi (हिंदी)', value: 'hi' },
  { label: 'Marathi (मराठी)', value: 'mr' },
];

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const { isDemoMode, disableDemoMode } = useDemo();
  const [user, setUser] = useState<any>(null);
  const [aiLanguage, setAiLanguage] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (isDemoMode) {
      setUser({ email: 'demo@agribud.app' });
      setLoading(false);
      return;
    }
    fetchProfile();
  }, [isDemoMode]);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', user.id)
        .single();
      
      if (data?.preferred_language) {
        setAiLanguage(data.preferred_language);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isDemoMode) {
      alert(t('save'));
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_language: aiLanguage })
        .eq('id', user.id);
      
      if (!error) {
        alert(t('save'));
      }
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    if (isDemoMode) {
      disableDemoMode();
      router.push('/');
      return;
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      {isDemoMode && <div className="demo-badge">Demo Mode</div>}

      <header style={{ 
        padding: '0.6rem clamp(0.75rem, 3vw, 2rem)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.75rem', 
        backgroundColor: 'var(--bg-surface)', 
        borderBottom: '1.5px solid var(--border)',
        flexShrink: 0,
      }}>
        <button onClick={() => router.back()} style={{ color: 'var(--primary-light)', padding: '0.35rem', borderRadius: '50%', flexShrink: 0 }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: 'clamp(1.1rem, 3vw, 1.4rem)', color: 'var(--primary)' }}>{t('accountSettings')}</h1>
      </header>

      <main className="content-scroll" style={{ maxWidth: '700px', margin: '0 auto', width: '100%', padding: 'clamp(0.75rem, 3vw, 2rem)' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
            <Loader2 className="animate-spin" size={36} color="var(--primary-light)" />
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Account Card */}
            <div style={{ backgroundColor: 'white', padding: 'clamp(1rem, 3vw, 1.5rem)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.15rem', fontFamily: 'var(--font-inter)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary-light)', fontWeight: 600, fontSize: '0.8rem' }}>
                    <ShieldCheck size={13} /> {isDemoMode ? 'Demo Account' : t('verifiedAccount')}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                style={{ 
                  width: '100%',
                  padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2', color: '#ef4444', 
                  fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut size={15} /> {isDemoMode ? 'Exit Demo' : t('logout')}
              </button>
            </div>

            {/* UI Language */}
            <div style={{ backgroundColor: 'white', padding: 'clamp(1rem, 3vw, 1.5rem)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.35rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <Globe size={18} color="var(--primary-light)" />
                </div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{t('uiLanguage')}</h3>
              </div>
              
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>{t('uiLanguageSub')}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.6rem' }}>
                {UI_LANGUAGES.map((lang) => (
                  <button 
                    key={lang.value}
                    onClick={() => setLanguage(lang.value as Language)}
                    style={{
                      padding: '0.6rem', borderRadius: 'var(--radius-md)', backgroundColor: language === lang.value ? 'var(--bg-hover)' : 'white',
                      border: '1.5px solid', borderColor: language === lang.value ? 'var(--primary-light)' : 'var(--border)',
                      color: 'var(--primary)', fontSize: '0.85rem', fontWeight: language === lang.value ? 700 : 500, textAlign: 'center'
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Language */}
            <div style={{ backgroundColor: 'white', padding: 'clamp(1rem, 3vw, 1.5rem)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ padding: '0.35rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <MessageCircle size={18} color="var(--primary-light)" />
                </div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{t('aiLanguage')}</h3>
              </div>
              
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>{t('aiLanguageSub')}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.6rem' }}>
                {AI_LANGUAGES.map((lang) => (
                  <button 
                    key={lang.value}
                    onClick={() => setAiLanguage(lang.value)}
                    style={{
                      padding: '0.6rem', borderRadius: 'var(--radius-md)', backgroundColor: aiLanguage === lang.value ? 'var(--bg-hover)' : 'white',
                      border: '1.5px solid', borderColor: aiLanguage === lang.value ? 'var(--primary-light)' : 'var(--border)',
                      color: 'var(--primary)', fontSize: '0.85rem', fontWeight: aiLanguage === lang.value ? 700 : 500, textAlign: 'center'
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={handleSave} 
                className="btn-primary" 
                style={{ padding: '0.75rem 2rem', fontSize: '0.95rem', width: '100%', maxWidth: '320px', borderRadius: 'var(--radius-md)' }}
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                {t('applyPreferences')}
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
