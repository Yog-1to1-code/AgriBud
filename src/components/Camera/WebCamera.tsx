"use client";
import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Zap } from 'lucide-react';

interface WebCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

export default function WebCamera({ onCapture, onClose }: WebCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        setIsInitializing(true);
        setError(null);
        const constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(currentStream);
        if (videoRef.current) {
          videoRef.current.srcObject = currentStream;
        }
      } catch (err: any) {
        console.error("Camera Error:", err);
        setError("Unable to access camera. Please ensure you have given permission.");
      } finally {
        setIsInitializing(false);
      }
    };

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Match canvas size to video stream
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

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'black', 
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Viewfinder */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        
        {isInitializing && (
          <div style={{ position: 'absolute', color: 'white', textAlign: 'center' }}>
            <RefreshCw className="animate-spin" size={48} style={{ marginBottom: '1rem' }} />
            <p>Initializing Camera...</p>
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', color: 'white', textAlign: 'center', padding: '2rem' }}>
            <p style={{ marginBottom: '1.5rem' }}>{error}</p>
            <button onClick={onClose} className="btn-primary" style={{ padding: '0.8rem 2rem' }}>Go Back</button>
          </div>
        )}

        {/* Framing Overlay */}
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          width: '280px',
          height: '280px',
          border: '2px solid rgba(255,255,255,0.5)',
          borderRadius: 'var(--radius-lg)',
          pointerEvents: 'none'
        }}>
           <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '4px solid var(--primary-light)', borderLeft: '4px solid var(--primary-light)' }} />
           <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '4px solid var(--primary-light)', borderRight: '4px solid var(--primary-light)' }} />
           <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '4px solid var(--primary-light)', borderLeft: '4px solid var(--primary-light)' }} />
           <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '4px solid var(--primary-light)', borderRight: '4px solid var(--primary-light)' }} />
        </div>
      </div>

      {/* Controls */}
      <div style={{ 
        height: '140px', 
        backgroundColor: 'rgba(0,0,0,0.9)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 3rem'
      }}>
        <button onClick={onClose} style={{ color: 'white', padding: '1rem' }}>
          <X size={32} />
        </button>

        <button 
          onClick={handleCapture} 
          disabled={!stream || isInitializing}
          style={{ 
            width: '80px', 
            height: '80px', 
            borderRadius: '50%', 
            backgroundColor: 'white', 
            border: '6px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.1s'
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'white', border: '2px solid black' }} />
        </button>

        <div style={{ width: '52px' }} /> {/* Spacer */}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
