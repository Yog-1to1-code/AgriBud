"use client";
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, ExternalLink, Globe, User, ShieldCheck, Sprout, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PromptBar from './PromptBar';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemo } from '@/contexts/DemoContext';

type LoadingStage = 'thinking' | 'searching' | 'grounding' | 'elaborating' | 'iterating' | 'finalizing';

export default function ChatInterface({ cropId, sessionId, onSessionChange, onToggleSidebar }: { cropId: string, sessionId: string, onSessionChange: (id: string) => void, onToggleSidebar?: () => void }) {
  const { t } = useLanguage();
  const { isDemoMode, demoMessages, addDemoMessage, addDemoSession, getDemoAIResponse } = useDemo();
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('thinking');
  const [isFetching, setIsFetching] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDemoMode) {
      if (sessionId !== 'new') {
        setMessages(demoMessages[sessionId] || []);
      } else {
        setMessages([]);
      }
      return;
    }

    if (sessionId !== 'new' && messages.length === 0) {
      fetchMessages(sessionId);
    }
  }, [sessionId, isDemoMode, demoMessages]);

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

  const sendMessage = async (input: string, mediaList: { supabaseUrl?: string, geminiFileUri?: string, mimeType?: string, fileName?: string }[]) => {
    const userMsg = { 
      role: 'user', 
      content: input, 
      id: Date.now().toString(), 
      // Store all media URLs + types for preview
      image_url: mediaList.length > 0 ? mediaList[0].supabaseUrl || null : null,
      mimeType: mediaList.length > 0 ? mediaList[0].mimeType || null : null,
      mediaList: mediaList.length > 0 ? mediaList.map(m => ({
        url: m.supabaseUrl || '',
        mimeType: m.mimeType || '',
      })) : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    if (isDemoMode) {
      let currentSessionId = sessionId;
      
      if (sessionId === 'new') {
        const title = input.substring(0, 30) + (input.length > 30 ? '...' : '');
        const newSession = addDemoSession(cropId, title);
        currentSessionId = newSession.id;
        onSessionChange(currentSessionId);
        addDemoMessage(currentSessionId, userMsg);
      } else {
        addDemoMessage(currentSessionId, userMsg);
      }

      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const aiResponse = getDemoAIResponse();
      const assistantMsg = { 
        role: 'assistant', 
        content: aiResponse.response, 
        id: (Date.now() + 1).toString(), 
        metadata: { citations: aiResponse.citations } 
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      addDemoMessage(currentSessionId, assistantMsg);
      setIsLoading(false);
      return;
    }

    // Real API call
    try {
      const formData = new FormData();
      formData.append('prompt', input);
      formData.append('cropId', cropId);
      formData.append('sessionId', sessionId);
      
      // Send all media as JSON arrays
      if (mediaList.length > 0) {
        formData.append('mediaJson', JSON.stringify(mediaList));
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-deep)', minHeight: 0 }}>
      
      {/* Mobile Header — Always visible on mobile via CSS */}
      <div style={{ 
        padding: '0.6rem 0.75rem', 
        backgroundColor: 'var(--bg-surface)', 
        borderBottom: '1px solid var(--border)', 
        display: 'none', /* Hidden by default (desktop) */
        alignItems: 'center', 
        gap: '0.75rem',
        flexShrink: 0,
      }} className="mobile-chat-header">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar} style={{ padding: '0.35rem', color: 'var(--primary)', borderRadius: 'var(--radius-sm)' }}>
            <Menu size={22} />
          </button>
        )}
        <h2 style={{ fontSize: '1.05rem', color: 'var(--primary)', fontWeight: 600 }}>{t('appName')} Diagnosis</h2>
      </div>

      {/* Scrollable Messages Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(0.5rem, 2vw, 1rem)', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '1.5rem' }}>
          {isFetching ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 className="animate-spin" size={30} color="var(--primary-light)" /></div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'clamp(2rem, 5vw, 4rem) 1rem' }}>
              <div style={{ width: '56px', height: '56px', backgroundColor: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', border: '2px solid var(--primary-glow)', boxShadow: 'var(--shadow-md)' }}>
                <ShieldCheck size={28} color="var(--primary-light)" />
              </div>
              <h2 style={{ fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', color: 'var(--primary)', marginBottom: '0.75rem' }}>{t('helloFarmer')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 'clamp(0.9rem, 2vw, 1.05rem)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                {t('chatSub')}
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={msg.id || i} style={{ 
                alignSelf: 'stretch',
                display: 'flex',
                gap: '0.75rem',
                flexDirection: 'column'
              }}>
                <div style={{
                  display: 'flex',
                  gap: 'clamp(0.5rem, 2vw, 1rem)',
                  alignItems: 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}>
                  {/* Avatar */}
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: msg.role === 'user' ? 'var(--primary-light)' : 'var(--primary)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'white',
                    flexShrink: 0,
                    boxShadow: 'var(--shadow-sm)'
                  }}>
                    {msg.role === 'user' ? <User size={16} /> : <ShieldCheck size={16} />}
                  </div>

                  {/* Message Bubble */}
                  <div style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-surface)',
                    padding: 'clamp(0.75rem, 2vw, 1.25rem)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-sm)',
                    border: '1px solid var(--border)',
                    position: 'relative',
                    minWidth: 0,
                    maxWidth: '100%',
                    overflow: 'hidden',
                  }}>
                    {/* Multi-media preview — uses mediaList array, falls back to single image_url */}
                    {(() => {
                      // Build list: check msg.mediaList (fresh), msg.metadata?.mediaList (from DB), or single image_url
                      const items: { url: string; mimeType: string }[] = msg.mediaList || msg.metadata?.mediaList ||
                        (msg.image_url ? [{ url: msg.image_url, mimeType: msg.mimeType || msg.metadata?.mimeType || '' }] : []);
                      
                      if (items.length === 0) return null;

                      return (
                        <div style={{ 
                          marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
                        }}>
                          {items.map((item, idx) => {
                            const mime = item.mimeType || '';
                            const url = item.url;
                            const isVideo = mime.startsWith('video/') || /\.(mp4|webm|mov|avi)$/i.test(url);
                            const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|ogg|webm|m4a)$/i.test(url);

                            if (isVideo) {
                              return (
                                <div key={idx} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', maxWidth: '100%' }}>
                                  <video src={url} controls playsInline preload="metadata"
                                    style={{ maxWidth: '100%', maxHeight: '250px', display: 'block' }} />
                                </div>
                              );
                            }
                            if (isAudio) {
                              return (
                                <div key={idx} style={{ 
                                  padding: '0.5rem 0.6rem', borderRadius: 'var(--radius-sm)',
                                  backgroundColor: 'var(--bg-hover, #f5f5f5)', border: '1px solid var(--border)',
                                  display: 'flex', alignItems: 'center', gap: '0.4rem', width: '100%',
                                }}>
                                  <span style={{ fontSize: '1rem' }}>🎵</span>
                                  <audio src={url} controls preload="metadata" style={{ flex: 1, height: '32px', minWidth: 0 }} />
                                </div>
                              );
                            }
                            // Image
                            return (
                              <div key={idx} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', display: 'inline-block' }}>
                                <img src={url} alt="Upload" style={{ maxWidth: items.length > 1 ? '140px' : '100%', maxHeight: '250px', display: 'block', objectFit: 'cover' }} />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
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

                {/* Citations */}
                {msg.role === 'assistant' && msg.metadata?.citations && msg.metadata.citations.length > 0 && (
                  <div style={{ paddingLeft: 'clamp(2.5rem, 5vw, 3rem)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {msg.metadata.citations.map((cite: any, idx: number) => (
                      <a key={idx} href={cite.url} target="_blank" rel="noreferrer" 
                        style={{ 
                          padding: '0.35rem 0.6rem', 
                          borderRadius: 'var(--radius-sm)', 
                          fontSize: '0.7rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.4rem', 
                          color: 'var(--primary-light)',
                          backgroundColor: 'white',
                          border: '1px solid var(--border)',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Globe size={10} /> {cite.title || 'Source'} <ExternalLink size={9} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div style={{ alignSelf: 'flex-start', paddingLeft: 'clamp(2.5rem, 5vw, 3rem)' }} className="animate-fade-in">
              <div style={{ 
                backgroundColor: 'white', 
                padding: '0.6rem 1.25rem', 
                borderRadius: 'var(--radius-md)', 
                display: 'flex', 
                alignItems: 'center',
                gap: '0.75rem', 
                border: '1.5px solid var(--primary-glow)',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <div style={{ padding: '0.3rem', backgroundColor: 'var(--bg-hover)', borderRadius: '50%' }}>
                  <Sprout size={16} color="var(--primary-light)" className="animate-pulse" />
                </div>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <div className="animate-grow" style={{ width: '5px', height: '5px', backgroundColor: 'var(--primary-light)', borderRadius: '50%' }} />
                  <div className="animate-grow" style={{ width: '5px', height: '5px', backgroundColor: 'var(--primary)', borderRadius: '50%', animationDelay: '0.2s' }} />
                  <div className="animate-grow" style={{ width: '5px', height: '5px', backgroundColor: 'var(--primary-light)', borderRadius: '50%', animationDelay: '0.4s' }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.02em', minWidth: '120px' }}>
                  {t(loadingStage)}
                </span>
              </div>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>
      </div>

      {/* Input Area */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '1.5px solid var(--border)', flexShrink: 0 }}>
        <div style={{ maxWidth: '950px', margin: '0 auto', width: '100%' }}>
          <PromptBar onSendMessage={sendMessage} isLoading={isLoading} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .mobile-chat-header {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
