"use client";
import React, { useEffect, useState, useRef } from 'react';
import { Plus, MessageSquare, Loader2, ChevronLeft, History, Trash2, Edit2, Check, X, MoreVertical, Sprout } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Sidebar({ cropId, onSelectSession, currentSessionId }: { cropId: string, onSelectSession: (id: string) => void, currentSessionId: string | null }) {
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<any[]>([]);
  const [cropName, setCropName] = useState('Crop');
  const [loading, setLoading] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  
  const supabase = createClient();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCropDetails();
    fetchSessions();
  }, [currentSessionId, cropId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCropDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('farmer_crops')
        .select('name')
        .eq('id', cropId)
        .eq('user_id', user.id)
        .single();
      
      if (error) throw error;
      if (data) setCropName(data.name);
    } catch (err) {
      console.error("Error fetching crop details:", err);
    }
  };

  const fetchSessions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('crop_id', cropId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      if (data) setSessions(data);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenId(null);
    if (!confirm(t('deleteChatConfirm'))) return;
    try {
      const { error } = await supabase.from('chat_sessions').delete().eq('id', id);
      if (error) throw error;
      setSessions(sessions.filter(s => s.id !== id));
      if (currentSessionId === id) onSelectSession('new');
    } catch (err) {
      alert("Failed to delete.");
    }
  };

  const handleStartRename = (session: any, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpenId(null);
    setEditingSessionId(session.id);
    setNewTitle(session.title);
  };

  const handleRename = async (id: string, e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newTitle.trim()) return;
    try {
      const { error } = await supabase.from('chat_sessions').update({ title: newTitle.trim() }).eq('id', id);
      if (error) throw error;
      setSessions(sessions.map(s => s.id === id ? { ...s, title: newTitle.trim() } : s));
      setEditingSessionId(null);
    } catch (err) {
      alert("Failed to rename.");
    }
  };

  return (
    <div style={{ 
      width: '280px', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: 'var(--bg-surface)', 
      borderRight: '1.5px solid var(--border)' 
    }}>
      {/* Header */}
      <div style={{ padding: '1.25rem 1rem', borderBottom: '1.5px solid var(--border)' }}>
        <button 
          onClick={() => router.push('/dashboard')} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-light)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}
        >
          <ChevronLeft size={14} /> {t('backToHub')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ padding: '0.4rem', backgroundColor: 'var(--bg-hover)', borderRadius: 'var(--radius-sm)' }}>
            <Sprout size={18} color="var(--primary-light)" />
          </div>
          <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cropName}</h2>
        </div>
      </div>

      {/* Primary Action */}
      <div style={{ padding: '1rem' }}>
        <button 
          onClick={() => onSelectSession('new')}
          className="btn-primary"
          style={{ 
            width: '100%', 
            padding: '0.75rem', 
            borderRadius: 'var(--radius-md)', 
            fontSize: '0.95rem'
          }}
        >
          <Plus size={18} /> {t('newDiagnosis')}
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          <History size={12} /> {t('historyTitle')}
        </div>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}><Loader2 className="animate-spin" size={20} color="var(--primary-light)" /></div>
        ) : sessions.length === 0 ? (
          <p style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', fontStyle: 'italic' }}>{t('noRecords')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {sessions.map(s => (
              <div key={s.id} style={{ 
                position: 'relative', 
                display: 'flex', 
                alignItems: 'center', 
                borderRadius: 'var(--radius-md)', 
                backgroundColor: s.id === currentSessionId ? 'var(--bg-hover)' : 'transparent',
                transition: 'all 0.2s'
              }}>
                {editingSessionId === s.id ? (
                  <form onSubmit={(e) => handleRename(s.id, e)} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem' }}>
                    <input 
                      autoFocus
                      style={{ flex: 1, padding: '0.3rem', fontSize: '0.8rem', border: '1px solid var(--primary-light)' }}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onBlur={() => setEditingSessionId(null)}
                    />
                    <button type="submit" onMouseDown={(e) => handleRename(s.id, e)} style={{ color: 'var(--primary-light)' }}><Check size={14} /></button>
                  </form>
                ) : (
                  <>
                    <button 
                      onClick={() => onSelectSession(s.id)}
                      style={{
                        flex: 1,
                        padding: '0.6rem 0.75rem',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        fontSize: '0.85rem',
                        color: s.id === currentSessionId ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: s.id === currentSessionId ? 700 : 500
                      }}
                    >
                      <MessageSquare size={14} style={{ color: s.id === currentSessionId ? 'var(--primary-light)' : 'var(--text-muted)' }} />
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</span>
                    </button>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === s.id ? null : s.id); }}
                      style={{ padding: '0.4rem', color: 'var(--text-muted)' }}
                    >
                      <MoreVertical size={14} />
                    </button>

                    {menuOpenId === s.id && (
                      <div ref={menuRef} style={{ 
                        position: 'absolute', top: '90%', right: '0.5rem', zIndex: 100, backgroundColor: 'white',
                        padding: '0.25rem', borderRadius: 'var(--radius-md)', minWidth: '120px',
                        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.1)', border: '1.5px solid var(--border)'
                      }}>
                        <button onClick={(e) => handleStartRename(s, e)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Edit2 size={12} /> {t('rename')}</button>
                        <button onClick={(e) => handleDeleteSession(s.id, e)} style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', borderRadius: 'var(--radius-sm)' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Trash2 size={12} /> {t('delete')}</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
