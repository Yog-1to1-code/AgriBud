"use client";
import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import ChatInterface from '@/components/Chat/ChatInterface';
import { useParams } from 'next/navigation';
import { useDemo } from '@/contexts/DemoContext';

export default function CropChatPage() {
  const params = useParams();
  const cropId = params.id as string;
  const { isDemoMode } = useDemo();
  const [currentSessionId, setCurrentSessionId] = useState<string>('new');
  const [sessionKey, setSessionKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSelectSession = (id: string) => {
    setSessionKey(prev => prev + 1);
    setCurrentSessionId(id);
    setIsSidebarOpen(false);
  };

  return (
    <div className="app-shell">
      {/* Demo Mode Badge */}
      {isDemoMode && <div className="demo-badge">Demo Mode</div>}

      <div className="main-container" style={{ position: 'relative' }}>
        
        {/* Mobile Sidebar Overlay Backdrop */}
        {isSidebarOpen && (
          <div 
            style={{ 
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
              backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100,
              opacity: 1,
              transition: 'opacity 0.3s ease',
            }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div style={{
          height: '100%',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 101,
          flexShrink: 0,
        }} className={`sidebar-wrap ${isSidebarOpen ? 'sidebar-open' : ''}`}>
          <Sidebar 
            cropId={cropId}
            currentSessionId={currentSessionId} 
            onSelectSession={handleSelectSession} 
          />
        </div>

        {/* Main Chat Area */}
        <main style={{ 
          flex: 1, 
          backgroundColor: 'var(--bg-deep)', 
          position: 'relative', 
          width: '100%', 
          minWidth: 0,
          display: 'flex', 
          flexDirection: 'column' 
        }}>
          <ChatInterface 
            key={`chat-${sessionKey}`}
            cropId={cropId}
            sessionId={currentSessionId}
            onSessionChange={(id) => setCurrentSessionId(id)}
            onToggleSidebar={() => setIsSidebarOpen(true)}
          />
        </main>
      </div>

      <style jsx>{`
        .sidebar-wrap {
          height: 100%;
        }
        @media (max-width: 768px) {
          .sidebar-wrap {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 101;
            transform: translateX(-100%);
            width: 280px;
            max-width: 85vw;
            box-shadow: 4px 0 20px rgba(0,0,0,0.15);
          }
          .sidebar-wrap.sidebar-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
