"use client";
import React, { useState, useRef, useCallback } from 'react';
import { Plus, Mic, Send, Image as ImageIcon, Video, FileAudio, Camera, FolderOpen, X, Loader2, CheckCircle2, AlertCircle, ChevronLeft, Circle, Square } from 'lucide-react';
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
  onSendMessage: (text: string, mediaList: MediaInfo[]) => void;
  isLoading: boolean;
}

type MenuView = 'main' | 'image' | 'video' | 'audio';

export default function PromptBar({ onSendMessage, isLoading }: PromptBarProps) {
  const { t, language } = useLanguage();
  const { isDemoMode } = useDemo();
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<MediaInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [captureMode, setCaptureMode] = useState<'photo' | 'video' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordingTime, setAudioRecordingTime] = useState(0);
  // STT language: defaults to the app's UI language, user can override by tapping badge
  const [sttLang, setSttLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('agribud_stt_lang') || language || 'en';
    }
    return 'en';
  });
  
  const recognitionRef = useRef<any>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    closeMenu();
    // Reset the input so the same file can be selected again
    e.target.value = '';

    for (const file of Array.from(files)) {
      if (isDemoMode) {
        setIsUploading(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        setUploadedMedia(prev => [...prev, {
          supabaseUrl: URL.createObjectURL(file),
          geminiFileUri: 'demo-uri',
          mimeType: file.type,
          fileName: file.name,
        }]);
        setIsUploading(false);
      } else {
        await uploadMedia(file);
      }
    }
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const closeMenu = () => {
    setIsExpanded(false);
    setMenuView('main');
  };

  const uploadMedia = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('media', file);
      const response = await fetch('/api/media/upload', { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      setUploadedMedia(prev => [...prev, data]);
    } catch (err) {
      setUploadError(t('uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() && uploadedMedia.length === 0) return;
    if (isUploading) return;
    onSendMessage(input, uploadedMedia);
    setInput('');
    setUploadedMedia([]);
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

    // Each language gets its own recognizer — no "auto" since the browser
    // Speech API cannot detect language automatically.
    // EN = English text, HI = हिंदी text, MR = मराठी text
    const langMap: Record<string, string> = {
      'en': 'en-IN',
      'hi': 'hi-IN',
      'mr': 'mr-IN',
    };
    recognition.lang = langMap[sttLang] || 'en-IN';
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

  // Cycle: EN → HI → MR → EN
  const cycleSttLang = () => {
    const langs = ['en', 'hi', 'mr'];
    const currentIdx = langs.indexOf(sttLang);
    const nextLang = langs[(currentIdx + 1) % langs.length];
    setSttLang(nextLang);
    localStorage.setItem('agribud_stt_lang', nextLang);
  };

  const openCapture = (mode: 'photo' | 'video') => {
    setCaptureMode(mode);
    closeMenu();
  };

  // ── Audio Recording ─────────────────────────────────────
  const startAudioRecording = useCallback(async () => {
    closeMenu();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      // Find supported mime type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) { selectedMime = mime; break; }
      }
      if (!selectedMime) {
        alert('Audio recording not supported on this browser. Please use "From Files" instead.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType: selectedMime });
      audioRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(t => { t.stop(); t.enabled = false; });
        audioStreamRef.current = null;
        // Build file
        const ext = selectedMime.includes('mp4') ? 'mp4' : selectedMime.includes('ogg') ? 'ogg' : 'webm';
        const blob = new Blob(audioChunksRef.current, { type: selectedMime });
        const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: selectedMime });

        if (isDemoMode) {
          setIsUploading(true);
          setTimeout(() => {
            setUploadedMedia(prev => [...prev, {
              supabaseUrl: URL.createObjectURL(file),
              geminiFileUri: 'demo-uri',
              mimeType: file.type,
              fileName: file.name,
            }]);
            setIsUploading(false);
          }, 600);
        } else {
          uploadMedia(file);
        }
        setTimeout(() => textareaRef.current?.focus(), 100);
      };

      recorder.start(1000);
      setIsRecordingAudio(true);
      setAudioRecordingTime(0);
      audioTimerRef.current = setInterval(() => {
        setAudioRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Audio recording error:', err);
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  }, [isDemoMode]);

  const stopAudioRecording = useCallback(() => {
    if (audioRecorderRef.current && isRecordingAudio) {
      audioRecorderRef.current.stop();
      setIsRecordingAudio(false);
      if (audioTimerRef.current) {
        clearInterval(audioTimerRef.current);
        audioTimerRef.current = null;
      }
    }
  }, [isRecordingAudio]);

  const cancelAudioRecording = useCallback(() => {
    if (audioRecorderRef.current) {
      // Remove the onstop handler to prevent file creation
      audioRecorderRef.current.onstop = null;
      if (audioRecorderRef.current.state !== 'inactive') {
        audioRecorderRef.current.stop();
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
      audioStreamRef.current = null;
    }
    setIsRecordingAudio(false);
    if (audioTimerRef.current) {
      clearInterval(audioTimerRef.current);
      audioTimerRef.current = null;
    }
  }, []);

  const formatRecTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCapture = async (file: File) => {
    if (isDemoMode) {
      setIsUploading(true);
      await new Promise(resolve => setTimeout(resolve, 800));
      setUploadedMedia(prev => [...prev, {
        supabaseUrl: URL.createObjectURL(file),
        geminiFileUri: 'demo-uri',
        mimeType: file.type,
        fileName: file.name,
      }]);
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

      {/* Attached Media Preview Strip */}
      {(uploadedMedia.length > 0 || isUploading || uploadError) && (
        <div style={{ 
          position: 'absolute', bottom: '100%', left: 'clamp(0.5rem, 2vw, 1.25rem)', right: 'clamp(0.5rem, 2vw, 1.25rem)', marginBottom: '0.5rem', 
          padding: '0.5rem', borderRadius: 'var(--radius-md)', backgroundColor: 'white',
          border: `1px solid ${uploadError ? '#fee2e2' : 'var(--border)'}`,
          boxShadow: 'var(--shadow-md)', zIndex: 10,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          overflowX: 'auto',
        }}>
          {/* Uploaded media thumbnails */}
          {uploadedMedia.map((m, i) => {
            const isImg = m.mimeType.startsWith('image/');
            const isVid = m.mimeType.startsWith('video/');
            return (
              <div key={i} style={{ 
                position: 'relative', flexShrink: 0, width: '56px', height: '56px', 
                borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)',
                backgroundColor: 'var(--bg-hover, #f5f5f5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {isImg ? (
                  <img src={m.supabaseUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : isVid ? (
                  <Video size={22} color="var(--text-muted)" />
                ) : (
                  <FileAudio size={22} color="var(--text-muted)" />
                )}
                {/* Remove button */}
                <button 
                  onClick={() => setUploadedMedia(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ 
                    position: 'absolute', top: '2px', right: '2px', 
                    width: '18px', height: '18px', borderRadius: '50%',
                    backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 0, lineHeight: 1,
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            );
          })}

          {/* Uploading spinner */}
          {isUploading && (
            <div style={{ 
              flexShrink: 0, width: '56px', height: '56px', borderRadius: '8px',
              border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Loader2 className="animate-spin" size={20} color="var(--primary-light)" />
            </div>
          )}

          {/* Error state */}
          {uploadError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#ef4444' }}>
              <AlertCircle size={14} />
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)}><X size={12} /></button>
            </div>
          )}
        </div>
      )}

      {/* Audio Recording Indicator */}
      {isRecordingAudio && (
        <div style={{ 
          position: 'absolute', bottom: '100%', left: 'clamp(0.5rem, 2vw, 1.25rem)', right: 'clamp(0.5rem, 2vw, 1.25rem)', marginBottom: '0.5rem', 
          padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', backgroundColor: 'white',
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          border: '1px solid #fecaca',
          boxShadow: 'var(--shadow-md)', zIndex: 10
        }}>
          {/* Pulsing red dot */}
          <div style={{ 
            width: '10px', height: '10px', borderRadius: '50%', 
            backgroundColor: '#ef4444', flexShrink: 0,
            animation: 'audioPulse 1s ease-in-out infinite',
          }} />
          
          <span style={{ fontSize: '0.85rem', flex: 1, color: '#ef4444', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            Recording... {formatRecTime(audioRecordingTime)}
          </span>
          
          {/* Cancel */}
          <button 
            onClick={cancelAudioRecording}
            style={{ padding: '0.25rem', borderRadius: '50%', color: 'var(--text-muted)' }}
          >
            <X size={16} />
          </button>
          
          {/* Stop & Save */}
          <button 
            onClick={stopAudioRecording}
            style={{ 
              padding: '0.3rem 0.7rem', borderRadius: 'var(--radius-sm)', 
              backgroundColor: '#ef4444', color: 'white', 
              fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem'
            }}
          >
            <Square size={10} fill="white" /> Stop
          </button>
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
                  <button onClick={() => setMenuView('audio')} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FileAudio size={15} /> {t('addAudio')}</button>
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

              {menuView === 'audio' && (
                <>
                  <button onClick={() => setMenuView('main')} style={{ padding: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', fontSize: '0.7rem' }}><ChevronLeft size={12} /> Back</button>
                  <button onClick={startAudioRecording} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><Circle size={15} color="#ef4444" fill="#ef4444" /> Record Now</button>
                  <button onClick={() => { audioInputRef.current?.click(); closeMenu(); }} style={{ padding: '0.5rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}><FolderOpen size={15} /> From Files</button>
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
          {/* Language indicator badge — tap to cycle: EN → HI → MR */}
          <span 
            onClick={(e) => { e.stopPropagation(); cycleSttLang(); }}
            style={{ 
              position: 'absolute', top: '-4px', right: '-6px',
              fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.03em',
              color: 'white', 
              backgroundColor: isListening ? '#ef4444' : 'var(--primary)',
              borderRadius: '4px', padding: '1px 3.5px', lineHeight: 1.3,
              cursor: 'pointer', userSelect: 'none',
              transition: 'background-color 0.2s',
            }}
          >
            {sttLang.toUpperCase()}
          </span>
        </div>

        {/* Send */}
        <button 
          onClick={handleSend} 
          disabled={isLoading || isUploading || (!input.trim() && uploadedMedia.length === 0)} 
          className="btn-primary" 
          style={{ width: '36px', height: '36px', minWidth: '36px', padding: 0, borderRadius: 'var(--radius-md)', flexShrink: 0 }}
        >
          {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        </button>

        {/* Hidden Inputs */}
        <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileSelect} multiple />
        <input type="file" accept="video/*" hidden ref={videoInputRef} onChange={handleFileSelect} multiple />
        <input type="file" accept="audio/*" hidden ref={audioInputRef} onChange={handleFileSelect} multiple />
      </div>
    </div>
  );
}
