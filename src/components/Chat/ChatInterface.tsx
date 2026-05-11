"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, ExternalLink, Globe, User, ShieldCheck, Sprout, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PromptBar from './PromptBar';
import { useLanguage } from '@/contexts/LanguageContext';

type LoadingStage = 'thinking' | 'searching' | 'grounding' | 'elaborating' | 'iterating' | 'finalizing';

export default function ChatInterface({ cropId, sessionId, onSessionChange, onToggleSidebar }: { cropId: string, sessionId: string, onSessionChange: (id: string) => void, onToggleSidebar?: () => void }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('thinking');
  const [isFetching, setIsFetching] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId !== 'new' && messages.length === 0) {
      fetchMessages(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, loadingStage]);

  // Stage rotation effect
  useEffect(() => {
    if (!isLoading) {
      setLoadingStage('thinking');
      return;
    }

    const stages: LoadingStage[] = ['thinking', 'searching', 'grounding', 'elaborating', 'iterating', 'finalizing'];
    let stageIndex = 0;
    
    const interval = setInterval(() => {
      stageIndex++;
      if (stageIndex < stages.length) {
        setLoadingStage(stages[stageIndex]);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [isLoading]);

  const fetchMessages = async (id: string) => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/chat/history?sessionId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  };

  const sendMessage = async (input: string, media: { supabaseUrl?: string, geminiFileUri?: string, mimeType?: string } | null) => {
    const userMsg = { 
      role: 'user', 
      content: input, 
      id: Date.now().toString(), 
      image_url: media?.supabaseUrl || null 
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('prompt', input);
      formData.append('cropId', cropId);
      formData.append('sessionId', sessionId);
      
      if (media) {
        if (media.supabaseUrl) formData.append('supabaseUrl', media.supabaseUrl);
        if (media.geminiFileUri) formData.append('geminiFileUri', media.geminiFileUri);
        if (media.mimeType) formData.append('mimeType', media.mimeType);
      }

      const response = await fetch('/api/chat', { method: 'POST', body: formData });
      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response, id: Date.now().toString(), metadata: data.metadata }]);
        if (data.sessionId && data.sessionId !== sessionId) onSessionChange(data.sessionId);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Request failed.', id: Date.now().toString() }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Network error.', id: Date.now().toString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-deep)' }}>
      
      {/* Mobile Header (Only visible on small screens) */}
      <div className="mobile-block mobile-hidden" style={{ padding: '1rem', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} style={{ padding: '0.4rem', color: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}>
            <Menu size={24} />
          </button>
        )}
        <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 600 }}>{t('appName')} Diagnosis</h2>
      </div>

      {/* Scrollable Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
          {isFetching ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={32} color="var(--primary-light)" /></div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
              <div style={{ width: '64px', height: '64px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem auto', border: '2px solid var(--primary-glow)', boxShadow: 'var(--shadow-md)' }}>
                <ShieldCheck size={32} color="var(--primary-light)" />
              </div>
              <h2 style={{ fontSize: '2.4rem', color: 'var(--primary)', marginBottom: '1rem' }}>{t('helloFarmer')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.5 }}>
                {t('chatSub')}
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id || i} style={{ 
                alignSelf: 'stretch',
                display: 'flex',
                gap: '1rem',
                flexDirection: 'column'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}>
                  <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '50%', 
                    backgroundColor: msg.role === 'user' ? 'var(--primary-light)' : 'var(--primary)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {msg.role === 'user' ? <User size={18} /> : <ShieldCheck size={18} />}
                  </div>

                  <div style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-surface)',
                    padding: '1.25rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border)',
                    position: 'relative'
                  }}>
                    {msg.image_url && (
                      <div style={{ marginBottom: '1rem', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', display: 'inline-block' }}>
                        <img src={msg.image_url} alt="Crop Upload" style={{ maxWidth: '100%', maxHeight: '400px', display: 'block' }} />
                      </div>
                    )}
                    <div className="prose" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({node, ...props}) => (
                            <div className="table-wrapper">
                              <table {...props} />
                            </div>
                          )
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>

                {msg.role === 'assistant' && msg.metadata?.citations && (
                  <div style={{ paddingLeft: '3.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {msg.metadata.citations.map((cite: any, idx: number) => (
                      <a key={idx} href={cite.url} target="_blank" rel="noreferrer" 
                        style={{ 
                          padding: '0.4rem 0.75rem', 
                          borderRadius: 'var(--radius-sm)', 
                          fontSize: '0.75rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          color: 'var(--primary-light)',
                          backgroundColor: 'white',
                          border: '1px solid var(--border)',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                      >
                        <Globe size={12} /> {cite.title || 'Official Source'} <ExternalLink size={10} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div style={{ alignSelf: 'flex-start', paddingLeft: '3.5rem' }} className="animate-fade-in">
              <div style={{ 
                backgroundColor: 'white', 
                padding: '0.75rem 1.5rem', 
                borderRadius: 'var(--radius-md)', 
                display: 'flex', 
                alignItems: 'center',
                gap: '1rem', 
                border: '1.5px solid var(--primary-glow)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ padding: '0.4rem', backgroundColor: 'var(--bg-hover)', borderRadius: '50%' }}>
                  <Sprout size={18} color="var(--primary-light)" className="animate-pulse" />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <div className="animate-grow" style={{ width: '6px', height: '6px', backgroundColor: 'var(--primary-light)', borderRadius: '50%' }} />
                  <div className="animate-grow" style={{ width: '6px', height: '6px', backgroundColor: 'var(--primary)', borderRadius: '50%', animationDelay: '0.2s' }} />
                  <div className="animate-grow" style={{ width: '6px', height: '6px', backgroundColor: 'var(--primary-light)', borderRadius: '50%', animationDelay: '0.4s' }} />
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.02em', minWidth: '150px' }}>
                  {t(loadingStage)}
                </span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>
      </div>

      {/* Input Area */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1.5px solid var(--border)', padding: '0.25rem 0' }}>
        <div style={{ maxWidth: '950px', margin: '0 auto', width: '100%' }}>
          <PromptBar onSendMessage={sendMessage} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
