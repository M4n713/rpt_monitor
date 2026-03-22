import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Mail, Send, Inbox, User, CheckCircle, Loader2, RefreshCw, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';

interface DirectMessage {
  id: number;
  sender_id: number;
  recipient_id: number;
  subject: string;
  body: string;
  is_read: number;
  created_at: string;
  other_party_name: string;
  other_party_role: string;
}

interface Recipient {
  id: number;
  full_name: string;
  role: string;
  last_active_at?: string;
}

export function MessagingPanel() {
  const [activeTab, setActiveTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  
  const isOnline = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return (now.getTime() - date.getTime()) < 5 * 60 * 1000; // 5 minutes
  };
  
  // Compose State
  const [composeForm, setComposeForm] = useState({
    recipient_id: '',
    subject: '',
    body: ''
  });
  const [sending, setSending] = useState(false);

  const fetchMessages = async (type: 'inbox' | 'sent') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/direct-messages?type=${type}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setMessages(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch messages', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    try {
      const res = await fetch('/api/recipients');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setRecipients(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch recipients', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'compose') {
      fetchRecipients();
    } else {
      fetchMessages(activeTab);
    }
  }, [activeTab]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.recipient_id || !composeForm.body) return;

    setSending(true);
    try {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeForm),
      });

      if (res.ok) {
        alert('Message sent successfully');
        setComposeForm({ recipient_id: '', subject: '', body: '' });
        setActiveTab('sent');
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(data.error || 'Failed to send message');
        } else {
          alert('Server error occurred');
        }
      }
    } catch (err) {
      console.error('Send error', err);
    } finally {
      setSending(false);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/direct-messages/${id}/read`, { method: 'POST' });
      // Update local state
      setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: 1 } : m));
    } catch (err) {
      console.error('Read error', err);
    }
  };

  return (
    <Card className="border border-gray-200 shadow-sm h-[600px] flex flex-col">
      <CardHeader className="bg-gray-50 border-b border-gray-200 py-3 px-4 flex flex-row justify-between items-center">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          <CardTitle className="text-sm font-bold text-gray-900">Direct Messages</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button 
            variant={activeTab === 'inbox' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('inbox')}
            className="text-xs h-8"
          >
            <Inbox className="w-3 h-3 mr-1" /> Inbox
          </Button>
          <Button 
            variant={activeTab === 'sent' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('sent')}
            className="text-xs h-8"
          >
            <Send className="w-3 h-3 mr-1" /> Sent
          </Button>
          <Button 
            variant={activeTab === 'compose' ? 'default' : 'ghost'} 
            size="sm" 
            onClick={() => setActiveTab('compose')}
            className="text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Compose
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0 relative">
        {activeTab === 'compose' ? (
          <div className="p-6 overflow-y-auto h-full">
            <form onSubmit={handleSend} className="space-y-4 max-w-lg mx-auto">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Recipient</Label>
                <Select
                  value={composeForm.recipient_id}
                  onValueChange={(val) => setComposeForm({ ...composeForm, recipient_id: val })}
                  required
                >
                  <SelectTrigger className="w-full h-10 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <SelectValue placeholder="Select Recipient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map(r => (
                      <SelectItem key={r.id} value={r.id.toString()}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <div className="flex items-center gap-2">
                            {isOnline(r.last_active_at) ? (
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            ) : (
                              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                            )}
                            <span className="font-medium">{r.full_name}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 capitalize bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            {r.role}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Subject</Label>
                <Input 
                  placeholder="Subject"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({...composeForm, subject: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Message</Label>
                <textarea 
                  className="flex min-h-[150px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Type your message..."
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({...composeForm, body: e.target.value})}
                  required
                />
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={sending}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                  Send Message
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="h-full overflow-y-auto divide-y divide-gray-100">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Inbox className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">No messages found</p>
              </div>
            ) : (
              messages.map(msg => (
                <div 
                  key={msg.id} 
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${activeTab === 'inbox' && !msg.is_read ? 'bg-blue-50/50' : ''}`}
                  onClick={() => {
                    if (activeTab === 'inbox' && !msg.is_read) markAsRead(msg.id);
                  }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {msg.other_party_name} 
                          <span className="text-xs font-normal text-gray-500 ml-1">({msg.other_party_role})</span>
                        </p>
                        <p className="text-xs text-gray-400">
                          {msg.created_at ? (() => {
                            let dateStr = msg.created_at;
                            if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                            return new Date(dateStr).toLocaleString();
                          })() : '---'}
                        </p>
                      </div>
                    </div>
                    {activeTab === 'inbox' && !msg.is_read && (
                      <span className="w-2 h-2 rounded-full bg-blue-500 block" title="Unread"></span>
                    )}
                  </div>
                  <div className="pl-10">
                    <p className="text-sm font-medium text-gray-800 mb-1">{msg.subject || '(No Subject)'}</p>
                    <p className="text-sm text-gray-600 line-clamp-2">{msg.body}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
