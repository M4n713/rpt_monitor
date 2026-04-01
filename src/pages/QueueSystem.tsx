import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  FileText,
  MessageCircle,
  ArrowRight,
  HelpCircle,
  Globe,
  UserCircle2,
  Phone,
  Mail,
  Bell,
  Printer,
  Check,
  ChevronDown,
  CreditCard,
  Monitor,
  Layout,
  Clock,
  Users,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────────────────────

type Service = {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  large?: boolean;
};

type Step = 'services' | 'queue-in' | 'confirmation';

// ─── Constants ───────────────────────────────────────────────────────────────

const SERVICES: Service[] = [
  {
    id: 'tax-payment',
    icon: <CreditCard className="w-6 h-6 text-white" />,
    title: 'Tax Payment',
    description: 'Process current, advance and delinquent RPT Payments',
    large: true,
  },
  {
    id: 'tax-clearance',
    icon: <ShieldCheck className="w-5 h-5 text-indigo-500" />,
    title: 'Tax Clearance',
    description: 'Request official verification of RPT status for legal, commercial or personal purposes.',
  },
  {
    id: 'tax-certification',
    icon: <FileText className="w-5 h-5 text-indigo-400" />,
    title: 'Tax Certification',
    description: 'Obtain certified copies of previous RPT payments and assessments.',
  },
  {
    id: 'other-inquiries',
    icon: <MessageCircle className="w-5 h-5 text-slate-400" />,
    title: 'Other Tax Inquiries',
    description: 'Provide assistance with re-assessments, transfers or other RPT concerns not listed above.',
  },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function generateTicket() {
  const number = Math.floor(Math.random() * 900) + 1;
  const padded = number.toString().padStart(3, '0');
  return `RPT-${padded}`;
}

function getInitials(first: string, last: string) {
  return `${first.charAt(0).toUpperCase()}${last.charAt(0).toUpperCase()}`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TopNav({
  activeTab,
  onTabChange,
}: {
  activeTab: 'Services' | 'Status' | 'Support';
  onTabChange?: (tab: 'Services' | 'Status' | 'Support') => void;
}) {
  return (
    <header
      style={{
        background: '#0f172a',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        height: '56px',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontWeight: 800,
          fontSize: '13px',
          letterSpacing: '0.15em',
          color: '#fff',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        RPT Queueing System
      </span>

      <button
        onClick={() => window.open(window.location.pathname + '?display=true', '_blank')}
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.9)',
          borderRadius: '8px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.3)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.15)';
        }}
      >
        <Monitor className="w-4 h-4" />
        LAUNCH MONITOR
      </button>
    </header>
  );
}

// ─── Page: Services ───────────────────────────────────────────────────────────

function ServicesPage({
  onSelectService,
}: {
  onSelectService: (service: Service) => void;
}) {
  const [nowServing, setNowServing] = useState<string>('---');
  const [countersOpen, setCountersOpen] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nsRes, sRes] = await Promise.all([
          fetch('/api/queue/now-serving'),
          fetch('/api/queue/stats'),
        ]);
        const nsData = await nsRes.json();
        if (nsData && nsData.queue_number) {
          setNowServing(`RPT-${String(nsData.queue_number).padStart(3, '0')}`);
        }
        const sData = await sRes.json();
        if (sData && typeof sData.active_collectors === 'number') {
          setCountersOpen(sData.active_collectors);
        }
      } catch (err) {
        console.error('Fetch services error:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const bigService = SERVICES[0];
  const smallServices = SERVICES.slice(1);

  return (
    <div
      style={{
        flex: 1,
        background: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <main
        style={{
          flex: 1,
          padding: '48px 64px 0',
          overflowY: 'auto',
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%'
        }}
      >
        {/* Welcome heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <div style={{ width: '24px', height: '2px', background: '#6366f1' }} />
          <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.2em', color: '#6366f1', textTransform: 'uppercase' }}>
            TAXPAYER SERVICES
          </div>
        </div>
        <h1
          style={{
            fontSize: '56px',
            fontWeight: 900,
            color: '#1e293b',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            margin: '20px 0 16px',
          }}
        >
          Welcome!
        </h1>
        <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '520px', marginBottom: '60px', fontWeight: 500 }}>
          Our system is designed for your convenience. Please select the transaction you wish to process today.
        </p>

        {/* Service cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Large card */}
          <div
            onClick={() => onSelectService(bigService)}
            style={{
              background: '#fff',
              borderRadius: '24px',
              padding: '40px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 10px 15px -3px rgba(99,102,241,0.3)'
              }}
            >
              <div style={{ transform: 'scale(1.2)' }}>
                {bigService.icon}
              </div>
            </div>
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
                {bigService.title}
              </h2>
              <p style={{ fontSize: '15px', color: '#64748b', lineHeight: 1.6 }}>
                {bigService.description}
              </p>
            </div>
          </div>

          {/* Tax Clearance */}
          <SmallCard service={SERVICES[1]} onClick={() => onSelectService(SERVICES[1])} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '20px', marginBottom: '40px' }}>
          {/* Tax Certification */}
          <SmallCard service={SERVICES[2]} onClick={() => onSelectService(SERVICES[2])} />
          {/* Other inquiries */}
          <SmallCard service={SERVICES[3]} onClick={() => onSelectService(SERVICES[3])} horizontal={true} />
        </div>
      </main>

      {/* Status bar */}
      <div
        style={{
          background: '#fff',
          borderTop: '1px solid #e2e8f0',
          padding: '20px 64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#22c55e',
              animation: 'pulse 2s infinite',
              boxShadow: '0 0 10px #22c55e'
            }}
          />
          <span
            style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: '#64748b', textTransform: 'uppercase' }}
          >
            SYSTEM STATUS: OPTIMAL
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '56px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              NOW SERVING
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#1e293b' }}>{nowServing}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              COUNTERS ACTIVE
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#6366f1' }}>{countersOpen}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SmallCard({
  service,
  onClick,
  horizontal,
}: {
  service: Service;
  onClick: () => void;
  horizontal?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff',
        borderRadius: '24px',
        padding: horizontal ? '32px 40px' : '40px',
        border: '1px solid #e2e8f0',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        alignItems: horizontal ? 'center' : 'flex-start',
        gap: '24px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.1)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#6366f1';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.borderColor = '#e2e8f0';
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          background: '#f1f5f9',
          borderRadius: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#4f46e5'
        }}
      >
        <div style={{ transform: 'scale(1)' }}>
          {service.icon}
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>
          {service.title}
        </h3>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>{service.description}</p>
      </div>
    </div>
  );
}

// ─── Page: Queue In ───────────────────────────────────────────────────────────

function QueueInPage({
  selectedService,
  onSuccess,
}: {
  selectedService: Service;
  onSuccess: (info: { ticket: string; fullName: string; initials: string; service: Service }) => void;
}) {
  const [formData, setFormData] = useState({
    first_name: '',
    mi: '',
    last_name: '',
    age: '',
    gender: '',
    contact_number: '+63',
    email: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [nowServing, setNowServing] = useState<string>('---');
  const [assignedTicket, setAssignedTicket] = useState<string | null>(null);

  useEffect(() => {
    const fetchNowServing = async () => {
      try {
        const res = await fetch('/api/queue/now-serving');
        const data = await res.json();
        if (data && data.queue_number) {
          setNowServing(`RPT-${String(data.queue_number).padStart(3, '0')}`);
        } else {
          setNowServing('---');
        }
      } catch (err) {
        console.error('Failed to fetch now serving:', err);
      }
    };

    fetchNowServing();
    const interval = setInterval(fetchNowServing, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleMIChange = (val: string) => {
    let cleaned = val.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (cleaned.length > 2) cleaned = cleaned.substring(0, 2);
    setFormData({ ...formData, mi: cleaned.length > 0 ? cleaned + '.' : '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      };

      const res = await fetch('/api/queue/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setAssignedTicket(data.queue_label);
        // Show in sidebar for a second before transitioning
        setTimeout(() => {
          onSuccess({
            ticket: data.queue_label,
            fullName: data.user?.full_name ?? `${formData.first_name} ${formData.last_name}`,
            initials: getInitials(formData.first_name, formData.last_name),
            service: selectedService,
          });
        }, 1500);
      } else {
        setError(data.error || 'Failed to join queue');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTicket = (ticket: string) => {
    // Already formatted as RPT-001 in state
    return ticket;
  };

  const currentWait = Math.floor(Math.random() * 10) + 8;

  return (
    <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, padding: '48px 64px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 400px', gap: '64px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Left: form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ width: '24px', height: '2px', background: '#6366f1' }} />
              <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.2em', color: '#6366f1', textTransform: 'uppercase' }}>
                REGISTRATION
              </div>
            </div>
            <h1 style={{ fontSize: '56px', fontWeight: 900, color: '#1e293b', lineHeight: 1, letterSpacing: '-0.02em', margin: '0 0 16px' }}>
              Queue In
            </h1>
            <p style={{ color: '#64748b', fontSize: '16px', maxWidth: '520px', fontWeight: 500 }}>
              Please provide your details. This information helps us process your transaction efficiently.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '32px',
            background: '#fff',
            padding: '48px',
            borderRadius: '32px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'
          }}>
            {/* Row 1: First Name, MI, Last Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 1fr', gap: '24px' }}>
              <Field label="FIRST NAME">
                <input
                  style={inputStyle}
                  placeholder="e.g. Juan"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  required
                />
              </Field>
              <Field label="MI">
                <input
                  style={inputStyle}
                  placeholder="D."
                  value={formData.mi}
                  onChange={(e) => handleMIChange(e.target.value)}
                />
              </Field>
              <Field label="LAST NAME">
                <input
                  style={inputStyle}
                  placeholder="e.g. Dela Cruz"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  required
                />
              </Field>
            </div>

            {/* Row 2: Age, Gender, Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 160px 1fr', gap: '24px' }}>
              <Field label="AGE">
                <input
                  style={inputStyle}
                  placeholder="00"
                  value={formData.age}
                  maxLength={3}
                  onInput={(e) => {
                    const val = e.currentTarget.value.replace(/\D/g, '').slice(0, 3);
                    setFormData({ ...formData, age: val });
                  }}
                  required
                />
              </Field>
              <Field label="GENDER">
                <div style={{ position: 'relative' }}>
                  <select
                    style={{ ...inputStyle, paddingRight: '40px', appearance: 'none', cursor: 'pointer' }}
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    required
                  >
                    <option value=""></option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  <ChevronDown
                    className="w-5 h-5"
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}
                  />
                </div>
              </Field>
              <Field label="CONTACT NUMBER">
                <div style={{ position: 'relative' }}>
                  <Phone
                    className="w-5 h-5"
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                  />
                  <input
                    style={{ ...inputStyle, paddingLeft: '44px' }}
                    placeholder="+639123456789"
                    value={formData.contact_number}
                    onInput={(e) => {
                      let val = e.currentTarget.value;
                      if (!val.startsWith('+63')) val = '+63' + val.replace(/\D/g, '');
                      else val = '+63' + val.substring(3).replace(/\D/g, '');
                      if (val.length > 13) val = val.slice(0, 13);
                      setFormData({ ...formData, contact_number: val });
                    }}
                    required
                  />
                </div>
              </Field>
            </div>

            {/* Row 3: Email */}
            <Field label="EMAIL ADDRESS" optional>
              <div style={{ position: 'relative' }}>
                <Mail
                  className="w-5 h-5"
                  style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  style={{ ...inputStyle, paddingLeft: '44px' }}
                  placeholder="taxpayer@domain.com"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </Field>

            {error && (
              <p style={{ color: '#ef4444', fontSize: '14px', background: '#fef2f2', padding: '16px 20px', borderRadius: '12px', border: '1px solid #fee2e2', fontWeight: 600 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                padding: '20px 40px',
                fontWeight: 800,
                fontSize: '16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.3s',
                width: 'fit-content',
                boxShadow: loading ? 'none' : '0 10px 15px -3px rgba(99,102,241,0.3)'
              }}
              onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = '#1e293b'; }}
            >
              {loading ? (
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <>Get Queue Number <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '16px' }}>
              By proceeding, you agree to our{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span> and{' '}
              <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span> regarding tax data management.
            </p>
          </form>
        </div>

        {/* Right: sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Current wait */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '20px 24px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
              Current Wait
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: '#0f172a' }}>{currentWait} MINS</div>
          </div>

          {/* Queue number display */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #234e7d 100%)',
              borderRadius: '16px',
              padding: '64px 24px',
              textAlign: 'center',
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
              Your Number Is
            </div>
            <div style={{ 
              fontSize: '64px', 
              fontWeight: 900, 
              letterSpacing: '-0.02em', 
              lineHeight: 1.1,
              wordWrap: 'break-word',
              overflowWrap: 'anywhere'
            }}>
              {assignedTicket ? formatTicket(assignedTicket) : '---'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>
              Wait For Your Turn
            </div>
          </div>

          {/* Live flow */}
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '16px 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#475569', textTransform: 'uppercase' }}>Live Flow</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#475569' }}>Now Serving</span>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#4f46e5' }}>{nowServing}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Shared Field wrapper
function Field({
  label,
  children,
  optional,
}: {
  label: string;
  placeholder?: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase' }}>
          {label}
        </label>
        {optional && (
          <span style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>OPTIONAL</span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#f8fafc',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  padding: '16px 20px',
  fontSize: '16px',
  color: '#1e293b',
  fontWeight: 600,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  transition: 'all 0.2s'
};

// ─── Page: Confirmation ───────────────────────────────────────────────────────

function ConfirmationPage({
  ticket,
  fullName,
  initials,
  service,
  onDone,
}: {
  ticket: string;
  fullName: string;
  initials: string;
  service: Service;
  onDone: () => void;
}) {
  const waitMins = Math.floor(Math.random() * 8) + 10;
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onDone();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDone]);

  const [nowServing, setNowServing] = useState<string>('---');
  const [queueList, setQueueList] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Now Serving
        const nsRes = await fetch('/api/queue/now-serving');
        const nsData = await nsRes.json();
        if (nsData && nsData.queue_number) {
          setNowServing(`RPT-${String(nsData.queue_number).padStart(3, '0')}`);
        }

        // Fetch Queue List
        const qRes = await fetch('/api/queue/active');
        const qData = await qRes.json();
        if (Array.isArray(qData)) {
          setQueueList(qData);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ flex: 1, background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <main style={{ flex: 1, padding: '64px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 400px', gap: '80px', maxWidth: '1400px', margin: '0 auto', width: '100%', alignItems: 'center' }}>
        {/* Left: Premium Ticket */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '32px',
              padding: '64px',
              textAlign: 'center',
              width: '100%',
              maxWidth: '480px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '8px', background: 'linear-gradient(90deg, #6366f1, #a855f7)' }} />
            
            <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.2em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '40px' }}>
              CURRENTLY SERVING
            </div>
            <div
              style={{
                fontSize: '104px',
                fontWeight: 950,
                color: '#1e293b',
                lineHeight: 1,
                letterSpacing: '-0.05em',
                marginBottom: '48px',
              }}
            >
              {nowServing}
            </div>
            
            <div style={{ background: '#f1f5f9', borderRadius: '24px', padding: '40px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.1em' }}>
                YOUR TICKET NUMBER
              </div>
              <div style={{ fontSize: '48px', fontWeight: 950, color: '#6366f1', letterSpacing: '-0.02em' }}>{ticket}</div>
            </div>

            <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
              <div style={{ width: '24px', height: '24px', background: '#22c55e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(34,197,94,0.4)' }}>
                <Check className="w-4 h-4 text-white" />
              </div>
              <span style={{ fontSize: '16px', fontWeight: 700 }}>Next in line: Approx. {waitMins} mins</span>
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '60px' }}>
          {/* Selected service */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
              Transaction
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{service.title}</div>
          </div>

          <div style={{ height: '1px', background: '#e2e8f0' }} />

          {/* Taxpayer name */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>
              Taxpayer Name
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #60a5fa, #34d399)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>{fullName}</div>
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: '#e2e8f0' }} />

          {/* Queue List */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '12px' }}>
              Current Queue
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {queueList.length > 0 ? (
                queueList.slice(0, 5).map((person, idx) => (
                  <div 
                    key={person.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      background: person.full_name === fullName ? 'rgba(99, 102, 241, 0.05)' : '#fff',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: person.full_name === fullName ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{idx + 1}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{person.full_name}</span>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#6366f1' }}>
                      RPT-{String(person.queue_number).padStart(3, '0')}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>No other taxpayers in queue</div>
              )}
              {queueList.length > 5 && (
                <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '4px' }}>
                  + {queueList.length - 5} more in line
                </div>
              )}
            </div>
          </div>

          <div style={{ height: '1px', background: '#e2e8f0' }} />

          {/* Actions - Removed per user request */}

          </div>
        </main>
      </div>
  );
}

// ─── Page: Big Screen Display ──────────────────────────────────────────────────

function NowServingBigScreen() {
  const [nowServing, setNowServing] = useState<string>('---');
  const [queueList, setQueueList] = useState<any[]>([]);
  const [activeCollectors, setActiveCollectors] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [nsRes, qRes, sRes] = await Promise.all([
          fetch('/api/queue/now-serving'),
          fetch('/api/queue/active'),
          fetch('/api/queue/stats'),
        ]);

        const nsData = await nsRes.json();
        if (nsData && nsData.queue_number) {
          setNowServing(`RPT-${String(nsData.queue_number).padStart(3, '0')}`);
        }

        const qData = await qRes.json();
        if (Array.isArray(qData)) {
          setQueueList(qData);
        }

        const sData = await sRes.json();
        if (sData && typeof sData.active_collectors === 'number') {
          setActiveCollectors(sData.active_collectors);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 3000); // Faster refresh for public display
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: '#0f172a', // Direct dark theme for high visibility
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div 
        style={{ 
          padding: '40px 64px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(79,70,229,0.3)'
          }}>
            <Monitor className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '0.02em', margin: 0 }}>
              RPT QUEUE MONITOR
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0', fontWeight: 600, letterSpacing: '0.1em' }}>
              REAL-TIME UPDATE
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '20px', fontWeight: 800 }}>
            <ClockDisplay />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', padding: '40px 64px' }}>
        {/* Left: Now Serving Hero */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          <section
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)',
              borderRadius: '32px',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Animated Glow Background */}
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
              zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
              <div style={{ 
                fontSize: '32px', 
                fontWeight: 900, 
                color: '#818cf8', 
                letterSpacing: '0.5em', 
                textTransform: 'uppercase',
                marginBottom: '60px',
                opacity: 0.8
              }}>
                NOW SERVING
              </div>

              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center',
                gap: '0'
              }}>
                <div style={{ 
                  fontSize: '140px', 
                  fontWeight: 900, 
                  color: '#fff', 
                  letterSpacing: '0.1em', 
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  opacity: 0.9,
                  textShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  RPT-
                </div>
                <div 
                  style={{ 
                    fontSize: '320px', 
                    fontWeight: 950, 
                    lineHeight: 0.9,
                    color: '#fff',
                    textShadow: '0 0 100px rgba(79, 70, 229, 0.6), 0 20px 40px rgba(0,0,0,0.4)',
                    fontFamily: "'Inter', sans-serif",
                    letterSpacing: '-0.02em'
                  }}
                >
                  {nowServing.split('-')[1] || '---'}
                </div>
              </div>
            </div>
          </section>

          {/* Quick Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            <div style={bigStatBox}>
              <Users className="w-8 h-8 text-indigo-400" />
              <div>
                <div style={bigStatLabel}>IN QUEUE</div>
                <div style={bigStatValue}>{queueList.length}</div>
              </div>
            </div>
            <div style={bigStatBox}>
              <Layout className="w-8 h-8 text-emerald-400" />
              <div>
                <div style={bigStatLabel}>{activeCollectors === 1 ? 'ACTIVE COLLECTOR' : 'ACTIVE COLLECTORS'}</div>
                <div style={bigStatValue}>{activeCollectors}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Queue List */}
        <div style={{ 
          background: 'rgba(15, 23, 42, 0.6)', 
          backdropFilter: 'blur(20px)',
          borderRadius: '32px', 
          border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)'
        }}>
          <div style={{ 
            padding: '32px 40px', 
            background: 'rgba(255,255,255,0.03)', 
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 700, letterSpacing: '0.1em' }}>NEXT IN LINE</div>
          </div>
          
          <div style={{ flex: 1, padding: '24px 40px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {queueList.length > 0 ? (
                queueList.map((person, idx) => (
                  <div 
                    key={person.id} 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      background: idx === 0 ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.02)',
                      padding: '28px 32px',
                      borderRadius: '24px',
                      border: idx === 0 ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255,255,255,0.05)',
                      transform: idx === 0 ? 'scale(1.02)' : 'none',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: idx === 0 ? '0 0 40px -10px rgba(99, 102, 241, 0.3)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <span style={{ 
                        fontSize: '18px', 
                        fontWeight: 900, 
                        color: idx === 0 ? '#818cf8' : '#475569',
                        width: '32px'
                      }}>
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{person.full_name}</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{person.transaction_type || 'Other Tax Inquiries'}</div>
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '32px', 
                      fontWeight: 900, 
                      color: idx === 0 ? '#818cf8' : '#fff',
                      fontFamily: 'monospace'
                    }}>
                      RPT-{String(person.queue_number).padStart(3, '0')}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
                  <Users className="w-16 h-16 mx-auto mb-4 opacity-10" />
                  <div style={{ fontSize: '20px', fontWeight: 600 }}>ALL CAUGHT UP</div>
                  <div style={{ fontSize: '14px' }}>No pending tickets in queue</div>
                </div>
              )}
            </div>
          </div>

          <div style={{ padding: '32px 40px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '12px 24px', 
              background: 'rgba(34, 197, 94, 0.1)', 
              borderRadius: '100px',
              border: '1px solid rgba(34, 197, 94, 0.2)'
            }}>
              <div 
                style={{ 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  background: '#22c55e',
                  animation: 'pulse 1.5s infinite' 
                }} 
              />
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#4ade80', letterSpacing: '0.05em' }}>
                SYSTEM STATUS: ACTIVE & MONITORING
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const dateStr = time.toLocaleDateString(undefined, { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }).toUpperCase();

  const timeStr = time.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: true 
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
      <div style={{ color: '#94a3b8', fontSize: '14px', letterSpacing: '0.1em', fontWeight: 700 }}>{dateStr}</div>
      <div style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1 }}>{timeStr}</div>
    </div>
  );
}

const bigStatBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  borderRadius: '24px',
  padding: '32px 40px',
  border: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  alignItems: 'center',
  gap: '24px'
};

const bigStatLabel: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: '#94a3b8',
  letterSpacing: '0.15em',
  textTransform: 'uppercase'
};

const bigStatValue: React.CSSProperties = {
  fontSize: '36px',
  fontWeight: 900,
  color: '#fff'
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function QueueSystem() {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>('services');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [confirmation, setConfirmation] = useState<{
    ticket: string;
    fullName: string;
    initials: string;
    service: Service;
  } | null>(null);

  // Check for display mode via query parameter: /queue?display=true
  const isDisplayMode = new URLSearchParams(location.search).get('display') === 'true';

  const activeTab =
    step === 'services' ? 'Services' : step === 'confirmation' ? 'Status' : 'Services';

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep('queue-in');
  };

  const handleSuccess = (info: { ticket: string; fullName: string; initials: string; service: Service }) => {
    // Show ticket for 3 seconds then return to services
    setTimeout(() => {
      setStep('services');
      setSelectedService(null);
    }, 4000);
  };

  // If in display mode, show the big screen display only
  if (isDisplayMode) {
    return (
      <>
        <NowServingBigScreen />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        `}</style>
      </>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      <TopNav activeTab={activeTab} />

      {step === 'services' && <ServicesPage onSelectService={handleSelectService} />}

      {step === 'queue-in' && selectedService && (
        <QueueInPage selectedService={selectedService} onSuccess={handleSuccess} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        input:focus, select:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        @media print {
          header, nav, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
