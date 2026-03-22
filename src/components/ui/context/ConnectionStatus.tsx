import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'mock'>('loading');
  const [message, setMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkStatus = async () => {
    setIsRefreshing(true);
    try {
      // Check DB connection
      const dbRes = await fetch('/api/check-db');
      const dbData = await dbRes.json();
      console.log('[ConnectionStatus] dbData:', dbData);
      
      if (dbRes.ok && dbData.status === 'connected') {
        if (dbData.initStatus?.mode === 'mock') {
          setStatus('mock');
          setMessage(`MOCK MODE: DB Timeout (${dbData.dbHost}). Data will be lost on restart.`);
        } else {
          setStatus('connected');
          setMessage(`DB: ${dbData.dbHost} | ${dbData.counts.users} users, ${dbData.counts.properties} properties`);
        }
      } else {
        setStatus('error');
        setMessage(`DB Error: ${dbData.message || 'Connection failed'}`);
      }
    } catch (e: any) {
      setStatus('error');
      setMessage(`Server Error: ${e.message || 'Server unreachable'}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`fixed bottom-4 right-4 p-3 rounded-lg shadow-lg flex items-center gap-3 text-sm font-medium z-50 transition-all duration-300 ${
      status === 'connected' ? 'bg-green-100 text-green-800 border border-green-200' :
      status === 'mock' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
      status === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
      'bg-gray-100 text-gray-800'
    }`}>
      <div className="flex items-center gap-2">
        {(status === 'connected' || status === 'mock') && <Wifi className="w-4 h-4" />}
        {status === 'error' && <WifiOff className="w-4 h-4" />}
        {status === 'loading' && <Wifi className="w-4 h-4 animate-pulse" />}
        
        <span>{message || 'Checking connection...'}</span>
      </div>

      <button 
        onClick={checkStatus}
        disabled={isRefreshing}
        className={`p-1 rounded-full hover:bg-black/5 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
        title="Refresh connection status"
      >
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
}
