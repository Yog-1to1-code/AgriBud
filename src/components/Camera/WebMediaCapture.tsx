"use client";
import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Circle, StopCircle, Video } from 'lucide-react';

interface WebMediaCaptureProps {
  mode: 'photo' | 'video';
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function WebMediaCapture({ mode, onCapture, onClose }: WebMediaCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    let timerInterval: NodeJS.Timeout;

    const startCamera = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        const constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: mode === 'video' // Only request audio if recording video
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(currentStream);
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
        }
      } catch (err: any) {
        console.error("Camera Error:", err);
        setError("Unable to access camera/microphone. Please check permissions.");
      } finally {
        setIsInitializing(false);
      }
    };

    startCamera();

    if (isRecording) {
      timerInterval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [mode, isRecording]);

  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
          onClose();
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const startVideoRecording = () => {
    if (!stream) return;
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    mediaRecorderRef.current = recorder;
    const chunks: Blob[] = [];
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: 'video/webm' });
      onCapture(file);
      onClose();
    };

    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

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
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        
        {isInitializing && (
          <div style={{ position: 'absolute', color: 'white', textAlign: 'center' }}>
            <RefreshCw className="animate-spin" size={48} />
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', color: 'white', textAlign: 'center', padding: '2rem' }}>
            <p>{error}</p>
            <button onClick={onClose} className="btn-primary" style={{ marginTop: '1rem' }}>Close</button>
          </div>
        )}

        {/* Video Recording UI */}
        {mode === 'video' && isRecording && (
          <div style={{ position: 'absolute', top: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(255,0,0,0.8)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white' }}>
            <div style={{ width: '10px', height: '10px', backgroundColor: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }} />
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      <div style={{ height: '160px', backgroundColor: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0 2rem' }}>
        <button onClick={onClose} style={{ color: 'white', opacity: isRecording ? 0.3 : 1 }} disabled={isRecording}>
          <X size={32} />
        </button>

        {mode === 'photo' ? (
          <button 
            onClick={handleCapturePhoto} 
            disabled={!stream || isInitializing}
            style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'white', border: '6px solid var(--primary)', padding: '4px' }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '2px solid black' }} />
          </button>
        ) : (
          <button 
            onClick={isRecording ? stopVideoRecording : startVideoRecording}
            disabled={!stream || isInitializing}
            style={{ width: '80px', height: '80px', borderRadius: '50%', border: '6px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {isRecording ? <StopCircle size={48} color="#ef4444" /> : <div style={{ width: '50px', height: '50px', backgroundColor: '#ef4444', borderRadius: '50%' }} />}
          </button>
        )}

        <div style={{ width: '32px' }} />
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
