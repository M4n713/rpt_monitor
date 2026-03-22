import React, { useEffect, useState } from 'react';
import { useAuth } from '../components/ui/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { autoFormatPinInput, formatPinSearch } from '@/src/lib/utils';
import { LogOut, Home, CreditCard, History, MapPin, FileText, User, Menu, Activity, Globe } from 'lucide-react';

interface Property {
  id: number;
  pin: string;
  td_no: string;
  lot_no: string;
  registered_owner_name: string;
  address: string;
  description: string;
  assessed_value: number;
  tax_due: number;
  status: 'paid' | 'unpaid' | 'partial';
  last_payment_date: string | null;
  total_area: string;
}

interface Payment {
  id: number;
  amount: number;
  payment_date: string;
  collector_name: string;
  or_no: string;
  year: string;
  basic_tax: number;
  sef_tax: number;
  interest: number;
  discount: number;
}

const getLocationFromPin = (pin: string) => {
  if (!pin) return 'Unknown Location';

  // PIN format: 028-09-XXXX-...
  // The location is determined by the 3rd segment (XXXX)
  const parts = pin.split('-');
  if (parts.length < 3) return 'Unknown Location';

  const locationCode = parts[2];

  switch (locationCode) {
    case '0001': return 'Batong Buhay';
    case '0002': return 'Buenavista';
    case '0003': return 'Burgos';
    case '0004': return 'Claudio Salgado';
    case '0005': return 'Ligaya';
    case '0006': return 'Paetan';
    case '0007': return 'Pag-asa';
    case '0008': return 'Sta. Lucia';
    case '0009': return 'San Vicente';
    case '0010': return 'Sto. Niño';
    case '0011': return 'Tagumpay';
    case '0012': return 'Victoria';
    case '0013': return 'Poblacion';
    case '0014': return 'San Agustin';
    case '0015': return 'Gen. Emilio Aguinaldo';
    case '0016': return 'Ibud';
    case '0017': return 'Ilvita';
    case '0018': return 'Lagnas';
    case '0019': return 'Malisbong';
    case '0020': return 'San Francisco';
    case '0021': return 'San Nicolas';
    case '0022': return 'Tuban';
    default: return 'Unknown Location';
  }
};

import { MessagePopup } from '@/src/components/MessagePopup';
import { MessagingPanel } from '@/src/components/MessagingPanel';

export default function Dashboard({ taxpayerId, taxpayerName }: { taxpayerId?: number, taxpayerName?: string }) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'rpt' | 'faq' | 'announcements' | 'settings' | 'erptaas'>('rpt');
  const [erptaasPin, setErptaasPin] = useState('');
  const [erptaasUrl, setErptaasUrl] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isViewMode = !!taxpayerId;
  const displayName = taxpayerName || user?.full_name;

  useEffect(() => {
    // If not in view mode, default to announcements tab
    if (!isViewMode) {
      setActiveTab('announcements');
    }
  }, [isViewMode]);

  useEffect(() => {
    const url = taxpayerId ? `/api/properties?taxpayer_id=${taxpayerId}` : '/api/properties';
    fetch(url)
      .then(res => {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Not JSON');
      })
      .then(data => {
        setProperties(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    if (!isViewMode) {
      fetch('/api/messages')
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return res.json();
          }
          throw new Error('Not JSON');
        })
        .then(data => {
          setAnnouncements(data);
        })
        .catch(console.error);
    }
  }, [taxpayerId, isViewMode]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetch(`/api/properties/${selectedPropertyId}/payments`)
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return res.json();
          }
          throw new Error('Not JSON');
        })
        .then(setPayments)
        .catch(console.error);
    } else {
      setPayments([]);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (activeTab === 'erptaas') {
      const currentPin = properties.find(p => p.id === selectedPropertyId)?.pin || properties[0]?.pin || '';
      if (currentPin) setErptaasPin(currentPin);
    }
  }, [activeTab, selectedPropertyId, properties]);


  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'All fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New password and confirm password do not match' });
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMessage(null), 3000);
      } else {
        const data = await res.json();
        setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (err) {
      setPasswordMessage({ type: 'error', text: 'Error changing password. Please try again.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={isViewMode ? "" : "min-h-screen bg-gray-50 p-4 md:p-8"}>
      <div className={isViewMode ? "" : "max-w-7xl mx-auto"}>
        {/* Header */}
        {!isViewMode && (
          <div className="flex items-center mb-8 gap-4 relative">
            {/* Sandwich Menu */}
            <div className="relative">
              <Button variant="outline" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                <Menu className="w-5 h-5" />
              </Button>

              {isMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
                  <button
                    onClick={() => { setActiveTab('rpt'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${activeTab === 'rpt' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    Real Property Tax
                  </button>
                  <button
                    onClick={() => { setActiveTab('erptaas'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${activeTab === 'erptaas' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    eRPTAAS
                  </button>
                  <button
                    onClick={() => { setActiveTab('faq'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${activeTab === 'faq' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    FAQ
                  </button>
                  <button
                    onClick={() => { setActiveTab('announcements'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${activeTab === 'announcements' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    Announcements
                  </button>
                  <button
                    onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    Settings
                  </button>
                  <div className="border-t border-gray-100 my-1"></div>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">Welcome, {displayName}</h1>
              <p className="text-gray-500">View and manage your Real Property Tax</p>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="w-full">
          {activeTab === 'rpt' && (
            <>
              {properties.length === 0 ? (
                <Card className="border border-gray-200 shadow-sm text-center py-12">
                  <CardContent>
                    <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-900">No Properties Linked</h2>
                    <p className="text-gray-500 mt-2">Your account is not yet linked to any property assessments.</p>
                    <p className="text-sm text-gray-400 mt-1">Please contact the Office of the Municipal Treasurer for assistance.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-8">
                  {/* Property List Table */}
                  <Card className="border border-gray-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-gray-50 border-b border-gray-200 pb-4">
                      <CardTitle className="text-lg font-bold text-gray-900">My Properties</CardTitle>
                    </CardHeader>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">PIN</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Registered Owner</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Lot No.</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">TD No.</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Area</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Assessed<br />Value</th>
                            <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {properties
                            .filter(prop => selectedPropertyId ? prop.id === selectedPropertyId : true)
                            .map((prop) => (
                            <tr
                              key={prop.id}
                              className={`transition-colors ${selectedPropertyId === prop.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                            >
                              <td className="px-6 py-4 font-medium text-gray-900">{prop.pin}</td>
                              <td className="px-6 py-4 text-gray-600">{prop.registered_owner_name}</td>
                              <td className="px-6 py-4 text-gray-600">{getLocationFromPin(prop.pin)}</td>
                              <td className="px-6 py-4 text-gray-600">{prop.lot_no}</td>
                              <td className="px-6 py-4 text-gray-600">{prop.td_no}</td>
                              <td className="px-6 py-4 text-right font-mono text-gray-700">{prop.total_area || '-'}</td>
                              <td className="px-6 py-4 text-right font-mono text-gray-700">
                                <span className="inline-flex items-center justify-end w-full">
                                  <span className="invisible">(</span>
                                  {parseFloat(String(prop.assessed_value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  <span className="invisible">)</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center">
                                <Button
                                  size="sm"
                                  variant={selectedPropertyId === prop.id ? "default" : "outline"}
                                  onClick={() => setSelectedPropertyId(prop.id === selectedPropertyId ? null : prop.id)}
                                  className="h-8 text-xs gap-2"
                                >
                                  <History className="w-3 h-3" />
                                  {selectedPropertyId === prop.id ? 'Hide History' : 'Payment History'}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Payment History Section */}
                  {selectedProperty && (
                    <Card className="border border-gray-200 shadow-sm">
                      <CardHeader className="bg-white border-b border-gray-200">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
                            <History className="w-5 h-5 text-gray-700" />
                            Payment History
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 overflow-x-auto">
                        {payments.length === 0 ? (
                          <div className="text-center py-12">
                            <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-sm text-gray-400">No payment records found for this property.</p>
                          </div>
                        ) : (
                          <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">OR No.</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Year</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Basic<br />Tax</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">SEF<br />Tax</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Interest</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Discount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {payments.map(payment => (
                                <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-6 py-4 font-medium text-gray-900">
                                    {payment.payment_date ? (() => {
                                      let dateStr = payment.payment_date;
                                      if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                                      return new Date(dateStr).toLocaleDateString();
                                    })() : '-'}
                                  </td>
                                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{payment.or_no || '-'}</td>
                                  <td className="px-6 py-4 text-gray-600">{payment.year || '-'}</td>
                                  <td className="px-6 py-4 text-right font-mono text-gray-700">
                                    <span className="inline-flex items-center justify-end w-full">
                                      <span className="invisible">(</span>
                                      {parseFloat(String(payment.basic_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      <span className="invisible">)</span>
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono text-gray-700">
                                    <span className="inline-flex items-center justify-end w-full">
                                      <span className="invisible">(</span>
                                      {parseFloat(String(payment.sef_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      <span className="invisible">)</span>
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono text-gray-700">
                                    <span className="inline-flex items-center justify-end w-full">
                                      <span className="invisible">(</span>
                                      {parseFloat(String(payment.interest || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      <span className="invisible">)</span>
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono text-gray-700">
                                    <span className="inline-flex items-center justify-end w-full">
                                      {parseFloat(String(payment.discount || 0)) > 0 ? (
                                        <>
                                          <span>(</span>
                                          {parseFloat(String(payment.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                          <span>)</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="invisible">(</span>
                                          {'0.00'}
                                          <span className="invisible">)</span>
                                        </>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right font-bold font-mono text-gray-900">
                                    <span className="inline-flex items-center justify-end w-full">
                                      <span className="invisible">(</span>
                                      {parseFloat(String(payment.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      <span className="invisible">)</span>
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-8">
              <Card className="border border-gray-200 shadow-sm">
                <CardHeader className="bg-white border-b border-gray-200">
                  <CardTitle className="text-lg font-bold text-gray-900">Announcements</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  {announcements.length === 0 ? (
                    <p className="text-gray-500 italic">No new announcements at this time.</p>
                  ) : (
                    <div className="space-y-4">
                      {announcements.map(announcement => (
                        <div key={announcement.id} className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                          <h3 className="font-bold text-blue-900">{announcement.title}</h3>
                          <p className="text-blue-800 mt-1 text-sm">{announcement.body}</p>
                          <p className="text-xs text-blue-600 mt-2">
                            {announcement.created_at ? (() => {
                              let dateStr = announcement.created_at;
                              if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                              return new Date(dateStr).toLocaleString();
                            })() : '---'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'faq' && (
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="bg-white border-b border-gray-200">
                <CardTitle className="text-lg font-bold text-gray-900">Frequently-Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900">How do I pay my Real Property Tax?</h3>
                  <p className="text-gray-600 mt-1">You can pay your Real Property Tax at the Municipal Treasurer's Office or through authorized payment channels.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">What happens if I pay late?</h3>
                  <p className="text-gray-600 mt-1">Late payments are subject to a 2% interest per month on the unpaid amount, up to a maximum of 72% (36 months).</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">How can I get a discount?</h3>
                  <p className="text-gray-600 mt-1">Advance payments (paid before the year starts) usually receive a 20% discount, while prompt payments (paid within the quarter) receive a 10% discount.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              <Card className="border border-gray-200 shadow-sm max-w-md">
                <CardHeader className="bg-white border-b border-gray-200">
                  <CardTitle className="text-lg font-bold text-gray-900">Settings</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                      <input
                        type="password"
                        placeholder="Enter current password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {passwordMessage && (
                      <div className={`p-3 rounded-md ${passwordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {passwordMessage.text}
                      </div>
                    )}
                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Change Password</Button>
                  </form>
                </CardContent>
              </Card>

              <div className="mt-8">
                <MessagingPanel />
              </div>
            </div>
          )}
          {activeTab === 'erptaas' && (
            <Card className="border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-12rem)]">
              <CardHeader className="bg-white border-b border-gray-200 flex-none">
                <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
                  <Globe className="w-5 h-5 text-blue-600" />
                  eSearch Property
                </CardTitle>
                <CardDescription>
                  Search for property records in the Official eRPTAAS Portal.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 flex-1 flex flex-col min-h-0">
                <div className="flex flex-col gap-2 max-w-md flex-none">
                  <Label htmlFor="erptaas-pin">Enter PIN</Label>
                  <div className="flex gap-2">
                    <Input
                      id="erptaas-pin"
                      placeholder="028-09-XXXX-XXX-XX"
                      value={erptaasPin}
                      onChange={(e) => setErptaasPin(autoFormatPinInput(e.target.value))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const formatted = formatPinSearch(erptaasPin);
                          setErptaasPin(formatted);
                          setErptaasUrl(`https://www.ompassessor.com.ph/etax/redirectpage/viewdetails.php?mode=2&pinno=${formatted}&muncode=09`);
                        }
                      }}
                    />
                    <Button
                      onClick={() => {
                        const formatted = formatPinSearch(erptaasPin);
                        setErptaasPin(formatted);
                        setErptaasUrl(`https://www.ompassessor.com.ph/etax/redirectpage/viewdetails.php?mode=2&pinno=${formatted}&muncode=09`);
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Search
                    </Button>
                  </div>
                </div>

                <div className="flex-1 w-full border rounded-xl overflow-hidden bg-white relative">
                  {erptaasUrl ? (
                    <div className="w-full h-full flex flex-col overflow-hidden bg-white">
                      {/* Search Result Summary (Top) */}
                      <div className="h-[100px] border-b overflow-hidden relative bg-gray-50/30">
                        <iframe
                          src={erptaasUrl.replace('viewdetails.php', 'esearchproperty.php').replace('pinno=', 'iSearchTxt=') + '&iMode=2&iMunicipality=09&iGoSearch=Search'}
                          className="w-[200%] h-[200%] border-none -mt-[110px] -ml-[284px]"
                          title="eRPTAAS Search Result"
                        />
                      </div>
                      {/* Property Details (Bottom) - The detailed view */}
                      <div className="flex-1 overflow-hidden relative">
                        <iframe
                          src={erptaasUrl}
                          className="w-[150%] h-[200%] border-none -mt-[50px] -ml-[105px]"
                          title="eRPTAAS Property Details"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 bg-gray-50">
                      <Globe className="w-16 h-16 text-gray-300 mb-4" />
                      <h3 className="text-xl font-bold text-gray-900">External Resource</h3>
                      <p className="text-gray-500 max-w-sm mx-auto mt-2">
                        Enter a PIN above and click Search to view records from the Official Municipal Assessor's portal.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}




        </div>
      </div>
      <MessagePopup />
    </div>
  );
}
