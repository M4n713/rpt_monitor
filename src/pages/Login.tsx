import React, { useState } from 'react';
import { useAuth } from '../components/ui/context/AuthContext';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/src/components/ui/card';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/src/components/ui/dialog';
import { Textarea } from '@/src/components/ui/textarea';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ name: '', email: '', message: '' });
  const [inquiryStatus, setInquiryStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const { login } = useAuth();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const user = await res.json();
          login(user);
        } else {
          throw new Error('Invalid response format');
        }
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setError(data.error || 'Invalid credentials');
        } else {
          setError('Server error occurred');
        }
      }
    } catch (err) {
      setError('Login failed. Please check your connection.');
    }
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInquiryStatus('sending');
    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_name: inquiryForm.name,
          email: inquiryForm.email,
          message: inquiryForm.message
        }),
      });

      if (res.ok) {
        setInquiryStatus('success');
        setTimeout(() => {
          setShowInquiryModal(false);
          setInquiryStatus('idle');
          setInquiryForm({ name: '', email: '', message: '' });
        }, 2000);
      } else {
        setInquiryStatus('error');
      }
    } catch (err) {
      setInquiryStatus('error');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your credentials to access your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid w-full items-center gap-4">
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            <Button className="w-full mt-4" type="submit">Login</Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <button 
              onClick={() => setShowInquiryModal(true)}
              className="text-blue-500 hover:underline font-medium focus:outline-none"
            >
              Inquire with us
            </button>
          </p>
        </CardFooter>
      </Card>

      <Dialog open={showInquiryModal} onOpenChange={setShowInquiryModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Account Inquiry</DialogTitle>
            <DialogDescription>
              Please provide your details below to request an account or inquire about your property tax status.
            </DialogDescription>
          </DialogHeader>
          
          {inquiryStatus === 'success' ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Send className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-green-600 font-medium">Inquiry sent successfully! We will review your request.</p>
            </div>
          ) : (
            <form onSubmit={handleInquirySubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name (First, Middle, Last)</Label>
                <Input 
                  id="name" 
                  value={inquiryForm.name}
                  onChange={e => setInquiryForm({...inquiryForm, name: e.target.value})}
                  required
                  placeholder="Juan Santos Dela Cruz"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address (Optional)</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={inquiryForm.email}
                  onChange={e => setInquiryForm({...inquiryForm, email: e.target.value})}
                  placeholder="juan@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Property Details</Label>
                <p className="text-xs text-gray-500 mb-1">
                  Please list your PINs or provide the Registered Owner, Lot No. and Area.
                </p>
                <Textarea 
                  id="message" 
                  value={inquiryForm.message}
                  onChange={e => setInquiryForm({...inquiryForm, message: e.target.value})}
                  required
                  placeholder="Example:
1. PIN: 028-09-0001-001-10
2. Owner: Maria Clara, Lot 5, 100sqm"
                  className="min-h-[120px]"
                />
              </div>
              
              {inquiryStatus === 'error' && (
                <p className="text-red-500 text-sm">Failed to send message. Please try again.</p>
              )}

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setShowInquiryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inquiryStatus === 'sending'}>
                  {inquiryStatus === 'sending' ? 'Sending...' : 'Submit Inquiry'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
