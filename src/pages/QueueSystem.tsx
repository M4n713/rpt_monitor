import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// No AuthContext needed for public kiosk
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { 
  UserPlus, 
  Users, 
  Clock, 
  CheckCircle, 
  ArrowRight, 
  User, 
  Calendar, 
  LogOut,
  QrCode,
  Phone,
  ShieldCheck,
  Zap,
  Ticket,
  ChevronDown
} from 'lucide-react';

export default function QueueSystem() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    first_name: '',
    mi: '',
    last_name: '',
    age: '',
    gender: '',
    phone_number: ''
  });
  
  const [queueInfo, setQueueInfo] = useState<{ label: string, fullName: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const handleMIChange = (val: string) => {
    let cleaned = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleaned.length > 2) cleaned = cleaned.substring(0, 2);
    if (cleaned.length > 0) {
      setFormData({ ...formData, mi: cleaned + '.' });
    } else {
      setFormData({ ...formData, mi: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/queue/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (res.ok) {
        setQueueInfo({
          label: data.queue_label,
          fullName: data.user.full_name
        });
        setSuccessAnimation(true);
        setTimeout(() => {
          setFormData({ first_name: '', mi: '', last_name: '', age: '', gender: '', phone_number: '' });
          setSuccessAnimation(false);
        }, 3000);
      } else {
        setError(data.error || 'Failed to join queue');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden flex flex-col">
      {/* Compact Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-3 flex justify-between items-center shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-blue-100 shadow-lg">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none uppercase">RPT Kiosk</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Real Property Tax Queue</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
            <span className="text-[9px] font-bold text-green-600 uppercase tracking-wider">Online</span>
          </div>
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-slate-400 hover:text-red-500 font-bold text-[10px] uppercase tracking-wider transition-all">
            <LogOut className="w-3.5 h-3.5" /> Close
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-6">
        <div className="max-w-6xl mx-auto h-full grid lg:grid-cols-12 gap-8">
          {/* Main Form Area */}
          <div className="lg:col-span-7 h-full flex flex-col gap-6">
            <div className="shrink-0 space-y-1">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Get your Queue Number</h2>
              <p className="text-sm text-slate-500">Please provide your personal details to proceed</p>
            </div>

            <Card className="border-none shadow-none rounded-2xl overflow-hidden bg-white flex-1 flex flex-col">
              <CardContent className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-10">
                  {/* Underlined Fields with Labels Below */}
                  <div className="grid grid-cols-[1fr_80px_1.2fr] gap-x-8 gap-y-10">
                    <div className="flex flex-col-reverse group">
                      <Label className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-blue-600 transition-colors">First Name</Label>
                      <input 
                        className="w-full bg-transparent border-b-2 border-slate-200 py-2 text-xl font-bold outline-none focus:border-blue-600 transition-colors placeholder:text-slate-200"
                        placeholder="Type here..."
                        value={formData.first_name}
                        onChange={e => setFormData({...formData, first_name: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="flex flex-col-reverse group">
                      <Label className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-blue-600 transition-colors">MI</Label>
                      <input 
                        className="w-full bg-transparent border-b-2 border-slate-200 py-2 text-xl font-bold outline-none focus:border-blue-600 transition-colors placeholder:text-slate-200"
                        placeholder="X."
                        value={formData.mi}
                        onChange={e => handleMIChange(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col-reverse group">
                      <Label className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-blue-600 transition-colors">Last Name</Label>
                      <input 
                        className="w-full bg-transparent border-b-2 border-slate-200 py-2 text-xl font-bold outline-none focus:border-blue-600 transition-colors placeholder:text-slate-200"
                        placeholder="Type here..."
                        value={formData.last_name}
                        onChange={e => setFormData({...formData, last_name: e.target.value})}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[100px_140px_1fr] gap-x-8 gap-y-10">
                    <div className="flex flex-col-reverse group">
                      <Label className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-blue-600 transition-colors">Age</Label>
                      <input 
                        type="text"
                        maxLength={2}
                        className="w-full bg-transparent border-b-2 border-slate-200 py-2 text-xl font-bold outline-none focus:border-blue-600 transition-colors placeholder:text-slate-200"
                        placeholder="00"
                        value={formData.age}
                        onInput={(e) => {
                          const val = e.currentTarget.value.replace(/\D/g, '');
                          if (val.length > 2) e.currentTarget.value = val.slice(0, 2);
                          setFormData({...formData, age: val.slice(0, 2)});
                        }}
                        required
                      />
                    </div>

                    <div className="flex flex-col-reverse group">
                      <Label className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-blue-600 transition-colors">Gender</Label>
                      <div className="relative">
                         <select
                            className="w-full bg-transparent border-b-2 border-slate-200 py-2 pr-8 text-xl font-bold outline-none focus:border-blue-600 transition-colors appearance-none cursor-pointer"
                            value={formData.gender}
                            onChange={e => setFormData({...formData, gender: e.target.value})}
                            required
                         >
                             <option value="" disabled></option>
                             <option value="Male">Male</option>
                             <option value="Female">Female</option>
                          </select>
                         <ChevronDown className="absolute right-1 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="flex flex-col-reverse group">
                      <Label className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-focus-within:text-blue-600 transition-colors">Contact Number</Label>
                      <input 
                        className="w-full bg-transparent border-b-2 border-slate-200 py-2 text-xl font-bold outline-none focus:border-blue-600 transition-colors placeholder:text-slate-200"
                        placeholder="09XXXXXXXXX"
                        value={formData.phone_number}
                        onInput={(e) => {
                          const val = e.currentTarget.value.replace(/\D/g, '');
                          setFormData({...formData, phone_number: val});
                        }}
                        required
                      />
                    </div>
                  </div>
                  
                  {error && <p className="text-red-500 text-[10px] font-bold text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                  
                  <div className="pt-4">
                    <Button 
                      type="submit"
                      className={`w-full h-16 text-xl font-bold rounded-2xl transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-4 ${
                        successAnimation 
                        ? 'bg-green-500 hover:bg-green-500 cursor-default text-white' 
                        : 'bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]'
                      }`} 
                      disabled={loading || successAnimation}
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : successAnimation ? (
                        <>
                          <CheckCircle className="w-6 h-6 text-white" />
                          REGISTERED!
                        </>
                      ) : (
                        <>
                          Generate
                          <Ticket className="w-6 h-6 opacity-40 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-5 h-full flex flex-col gap-6">
            <div className="shrink-0 h-10"></div> {/* Spacer for alignment with header */}

            <Card className={`flex-1 border-none rounded-[2rem] overflow-hidden shadow-2xl shadow-slate-200 transition-all duration-500 ${
              queueInfo ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}>
              <CardContent className="h-full p-8 flex flex-col items-center justify-center">
                {queueInfo ? (
                  <div className="w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-200/50 leading-none">Your Priority Number</p>
                       <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter drop-shadow-2xl truncate px-2">
                         {queueInfo.label}
                       </h1>
                    </div>
                    
                    <div className="space-y-4">
                      <p className="text-sm font-bold uppercase tracking-[0.2em] text-blue-100">{queueInfo.fullName}</p>
                      <div className="w-16 h-1 bg-white/20 mx-auto rounded-full"></div>
                    </div>
                    
                    <div className="bg-white p-6 rounded-[2rem] shadow-2xl transform hover:scale-105 transition-transform duration-300 inline-block">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(queueInfo.label + ' | ' + queueInfo.fullName)}`}
                        alt="Queue QR Code"
                        className="w-[180px] h-[180px]"
                      />
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-blue-200/80">
                       <QrCode className="w-4 h-4" />
                       <p className="text-[10px] font-bold uppercase tracking-widest">
                         SCAN OR TAKE A PHOTO
                       </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-12">
                    <div className="space-y-6">
                      <div className="bg-white/5 rounded-3xl p-8 border border-white/5 backdrop-blur-md">
                        <Users className="w-12 h-12 text-blue-500/50 mx-auto mb-4" />
                        <p className="text-lg font-black text-white uppercase italic tracking-wider">System Standing By</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-2">Waiting for registration...</p>
                      </div>
                    </div>
                    <div className="flex gap-4 justify-center">
                       <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                       <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                       <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="shrink-0 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-start gap-4">
               <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                  <User className="w-5 h-5" />
               </div>
               <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-tight">Access Confirmation</h3>
                <p className="text-xs text-slate-500 leading-relaxed">Proceed to the counter once your number is flashed on the main screen.</p>
               </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
      `}</style>
    </div>
  );
}
