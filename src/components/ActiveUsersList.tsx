import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/src/components/ui/card';
import { Users, Circle } from 'lucide-react';

interface ActiveUser {
  id: number;
  full_name: string;
  role: string;
  last_active_at: string;
  queue_number?: number;
}

export function ActiveUsersList() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const res = await fetch('/api/active-users');
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            setActiveUsers(data);
          }
        }
      } catch (err) {
        // Ignore network errors to prevent console spam during server restarts
      }
    };

    fetchActiveUsers();
    const interval = setInterval(fetchActiveUsers, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border border-gray-200 shadow-sm">
      <CardContent className="p-0 max-h-[300px] overflow-y-auto">
        {activeUsers.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-400">No active users</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activeUsers.map(user => (
              <div key={user.id} className="p-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">
                      {user.full_name}
                      {user.queue_number && (
                        <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-mono">
                          #{user.queue_number}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-gray-500 capitalize">{user.role}</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400">
                  {user.last_active_at ? (() => {
                    let dateStr = user.last_active_at;
                    if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) {
                      dateStr = dateStr.replace(' ', 'T') + 'Z';
                    }
                    const d = new Date(dateStr);
                    return d.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      hour12: true 
                    });
                  })() : '---'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
