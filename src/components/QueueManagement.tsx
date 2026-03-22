import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Users, Clock, Trash2, Bell, CheckCircle } from 'lucide-react';

interface QueuedUser {
  id: number;
  full_name: string;
  phone_number: string;
  queue_number: number;
  notified: boolean;
  notified_at: string | null;
}

export function QueueManagement() {
  const [queue, setQueue] = useState<QueuedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fetchQueue = async () => {
    try {
      const res = await fetch('/api/queue/active');
      if (res.ok) {
        const data = await res.json();
        setQueue(data);
      }
    } catch (err) {
      console.error('Fetch queue error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 15000); // 15s refresh
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  const handleCancel = async (taxpayerId: number) => {
    if (!confirm('Are you sure you want to cancel this taxpayer\'s queue? They will need to re-queue at the kiosk.')) return;
    
    try {
      const res = await fetch('/api/admin/cancel-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxpayer_id: taxpayerId })
      });
      if (res.ok) fetchQueue();
    } catch (err) {
      console.error('Cancel queue error:', err);
    }
  };

  const calculateWaitTime = (notifiedAt: string | null) => {
    if (!notifiedAt) return 0;
    const notifiedDate = new Date(notifiedAt);
    return Math.floor((currentTime.getTime() - notifiedDate.getTime()) / 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Live Service Queue</h2>
          <p className="text-sm text-gray-500">Managing {queue.length} taxpayers in queue</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchQueue} className="gap-2">
           <Clock className="w-4 h-4" /> Refresh List
        </Button>
      </div>

      {queue.length === 0 && !loading ? (
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center text-gray-400">
             <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
             <p>No taxpayers currently in the daily queue.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queue.map(u => {
            const waitSeconds = calculateWaitTime(u.notified_at);
            const canCancel = u.notified && waitSeconds >= 120;
            
            return (
              <Card key={u.id} className={`overflow-hidden transition-all border-none shadow-md ${u.notified ? 'ring-2 ring-blue-500' : ''}`}>
                <div className={`h-2 ${u.notified ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'}`} />
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-100 text-blue-900 font-black px-3 py-1 rounded-lg text-lg font-mono tracking-tighter shadow-sm border border-blue-200">
                      RPT-{String(u.queue_number).padStart(4, '0')}
                    </div>
                    {u.notified && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-wider animate-in fade-in zoom-in">
                        <CheckCircle className="w-3 h-3" /> Notified
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    <h3 className="font-bold text-gray-900 leading-tight">{u.full_name}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      {u.phone_number || 'No Phone Linked'}
                    </p>
                  </div>

                  {u.notified && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1 border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Time since notified</p>
                      <p className={`text-xl font-mono font-bold tracking-tight ${waitSeconds >= 120 ? 'text-red-500' : 'text-gray-900'}`}>
                        {Math.floor(waitSeconds / 60)}m {waitSeconds % 60}s
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                     <Button 
                       variant="destructive" 
                       size="sm" 
                       className="flex-1 gap-2 h-10 shadow-sm"
                       onClick={() => handleCancel(u.id)}
                       disabled={u.notified && waitSeconds < 120}
                     >
                        <Trash2 className="w-3.5 h-3.5" />
                        {u.notified && waitSeconds < 120 ? `Wait ${120 - waitSeconds}s` : 'Cancel Queue'}
                     </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
