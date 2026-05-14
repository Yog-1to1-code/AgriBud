"use client";
import React, { useState, useRef } from 'react';
import { Plus, Mic, Send, Image as ImageIcon, Video, FileAudio, Camera, FolderOpen, X, Loader2, CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';
import WebMediaCapture from '../Camera/WebMediaCapture';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDemo } from '@/contexts/DemoContext';

interface MediaInfo {
  supabaseUrl: string;
  geminiFileUri: string;
  mimeType: string;
  fileName: string;
}

interface PromptBarProps {
  onSendMessage: (text: string, media: MediaInfo | null) => void;
  isLoading: boolean;
}

type MenuView = 'main' | 'image' | 'video';

export default function PromptBar({ onSendMessage, isLoading }: PromptBarProps) {
  const { t, language } = useLanguage();
  const { isDemoMode } = useDemo();
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<MediaInfo | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [sttLang, setSttLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agribud_stt_lang') || 'auto';
    }
    return 'auto';
  });
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    closeMenu();

    if (isDemoMode) {
      // In demo mode, simulate upload
      setIsUploading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadedMedia({
        supabaseUrl: URL.createObjectURL(file),
        geminiFileUri: 'demo-uri',
        mimeType: file.type,
        fileName: file.name,
      });
      setIsUploading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
      return;
    }

    await uploadMedia(file);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const closeMenu = () => {
    setIsExpanded(false);
    setMenuView('main');
  };

  const uploadMedia = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    setUploadedMedia(null);
    try {
      const formData = new FormData();
      formData.append('media', file);
      const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setUploadedMedia(data);
    } catch (err) {
      setUploadError(t('uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() && !uploadedMedia) return;
    if (isUploading) return;
    onSendMessage(input, uploadedMedia);
    setInput('');
    setUploadedMedia(null);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const startSTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech-to-Text not supported on this browser.");
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Language mapping for STT
    // 'auto' mode: We use a broad Hindi recognizer which handles Hindi, Marathi,
    // and accented English reasonably well for Indian users.
    // Specific modes force exact language recognition.
    const langMap: Record<string, string> = {
      'auto': 'hi-IN',  // Hindi recognizer works best as "catch-all" for Indian languages
      'en': 'en-IN',
      'hi': 'hi-IN',
      'mr': 'mr-IN',
    };
    recognition.lang = langMap[sttLang] || 'hi-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setTimeout(() => textareaRef.current?.focus(), 100);
    };
    recognition.start();
  };

  const cycleSttLang = () => {
    const langs = ['auto', 'en', 'hi', 'mr'];
    const currentIdx = langs.indexOf(sttLang);
    const nextLang = langs[(currentIdx + 1) % langs.length];
    setSttLang(nextLang);
    localStorage.setItem('agribud_stt_lang', nextLang);
  };

  const openCapture = (mode: 'photo' | 'video') => {
    setCaptureMode(mode);
    closeMenu();
  };

  const handleCapture = async (file: File) => {
    if (isDemoMode) {
      setIsUploading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadedMedia({
        supabaseUrl: URL.createObjectURL(file),
        geminiFileUri: 'demo-uri',
        mimeType: file.type,
        fileName: file.name,
      });
      setIsUploading(false);
    } else {
      uploadMedia(file);
    }
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  return (
    <div style={{ padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(0.5rem, 2vw, 1.25rem)', position: 'relative' }}>
      {/* Camera/Video Capture Overlay */}
      {captureMode && (
        <WebMediaCapture 
          mode={captureMode}
          onCapture={handleCapture} 
          onClose={() => setCaptureMode(null)} 
        />
      )}

      {/* Upload Status */}
      {(isUploading || uploadedMedia || uploadError) && (
        <div style={{ 
          position: 'absolute', bottom: '100%', left: 'clamp(0.5rem, 2vw, 1.25rem)', right: 'clamp(0.5rem, 2vw, 1.25rem)', marginBottom: '0.5rem', 
          padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'white',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          border: `1px solid ${uploadError ? '#fee2e2' : 'var(--border)'}`,
          boxShadow: 'var(--shadow-md)', zIndex: 10
        }}>
          {isUploading ? <Loader2 className="animate-spin" size={16} color="var(--primary-light)" /> : 
           uploadedMedia ? <CheckCircle2 size={16} color="var(--primary-light)" /> : 
           <AlertCircle size={16} color="#ef4444" />}
          
          <span style={{ fontSize: '0.8rem', flex: 1, color: "var(--text-main)", fontWeight: 500 }}>
            {isUploading ? t('preparingMedia') : (uploadedMedia ? t('mediaReady') : t('uploadFailed'))}
          </span>
          
          {!isUploading && <button onClick={() => { setUploadedMedia(null); setUploadError(null); }}><X size={14} color="var(--text-muted)" /></button>}
        </div>
      )}

      {/* Input Bar */}
      <div style={{ 
        display: 'flex', alignItems: 'flex-end', gap: '0.5rem', padding: '0.4rem', 
        borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)',
        backgroundColor: 'white', boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Expand Menu */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => {
              if (isExpanded) closeMenu();
              else setIsExpanded(true);
            }} 
            style={{ 
              width: '36px', height: '36px', borderRadius: '50%', 
              backgroundColor: isExpanded ? 'var(--bg-hover)' : 'transparent', 
              color: isExpanded ? 'var(--primary-light)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Plus size={18} style={{ transform: isExpanded ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          
          {isExpanded && (
            <div style={{ 
              position: 'absolute', bottom: '100%', left: 0, marginBottom: '0.5rem', 
              padding: '0.3rem', borderRadius: 'var(--radius-md)', display: 'flex', 
              flexDirection: 'column', gap: '0.15rem', width: '180px', zIndex: 100,
              backgroundColor: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '1.5px solid var(--border)'
            }}>
              {menuView === 'main' && (
                <>
                  <button onClick={() => setMenuView('image')} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><ImageIcon size={15} /> {t('uploadPhoto')}</button>
                  <button onClick={() => setMenuView('video')} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Video size={15} /> {t('recordVideo')}</button>
                  <button onClick={() => { audioInputRef.current?.click(); closeMenu(); }} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FileAudio size={15} /> {t('addAudio')}</button>
                </>
              )}

              {menuView === 'image' && (
                <>
                  <button onClick={() => setMenuView('main')} style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}><ChevronLeft size={12} /> Back</button>
                  <button onClick={() => openCapture('photo')} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Camera size={15} /> Shoot Now</button>
                  <button onClick={() => { fileInputRef.current?.click(); closeMenu(); }} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FolderOpen size={15} /> From Gallery</button>
                </>
              )}

              {menuView === 'video' && (
                <>
                  <button onClick={() => setMenuView('main')} style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}><ChevronLeft size={12} /> Back</button>
                  <button onClick={() => openCapture('video')} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Video size={15} /> Record Now</button>
                  <button onClick={() => { videoInputRef.current?.click(); closeMenu(); }} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FolderOpen size={15} /> Pick Video</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Text Input */}
        <textarea 
          ref={textareaRef} value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder={t('askAnything')}
          style={{ 
            flex: 1, border: 'none', background: 'transparent', outline: 'none', 
            padding: '0.4rem 0', resize: 'none', minHeight: '36px', maxHeight: '120px',
            color: 'var(--text-main)', fontSize: '1rem', lineHeight: '1.4',
            minWidth: 0, /* Prevent flex overflow */
          }} 
          rows={1}
          onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 120) + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={isLoading}
        />

        {/* Mic — Tap to record, Long-press to cycle language */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button 
            onClick={startSTT}
            onContextMenu={(e) => { e.preventDefault(); cycleSttLang(); }}
            disabled={isLoading} 
            style={{ 
              padding: '0.4rem', borderRadius: '50%', 
              color: isListening ? '#ef4444' : 'var(--text-muted)',
              position: 'relative',
            }}
            title={`Speech: ${sttLang.toUpperCase()} — Long-press to change`}
          >
            <Mic size={18} className={isListening ? 'animate-pulse' : ''} />
          </button>
          {/* Language indicator badge — tap to cycle: AUTO → EN → HI → MR */}
          <span 
            onClick={(e) => { e.stopPropagation(); cycleSttLang(); }}
            style={{ 
              position: 'absolute', top: '-4px', right: '-6px',
              fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.03em',
              color: 'white', 
              backgroundColor: isListening ? '#ef4444' : (sttLang === 'auto' ? 'var(--accent, #ff9933)' : 'var(--primary)'),
              borderRadius: '4px', padding: '1px 3.5px', lineHeight: 1.3,
              cursor: 'pointer', userSelect: 'none',
              transition: 'background-color 0.2s',
            }}
          >
            {sttLang === 'auto' ? 'A' : sttLang.toUpperCase()}
          </span>
        </div>

        {/* Send */}
        <button 
          onClick={handleSend} 
          disabled={isLoading || isUploading || (!input.trim() && !uploadedMedia)} 
          className="btn-primary" 
          style={{ width: '36px', height: '36px', minWidth: '36px', padding: 0, borderRadius: 'var(--radius-md)', flexShrink: 0 }}
        >
          {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        </button>

        {/* Hidden Inputs */}
        <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileSelect} />
        <input type="file" accept="video/*" hidden ref={videoInputRef} onChange={handleFileSelect} />
        <input type="file" accept="audio/*" hidden ref={audioInputRef} onChange={handleFileSelect} />
      </div>
    </div>
  );
}
