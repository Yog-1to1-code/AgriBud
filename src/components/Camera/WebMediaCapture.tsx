"use client";
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, StopCircle, SwitchCamera } from 'lucide-react';

interface WebMediaCaptureProps {
  mode: 'photo' | 'video';
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function WebMediaCapture({ mode, onCapture, onClose }: WebMediaCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [hasStream, setHasStream] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // ── Kill all camera/mic tracks reliably (macOS-safe) ──
  const killStream = useCallback(() => {
    // Stop the recorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    mediaRecorderRef.current = null;

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Fully detach from video element — video.load() is required on
    // macOS Safari/Chrome to actually release the camera hardware
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      try { videoRef.current.load(); } catch {}
    }

    // Kill every track on the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => {
        t.enabled = false;
        t.stop();
      });
      streamRef.current = null;
    }

    setHasStream(false);
    setIsRecording(false);
    setRecordingTime(0);
  }, []);

  // ── Start Camera ──
  const startCamera = useCallback(async () => {
    killStream(); // ensure clean slate

    setIsInitializing(true);
    setError(null);

    try {
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: mode === 'video',
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: mode === 'video',
        });
      }

      streamRef.current = mediaStream;
      setHasStream(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise<void>((resolve) => {
          const vid = videoRef.current!;
          vid.onloadedmetadata = () => { vid.play().then(resolve).catch(resolve); };
        });
      }
    } catch (err: any) {
      console.error("Camera Error:", err);
      if (err.name === 'NotAllowedError') {
        setError("Camera permission denied. Please allow camera access in your browser settings and reload.");
      } else if (err.name === 'NotFoundError') {
        setError("No camera found on this device.");
      } else if (err.name === 'NotReadableError') {
        setError("Camera is in use by another application. Close other apps and try again.");
      } else {
        setError(`Camera error: ${err.message || 'Unknown error'}. Try using "From Gallery" instead.`);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [facingMode, mode, killStream]);

  useEffect(() => {
    startCamera();
    return () => { killStream(); };
  }, [startCamera, killStream]);

  // ── Photo Capture ──
  const handleCapturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !hasStream) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera not ready yet. Please wait a moment and try again.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Kill stream IMMEDIATELY — don't wait for toBlob callback
      killStream();
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
          onClose();
        }
      }, 'image/jpeg', 0.85);
    }
  }, [hasStream, onCapture, onClose, killStream]);

  // ── Video Recording ──
  const startVideoRecording = useCallback(() => {
    if (!streamRef.current) return;

    const mimeTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    let selectedMime = '';
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) { selectedMime = mime; break; }
    }

    if (!selectedMime) {
      setError("Video recording is not supported on this browser. Try using 'Pick Video' from gallery instead.");
      return;
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType: selectedMime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      // Capture stream reference locally — if the component unmounts before
      // onstop fires, streamRef.current will be null, but these local 
      // references survive and we can still kill the hardware camera.
      const capturedStream = streamRef.current;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const ext = selectedMime.includes('mp4') ? 'mp4' : 'webm';
        const blobType = selectedMime.includes('mp4') ? 'video/mp4' : 'video/webm';
        const blob = new Blob(chunksRef.current, { type: blobType });
        const file = new File([blob], `video-${Date.now()}.${ext}`, { type: blobType });
        
        // Kill the captured stream directly (survives component unmount)
        capturedStream.getTracks().forEach(t => { t.enabled = false; t.stop(); });
        
        // Also run full cleanup if component is still mounted
        killStream();
        onCapture(file);
        onClose();
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setIsRecording(false);
      };

      recorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      setError(`Recording failed: ${err.message}`);
    }
  }, [onCapture, onClose, killStream]);

  const stopVideoRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Kill stream tracks IMMEDIATELY — don't wait for async onstop
      // (onstop will also try to kill, but this ensures instant release)
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        try { videoRef.current.load(); } catch {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => { t.enabled = false; t.stop(); });
      }
    }
  }, [isRecording]);

  // ── Switch Camera ──
  const switchCamera = useCallback(() => {
    if (isRecording) return;
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  }, [isRecording]);

  // ── Close (always kill stream) ──
  const handleClose = useCallback(() => {
    killStream();
    onClose();
  }, [killStream, onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'black', zIndex: 2000, display: 'flex', flexDirection: 'column' 
    }}>
      {/* Viewfinder */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          style={{ 
            width: '100%', height: '100%', objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          }} 
        />
        
        {isInitializing && !error && (
          <div style={{ position: 'absolute', color: 'white', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <RefreshCw className="animate-spin" size={48} />
            <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Starting camera...</p>
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', color: 'white', textAlign: 'center', padding: '2rem', maxWidth: '340px' }}>
            <p style={{ fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>{error}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => startCamera()} className="btn-primary" style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem' }}>Retry</button>
              <button onClick={handleClose} style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 'var(--radius-md)' }}>Close</button>
            </div>
          </div>
        )}

        {/* Recording indicator */}
        {mode === 'video' && isRecording && (
          <div style={{ position: 'absolute', top: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(239,68,68,0.9)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', backdropFilter: 'blur(8px)' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'white', borderRadius: '50%', animation: 'camPulse 1s infinite' }} />
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {/* Controls Bar */}
      <div style={{ 
        height: '140px', backgroundColor: 'rgba(0,0,0,0.95)', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-around', 
        padding: '0 1.5rem',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Close */}
        <button 
          onClick={handleClose} 
          style={{ color: 'white', opacity: isRecording ? 0.3 : 1, padding: '0.5rem' }} 
          disabled={isRecording}
        >
          <X size={28} />
        </button>

        {/* Capture / Record Button */}
        {mode === 'photo' ? (
          <button 
            onClick={handleCapturePhoto} 
            disabled={!hasStream || isInitializing || !!error}
            style={{ 
              width: '72px', height: '72px', borderRadius: '50%', 
              backgroundColor: 'white', border: '5px solid var(--primary)', 
              opacity: (!hasStream || isInitializing || error) ? 0.4 : 1,
              transition: 'transform 0.1s',
            }}
            onTouchStart={(e) => { if (hasStream) (e.currentTarget as HTMLElement).style.transform = 'scale(0.9)'; }}
            onTouchEnd={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid #333' }} />
          </button>
        ) : (
          <button 
            onClick={isRecording ? stopVideoRecording : startVideoRecording}
            disabled={!hasStream || isInitializing || !!error}
            style={{ 
              width: '72px', height: '72px', borderRadius: '50%', 
              border: '5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: (!hasStream || isInitializing || error) ? 0.4 : 1,
            }}
          >
            {isRecording 
              ? <StopCircle size={42} color="#ef4444" /> 
              : <div style={{ width: '44px', height: '44px', backgroundColor: '#ef4444', borderRadius: '50%' }} />
            }
          </button>
        )}

        {/* Switch Camera */}
        <button 
          onClick={switchCamera} 
          style={{ color: 'white', opacity: isRecording ? 0.3 : 1, padding: '0.5rem' }} 
          disabled={isRecording}
        >
          <SwitchCamera size={24} />
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <style jsx>{`
        @keyframes camPulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
