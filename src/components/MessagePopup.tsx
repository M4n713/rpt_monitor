import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { X, Bell } from 'lucide-react';

interface Message {
  id: number;
  title: string;
  body: string;
  created_at: string;
}

export function MessagePopup() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/messages');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            // Filter out dismissed messages
            const dismissed = JSON.parse(localStorage.getItem('dismissed_messages') || '[]');
            const newMessages = data.filter((m: Message) => !dismissed.includes(m.id));
            
            setMessages(newMessages);
            if (newMessages.length > 0) {
              setCurrentMessage(newMessages[0]);
              setIsOpen(true);
            }
          }
        }
      } catch (err) {
        // Ignore network errors to prevent console spam during server restarts
      }
    };

    fetchMessages();
    // Poll every 30 seconds
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    if (!currentMessage) return;

    // Save to local storage
    const dismissed = JSON.parse(localStorage.getItem('dismissed_messages') || '[]');
    localStorage.setItem('dismissed_messages', JSON.stringify([...dismissed, currentMessage.id]));

    setIsOpen(false);
    
    // Show next message if any
    const nextMessages = messages.filter(m => m.id !== currentMessage.id);
    setMessages(nextMessages);
    
    if (nextMessages.length > 0) {
      setTimeout(() => {
        setCurrentMessage(nextMessages[0]);
        setIsOpen(true);
      }, 500);
    }
  };

  if (!isOpen || !currentMessage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <Card className="w-80 shadow-lg border-l-4 border-l-blue-500">
        <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-sm font-bold text-gray-900">{currentMessage.title}</CardTitle>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-2 text-gray-400 hover:text-gray-900" onClick={handleDismiss}>
            <X className="w-3 h-3" />
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 leading-relaxed">{currentMessage.body}</p>
          <p className="text-[10px] text-gray-400 mt-3 text-right">
            {new Date(currentMessage.created_at).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
