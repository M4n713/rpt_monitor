import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  FileText,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Phone,
  Mail,
  Bell,
  Check,
  ChevronDown,
  CreditCard,
  Monitor,
  Clock,
  Users,
  PenLine,
  LogIn,
  UserPlus,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';

type Service = { id: string; title: string };
type Step = 'landing' | 'transaction' | 'info-form' | 'result';

type Transaction = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const TRANSACTIONS: Transaction[] = [
  { id: 'tax-payment', label: 'Tax Payment', icon: <CreditCard className="w-6 h-6" /> },
  { id: 'tax-clearance', label: 'Tax Clearance', icon: <ShieldCheck className="w-6 h-6" /> },
  { id: 'tax-certification', label: 'Tax Certificate', icon: <FileText className="w-6 h-6" /> },
  { id: 'other-inquiries', label: 'Other RPT Inquiries', icon: <MessageCircle className="w-6 h-6" /> },
];

const IDLE_TIMEOUT_MS = 60000;
const RESULT_DISPLAY_MS = 30000;

function getInitials(first: string, last: string) {
  return `${first.charAt(0).toUpperCase()}${last.charAt(0).toUpperCase()}`;
}

function formatQueueNumber(num: number | string | undefined): string {
  if (!num) return '---';
  return `RPT-${String(num).padStart(3, '0')}`;
}

function useNowServing(intervalMs = 5000) {
  const [nowServing, setNowServing] = useState<string>('---');
  const [activeCollectors, setActiveCollectors] = useState(0);

  useEffect(() => {
    let iv: ReturnType<typeof setInterval>;
    const doFetch = async () => {
      try {
        const [nsRes, sRes] = await Promise.all([
          window.fetch('/api/queue/now-serving'),
          window.fetch('/api/queue/stats'),
        ]);
        const nsData = await nsRes.json();
        if (nsData?.queue_number) setNowServing(formatQueueNumber(nsData.queue_number));
        else setNowServing('---');
        const sData = await sRes.json();
        if (sData && typeof sData.active_collectors === 'number') setActiveCollectors(sData.active_collectors);
      } catch { /* ignore */ }
    };
    doFetch();
    iv = setInterval(doFetch, intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);

  return { nowServing, activeCollectors };
}

function useIdleTimer(onTimeout: () => void, timeoutMs: number, enabled: boolean) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!enabled) return;
    timeoutRef.current = setTimeout(() => onTimeoutRef.current(), timeoutMs);
  }, [timeoutMs, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }
    resetTimer();
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    const handler = () => resetTimer();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((e) => window.removeEventListener(e, handler));
    };
  }, [enabled, resetTimer]);

  return resetTimer;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f8fafc',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  padding: '14px 18px',
  fontSize: '16px',
  color: '#1e293b',
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'all 0.2s',
};

function Field({ label, children, optional }: { label: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase' }}>{label}</label>
        {optional && <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>OPTIONAL</span>}
      </div>
      {children}
    </div>
  );
}

function BackHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
      <button onClick={onBack} style={{
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.9)', borderRadius: '10px', padding: '10px 16px',
        fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center',
        gap: '8px', transition: 'all 0.2s', whiteSpace: 'nowrap',
      }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 style={{ fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>{title}</h1>
    </header>
  );
}

function LandingScreen({ onManualEntry }: { onManualEntry: () => void }) {
  const { nowServing, activeCollectors } = useNowServing();
  const qrUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname + '?register=true' : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(24px, 4vh, 64px) clamp(24px, 4vw, 64px)', overflowY: 'auto', gap: 'clamp(24px, 3vh, 48px)',
      }}>
        <div style={{ textAlign: 'center', maxWidth: '600px', width: '100%' }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
            <img src="/logo.png" alt="Logo" style={{ height: 'clamp(60px, 10vh, 100px)', width: 'auto', objectFit: 'contain' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <h1 style={{ fontSize: 'clamp(20px, 3.5vw, 36px)', fontWeight: 900, color: '#1e293b', lineHeight: 1.2, marginBottom: '4px', letterSpacing: '-0.01em' }}>
            Office of the Municipal Treasurer
          </h1>
          <h2 style={{ fontSize: 'clamp(14px, 2vw, 20px)', fontWeight: 700, color: '#6366f1', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '12px' }}>
            Real Property Section
          </h2>
          <p style={{ color: '#64748b', fontSize: 'clamp(14px, 1.8vw, 17px)', fontWeight: 500 }}>
            Please choose how you would like to get your queue number
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 'clamp(16px, 2vw, 24px)', width: '100%', maxWidth: '680px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', padding: 'clamp(24px, 3vw, 40px)',
            border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: 'clamp(120px, 18vw, 180px)', height: 'clamp(120px, 18vw, 180px)', background: '#fff',
              borderRadius: '16px', border: '2px solid #e2e8f0', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: '12px',
            }}>
              <QRCodeSVG value={qrUrl} size={undefined} style={{ width: '100%', height: '100%' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>Scan QR Code</h3>
            <p style={{ fontSize: 'clamp(12px, 1.5vw, 14px)', color: '#64748b', textAlign: 'center' }}>Register using your phone</p>
          </div>

          <button onClick={onManualEntry} style={{
            background: '#fff', borderRadius: '24px', padding: 'clamp(24px, 3vw, 40px)', border: '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', fontFamily: 'inherit',
          }}
            onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)'; b.style.transform = 'translateY(-4px)'; b.style.borderColor = '#6366f1'; }}
            onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; b.style.transform = 'translateY(0)'; b.style.borderColor = '#e2e8f0'; }}
          >
            <div style={{
              width: 'clamp(120px, 18vw, 180px)', height: 'clamp(120px, 18vw, 180px)',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
              boxShadow: '0 10px 15px -3px rgba(99,102,241,0.3)',
            }}>
              <PenLine style={{ width: 'clamp(32px, 5vw, 48px)', height: 'clamp(32px, 5vw, 48px)' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(16px, 2vw, 20px)', fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>Manual Entry</h3>
            <p style={{ fontSize: 'clamp(12px, 1.5vw, 14px)', color: '#64748b', textAlign: 'center' }}>Register using this tablet</p>
          </button>
        </div>
      </main>

      <div style={{
        background: '#fff', borderTop: '1px solid #e2e8f0',
        padding: 'clamp(12px, 1.5vh, 20px) clamp(24px, 4vw, 64px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, flexWrap: 'wrap', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 10px #22c55e' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase' }}>System Status: Optimal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(24px, 4vw, 56px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Now Serving</div>
            <div style={{ fontSize: 'clamp(16px, 2vw, 24px)', fontWeight: 900, color: '#1e293b' }}>{nowServing}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Counters Active</div>
            <div style={{ fontSize: 'clamp(16px, 2vw, 24px)', fontWeight: 900, color: '#6366f1' }}>{activeCollectors}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionScreen({ onSelect, onBack }: { onSelect: (t: Transaction) => void; onBack: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, padding: 'clamp(24px, 4vh, 48px) clamp(24px, 4vw, 64px)', overflowY: 'auto', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
        <BackHeader onBack={onBack} title="Select Transaction" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 'clamp(12px, 1.5vw, 20px)' }}>
          {TRANSACTIONS.map((t) => (
            <button key={t.id} onClick={() => onSelect(t)} style={{
              background: '#fff', borderRadius: '20px', padding: 'clamp(24px, 3vw, 40px)', border: '1px solid #e2e8f0',
              cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', display: 'flex',
              flexDirection: 'column', alignItems: 'center', gap: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', fontFamily: 'inherit',
            }}
              onMouseEnter={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)'; b.style.transform = 'translateY(-4px)'; b.style.borderColor = '#6366f1'; }}
              onMouseLeave={(e) => { const b = e.currentTarget as HTMLButtonElement; b.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; b.style.transform = 'translateY(0)'; b.style.borderColor = '#e2e8f0'; }}
            >
              <div style={{
                width: 'clamp(48px, 6vw, 64px)', height: 'clamp(48px, 6vw, 64px)',
                background: t.id === 'tax-payment' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#f1f5f9',
                borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: t.id === 'tax-payment' ? '#fff' : '#6366f1',
                boxShadow: t.id === 'tax-payment' ? '0 10px 15px -3px rgba(99,102,241,0.3)' : 'none',
              }}>
                {React.cloneElement(t.icon as React.ReactElement, { className: undefined, style: { width: 'clamp(20px, 3vw, 28px)', height: 'clamp(20px, 3vw, 28px)' } })}
              </div>
              <span style={{ fontSize: 'clamp(14px, 1.8vw, 18px)', fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function RegistrationForm({
  selectedTransaction,
  onSuccess,
  showBack,
  onBack,
  compact,
}: {
  selectedTransaction: Transaction;
  onSuccess: (info: { ticket: string; fullName: string; initials: string; service: Service; isPriority: boolean }) => void;
  showBack?: boolean;
  onBack?: () => void;
  compact?: boolean;
}) {
  const [formData, setFormData] = useState({ first_name: '', mi: '', last_name: '', age: '', gender: '', contact_number: '+63', email: '' });
  const [isPriority, setIsPriority] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  const handleMIChange = (val: string) => {
    let cleaned = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleaned.length > 2) cleaned = cleaned.substring(0, 2);
    setFormData({ ...formData, mi: cleaned.length > 0 ? cleaned + '.' : '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentGiven || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const payload = {
        first_name: formData.first_name,
        mi: formData.mi,
        last_name: formData.last_name,
        age: formData.age,
        gender: formData.gender,
        phone_number: formData.contact_number,
        is_priority: isPriority,
        transaction_type: selectedTransaction.label,
      };

      const res = await fetch('/api/queue/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess({
          ticket: data.queue_label,
          fullName: data.user?.full_name ?? `${formData.first_name} ${formData.last_name}`,
          initials: getInitials(formData.first_name, formData.last_name),
          service: { id: selectedTransaction.id, title: selectedTransaction.label },
          isPriority,
        });
      } else {
        setError(data.error || 'Failed to join queue');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const gap = compact ? '12px' : 'clamp(16px, 2vh, 28px)';
  const pad = compact ? '20px' : 'clamp(24px, 3vw, 48px)';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{
        flex: 1, padding: compact ? '16px' : 'clamp(24px, 4vh, 48px) clamp(24px, 4vw, 64px)',
        overflowY: 'auto', maxWidth: compact ? '500px' : '700px', margin: '0 auto', width: '100%',
      }}>
        {showBack && onBack && <BackHeader onBack={onBack} title="Personal Information" />}
        {!showBack && (
          <div style={{ textAlign: 'center', marginBottom: compact ? '16px' : '32px' }}>
            <img src="/logo.png" alt="Logo" style={{ height: 'clamp(40px, 8vw, 64px)', width: 'auto', objectFit: 'contain', marginBottom: '8px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            <h1 style={{ fontSize: 'clamp(20px, 3vw, 32px)', fontWeight: 900, color: '#1e293b', marginBottom: '4px' }}>Personal Information</h1>
            <p style={{ color: '#64748b', fontSize: 'clamp(13px, 1.5vw, 15px)' }}>Transaction: <strong style={{ color: '#6366f1' }}>{selectedTransaction.label}</strong></p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          display: 'flex', flexDirection: 'column', gap, background: '#fff', padding: pad,
          borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '16px' }}>
            <Field label="FIRST NAME">
              <input style={inputStyle} placeholder="Enter first name" value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
            </Field>
            <Field label="MI">
              <input style={inputStyle} placeholder="MI" value={formData.mi} onChange={(e) => handleMIChange(e.target.value)} />
            </Field>
          </div>

          <Field label="LAST NAME">
            <input style={inputStyle} placeholder="Enter last name" value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '16px' }}>
            <Field label="AGE">
              <input style={inputStyle} placeholder="00" value={formData.age} maxLength={3}
                onInput={(e) => { const val = e.currentTarget.value.replace(/\D/g, '').slice(0, 3); setFormData({ ...formData, age: val }); }} required />
            </Field>
            <Field label="GENDER">
              <div style={{ position: 'relative' }}>
                <select style={{ ...inputStyle, paddingRight: '40px', appearance: 'none', cursor: 'pointer' }}
                  value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })} required>
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                <ChevronDown className="w-5 h-5" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              </div>
            </Field>
          </div>

          <Field label="CONTACT NUMBER">
            <div style={{ position: 'relative' }}>
              <Phone className="w-5 h-5" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="+639123456789" value={formData.contact_number}
                onInput={(e) => {
                  let val = e.currentTarget.value;
                  if (!val.startsWith('+63')) val = '+63' + val.replace(/\D/g, '');
                  else val = '+63' + val.substring(3).replace(/\D/g, '');
                  if (val.length > 13) val = val.slice(0, 13);
                  setFormData({ ...formData, contact_number: val });
                }} required />
            </div>
          </Field>

          <Field label="EMAIL ADDRESS" optional>
            <div style={{ position: 'relative' }}>
              <Mail className="w-5 h-5" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input style={{ ...inputStyle, paddingLeft: '44px' }} placeholder="taxpayer@domain.com" type="email"
                value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
          </Field>

          <div style={{ background: '#f1f5f9', borderRadius: '16px', padding: '20px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', marginBottom: '12px' }}>Are you a PWD, Pregnant or with Infant?</p>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
              <div style={{
                width: '48px', height: '26px', background: isPriority ? '#6366f1' : '#cbd5e1',
                borderRadius: '13px', position: 'relative', transition: 'background 0.3s', flexShrink: 0,
              }} onClick={() => setIsPriority(!isPriority)}>
                <div style={{
                  width: '22px', height: '22px', background: '#fff', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: isPriority ? '24px' : '2px',
                  transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: isPriority ? '#6366f1' : '#64748b' }}>Yes, I am a Priority Citizen</span>
            </label>
          </div>

          <div style={{ background: '#fffbeb', borderRadius: '16px', padding: '20px', border: '1px solid #fde68a' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#6366f1', marginTop: '2px', flexShrink: 0, cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', color: '#78350f', lineHeight: 1.6 }}>
                I freely consent to the collection and handling of my personal information for real property tax&ndash;related transactions, tax collection drives, and information campaign purposes only, subject to my rights under the Data Privacy Act.
              </span>
            </label>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: '14px', background: '#fef2f2', padding: '16px 20px', borderRadius: '12px', border: '1px solid #fee2e2', fontWeight: 600 }}>{error}</p>}

          <button type="submit" disabled={loading || !consentGiven} style={{
            background: loading || !consentGiven ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            color: '#fff', border: 'none', borderRadius: '16px', padding: '18px 36px', fontWeight: 800, fontSize: '16px',
            cursor: loading || !consentGiven ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '12px', transition: 'all 0.3s', width: '100%',
            boxShadow: loading || !consentGiven ? 'none' : '0 10px 15px -3px rgba(99,102,241,0.3)', fontFamily: 'inherit',
          }}>
            {loading ? (
              <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <>Get Queue Number <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

function ResultScreen({
  ticket, fullName, initials, service, isPriority, onDone, onRegisterAnother, sessionCount,
}: {
  ticket: string; fullName: string; initials: string; service: Service; isPriority: boolean;
  onDone: () => void; onRegisterAnother: () => void; sessionCount: number;
}) {
  const [nowServing, setNowServing] = useState<string>('---');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [countdown, setCountdown] = useState(Math.ceil(RESULT_DISPLAY_MS / 1000));

  useEffect(() => {
    const fetchNowServing = async () => {
      try {
        const res = await fetch('/api/queue/now-serving');
        const data = await res.json();
        if (data?.queue_number) setNowServing(formatQueueNumber(data.queue_number));
      } catch { /* ignore */ }
    };
    fetchNowServing();
    const iv = setInterval(fetchNowServing, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const ticketQrValue = JSON.stringify({ ticket, name: fullName, transaction: service.title, time: timeStr });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(16px, 3vh, 48px)', overflowY: 'auto' }}>
      <div style={{
        background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0', width: '100%', maxWidth: '480px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: 'clamp(20px, 3vw, 32px)',
          textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
        }}>
          <img src="/logo.png" alt="Logo" style={{ height: 'clamp(36px, 6vw, 56px)', width: 'auto', objectFit: 'contain', marginBottom: '8px' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <p style={{ color: '#fff', fontSize: 'clamp(12px, 1.5vw, 15px)', fontWeight: 700, letterSpacing: '0.02em', margin: 0 }}>Office of the Municipal Treasurer</p>
          <p style={{ color: '#818cf8', fontSize: 'clamp(10px, 1.2vw, 12px)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Real Property Section</p>
        </div>

        <div style={{ textAlign: 'center', padding: 'clamp(24px, 4vh, 48px) clamp(20px, 3vw, 32px)' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>Your Queue Number</div>
          <div style={{ fontSize: 'clamp(56px, 12vw, 96px)', fontWeight: 950, color: '#6366f1', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '8px', wordBreak: 'break-all' }}>{ticket}</div>

          {isPriority && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px', background: '#fef3c7', borderRadius: '100px', border: '1px solid #fde68a', marginBottom: '16px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#92400e' }}>PRIORITY</span>
            </div>
          )}

          <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '24px' }}>
            Transaction: <strong style={{ color: '#1e293b' }}>{service.title}</strong>
          </div>

          <div style={{
            background: '#f8fafc', borderRadius: '16px', padding: 'clamp(16px, 2vw, 24px)', border: '1px solid #e2e8f0',
            display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #60a5fa, #34d399)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '13px', flexShrink: 0 }}>{initials}</div>
                <div><div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{fullName}</div></div>
              </div>
            </div>
            <div style={{ height: '1px', background: '#e2e8f0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Date & Time</span>
              <span style={{ fontSize: '12px', color: '#1e293b', fontWeight: 700 }}>{dateStr} &bull; {timeStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>Now Serving</span>
              <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 800 }}>{nowServing}</span>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#64748b' }}>
            <div style={{ width: '24px', height: '24px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(34,197,94,0.4)', flexShrink: 0 }}>
              <Check className="w-4 h-4 text-white" />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>Please wait for your turn</span>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QRCodeSVG value={ticketQrValue} size={80} />
            </div>
          </div>
        </div>

        <div style={{ padding: '0 clamp(20px, 3vw, 32px) clamp(20px, 3vw, 32px)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {sessionCount > 0 && (
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>
              <Users className="w-3.5 h-3.5 inline-block mr-1" style={{ verticalAlign: 'middle' }} />
              {sessionCount} registered this session
            </div>
          )}

          <button onClick={onRegisterAnother} style={{
            width: '100%', background: '#fff', color: '#6366f1', border: '2px solid #6366f1', borderRadius: '14px',
            padding: '14px', fontWeight: 800, fontSize: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: '8px', transition: 'all 0.3s', fontFamily: 'inherit',
          }}>
            <UserPlus className="w-4 h-4" /> Register Another Person
          </button>

          <button onClick={onDone} style={{
            width: '100%', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', border: 'none',
            borderRadius: '14px', padding: '16px', fontWeight: 800, fontSize: '16px', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s',
            boxShadow: '0 10px 15px -3px rgba(99,102,241,0.3)', fontFamily: 'inherit',
          }}>
            Finish <LogIn className="w-4 h-4" />
          </button>

          <div style={{ textAlign: 'center', padding: '4px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Timer className="w-3 h-3 text-slate-400" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Auto-reset in {countdown}s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileRegisterScreen() {
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ticket: string; fullName: string; initials: string; service: Service; isPriority: boolean;
  } | null>(null);

  const handleFormSuccess = useCallback((info: { ticket: string; fullName: string; initials: string; service: Service; isPriority: boolean }) => {
    setConfirmation(info);
  }, []);

  const handleReset = useCallback(() => {
    setSelectedTransaction(null);
    setConfirmation(null);
  }, []);

  if (confirmation) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Outfit', 'Inter', 'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#0f172a', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <img src="/logo.png" alt="Logo" style={{ height: '28px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>RPT Queue</span>
        </header>
        <ResultScreen
          ticket={confirmation.ticket} fullName={confirmation.fullName} initials={confirmation.initials}
          service={confirmation.service} isPriority={confirmation.isPriority} onDone={handleReset}
          onRegisterAnother={handleReset} sessionCount={0}
        />
      </div>
    );
  }

  if (!selectedTransaction) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Outfit', 'Inter', 'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#0f172a', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <img src="/logo.png" alt="Logo" style={{ height: '28px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>RPT Queue</span>
        </header>
        <main style={{ flex: 1, padding: '24px 20px', maxWidth: '500px', margin: '0 auto', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b', marginBottom: '4px' }}>Select Transaction</h1>
            <p style={{ color: '#64748b', fontSize: '14px' }}>Choose the type of transaction</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {TRANSACTIONS.map((t) => (
              <button key={t.id} onClick={() => setSelectedTransaction(t)} style={{
                background: '#fff', borderRadius: '16px', padding: '20px 16px', border: '1px solid #e2e8f0',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.04)', fontFamily: 'inherit', transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6366f1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0'; }}
              >
                <div style={{
                  width: '40px', height: '40px',
                  background: t.id === 'tax-payment' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : '#f1f5f9',
                  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: t.id === 'tax-payment' ? '#fff' : '#6366f1',
                }}>
                  {React.cloneElement(t.icon as React.ReactElement, { className: undefined, style: { width: '18px', height: '18px' } })}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', textAlign: 'center' }}>{t.label}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'Outfit', 'Inter', 'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#0f172a', color: '#fff', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <img src="/logo.png" alt="Logo" style={{ height: '28px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        <span style={{ fontWeight: 800, fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>RPT Queue</span>
      </header>
      <RegistrationForm selectedTransaction={selectedTransaction} onSuccess={handleFormSuccess} compact />
    </div>
  );
}

function NowServingBigScreen() {
  const [nowServing, setNowServing] = useState<string>('---');
  const [queueList, setQueueList] = useState<any[]>([]);
  const [activeCollectors, setActiveCollectors] = useState<number>(0);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const lastPlayedAudioIdRef = useRef<number>(-1);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nsRes, qRes, sRes, annRes] = await Promise.all([
          fetch('/api/queue/now-serving'), fetch('/api/queue/active'),
          fetch('/api/queue/stats'), fetch('/api/public/announcements'),
        ]);
        const nsData = await nsRes.json();
        if (nsData?.queue_number) setNowServing(formatQueueNumber(nsData.queue_number));
        const qData = await qRes.json();
        if (Array.isArray(qData)) setQueueList(qData);
        const sData = await sRes.json();
        if (sData && typeof sData.active_collectors === 'number') setActiveCollectors(sData.active_collectors);
        const annData = await annRes.json();
        if (Array.isArray(annData)) {
          setAnnouncements(annData);
          if (annData.length > 0) {
            const latest = annData[0];
            if (lastPlayedAudioIdRef.current === -1) {
              lastPlayedAudioIdRef.current = latest.id;
            } else if (latest.id > lastPlayedAudioIdRef.current) {
              if (latest.audio_data && audioPlayerRef.current) {
                audioPlayerRef.current.src = `data:${latest.audio_mime || 'audio/mpeg'};base64,${latest.audio_data}`;
                audioPlayerRef.current.play().catch(() => {});
              }
              lastPlayedAudioIdRef.current = latest.id;
            }
          } else {
            if (lastPlayedAudioIdRef.current === -1) lastPlayedAudioIdRef.current = 0;
          }
        }
      } catch { /* ignore */ } finally { setLoading(false); }
    };
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      height: '100vh', width: '100vw', background: '#0f172a', color: '#fff',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      position: 'fixed', top: 0, left: 0, zIndex: 9999,
    }}>
      <div style={{
        padding: 'clamp(20px, 3vh, 40px) clamp(24px, 4vw, 64px)', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(12px, 2vw, 20px)' }}>
          <div style={{
            width: 'clamp(40px, 5vw, 64px)', height: 'clamp(40px, 5vw, 64px)',
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)', borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(79,70,229,0.3)', flexShrink: 0, overflow: 'hidden',
          }}>
            <img src="/logo.png" alt="Logo" style={{ height: '60%', width: '60%', objectFit: 'contain', borderRadius: '4px' }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div>
            <h1 style={{ fontSize: 'clamp(18px, 3vw, 32px)', fontWeight: 900, letterSpacing: '0.02em', margin: 0 }}>RPT Queue Monitor</h1>
            <p style={{ color: '#94a3b8', fontSize: 'clamp(10px, 1.2vw, 14px)', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.1em' }}>Office of the Municipal Treasurer &bull; Real Property Section</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}><ClockDisplay /></div>
      </div>

      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: 'clamp(280px, 55%, 1.2fr) 1fr',
        gap: 'clamp(16px, 3vw, 40px)', padding: 'clamp(16px, 3vh, 40px) clamp(24px, 4vw, 64px)', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(16px, 2vh, 40px)', overflow: 'hidden' }}>
          <section style={{
            flex: 1, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
            borderRadius: 'clamp(16px, 2vw, 32px)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            padding: 'clamp(24px, 4vh, 60px)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'clamp(200px, 30vw, 400px)', height: 'clamp(200px, 30vw, 400px)', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', zIndex: 0 }} />
            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(16px, 2.5vw, 32px)', fontWeight: 900, color: '#818cf8', letterSpacing: '0.5em', textTransform: 'uppercase', marginBottom: 'clamp(20px, 4vh, 60px)', opacity: 0.8 }}>NOW SERVING</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0' }}>
                <div style={{ fontSize: 'clamp(48px, 8vw, 140px)', fontWeight: 900, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1, opacity: 0.9, textShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>RPT-</div>
                <div style={{ fontSize: 'clamp(120px, 20vw, 320px)', fontWeight: 950, lineHeight: 0.9, color: '#fff', textShadow: '0 0 100px rgba(79, 70, 229, 0.6), 0 20px 40px rgba(0,0,0,0.4)', letterSpacing: '-0.02em' }}>
                  {nowServing.split('-')[1] || '---'}
                </div>
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(12px, 1.5vw, 32px)' }}>
            <div style={bigStatBox}>
              <Users className="w-8 h-8 text-indigo-400" style={{ width: 'clamp(20px, 3vw, 32px)', height: 'clamp(20px, 3vw, 32px)', flexShrink: 0 }} />
              <div><div style={bigStatLabel}>IN QUEUE</div><div style={{ ...bigStatValue, fontSize: 'clamp(20px, 3vw, 36px)' }}>{queueList.length}</div></div>
            </div>
            <div style={bigStatBox}>
              <Monitor className="w-8 h-8 text-emerald-400" style={{ width: 'clamp(20px, 3vw, 32px)', height: 'clamp(20px, 3vw, 32px)', flexShrink: 0 }} />
              <div><div style={bigStatLabel}>{activeCollectors === 1 ? 'ACTIVE COLLECTOR' : 'ACTIVE COLLECTORS'}</div><div style={{ ...bigStatValue, fontSize: 'clamp(20px, 3vw, 36px)' }}>{activeCollectors}</div></div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(20px)', borderRadius: 'clamp(16px, 2vw, 32px)',
          border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: 'clamp(16px, 2vw, 32px) clamp(20px, 3vw, 40px)', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <div style={{ fontSize: 'clamp(10px, 1.2vw, 13px)', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em' }}>NEXT IN LINE</div>
          </div>
          <div style={{ flex: 1, padding: 'clamp(12px, 1.5vw, 24px) clamp(16px, 2.5vw, 40px)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1vw, 20px)' }}>
              {queueList.length > 0 ? (
                queueList.map((person, idx) => (
                  <div key={person.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: idx === 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)',
                    padding: 'clamp(14px, 2vw, 28px) clamp(16px, 2vw, 32px)', borderRadius: 'clamp(12px, 1.5vw, 24px)',
                    border: idx === 0 ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                    transform: idx === 0 ? 'scale(1.02)' : 'none', transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: idx === 0 ? '0 0 40px -10px rgba(99, 102, 241, 0.3)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(10px, 1.5vw, 24px)', minWidth: 0 }}>
                      <span style={{ fontSize: 'clamp(12px, 1.5vw, 18px)', fontWeight: 900, color: idx === 0 ? '#818cf8' : '#475569', width: 'clamp(20px, 2vw, 32px)', flexShrink: 0 }}>{idx + 1}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'clamp(13px, 1.8vw, 22px)', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.full_name}</div>
                        <div style={{ fontSize: 'clamp(10px, 1vw, 13px)', color: '#94a3b8', fontWeight: 600 }}>{person.transaction_type || 'Other Tax Inquiries'}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 'clamp(16px, 2.5vw, 32px)', fontWeight: 900, color: idx === 0 ? '#818cf8' : '#fff', fontFamily: 'monospace', flexShrink: 0, marginLeft: '12px' }}>
                      RPT-{String(person.queue_number).padStart(3, '0')}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: 'clamp(30px, 5vh, 60px) 0', color: '#475569' }}>
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <div style={{ fontSize: 'clamp(14px, 2vw, 20px)', fontWeight: 600 }}>ALL CAUGHT UP</div>
                  <div style={{ fontSize: 'clamp(11px, 1.2vw, 14px)' }}>No pending tickets in queue</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ padding: 'clamp(16px, 2vw, 32px) clamp(20px, 3vw, 40px)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '100px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: 'clamp(10px, 1.2vw, 14px)', fontWeight: 800, color: '#4ade80', letterSpacing: '0.05em' }}>SYSTEM STATUS: ACTIVE &amp; MONITORING</span>
            </div>
          </div>
        </div>
      </div>

      {announcements.length > 0 && (
        <div style={{
          background: 'radial-gradient(ellipse at bottom, rgba(99, 102, 241, 0.15) 0%, transparent 100%)',
          borderTop: '1px solid rgba(99, 102, 241, 0.1)', padding: '24px 0', overflow: 'hidden',
          whiteSpace: 'nowrap', position: 'relative', display: 'flex', alignItems: 'center',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.2)', zIndex: 50,
        }}>
          <div style={{ padding: '0 32px 0 64px', background: 'linear-gradient(90deg, #0f172a 80%, transparent)', position: 'absolute', left: 0, zIndex: 10, fontWeight: 800, color: '#818cf8', height: '100%', display: 'flex', alignItems: 'center', letterSpacing: '0.1em', fontSize: '18px' }}>
            <Bell className="w-6 h-6 mr-3 text-indigo-400" /> ANNOUNCEMENTS
          </div>
          <div style={{ display: 'inline-block', animation: 'marquee 30s linear infinite', paddingLeft: '100vw' }}>
            {announcements.map((a, i) => (
              <span key={i} style={{ marginRight: '120px', fontSize: '24px', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                <span style={{ color: '#fff' }}>{a.audio_data && <Bell className="w-5 h-5 inline-block mr-2 text-indigo-400" />}{a.title}</span>
                {a.body && (<><span style={{ margin: '0 16px', color: '#4f46e5' }}>&bull;</span><span style={{ fontWeight: 500, color: '#cbd5e1' }}>{a.body}</span></>)}
              </span>
            ))}
          </div>
        </div>
      )}
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const dateStr = time.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
  const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
      <div style={{ color: '#94a3b8', fontSize: '14px', letterSpacing: '0.1em', fontWeight: 700 }}>{dateStr}</div>
      <div style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1 }}>{timeStr}</div>
    </div>
  );
}

const bigStatBox: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', borderRadius: '24px', padding: '32px 40px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '24px' };
const bigStatLabel: React.CSSProperties = { fontSize: '13px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.15em', textTransform: 'uppercase' };
const bigStatValue: React.CSSProperties = { fontSize: '36px', fontWeight: 900, color: '#fff' };

export default function QueueSystem() {
  const location = useLocation();
  const [step, setStep] = useState<Step>('landing');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ticket: string; fullName: string; initials: string; service: Service; isPriority: boolean;
  } | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const isDisplayMode = new URLSearchParams(location.search).get('display') === 'true';
  const isRegisterMode = new URLSearchParams(location.search).get('register') === 'true';

  const resetToLanding = useCallback(() => {
    setStep('landing');
    setSelectedTransaction(null);
    setConfirmation(null);
  }, []);

  const resetToTransaction = useCallback(() => {
    setStep('transaction');
    setSelectedTransaction(null);
    setConfirmation(null);
  }, []);

  useIdleTimer(resetToLanding, IDLE_TIMEOUT_MS, step !== 'landing');

  useEffect(() => {
    if (step === 'result' && confirmation) {
      const timer = setTimeout(resetToLanding, RESULT_DISPLAY_MS);
      return () => clearTimeout(timer);
    }
  }, [step, confirmation, resetToLanding]);

  const handleManualEntry = useCallback(() => setStep('transaction'), []);
  const handleSelectTransaction = useCallback((t: Transaction) => { setSelectedTransaction(t); setStep('info-form'); }, []);
  const handleFormSuccess = useCallback((info: { ticket: string; fullName: string; initials: string; service: Service; isPriority: boolean }) => {
    setConfirmation(info);
    setSessionCount((c) => c + 1);
    setStep('result');
  }, []);
  const handleDone = useCallback(() => { setSessionCount(0); resetToLanding(); }, [resetToLanding]);
  const handleRegisterAnother = useCallback(() => { resetToTransaction(); }, [resetToTransaction]);
  const handleBackFromTransaction = useCallback(() => setStep('landing'), []);
  const handleBackFromForm = useCallback(() => setStep('transaction'), []);

  if (isDisplayMode) {
    return (<>
      <NowServingBigScreen />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } } @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }`}</style>
    </>);
  }

  if (isRegisterMode) {
    return (<>
      <MobileRegisterScreen />
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap'); @keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } } input:focus, select:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }`}</style>
    </>);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', 'Inter', 'Segoe UI', system-ui, sans-serif", overflow: 'hidden', background: '#f8fafc' }}>
      <header style={{
        background: '#0f172a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 3vw, 32px)', height: '56px', flexShrink: 0, gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '32px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontWeight: 800, fontSize: 'clamp(10px, 1.5vw, 13px)', letterSpacing: '0.15em', color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>RPT Queueing System</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {sessionCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(99,102,241,0.15)', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#818cf8' }}>
              <Users className="w-3.5 h-3.5" /> {sessionCount}
            </div>
          )}
          <button onClick={() => window.open(window.location.pathname + '?display=true', '_blank')} style={{
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.9)', borderRadius: '8px', padding: '6px 14px', fontSize: '11px',
            fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.2s', whiteSpace: 'nowrap', fontFamily: 'inherit',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
          >
            <Monitor className="w-3.5 h-3.5" /> LAUNCH MONITOR
          </button>
        </div>
      </header>

      {step === 'landing' && <LandingScreen onManualEntry={handleManualEntry} />}
      {step === 'transaction' && <TransactionScreen onSelect={handleSelectTransaction} onBack={handleBackFromTransaction} />}
      {step === 'info-form' && selectedTransaction && <RegistrationForm selectedTransaction={selectedTransaction} onSuccess={handleFormSuccess} showBack onBack={handleBackFromForm} />}
      {step === 'result' && confirmation && (
        <ResultScreen ticket={confirmation.ticket} fullName={confirmation.fullName} initials={confirmation.initials}
          service={confirmation.service} isPriority={confirmation.isPriority} onDone={handleDone}
          onRegisterAnother={handleRegisterAnother} sessionCount={sessionCount} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        input:focus, select:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        @media print { header, nav, button { display: none !important; } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
}
