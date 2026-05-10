"use client";
import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Loader2, Save, LogOut, MessageCircle, ArrowLeft, User, ShieldCheck, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
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
  { label: 'Kannada (कನ್ನಡ)', value: 'Kannada' },
  { label: 'Malayalam (മലയാളं)', value: 'Malayalam' },
  { label: 'Punjabi (ਪੰਜਾਬੀ)', value: 'Punjabi' },
];

const UI_LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Hindi (हिंदी)', value: 'hi' },
  { label: 'Marathi (मराठी)', value: 'mr' },
];

export default function SettingsPage() {
  const { t, language, setLanguage } = useLanguage();
  const [user, setUser] = useState<any>(null);
  const [aiLanguage, setAiLanguage] = useState('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchProfile();
  }, []);

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
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="app-shell" style={{ backgroundColor: 'var(--bg-deep)' }}>
      <header style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--bg-surface)', borderBottom: '1.5px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ color: 'var(--primary-light)', padding: '0.4rem', borderRadius: '50%' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.4rem', color: 'var(--primary)' }}>{t('accountSettings')}</h1>
      </header>

      <main className="content-scroll" style={{ maxWidth: '800px', margin: '0 auto', width: '100%', padding: '2rem 1.25rem' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
            <Loader2 className="animate-spin" size={40} color="var(--primary-light)" />
          </div>
        ) : (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Account Card */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem 2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)', marginBottom: '0.2rem', fontFamily: 'var(--font-inter)' }}>{user?.email}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-light)', fontWeight: 600, fontSize: '0.85rem' }}>
                    <ShieldCheck size={14} /> {t('verifiedAccount')}
                  </div>
                </div>
              </div>
              <button 
                onClick={handleLogout} 
                style={{ 
                  padding: '0.6rem 1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2', color: '#ef4444', 
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <LogOut size={16} /> {t('logout')}
              </button>
            </div>

            {/* UI Language Selection */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem 2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '0.4rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
                  <Globe size={20} color="var(--primary-light)" />
                </div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{t('uiLanguage')}</h3>
              </div>
              
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>{t('uiLanguageSub')}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {UI_LANGUAGES.map((lang) => (
                  <button 
                    key={lang.value}
                    onClick={() => setLanguage(lang.value as Language)}
                    style={{
                      padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: language === lang.value ? 'var(--bg-hover)' : 'white',
                      border: '1.5px solid', borderColor: language === lang.value ? 'var(--primary-light)' : 'var(--border)',
                      color: 'var(--primary)', fontSize: '0.9rem', fontWeight: language === lang.value ? 700 : 500, textAlign: 'center'
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Language Card */}
            <div style={{ backgroundColor: 'white', padding: '1.5rem 2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div style={{ padding: '0.4rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-md)' }}>
                  <MessageCircle size={20} color="var(--primary-light)" />
                </div>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{t('aiLanguage')}</h3>
              </div>
              
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>{t('aiLanguageSub')}</p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem' }}>
                {AI_LANGUAGES.map((lang) => (
                  <button 
                    key={lang.value}
                    onClick={() => setAiLanguage(lang.value)}
                    style={{
                      padding: '0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: aiLanguage === lang.value ? 'var(--bg-hover)' : 'white',
                      border: '1.5px solid', borderColor: aiLanguage === lang.value ? 'var(--primary-light)' : 'var(--border)',
                      color: 'var(--primary)', fontSize: '0.9rem', fontWeight: aiLanguage === lang.value ? 700 : 500, textAlign: 'center'
                    }}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={handleSave} 
                className="btn-primary" 
                style={{ padding: '0.8rem 2.5rem', fontSize: '1rem' }}
                disabled={saving}
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {t('applyPreferences')}
              </button>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
