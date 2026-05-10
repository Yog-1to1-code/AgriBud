"use client";
import React, { useState } from 'react';
import Sidebar from '@/components/Sidebar/Sidebar';
import ChatInterface from '@/components/Chat/ChatInterface';
import { useParams } from 'next/navigation';

export default function CropChatPage() {
  const params = useParams();
  const cropId = params.id as string;
  const [currentSessionId, setCurrentSessionId] = useState<string>('new');

  return (
    <div className="app-shell">
      <div className="main-container">
        <Sidebar 
          cropId={cropId}
          currentSessionId={currentSessionId} 
          onSelectSession={(id) => setCurrentSessionId(id)} 
        />
        <main style={{ flex: 1, backgroundColor: 'var(--bg-deep)', position: 'relative' }}>
          <ChatInterface 
            cropId={cropId}
            sessionId={currentSessionId}
            onSessionChange={(id) => setCurrentSessionId(id)}
          />
        </main>
      </div>
    </div>
  );
}
