"use client";
import React, { useState, useRef } from 'react';
import { Plus, Mic, Send, Image as ImageIcon, Video, FileAudio, Camera, FolderOpen, X, Loader2, CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';
import WebMediaCapture from '../Camera/WebMediaCapture';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<MediaInfo | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video' | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    closeMenu();
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
  };

  const startSTT = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("STT not supported.");
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    const langMap: Record<string, string> = { 'en': 'en-IN', 'hi': 'hi-IN', 'mr': 'mr-IN' };
    recognition.lang = langMap[language] || 'en-IN';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
      setTimeout(() => textareaRef.current?.focus(), 100);
    };
    recognition.start();
  };

  const openCapture = (mode: 'photo' | 'video') => {
    setCaptureMode(mode);
    closeMenu();
  };

  return (
    <div style={{ padding: '0.75rem 1.25rem', position: 'relative' }}>
      {captureMode && (
        <WebMediaCapture 
          mode={captureMode}
          onCapture={(file) => {
            uploadMedia(file);
            setTimeout(() => textareaRef.current?.focus(), 100);
          }} 
          onClose={() => setCaptureMode(null)} 
        />
      )}

      {/* Status */}
      {(isUploading || uploadedMedia || uploadError) && (
        <div style={{ 
          position: 'absolute', bottom: '100%', left: '1.25rem', right: '1.25rem', marginBottom: '0.75rem', 
          padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', backgroundColor: 'white',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          border: `1px solid ${uploadError ? '#fee2e2' : 'var(--border)'}`,
          boxShadow: 'var(--shadow-md)', zIndex: 10
        }}>
          {isUploading ? <Loader2 className="animate-spin" size={18} color="var(--primary-light)" /> : 
           uploadedMedia ? <CheckCircle2 size={18} color="var(--primary-light)" /> : 
           <AlertCircle size={18} color="#ef4444" />}
          
          <span style={{ fontSize: '0.85rem', flex: 1, color: "var(--text-main)", fontWeight: 500 }}>
            {isUploading ? t('preparingMedia') : (uploadedMedia ? t('mediaReady') : t('uploadFailed'))}
          </span>
          
          {!isUploading && <button onClick={() => { setUploadedMedia(null); setUploadError(null); }}><X size={16} color="var(--text-muted)" /></button>}
        </div>
      )}

      <div style={{ 
        display: 'flex', alignItems: 'flex-end', gap: '0.75rem', padding: '0.5rem', 
        borderRadius: 'var(--radius-lg)', border: '1.5px solid var(--border)',
        backgroundColor: 'white', boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => {
              if (isExpanded) closeMenu();
              else setIsExpanded(true);
            }} 
            style={{ 
              width: '38px', height: '38px', borderRadius: '50%', 
              backgroundColor: isExpanded ? 'var(--bg-hover)' : 'transparent', 
              color: isExpanded ? 'var(--primary-light)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Plus size={20} style={{ transform: isExpanded ? 'rotate(45deg)' : 'none', transition: 'transform 0.3s' }} />
          </button>
          
          {isExpanded && (
            <div style={{ 
              position: 'absolute', bottom: '100%', left: 0, marginBottom: '0.75rem', 
              padding: '0.4rem', borderRadius: 'var(--radius-md)', display: 'flex', 
              flexDirection: 'column', gap: '0.2rem', width: '200px', zIndex: 100,
              backgroundColor: 'white', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', border: '1.5px solid var(--border)'
            }}>
              {menuView === 'main' && (
                <>
                  <button onClick={() => setMenuView('image')} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><ImageIcon size={16} /> {t('uploadPhoto')}</button>
                  <button onClick={() => setMenuView('video')} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Video size={16} /> {t('recordVideo')}</button>
                  <button onClick={() => audioInputRef.current?.click()} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FileAudio size={16} /> {t('addAudio')}</button>
                </>
              )}

              {menuView === 'image' && (
                <>
                  <button onClick={() => setMenuView('main')} style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}><ChevronLeft size={12} /> Back</button>
                  <button onClick={() => openCapture('photo')} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Camera size={16} /> Shoot Now</button>
                  <button onClick={() => fileInputRef.current?.click()} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FolderOpen size={16} /> From Gallery</button>
                </>
              )}

              {menuView === 'video' && (
                <>
                  <button onClick={() => setMenuView('main')} style={{ padding: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}><ChevronLeft size={12} /> Back</button>
                  <button onClick={() => openCapture('video')} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Video size={16} /> Record Now</button>
                  <button onClick={() => videoInputRef.current?.click()} style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FolderOpen size={16} /> Pick Video</button>
                </>
              )}
            </div>
          )}
        </div>

        <textarea 
          ref={textareaRef} value={input} 
          onChange={(e) => setInput(e.target.value)} 
          placeholder={t('askAnything')}
          style={{ 
            flex: 1, border: 'none', background: 'transparent', outline: 'none', 
            padding: '0.5rem 0', resize: 'none', minHeight: '38px', maxHeight: '150px',
            color: 'var(--text-main)', fontSize: '1rem'
          }} 
          rows={1}
          onInput={(e) => { e.currentTarget.style.height = 'auto'; e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'; }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={isLoading}
        />

        <button 
          onClick={startSTT} 
          disabled={isLoading} 
          style={{ padding: '0.6rem', borderRadius: '50%', color: isListening ? '#ef4444' : 'var(--text-muted)' }}
        >
          <Mic size={20} className={isListening ? 'animate-pulse' : ''} />
        </button>

        <button 
          onClick={handleSend} 
          disabled={isLoading || isUploading || (!input.trim() && !uploadedMedia)} 
          className="btn-primary" 
          style={{ width: '40px', height: '40px', minWidth: '40px', padding: 0, borderRadius: 'var(--radius-md)' }}
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        </button>

        <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileSelect} />
        <input type="file" accept="video/*" hidden ref={videoInputRef} onChange={handleFileSelect} />
        <input type="file" accept="audio/*" hidden ref={audioInputRef} onChange={handleFileSelect} />
      </div>
    </div>
  );
}
