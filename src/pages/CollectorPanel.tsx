import React, { useEffect, useState, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAuth } from '../components/ui/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatPinSearch, autoFormatPinInput } from '@/src/lib/utils';
import { extractSoaData, normalizeArea, normalizeLotNo, normalizeOwnerName, normalizePin, type SoaExtractionResult } from '@/src/lib/soaPdf';
import {
  getAvailableRules,
  isRuleEffective,
  calculateTaxForYear as computeTaxForYear,
  calculateTaxForRange as computeTaxForRange,
  type ComputationRule,
} from '@/src/lib/rptComputation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Badge } from "@/src/components/ui/badge";
import {
  Calculator,
  Menu,
  X,
  CreditCard,
  FileText,
  Users,
  Settings,
  LogOut,
  ClipboardList,
  Search,
  Loader2,
  History,
  Home,
  Activity,
  Printer,
  Trash2,
  Globe
} from 'lucide-react';

interface Property {
  id: number;
  owner_id: number | null;
  registered_owner_name: string;
  pin: string;
  td_no: string;
  lot_no: string;
  address: string;
  description: string;
  assessed_value: number;
  tax_due: number;
  status: 'paid' | 'unpaid' | 'partial';
  last_payment_date: string | null;
  total_area: string;
  ownership_type?: string;
  claimed_area?: string;
  old_pin?: string;
  taxability?: string;
  classification?: string;
  remarks?: string;
}

interface Payment {
  id: number;
  property_id: number;
  amount: number;
  payment_date: string;
  collector_id: number;
  or_no: string;
  year: string;
  basic_tax: number;
  sef_tax: number;
  interest: number;
  discount: number;
  collector_name?: string;
  taxpayer_name?: string;
  registered_owner_name?: string;
  remarks?: string;
}

interface RptarUploadedSoaBatch {
  fileName: string;
  summary: SoaExtractionResult;
  rows: any[];
}

interface User {
  id: number;
  full_name: string;
  username: string;
  last_active_at?: string;
  queue_number?: number;
}

const buildPinMetaMap = (items: Property[]) => {
  const counts = new Map<string, number>();
  const seen = new Map<string, number>();
  const meta = new Map<number, { count: number; index: number }>();

  items.forEach(item => {
    counts.set(item.pin, (counts.get(item.pin) || 0) + 1);
  });

  items.forEach(item => {
    const index = (seen.get(item.pin) || 0) + 1;
    seen.set(item.pin, index);
    meta.set(item.id, { count: counts.get(item.pin) || 1, index });
  });

  return meta;
};

const getLocationFromPin = (pin: string) => {
  if (!pin) return 'Unknown Location';
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

const FormattedCurrencyInput = ({ value, onChange, className }: { value: string | number, onChange: (val: string) => void, className?: string }) => {
  const [internalValue, setInternalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      if (value === "" || value === undefined || value === null) {
        setInternalValue("");
      } else {
        const num = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
        if (isNaN(num)) {
          setInternalValue("");
        } else {
          setInternalValue(num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      }
    } else {
      // When focused, strip commas for easy editing
      setInternalValue(String(value).replace(/,/g, ''));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value);
    const rawValue = e.target.value.replace(/[^0-9.-]/g, '');
    onChange(rawValue);
  };

  return (
    <Input
      type={isFocused ? "number" : "text"}
      className={className}
      value={internalValue}
      onChange={handleChange}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    />
  );
};

const STANDARD_RANGES = [
  [1974, 1978], [1979, 1984], [1985, 1991], [1992, 1994],
  [1995, 1997], [1998, 2000], [2001, 2003], [2004, 2006],
  [2007, 2015], [2016, 2026]
];

const calculateTaxForYear = (
  year: number,
  prop: Property,
  computationType: string,
  manualAssessedValue?: number,
  options = {},
  rules?: ComputationRule[]
) => computeTaxForYear(year, prop, computationType, manualAssessedValue, options, rules);

const calculateTaxForRange = (
  startYear: number,
  endYear: number,
  prop: Property,
  computationType: string,
  manualAssessedValue?: number,
  options = {},
  rules?: ComputationRule[]
) => computeTaxForRange(startYear, endYear, prop, computationType, manualAssessedValue, options, rules);

const getCalculationOptions = (applyInterest: boolean, applyDiscount: boolean) => ({
  includeInterest: applyInterest,
  includeDiscount: applyDiscount
});

import { ActiveUsersList } from '@/src/components/ActiveUsersList';
import { MessagePopup } from '@/src/components/MessagePopup';
import { MessagingPanel } from '@/src/components/MessagingPanel';

export default function CollectorPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Data State
  const [taxpayers, setTaxpayers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);

  // Selection State
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');

  // Payment Queue State
  const [paymentQueue, setPaymentQueue] = useState<any[]>([]);
  const [pendingAssessments, setPendingAssessments] = useState<any[]>([]);
  const [computationRules, setComputationRules] = useState<ComputationRule[]>([]);

  // Form State
  const [paymentForm, setPaymentForm] = useState({
    or_no: '',
    year: '',
    assessed_value: '',
    basic_tax: '',
    sef_tax: '',
    interest: '',
    discount: '',
    amount: '',
    computationType: 'standard', // kept for compatibility with existing records
    applyInterest: false,
    applyDiscount: false
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeStatus(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordChangeStatus({ type: 'error', message: 'New passwords do not match' });
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setPasswordChangeStatus({ type: 'success', message: 'Password changed successfully' });
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordChangeStatus({ type: 'error', message: data.error || 'Failed to change password' });
      }
    } catch (err) {
      setPasswordChangeStatus({ type: 'error', message: 'An error occurred' });
    }
  };

  // Navigation State
  const [activeTab, setActiveTab] = useState('payment-queue');
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);
  const [queueNumber, setQueueNumber] = useState('RPT-001');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [taxpayerLogs, setTaxpayerLogs] = useState<any[]>([]);
  const [rptarSearchQuery, setRptarSearchQuery] = useState('');
  const [rptarSearchResults, setRptarSearchResults] = useState<Property[]>([]);
  const [rptarSelectedPropertyId, setRptarSelectedPropertyId] = useState<number | null>(null);
  const [rptarPayments, setRptarPayments] = useState<Payment[]>([]);
  const [collectorPayments, setCollectorPayments] = useState<any[]>([]);
  const [isRptarSearching, setIsRptarSearching] = useState(false);
  const [isRptarPdfProcessing, setIsRptarPdfProcessing] = useState(false);
  const rptarPdfInputRef = useRef<HTMLInputElement>(null);
  const [rptarUploadedSoasByProperty, setRptarUploadedSoasByProperty] = useState<Record<number, RptarUploadedSoaBatch[]>>({});
  const [rptarUploadStatus, setRptarUploadStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [uploadedSoaSummary, setUploadedSoaSummary] = useState<SoaExtractionResult | null>(null);
  const [isAbstractLoading, setIsAbstractLoading] = useState(false);
  const [abstractSearchQuery, setAbstractSearchQuery] = useState('');
  const [activeAbstractSearchQuery, setActiveAbstractSearchQuery] = useState('');

  const availableComputationRules = useMemo(
    () => getAvailableRules(computationRules),
    [computationRules]
  );

  useEffect(() => {
    if (!availableComputationRules.some(rule => rule.value === paymentForm.computationType)) {
      setPaymentForm(prev => ({ ...prev, computationType: 'standard' }));
    }
  }, [availableComputationRules, paymentForm.computationType]);

  const abstractSummary = useMemo(() => {
    const filtered = collectorPayments.filter(p =>
      p.or_no?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
      p.year?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
      p.pin?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
      p.taxpayer_name?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
      p.registered_owner_name?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase())
    );

    const uniqueTaxpayers = new Set(filtered.map(p => p.taxpayer_name).filter(Boolean)).size;
    const uniquePins = new Set(filtered.map(p => p.pin).filter(Boolean)).size;
    const totalAmount = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
    const toDateAmount = collectorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return { uniqueTaxpayers, uniquePins, totalAmount, toDateAmount, filtered };
  }, [collectorPayments, activeAbstractSearchQuery]);

  const [selectedLogPins, setSelectedLogPins] = useState<string[]>([]);
  const [selectedLogProperties, setSelectedLogProperties] = useState<Property[]>([]);
  const [isLoadingLogProperties, setIsLoadingLogProperties] = useState(false);
  const [showLogPinsModal, setShowLogPinsModal] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [taxpayerTimeIn, setTaxpayerTimeIn] = useState<Record<string, string>>({});

  const [erptaasPin, setErptaasPin] = useState('');
  const [erptaasUrl, setErptaasUrl] = useState('');

  const rptarPinMeta = useMemo(() => buildPinMetaMap(rptarSearchResults), [rptarSearchResults]);
  const selectedRptarUploadedSoas = useMemo(
    () => (rptarSelectedPropertyId ? (rptarUploadedSoasByProperty[rptarSelectedPropertyId] || []) : []),
    [rptarSelectedPropertyId, rptarUploadedSoasByProperty]
  );

  const syncGlobalSearch = (val: string, submit: boolean = false) => {
    const formatted = autoFormatPinInput(val);
    setRptarSearchQuery(formatted);
    setAbstractSearchQuery(formatted);
    setErptaasPin(formatted);

    if (submit) {
      const finalFormatted = formatPinSearch(formatted);
      // Update active filters
      setActiveAbstractSearchQuery(finalFormatted);
      // Trigger RPTAR search
      handleRptarSearch(null, finalFormatted);
      // Trigger eRPTAAS search
      const url = `https://www.ompassessor.com.ph/etax/redirectpage/esearchproperty.php?iSearchTxt=${finalFormatted}&iMode=2&iMunicipality=09&iGoSearch=Search`;
      setErptaasUrl(url);
    }
  };

  const latestDataRef = useRef({ taxpayers, properties, taxpayerTimeIn });

  useEffect(() => {
    latestDataRef.current = { taxpayers, properties, taxpayerTimeIn };
  }, [taxpayers, properties, taxpayerTimeIn]);

  const currentLogIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Logging is now handled server-side on link/payment actions
  }, [selectedTaxpayerId]);

  const fetchCollectorPayments = async () => {
    setIsAbstractLoading(true);
    try {
      const res = await fetch('/api/collector/payments');
      if (res.ok) {
        const data = await res.json();
        setCollectorPayments(data);
      }
    } catch (err) {
      console.error('Failed to fetch collector payments:', err);
    } finally {
      setIsAbstractLoading(false);
    }
  };

  const fetchComputationRules = async () => {
    try {
      const res = await fetch('/api/admin/computation-types');
      if (res.ok) setComputationRules(await res.json());
    } catch (err) {
      console.error('Failed to fetch computation rules:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'rpt-abstract') {
      fetchCollectorPayments();
      const interval = setInterval(fetchCollectorPayments, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    const fetchActiveUsersCount = async () => {
      try {
        const res = await fetch('/api/active-users');
        if (res.ok) {
          const data = await res.json();
          setActiveUsersCount(data.length);
        }
      } catch (err) {
        // Ignore network errors
      }
    };

    fetchActiveUsersCount();
    const interval = setInterval(fetchActiveUsersCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'erptaas') {
      const currentPin = rptarSearchResults.find(p => p.id === rptarSelectedPropertyId)?.pin ||
        properties.find(p => p.id.toString() === selectedPropertyId)?.pin || '';
      if (currentPin) setErptaasPin(currentPin);
    }
  }, [activeTab, rptarSelectedPropertyId, selectedPropertyId, rptarSearchResults, properties]);


  const menuItems = [
    { id: 'payment-queue', label: 'Payment Queue', subtitle: 'Manage Payments and Assessments', icon: CreditCard },
    { id: 'rptar', label: 'RPTAR', subtitle: 'RPT Account Register', icon: Users },
    { id: 'computation', label: 'RPT Computation', subtitle: 'Calculate Tax Due', icon: Calculator },
    { id: 'rpt-abstract', label: 'RPT Abstract', subtitle: 'Record of Collections', icon: FileText },
    { id: 'erptaas', label: 'eRPTAAS', icon: Globe },
    { id: 'taxpayer-log', label: 'Taxpayer Log', subtitle: 'Monitor Taxpayer Activity', icon: ClipboardList },
    { id: 'active-users', label: 'Active Users', subtitle: 'Currently Online Users', icon: Users },
    { id: 'settings', label: 'Settings', subtitle: 'Manage Account Settings', icon: Settings },
    ...(user?.role === 'admin' ? [{ id: 'back-to-admin', label: 'Back to Admin', subtitle: 'Return to Admin Panel', icon: Home }] : []),
  ];

  // UI State
  const [isComputationVisible, setIsComputationVisible] = useState(false);

  // Preview State
  const [previewItems, setPreviewItems] = useState<any[]>([]);

  const isOnline = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    return (now.getTime() - date.getTime()) < 5 * 60 * 1000; // 5 minutes
  };

  // Fetch initial data
  const [rptAbstractData, setRptAbstractData] = useState<any>(null);

  // Sort taxpayers by queue number (if available) or earliest pending assessment
  const sortedTaxpayers = useMemo(() => {
    return [...taxpayers].sort((a, b) => {
      // Primary sort: Queue Number
      if (a.queue_number && b.queue_number) {
        return a.queue_number - b.queue_number;
      }
      if (a.queue_number) return -1;
      if (b.queue_number) return 1;

      // Secondary sort: Pending Assessments (First Come First Serve)
      const aAssessments = pendingAssessments.filter(p => {
        const prop = properties.find(pr => pr.id === p.property_id);
        return prop && prop.owner_id === a.id;
      });
      const bAssessments = pendingAssessments.filter(p => {
        const prop = properties.find(pr => pr.id === p.property_id);
        return prop && prop.owner_id === b.id;
      });

      if (aAssessments.length === 0 && bAssessments.length === 0) return 0;
      if (aAssessments.length === 0) return 1;
      if (bAssessments.length === 0) return -1;

      // Get earliest date
      const aMin = Math.min(...aAssessments.map(as => new Date(as.created_at).getTime()));
      const bMin = Math.min(...bAssessments.map(bs => new Date(bs.created_at).getTime()));

      return aMin - bMin;
    });
  }, [taxpayers, pendingAssessments, properties]);

  useEffect(() => {
    if (activeTab === 'payment-queue' && sortedTaxpayers.length > 0 && !selectedTaxpayerId) {
      const firstId = sortedTaxpayers[0].id.toString();
      setSelectedTaxpayerId(firstId);
      // Queue number will be set by the effect below
      if (!taxpayerTimeIn[firstId]) {
        setTaxpayerTimeIn(prev => ({ ...prev, [firstId]: new Date().toISOString() }));
      }
    }
  }, [activeTab, sortedTaxpayers, selectedTaxpayerId]);

  // Update Queue Number when selected taxpayer changes
  useEffect(() => {
    if (selectedTaxpayerId) {
      const taxpayer = taxpayers.find(t => t.id.toString() === selectedTaxpayerId);
      if (taxpayer && taxpayer.queue_number) {
        setQueueNumber(`RPT-${String(taxpayer.queue_number).padStart(3, '0')}`);
      } else {
        // Fallback or if not yet assigned a queue number
        const index = sortedTaxpayers.findIndex(t => t.id.toString() === selectedTaxpayerId);
        if (index !== -1) {
          // If we don't have a queue number, we might want to show something else or nothing.
          // But for now, let's stick to the index-based fallback if queue_number is missing, 
          // although with the backend change, it should be there.
          // However, if the frontend hasn't refreshed the user list yet, it might be missing.
          // Let's just use "???" to indicate missing queue number if we expect it.
          // But to be safe and not break UI:
          setQueueNumber(`RPT-${String(index + 1).padStart(3, '0')}`);
        }
      }
    }
  }, [selectedTaxpayerId, taxpayers, sortedTaxpayers]);

  useEffect(() => {
    if (rptarSelectedPropertyId) {
      fetch(`/api/properties/${rptarSelectedPropertyId}/payments`)
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return res.json();
          }
          throw new Error('Not JSON');
        })
        .then(setRptarPayments)
        .catch(console.error);
    } else {
      setRptarPayments([]);
    }
  }, [rptarSelectedPropertyId]);

  useEffect(() => {
    setRptarUploadStatus(null);
  }, [rptarSelectedPropertyId]);

  const handleRptarSearch = async (e: React.FormEvent | null, overrideQuery?: string) => {
    e?.preventDefault();
    const queryToUse = overrideQuery || rptarSearchQuery;
    if (!queryToUse.trim()) return;
    setIsRptarSearching(true);
    setRptarSelectedPropertyId(null);
    setRptarUploadedSoasByProperty({});
    setRptarUploadStatus(null);
    try {
      const formattedQuery = formatPinSearch(queryToUse);
      const res = await fetch(`/api/properties?search=${encodeURIComponent(formattedQuery)}&includeTaxpayer=true`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();
      setRptarSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRptarSearching(false);
    }
  };

  const getSoaMatchIssues = (soa: SoaExtractionResult, prop: Property) => {
    const issues: string[] = [];

    if (!soa.ownerName || normalizeOwnerName(soa.ownerName) !== normalizeOwnerName(prop.registered_owner_name)) {
      issues.push(`Registered Owner mismatch (SOA: ${soa.ownerName || 'Not found'} | App: ${prop.registered_owner_name || 'Not found'})`);
    }

    if (!soa.pin || normalizePin(soa.pin) !== normalizePin(prop.pin)) {
      issues.push(`PIN mismatch (SOA: ${soa.pin || 'Not found'} | App: ${prop.pin || 'Not found'})`);
    }

    if (!soa.lotNo || normalizeLotNo(soa.lotNo) !== normalizeLotNo(prop.lot_no)) {
      issues.push(`Lot# mismatch (SOA: ${soa.lotNo || 'Not found'} | App: ${prop.lot_no || 'Not found'})`);
    }

    if (!soa.area || normalizeArea(soa.area) !== normalizeArea(prop.total_area)) {
      issues.push(`Area mismatch (SOA: ${soa.area || 'Not found'} | App: ${prop.total_area || 'Not found'})`);
    }

    return issues;
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPropertyId) return;

    setIsPdfProcessing(true);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => (item as any).str || '').join(" ");
          fullText += pageText + "\n";
        } catch (pageErr) {
          console.warn(`Warning: Failed to extract text from page ${i}:`, pageErr);
        }
      }

      if (!fullText || fullText.trim().length === 0) {
        alert("PDF file is empty or contains no readable text. Please ensure it's a valid document with text content.");
        return;
      }

      const prop = properties.find(p => p.id.toString() === selectedPropertyId);
      if (!prop) {
        alert("Selected property not found.");
        return;
      }

      const extractedSoa = extractSoaData(fullText);
      setUploadedSoaSummary(extractedSoa);

      const matchIssues = getSoaMatchIssues(extractedSoa, prop);
      if (matchIssues.length > 0) {
        alert(`SOA does not match the selected property.\n\n${matchIssues.join('\n')}`);
        return;
      }

      if (extractedSoa.groupedRanges.length === 0) {
        alert("No valid entries found in the PDF.\n\nTroubleshooting:\n• Expected format: TD# followed by Assessed Value and Year.\n• Example: 001-0017-A 12,460.00 2003");
        return;
      }

      const generatedItems = extractedSoa.groupedRanges.map(range => {
        const result = calculateTaxForRange(
          range.startYear,
          range.endYear,
          prop,
          paymentForm.computationType,
          range.assessedValue,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
          computationRules
        );
        return {
          property_id: parseInt(selectedPropertyId),
          pin: prop.pin,
          td_no: prop.td_no,
          year: range.startYear === range.endYear ? range.startYear.toString() : `${range.startYear}-${range.endYear}`,
          yearCount: range.endYear - range.startYear + 1,
          assessed_value: range.assessedValue,
          ...result,
          or_no: paymentForm.or_no,
          computationType: paymentForm.computationType,
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount,
          amount: Number(result.amount)
        };
      });

      if (generatedItems.length > 0) {
        let overallMin = Infinity;
        let overallMax = -Infinity;
        for (const item of generatedItems) {
          const parts = String(item.year).split('-');
          const startYear = parseInt(parts[0], 10);
          const endYear = parts.length > 1 ? parseInt(parts[1], 10) : startYear;
          if (startYear < overallMin) overallMin = startYear;
          if (endYear > overallMax) overallMax = endYear;
        }

        const rangeLabel = overallMin === overallMax ? `${overallMin}` : `${overallMin}-${overallMax}`;
        setPaymentForm(prev => ({ ...prev, year: rangeLabel }));
        setPreviewItems(generatedItems);

        if (selectedTaxpayerId) {
          try {
            const assessmentsToSave = generatedItems.map(item => ({
              property_id: item.property_id,
              taxpayer_id: selectedTaxpayerId,
              amount: item.amount,
              year: item.year,
              assessed_value: item.assessed_value,
              basic_tax: parseFloat(String(item.basic_tax || 0)),
              sef_tax: parseFloat(String(item.sef_tax || 0)),
              interest: parseFloat(String(item.interest || 0)),
              discount: parseFloat(String(item.discount || 0))
            }));

            await fetch('/api/assessments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assessmentsToSave)
            });
          } catch (err) {
            console.error('Failed to save assessments:', err);
          }
        }

        const ownerWarning =
          extractedSoa.ownerName &&
          normalizeOwnerName(extractedSoa.ownerName) !== normalizeOwnerName(prop.registered_owner_name)
            ? `\n\nWarning: SOA Name is "${extractedSoa.ownerName}" while property owner is "${prop.registered_owner_name}". Please verify before payment.`
            : '';

        alert(
          `Successfully extracted SOA data.\n\nRegistered Owner: ${extractedSoa.ownerName || 'Not found'}\nPIN: ${extractedSoa.pin || 'Not found'}\nLot#: ${extractedSoa.lotNo || 'Not found'}\nArea: ${extractedSoa.area || 'Not found'}\nYears: ${rangeLabel}\nEntries: ${generatedItems.length}${ownerWarning}`
        );
      } else {
        alert("No valid data ranges found in the SOA. Please ensure the document contains clear year and assessed value columns.");
      }
    } catch (err) {
      console.error('PDF processing error:', err);
      alert('Failed to process SOA. Please make sure it is a valid PDF document.');
    } finally {
      setIsPdfProcessing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleRptarPdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const isSingle = files.length === 1;

    // Only strictly require search results for single-file upload (matching requested behavior)
    if (isSingle && rptarSearchResults.length === 0) {
      setRptarUploadStatus({ type: 'error', text: 'Search properties first before uploading a single SOA for RPTAR.' });
      if (rptarPdfInputRef.current) rptarPdfInputRef.current.value = '';
      return;
    }

    setIsRptarPdfProcessing(true);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const uploadsByProperty: Record<number, RptarUploadedSoaBatch[]> = {};
      const matchedMessages: string[] = [];
      const failedMessages: string[] = [];
      let nextSelectedPropertyId = rptarSelectedPropertyId;

      for (const file of files) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map((item: any) => (item as any).str || '').join(' ') + '\n';
          }

          if (!fullText.trim()) {
            failedMessages.push(`${file.name}: PDF contains no readable text.`);
            continue;
          }

          const extractedSoa = extractSoaData(fullText);
          if (extractedSoa.tdGroupedRanges.length === 0) {
            failedMessages.push(`${file.name}: no TD#, Year, and Assessed Value rows were found.`);
            continue;
          }

          let matchedProperty: Property | undefined;

          if (isSingle) {
            // For single upload: must match currently searched results
            const matchedProperties = rptarSearchResults.filter(prop => getSoaMatchIssues(extractedSoa, prop).length === 0);
            if (matchedProperties.length === 0) {
              failedMessages.push(`${file.name}: no searched property matched the SOA fields.`);
              continue;
            }
            if (matchedProperties.length > 1) {
              failedMessages.push(`${file.name}: matched multiple properties. Narrow the search or open the exact record first.`);
              continue;
            }
            matchedProperty = matchedProperties[0];
          } else {
            // For multiple uploads: match by PIN, Owner, Lot, and Area against ALL properties in our list
            // (Uses strict validation but bypasses the "currently searched" results constraint)
            const matchedProperties = properties.filter(prop => getSoaMatchIssues(extractedSoa, prop).length === 0);
            
            if (matchedProperties.length === 0) {
              failedMessages.push(`${file.name}: no property record matched the SOA fields (Owner/PIN/Lot/Area).`);
              continue;
            }
            
            if (matchedProperties.length > 1) {
              failedMessages.push(`${file.name}: matches multiple properties in the registry. Needs manual selection.`);
              continue;
            }

            matchedProperty = matchedProperties[0];
          }

          if (matchedProperty) {
            // Prepare assessment records for history
            const soaRows = extractedSoa.tdGroupedRanges.map((range, index) => ({
              id: `rptar-soa-${matchedProperty!.id}-${Date.now()}-${index}`,
              td_no: range.tdNo,
              year: range.startYear === range.endYear ? `${range.startYear}` : `${range.startYear}-${range.endYear}`,
              assessed_value: range.assessedValue,
              basic_tax: 0,
              sef_tax: 0,
              interest: 0,
              discount: 0,
              record_type: 'assessment',
              remarks: `SOA: ${file.name}`
            }));

            // PERSIST TO DATABASE: Save to assessments table
            const assessmentsToSave = extractedSoa.tdGroupedRanges.map(range => ({
              property_id: matchedProperty!.id,
              taxpayer_id: matchedProperty!.owner_id, // can be null now
              amount: 0, // Placeholder
              year: range.startYear === range.endYear ? `${range.startYear}` : `${range.startYear}-${range.endYear}`,
              assessed_value: range.assessedValue,
              basic_tax: 0,
              sef_tax: 0,
              interest: 0,
              discount: 0,
              td_no: range.tdNo
            }));

            const res = await fetch('/api/assessments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assessmentsToSave)
            });

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              failedMessages.push(`${file.name}: Database error (${errorData.error || res.statusText})`);
              continue;
            }

            // Successfully matched AND saved
            if (!uploadsByProperty[matchedProperty.id]) {
              uploadsByProperty[matchedProperty.id] = [];
            }

            uploadsByProperty[matchedProperty.id].push({
              fileName: file.name,
              summary: extractedSoa,
              rows: soaRows
            });

            if (!nextSelectedPropertyId) {
              nextSelectedPropertyId = matchedProperty.id;
            }

            matchedMessages.push(`${file.name} -> ${matchedProperty.registered_owner_name} (${matchedProperty.pin})`);
          }
        } catch (fileErr) {
          console.error(`Error processing file ${file.name}:`, fileErr);
          failedMessages.push(`${file.name}: processing error.`);
        }
      }

      if (Object.keys(uploadsByProperty).length > 0) {
        setRptarUploadedSoasByProperty(prev => {
          const merged = { ...prev };
          for (const [propertyIdText, batches] of Object.entries(uploadsByProperty)) {
            const propertyId = Number(propertyIdText);
            merged[propertyId] = [...(merged[propertyId] || []), ...batches];
          }
          return merged;
        });
      }

      if (nextSelectedPropertyId) {
        setRptarSelectedPropertyId(nextSelectedPropertyId);
      }

      if (matchedMessages.length > 0 && failedMessages.length === 0) {
        setRptarUploadStatus({
          type: 'success',
          text: `Success: ${matchedMessages.length} file(s) saved to account history.`
        });
      } else if (matchedMessages.length > 0) {
        setRptarUploadStatus({
          type: 'success',
          text: `Matched: ${matchedMessages.length} file(s) saved. Failed: ${failedMessages.length} file(s).`
        });
      } else {
        setRptarUploadStatus({
          type: 'error',
          text: failedMessages.length > 0 ? failedMessages[0] : 'No valid files processed.'
        });
      }

      // If failures exist, alert them (since status bar might only show the first)
      if (failedMessages.length > 0) {
        console.warn('RPTAR Processing Failures:', failedMessages);
      }

    } catch (err) {
      console.error('RPTAR PDF processing error:', err);
      setRptarUploadStatus({
        type: 'error',
        text: 'Failed to process SOA files. Please check the console for details.'
      });
    } finally {
      setIsRptarPdfProcessing(false);
      if (rptarPdfInputRef.current) rptarPdfInputRef.current.value = '';
    }
  };
  const fetchTaxpayerLogs = async () => {
    try {
      const res = await fetch('/api/taxpayer-logs');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setTaxpayerLogs(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch taxpayer logs', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchComputationRules();
    fetchProperties();
    fetchAssessments();
    fetchTaxpayerLogs();
  }, []);

  useEffect(() => {
    if (selectedTaxpayerId) {
      fetch('/api/collector/view-taxpayer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ taxpayer_id: selectedTaxpayerId })
      }).catch(err => console.error('Failed to log view-taxpayer', err));
    }

    setSelectedPropertyId('');
    setPaymentQueue([]); // Clear queue on taxpayer change
    setPreviewItems([]); // Clear preview
    setUploadedSoaSummary(null);
    resetForm();
  }, [selectedTaxpayerId]);

  // Update form when property changes
  useEffect(() => {
    if (selectedPropertyId) {
      const prop = properties.find(p => p.id.toString() === selectedPropertyId);
      if (prop) {
        const defaultYear = prop.last_payment_date
          ? (new Date(prop.last_payment_date).getFullYear() + 1).toString()
          : new Date().getFullYear().toString();

        setPaymentForm(prev => ({
          ...prev,
          year: defaultYear,
          assessed_value: '', // Removed from form, handled in preview
          basic_tax: '',
          sef_tax: '',
          interest: '',
          discount: '',
          amount: '',
          computationType: 'standard'
        }));
        setUploadedSoaSummary(null);
        // Auto-generate preview for default year
        generatePreview(defaultYear, 'standard', prop);
      }
    }
  }, [selectedPropertyId]);

  // Re-generate preview when Year or Computation Type changes
  useEffect(() => {
    if (!selectedPropertyId || !paymentForm.year) return;
    const prop = properties.find(p => p.id.toString() === selectedPropertyId);
    if (!prop) return;
    generatePreview(paymentForm.year, paymentForm.computationType, prop);
  }, [paymentForm.year, paymentForm.computationType, selectedPropertyId]);

  useEffect(() => {
    if (!selectedPropertyId) return;
    const prop = properties.find(p => p.id.toString() === selectedPropertyId);
    if (!prop) return;

    setPreviewItems(prevItems => {
      if (prevItems.length === 0) return prevItems;

      return prevItems.map(item => {
        const yearParts = String(item.year).split('-');
        const startYear = parseInt(yearParts[0].trim(), 10);
        const endYear = yearParts.length > 1 ? parseInt(yearParts[1].trim(), 10) : startYear;
        const manualAV = parseFloat(String(item.assessed_value).replace(/,/g, ''));
        const result = calculateTaxForRange(
          startYear,
          endYear,
          prop,
          item.computationType || paymentForm.computationType,
          isNaN(manualAV) ? 0 : manualAV,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount)
        );

        return {
          ...item,
          basic_tax: result.basic_tax,
          sef_tax: result.sef_tax,
          interest: result.interest,
          discount: result.discount,
          amount: Number(result.amount),
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount
        };
      });
    });
  }, [paymentForm.applyInterest, paymentForm.applyDiscount, paymentForm.computationType, properties, selectedPropertyId]);

  useEffect(() => {
    setPaymentQueue(prevQueue => {
      if (prevQueue.length === 0) return prevQueue;

      const needsUpdate = prevQueue.some(item =>
        item.applyInterest !== paymentForm.applyInterest ||
        item.applyDiscount !== paymentForm.applyDiscount
      );
      if (!needsUpdate) return prevQueue;

      return prevQueue.map(item => {
        const prop = properties.find(p => p.id === item.property_id);
        if (!prop) return item;

        const yearParts = String(item.year).split('-');
        const startYear = parseInt(yearParts[0].trim(), 10);
        const endYear = yearParts.length > 1 ? parseInt(yearParts[1].trim(), 10) : startYear;
        const manualAV = parseFloat(String(item.assessed_value).replace(/,/g, ''));
        const result = calculateTaxForRange(
          startYear,
          endYear,
          prop,
          item.computationType || paymentForm.computationType,
          isNaN(manualAV) ? 0 : manualAV,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount)
        );

        return {
          ...item,
          basic_tax: result.basic_tax,
          sef_tax: result.sef_tax,
          interest: result.interest,
          discount: result.discount,
          amount: Number(result.amount),
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount
        };
      });
    });
  }, [paymentForm.applyInterest, paymentForm.applyDiscount, paymentForm.computationType, properties]);

  const generatePreview = (yearInput: string, type: string, prop: Property) => {
    const currentYear = new Date().getFullYear();

    // DENR: always force to the 10-year window regardless of what the user typed
    if (type === 'denr') {
      const denrStart = currentYear - 10;
      const denrEnd = currentYear;
      const denrLabel = `${denrStart}-${denrEnd}`;

      // Update the year input to show the forced DENR range
      setPaymentForm(prev => ({ ...prev, year: denrLabel }));

      const result = calculateTaxForRange(
        denrStart,
        denrEnd,
        prop,
        'denr',
        prop.assessed_value,
        getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
        computationRules
      );
      setPreviewItems([{
        year: denrLabel,
        yearCount: denrEnd - denrStart + 1,
        assessed_value: prop.assessed_value,
        ...result,
        amount: Number(result.amount),
        applyInterest: paymentForm.applyInterest,
        applyDiscount: paymentForm.applyDiscount,
        isManual: true
      }]);
      return;
    }

    if (!yearInput) {
      setPreviewItems([]);
      return;
    }

    let items: any[] = [];

    // Check if it's a range input or single year
    if (yearInput.includes('-')) {
      // If user is typing a range, we might wait or just try to parse
      const parts = yearInput.split('-');
      const start = parseInt(parts[0]);
      const end = parseInt(parts[1]);

      if (!isNaN(start) && !isNaN(end)) {
        // It's a manual range, treat as single item for now unless we want to explode it?
        // The previous logic treated manual ranges as one row.
        // But "Generate Ranges" button exploded it.
        // Let's keep it simple: manual input = 1 row, unless "Generate Ranges" is clicked.
        // BUT, user wants table.
        // Let's make "Generate Ranges" just a helper to fill the input?
        // No, the previous logic was: Input -> Generate -> Queue.
        // New logic: Input -> Preview Table -> Queue.

        // If manual range, show 1 row.
        const avToUse = start < 2016 ? 0 : prop.assessed_value;
        const result = calculateTaxForRange(
          start,
          end,
          prop,
          type,
          avToUse,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
          computationRules
        );
        items.push({
          year: yearInput,
          yearCount: end - start + 1,
          assessed_value: avToUse,
          ...result,
          amount: Number(result.amount),
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount,
          isManual: true
        });
      }
    } else {
      const year = parseInt(yearInput);
      if (!isNaN(year)) {
        const avToUse = year < 2016 ? 0 : prop.assessed_value;
        const result = calculateTaxForRange(
          year,
          year,
          prop,
          type,
          avToUse,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
          computationRules
        );
        items.push({
          year: yearInput,
          yearCount: 1,
          assessed_value: avToUse,
          ...result,
          amount: Number(result.amount),
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount,
          isManual: true
        });
      }
    }
    setPreviewItems(items);
  };

  const handleGenerateRanges = () => {
    if (!selectedPropertyId || !paymentForm.year) return;
    const prop = properties.find(p => p.id.toString() === selectedPropertyId);
    if (!prop) return;

    const currentYear = new Date().getFullYear();

    // DENR: always force to the 10-year window
    if (paymentForm.computationType === 'denr') {
      const denrStart = currentYear - 10;
      const denrEnd = currentYear;
      const denrLabel = `${denrStart}-${denrEnd}`;
      const result = calculateTaxForRange(
        denrStart,
        denrEnd,
        prop,
        'denr',
        prop.assessed_value,
        getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
        computationRules
      );
      setPreviewItems([{
        property_id: parseInt(selectedPropertyId),
        pin: prop.pin,
        year: denrLabel,
        yearCount: denrEnd - denrStart + 1,
        assessed_value: prop.assessed_value,
        ...result,
        or_no: paymentForm.or_no,
        computationType: 'denr',
        applyInterest: paymentForm.applyInterest,
        applyDiscount: paymentForm.applyDiscount,
        amount: Number(result.amount)
      }]);
      setPaymentForm(prev => ({ ...prev, year: denrLabel }));
      return;
    }

    const startYear = parseInt(paymentForm.year);
    if (isNaN(startYear)) return;

    const generatedItems = [];
    let currentStart = startYear;

    while (currentStart <= 2026) {
      const range = STANDARD_RANGES.find(r => currentStart >= r[0] && currentStart <= r[1]);

      if (range) {
        const endYear = range[1];
        const avToUse = currentStart < 2016 ? 0 : prop.assessed_value;
        const result = calculateTaxForRange(
          currentStart,
          endYear,
          prop,
          paymentForm.computationType,
          avToUse,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
          computationRules
        );
        generatedItems.push({
          property_id: parseInt(selectedPropertyId),
          pin: prop.pin,
          year: currentStart === endYear ? currentStart.toString() : `${currentStart}-${endYear}`,
          yearCount: endYear - currentStart + 1,
          assessed_value: avToUse,
          ...result,
          or_no: paymentForm.or_no,
          computationType: paymentForm.computationType,
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount,
          amount: Number(result.amount)
        });
        currentStart = endYear + 1;
      } else {
        const avToUse = currentStart < 2016 ? 0 : prop.assessed_value;
        const result = calculateTaxForRange(
          currentStart,
          currentStart,
          prop,
          paymentForm.computationType,
          avToUse,
          getCalculationOptions(paymentForm.applyInterest, paymentForm.applyDiscount),
          computationRules
        );
        generatedItems.push({
          property_id: parseInt(selectedPropertyId),
          pin: prop.pin,
          year: currentStart.toString(),
          yearCount: 1,
          assessed_value: avToUse,
          ...result,
          or_no: paymentForm.or_no,
          computationType: paymentForm.computationType,
          applyInterest: paymentForm.applyInterest,
          applyDiscount: paymentForm.applyDiscount,
          amount: Number(result.amount)
        });
        currentStart++;
      }
    }

    setPreviewItems(generatedItems);
  };

  const handlePreviewItemChange = (index: number, field: string, value: string) => {
    const newPreview = [...previewItems];
    const item = newPreview[index];

    if (field === 'assessed_value') {
      item.assessed_value = value; // Keep as string for input

      const prop = properties.find(p => p.id.toString() === selectedPropertyId);
      if (prop) {
        let startYear, endYear;
        if (item.year.includes('-')) {
          const parts = item.year.split('-');
          startYear = parseInt(parts[0]);
          endYear = parseInt(parts[1]);
        } else {
          startYear = parseInt(item.year);
          endYear = startYear;
        }

        const manualAV = parseFloat(value);
        // If manualAV is NaN (empty), pass 0 or undefined.
        const result = calculateTaxForRange(
          startYear,
          endYear,
          prop,
          paymentForm.computationType,
          isNaN(manualAV) ? 0 : manualAV,
          getCalculationOptions(
            item.applyInterest ?? paymentForm.applyInterest,
            item.applyDiscount ?? paymentForm.applyDiscount
          ),
          computationRules
        );

        item.basic_tax = result.basic_tax;
        item.sef_tax = result.sef_tax;
        item.interest = result.interest;
        item.discount = result.discount;
        item.amount = Number(result.amount);
        item.applyInterest = item.applyInterest ?? paymentForm.applyInterest;
        item.applyDiscount = item.applyDiscount ?? paymentForm.applyDiscount;
      }
    }
    setPreviewItems(newPreview);
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/collector/taxpayers');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();
      setTaxpayers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const fetchProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();
      setProperties(data);
    } catch (err) {
      console.error('Failed to fetch properties', err);
    }
  };

  const fetchAssessments = async () => {
    try {
      const res = await fetch('/api/assessments');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();
      setPendingAssessments(data);
    } catch (err) {
      console.error('Failed to fetch assessments', err);
    }
  };

  const resetForm = () => {
    setPaymentForm({
      or_no: paymentForm.or_no, // Keep OR No.
      year: '',
      assessed_value: '',
      basic_tax: '',
      sef_tax: '',
      interest: '',
      discount: '',
      amount: '',
      computationType: 'standard',
      applyInterest: paymentForm.applyInterest,
      applyDiscount: paymentForm.applyDiscount
    });
    setPreviewItems([]);
  };

  const addToQueue = () => {
    if (previewItems.length === 0) return;

    const prop = properties.find(p => p.id.toString() === selectedPropertyId);
    if (!prop) return;

    const newItems = previewItems.map(item => ({
      property_id: parseInt(selectedPropertyId),
      taxpayer_id: parseInt(selectedTaxpayerId),
      pin: prop.pin,
      ...item,
      or_no: paymentForm.or_no,
      computationType: paymentForm.computationType,
      applyInterest: item.applyInterest ?? paymentForm.applyInterest,
      applyDiscount: item.applyDiscount ?? paymentForm.applyDiscount,
      remarks: paymentForm.computationType === 'share' ? 'Share Area' : ''
    }));

    setPaymentQueue([...paymentQueue, ...newItems]);
    setSelectedPropertyId(''); // Reset selection
    resetForm();
  };

  const addAssessmentToQueue = (assessment: any) => {
    const newItem = {
      property_id: assessment.property_id,
      taxpayer_id: assessment.taxpayer_id || parseInt(selectedTaxpayerId),
      pin: assessment.pin,
      year: assessment.year,
      yearCount: assessment.year.includes('-') ? (parseInt(assessment.year.split('-')[1]) - parseInt(assessment.year.split('-')[0]) + 1) : 1,
      assessed_value: assessment.property_assessed_value,
      basic_tax: assessment.basic_tax,
      sef_tax: assessment.sef_tax,
      interest: assessment.interest,
      discount: assessment.discount,
      amount: assessment.amount,
      computationType: 'standard',
      applyInterest: parseFloat(String(assessment.interest || 0)) > 0,
      applyDiscount: parseFloat(String(assessment.discount || 0)) > 0,
      or_no: '',
      assessment_id: assessment.id,
      remarks: ''
    };

    setPaymentQueue([...paymentQueue, newItem]);
    setPendingAssessments(prev => prev.filter(a => a.id !== assessment.id));
  };

  // Removed handleQueueItemChange since queue is now read-only (or removed via button)

  const removeFromQueue = async (index: number) => {
    const newQueue = [...paymentQueue];
    newQueue.splice(index, 1);
    setPaymentQueue(newQueue);

    // Record time_out for the taxpayer when item is removed from queue
    if (selectedTaxpayerId) {
      try {
        await fetch('/api/taxpayer-log/time-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taxpayer_id: selectedTaxpayerId })
        });
      } catch (err) {
        console.error('Failed to record time_out:', err);
      }
    }

    // Refresh assessments, but keep assessments already moved to `paymentQueue` hidden.
    // `/api/assessments` returns the server-side pending list and does NOT know about
    // the client-side `paymentQueue`, so a plain refetch would cause other items to re-appear.
    try {
      const res = await fetch('/api/assessments');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();

      const queuedAssessmentIds = new Set(newQueue.map(q => q.assessment_id));
      setPendingAssessments(data.filter((a: any) => !queuedAssessmentIds.has(a.id)));
    } catch (err) {
      console.error('Failed to refresh assessments after queue removal', err);
      // Fallback: at least show UI update (queue item already removed).
      fetchAssessments();
    }
  };

  const removeFromPreview = (index: number) => {
    const newPreview = [...previewItems];
    newPreview.splice(index, 1);
    setPreviewItems(newPreview);

    // Sync the Year/Range input to the remaining items
    if (newPreview.length > 0) {
      let overallMin = Infinity;
      let overallMax = -Infinity;
      for (const gi of newPreview) {
        const parts = String(gi.year).split('-');
        const s = parseInt(parts[0]);
        const e = parts.length > 1 ? parseInt(parts[1]) : s;
        if (s < overallMin) overallMin = s;
        if (e > overallMax) overallMax = e;
      }
      const rangeLabel = overallMin === overallMax ? `${overallMin}` : `${overallMin}-${overallMax}`;
      setPaymentForm(prev => ({ ...prev, year: rangeLabel }));
    } else {
      setPaymentForm(prev => ({ ...prev, year: '' }));
    }
  };

  const handlePayment = async () => {
    if (paymentQueue.length === 0 || !paymentForm.or_no) return;

    if (paymentForm.or_no.length < 8) {
      alert('OR Number must be between 8 and 10 digits.');
      return;
    }

    try {
      // Add OR No to all items
      const payload = paymentQueue.map(item => ({
        ...item,
        or_no: paymentForm.or_no
      }));

      // Send each payment individually since the backend expects a single object
      let allSuccess = true;
      for (const item of payload) {
        const res = await fetch('/api/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (!res.ok) {
          allSuccess = false;
          break;
        }
      }

      if (allSuccess) {
        // Calculate Abstract Data
        const totalBasic = paymentQueue.reduce((sum, item) => sum + parseFloat(item.basic_tax || '0'), 0);
        const totalSef = paymentQueue.reduce((sum, item) => sum + parseFloat(item.sef_tax || '0'), 0);
        const totalAmount = paymentQueue.reduce((sum, item) => sum + item.amount, 0);

        const abstractData = {
          date: new Date().toLocaleDateString(),
          orNo: paymentForm.or_no,
          taxpayerName: taxpayers.find(t => t.id.toString() === selectedTaxpayerId)?.full_name || 'Unknown',
          totalBasic,
          totalSef,
          totalAmount
        };

        // Log taxpayer activity - REMOVED (Handled by backend)

        setRptAbstractData(abstractData);
        setPaymentQueue([]);
        setPaymentForm(prev => ({ ...prev, or_no: '' }));
        fetchProperties(); // Refresh list
        fetchAssessments(); // Refresh assessments
        fetchCollectorPayments(); // Refresh collector abstract
        setActiveTab('rpt-abstract'); // Switch to Abstract View
      } else {
        alert('Payment failed');
      }
    } catch (err) {
      console.error('Payment error', err);
    }
  };

  // Filter properties for selected taxpayer
  const taxpayerProperties = properties.filter(p => p.owner_id && p.owner_id.toString() === selectedTaxpayerId);
  const selectedProperty = properties.find(p => p.id.toString() === selectedPropertyId);



  const handleReviewComputation = (assessment: any) => {
    // Pre-fill form with assessment data
    setPaymentForm({
      or_no: '',
      year: assessment.year,
      assessed_value: assessment.property_assessed_value,
      basic_tax: assessment.basic_tax,
      sef_tax: assessment.sef_tax,
      interest: assessment.interest,
      discount: assessment.discount,
      amount: assessment.amount,
      computationType: 'standard', // Default or infer from assessment if stored
      applyInterest: parseFloat(String(assessment.interest || 0)) > 0,
      applyDiscount: parseFloat(String(assessment.discount || 0)) > 0
    });

    // Set selected property
    setSelectedPropertyId(assessment.property_id.toString());

    // Set preview items to match assessment
    const newItem = {
      property_id: assessment.property_id,
      pin: assessment.pin,
      year: assessment.year,
      yearCount: assessment.year.includes('-') ? (parseInt(assessment.year.split('-')[1]) - parseInt(assessment.year.split('-')[0]) + 1) : 1,
      assessed_value: assessment.property_assessed_value,
      basic_tax: assessment.basic_tax,
      sef_tax: assessment.sef_tax,
      interest: assessment.interest,
      discount: assessment.discount,
      amount: assessment.amount,
      computationType: 'standard',
      applyInterest: parseFloat(String(assessment.interest || 0)) > 0,
      applyDiscount: parseFloat(String(assessment.discount || 0)) > 0,
      or_no: '',
      assessment_id: assessment.id,
      isManual: true // Treat as manual to avoid auto-recalc overriding
    };
    setPreviewItems([newItem]);

    // Switch to computation tab
    setActiveTab('computation');
    setIsComputationVisible(true);
  };

  // Filter assessments for selected taxpayer
  const taxpayerAssessments = pendingAssessments.filter(a => {
    // Check if assessment has a direct taxpayer_id
    if (a.taxpayer_id && a.taxpayer_id.toString() === selectedTaxpayerId) {
      return true;
    }
    // Fallback: Find property owner for this assessment
    const prop = properties.find(p => p.id === a.property_id);
    return prop && prop.owner_id && prop.owner_id.toString() === selectedTaxpayerId;
  });

  // OR Input State for direct payment in queue
  const [orInputs, setOrInputs] = useState<Record<string, string>>({});

  const handleOrInputChange = (id: string, value: string) => {
    // Only allow digits
    const digitsOnly = value.replace(/\D/g, '');
    // Limit to max 9 digits
    const limited = digitsOnly.slice(0, 9);
    setOrInputs(prev => ({ ...prev, [id]: limited }));
  };

  const handleAssessmentValueChange = (assessmentId: number, newValue: string) => {
    setPendingAssessments(prev => prev.map(a => {
      if (a.id !== assessmentId) return a;
      
      const prop = properties.find(p => p.id === a.property_id);
      if (!prop) return a;

      let startYear, endYear;
      if (a.year.includes('-')) {
        const parts = a.year.split('-');
        startYear = parseInt(parts[0]);
        endYear = parseInt(parts[1]);
      } else {
        startYear = parseInt(a.year);
        endYear = startYear;
      }

      const manualAV = parseFloat(newValue.replace(/,/g, ''));
      const result = calculateTaxForRange(startYear, endYear, prop, 'standard', isNaN(manualAV) ? 0 : manualAV, {}, computationRules);
      

      return {
        ...a,
        property_assessed_value: newValue, // Keep as string for input
        basic_tax: result.basic_tax,
        sef_tax: result.sef_tax,
        interest: result.interest,
        discount: result.discount,
        amount: result.amount
      };
    }));
  };

  const handleRemoveAssessment = async (assessmentId: number) => {
    if (!confirm('Are you sure you want to remove this suggested computation?')) return;
    try {
      // Find the assessment to get taxpayer_id
      const assessment = pendingAssessments.find((a: any) => a.id === assessmentId);
      const taxpayerId = assessment?.taxpayer_id;

      // Record time_out for the taxpayer when assessment is removed
      if (taxpayerId) {
        try {
          await fetch('/api/taxpayer-log/time-out', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taxpayer_id: taxpayerId })
          });
        } catch (err) {
          console.error('Failed to record time_out:', err);
        }
      }

      // Delete the assessment
      const res = await fetch(`/api/assessments/${assessmentId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        console.log('[DEBUG] Assessment removed successfully:', assessmentId);

        // Keep assessments already moved into `paymentQueue` hidden.
        try {
          const pendingRes = await fetch('/api/assessments');
          if (!pendingRes.ok) throw new Error(`HTTP error! status: ${pendingRes.status}`);
          const contentType = pendingRes.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new TypeError("Oops, we haven't got JSON!");
          }
          const data = await pendingRes.json();
          const queuedAssessmentIds = new Set(paymentQueue.map(q => q.assessment_id));
          setPendingAssessments(data.filter((a: any) => !queuedAssessmentIds.has(a.id)));
        } catch (e) {
          // Fallback: at least refresh the UI.
          fetchAssessments();
        }
      } else {
        const text = await res.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          console.error('[DEBUG] Failed to parse error JSON. Body:', text);
          alert(`Failed to remove assessment: ${res.status} ${res.statusText}\n\nResponse was not JSON. Root cause might be a server crash or invalid URL.`);
          return;
        }

        console.error('[DEBUG] Failed to remove assessment:', res.status, errorData);
        const errorMsg = errorData.error || 'Server error';
        const details = errorData.details ? `\nDetails: ${errorData.details}` : '';
        const stack = errorData.stack ? `\nStack: ${errorData.stack.substring(0, 200)}...` : '';
        alert(`Failed to remove assessment: ${errorMsg}${details}${stack}`);
      }
    } catch (err) {
      console.error('Remove assessment error:', err);
      alert('An error occurred');
    }
  };

  const handleCommit = async (assessment: any) => {
    const orNo = orInputs[assessment.id];
    if (!orNo) {
      alert('Please enter an OR Number.');
      return;
    }
    if (orNo.length < 8) {
      alert('OR Number must be between 8 and 10 digits.');
      return;
    }

    try {
      const payloadItem = {
        property_id: assessment.property_id,
        taxpayer_id: assessment.taxpayer_id || parseInt(selectedTaxpayerId),
        pin: assessment.pin,
        year: assessment.year,
        yearCount: assessment.year.includes('-') ? (parseInt(assessment.year.split('-')[1]) - parseInt(assessment.year.split('-')[0]) + 1) : 1,
        assessed_value: assessment.property_assessed_value,
        basic_tax: assessment.basic_tax,
        sef_tax: assessment.sef_tax,
        interest: assessment.interest,
        discount: assessment.discount,
        amount: assessment.amount,
        computationType: 'standard',
        or_no: orNo,
        assessment_id: assessment.id,
        remarks: '',
        td_no: assessment.td_no
      };

      const received = window.confirm("Tax Payment Received?");
      if (!received) {
        // Log session closure as Cancelled
        const tIn = taxpayerTimeIn[selectedTaxpayerId] || new Date().toISOString();
        const tOut = new Date().toISOString();
        fetch('/api/taxpayer-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxpayer_id: selectedTaxpayerId,
            taxpayer_name: taxpayers.find(t => t.id.toString() === selectedTaxpayerId)?.full_name || 'Unknown',
            pins: JSON.stringify([assessment.pin]),
            time_in: tIn,
            time_out: tOut,
            remarks: 'Cancelled'
          })
        }).catch(console.error);
        
        alert('Payment session cancelled - Marked as Cancelled in logs');
        return;
      }

      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadItem),
      });

      if (res.ok) {
        const abstractData = {
          date: new Date().toLocaleDateString(),
          orNo: orNo,
          taxpayerName: taxpayers.find(t => t.id.toString() === selectedTaxpayerId)?.full_name || 'Unknown',
          totalBasic: parseFloat(assessment.basic_tax || '0'),
          totalSef: parseFloat(assessment.sef_tax || '0'),
          totalAmount: assessment.amount
        };

        // Log taxpayer activity - REMOVED (Handled by backend)

        setRptAbstractData(abstractData);
        setOrInputs(prev => {
          const newState = { ...prev };
          delete newState[assessment.id];
          return newState;
        });
        fetchProperties();
        fetchAssessments();
        fetchCollectorPayments();

        const remainingAssessments = taxpayerAssessments.filter(a => a.id !== assessment.id);
        if (remainingAssessments.length === 0) {
          setActiveTab('rpt-abstract');
        } else {
          alert(`Payment successful. OR No: ${orNo}. There are still ${remainingAssessments.length} pending assessment(s).`);
        }
      } else {
        alert('Payment failed');
      }
    } catch (err) {
      console.error('Payment error', err);
      alert('An error occurred during payment.');
    }
  };

  const renderPaymentQueue = () => (
    <div className="grid gap-8">
      {/* Selection Section */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm">
        <CardContent className="space-y-6 pt-8 pb-8 px-8">
          <div className="flex items-end justify-between gap-6">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                <Select
                  value={selectedTaxpayerId}
                  onValueChange={v => {
                    setSelectedTaxpayerId(v);
                    if (!taxpayerTimeIn[v]) {
                      setTaxpayerTimeIn(prev => ({ ...prev, [v]: new Date().toISOString() }));
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-12 text-base bg-white border-gray-200 shadow-none hover:border-blue-300 transition-all duration-200 rounded-none pl-10">
                    <SelectValue placeholder="Search or select a taxpayer..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <div className="p-2 sticky top-0 bg-white z-10 border-b border-gray-100 mb-1">
                      <p className="text-xs font-medium text-gray-400 px-2 uppercase tracking-wider">Assigned Taxpayers</p>
                    </div>
                    {sortedTaxpayers.map(tp => (
                      <SelectItem key={tp.id} value={tp.id.toString()} className="py-3 px-4 focus:bg-blue-50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${isOnline(tp.last_active_at) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-300'}`} />
                          <span className="font-medium text-gray-700">{tp.full_name}</span>
                          {tp.username && <span className="text-xs text-gray-400 font-mono ml-auto">@{tp.username}</span>}
                        </div>
                      </SelectItem>
                    ))}
                    {sortedTaxpayers.length === 0 && (
                      <div className="py-8 text-center text-gray-400 text-sm italic">
                        No taxpayers assigned to you.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center space-y-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider text-center">Current Queue</span>
              <div className="bg-indigo-50 text-indigo-700 font-mono text-2xl font-bold px-6 py-2 rounded-none border border-indigo-100 shadow-none text-center min-w-[120px] h-12 flex items-center justify-center">
                {queueNumber}
              </div>
            </div>
          </div>

          {selectedTaxpayerId && (
            <div className="mt-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Pending Assessments for Selected Taxpayer */}
              {taxpayerAssessments.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900">Suggested Computation</h3>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { fetchAssessments(); fetchUsers(); }} title="Refresh Assessments">
                        <Activity className="h-4 w-4 mr-1" />
                        Refresh
                      </Button>
                      <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                        {taxpayerAssessments.length} Pending
                      </Badge>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50/80 border-b border-gray-100">
                        <tr className="align-middle">
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-middle">PIN</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-middle">Registered Owner</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-middle">Location</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-middle">Lot No</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-middle">TD No</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-middle">Area</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-middle">Assessed Value</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-center align-middle">Tax Due</th>
                          <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left align-middle">OR Number</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-center align-middle">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {(expandedAssessmentId
                          ? taxpayerAssessments.filter(a => a.id === expandedAssessmentId)
                          : taxpayerAssessments
                        ).map(assessment => (
                          <React.Fragment key={assessment.id}>
                            <tr className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 py-4 text-sm font-sans font-medium text-gray-700 align-bottom whitespace-nowrap">{assessment.pin}</td>
                              <td className="px-4 py-4 text-sm font-sans text-gray-600 break-words whitespace-normal uppercase align-bottom max-w-[150px]">{assessment.registered_owner_name}</td>
                              <td className="px-6 py-4 text-sm font-sans text-gray-600 truncate max-w-[120px] uppercase align-bottom">{assessment.address || getLocationFromPin(assessment.pin)}</td>
                              <td className="px-6 py-4 text-sm font-sans text-gray-600 align-bottom whitespace-nowrap">{assessment.lot_no || '-'}</td>
                              <td className="px-6 py-4 text-sm font-sans font-medium text-gray-700 align-bottom whitespace-nowrap">{assessment.td_no || '-'}</td>
                              <td className="px-6 py-4 text-sm font-sans text-gray-600 align-bottom whitespace-nowrap">{assessment.total_area || '-'}</td>
                              <td className="px-6 py-4 text-sm font-sans text-right font-mono text-gray-600 align-bottom">
                                <span className="inline-flex items-center justify-end w-full">
                                  <span className="invisible">(</span>
                                  {parseFloat(String(assessment.property_assessed_value || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  <span className="invisible">)</span>
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm font-sans font-bold text-gray-900 align-bottom text-center">
                                <button
                                  onClick={() => setExpandedAssessmentId(prev => prev === assessment.id ? null : assessment.id)}
                                  className="text-indigo-600 hover:text-indigo-800 font-bold font-sans text-sm underline underline-offset-4 decoration-indigo-200"
                                >
                                  {parseFloat(String(assessment.amount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </button>
                              </td>
                              <td className="px-6 py-4 text-sm font-sans align-bottom">
                                <Input
                                  placeholder="7-9 digits"
                                  maxLength={9}
                                  className="w-[110px] h-5 text-sm font-sans tracking-widest !px-0 !py-0 !p-0 !m-0 bg-transparent !border-0 !rounded-none focus:!outline-none focus:!ring-0 focus:!bg-transparent !text-left leading-none"
                                  value={orInputs[assessment.id] || ''}
                                  onChange={(e) => handleOrInputChange(assessment.id, e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-4 align-bottom">
                                <div className="flex items-end space-x-2 h-full">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600"
                                    onClick={() => handleReviewComputation(assessment)}
                                    title="Edit Computation"
                                  >
                                    <Calculator className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors"
                                    onClick={() => handleRemoveAssessment(assessment.id)}
                                    title="Remove Assessment"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-8 bg-indigo-600 hover:bg-indigo-700 text-sm px-3 font-medium"
                                    onClick={() => handleCommit(assessment)}
                                  >
                                    Commit
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            {expandedAssessmentId === assessment.id && (
                               <tr className="bg-indigo-50/30">
                                 <td colSpan={10} className="px-4 py-4 border-l-4 border-l-indigo-500">
                                   <div className="mb-2 px-1">
                                     <h4 className="text-sm font-bold text-indigo-900 uppercase tracking-wide">Tax Summary:</h4>
                                   </div>
                                  <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <table className="w-full text-sm text-left">
                                      <thead className="bg-indigo-50/50 border-b border-indigo-100">
                                        <tr>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider align-bottom">TD#</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider align-bottom">Years Covered</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-center align-bottom">No. of Years</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-right align-bottom">Assessed Value</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-right align-bottom">Basic Tax</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-right align-bottom">SEF Tax</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-right align-bottom">Interest</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-right align-bottom">Discount</th>
                                          <th className="px-4 py-3 text-xs font-semibold text-indigo-900 uppercase tracking-wider text-right align-bottom">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-indigo-50">
                                        <tr>
                                          <td className="px-4 py-3 text-gray-900 font-bold whitespace-nowrap">{assessment.td_no || assessment.property_td_no || '-'}</td>
                                          <td className="px-4 py-3 text-gray-600 font-medium">{assessment.year}</td>
                                          <td className="px-4 py-3 text-gray-600 text-center">
                                            {assessment.year.includes('-')
                                              ? (parseInt(assessment.year.split('-')[1]) - parseInt(assessment.year.split('-')[0]) + 1)
                                              : 1}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                                            {(() => {
                                              const startYear = parseInt(assessment.year.split('-')[0]);
                                              const isEditable = startYear <= 2015;
                                              return isEditable ? (
                                                <span className="inline-flex items-center justify-end w-full">
                                                  <span className="invisible">(</span>
                                                  <FormattedCurrencyInput
                                                    className="w-32 text-right ml-auto h-8 bg-white border-indigo-200 no-spinner font-mono text-gray-900"
                                                    value={assessment.property_assessed_value}
                                                    onChange={(val) => handleAssessmentValueChange(assessment.id, val)}
                                                  />
                                                  <span className="invisible">)</span>
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center justify-end w-full">
                                                  <span className="invisible">(</span>
                                                  {parseFloat(String(assessment.property_assessed_value || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                  <span className="invisible">)</span>
                                                </span>
                                              );
                                            })()}
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                                            <span className="inline-flex items-center justify-end w-full">
                                              <span className="invisible">(</span>
                                              {parseFloat(String(assessment.basic_tax || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                              <span className="invisible">)</span>
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                                            <span className="inline-flex items-center justify-end w-full">
                                              <span className="invisible">(</span>
                                              {parseFloat(String(assessment.sef_tax || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                              <span className="invisible">)</span>
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                                            <span className="inline-flex items-center justify-end w-full">
                                              <span className="invisible">(</span>
                                              {parseFloat(String(assessment.interest || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                              <span className="invisible">)</span>
                                            </span>
                                          </td>
                                          <td className="px-4 py-3 text-right font-mono text-gray-600">
                                            <span className="inline-flex items-center justify-end w-full">
                                              {parseFloat(String(assessment.discount || '0')) > 0 ? (
                                                <>
                                                  <span>(</span>
                                                  {parseFloat(String(assessment.discount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                          <td className="px-4 py-3 text-right font-mono font-bold text-indigo-700">
                                            <span className="inline-flex items-center justify-end w-full">
                                              <span className="invisible">(</span>
                                              {parseFloat(String(assessment.amount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                              <span className="invisible">)</span>
                                            </span>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-xl p-12 text-center bg-gray-50/50">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900">No Pending Computations</h3>
                  <p className="text-gray-500 mt-2">There are no suggested computations for this taxpayer.</p>
                </div>
              )}

              {/* Properties List Removed */}
            </div>
          )}
        </CardContent>
      </Card>

      {paymentQueue.length > 0 && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>Payment Queue</CardTitle>
            <CardDescription>Review items before finalizing batch payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left align-bottom">Registered Owner</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left align-bottom">PIN</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-left align-bottom">Years Covered</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Assessed Value</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Basic Tax</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">SEF Tax</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Interest</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Discount</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Total</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-center align-bottom">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paymentQueue.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm text-gray-600 font-medium max-w-[180px] break-words whitespace-normal uppercase align-bottom">{(() => { const prop = properties.find(p => p.id === item.property_id); return prop?.registered_owner_name || '-'; })()}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 font-medium whitespace-nowrap align-bottom">{item.pin}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 font-medium align-bottom">{item.year}</td>
                      <td className="px-4 py-4 text-sm text-right font-mono text-gray-600 align-bottom">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.assessed_value || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-right font-mono text-gray-600 align-bottom">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.basic_tax || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-right font-mono text-gray-600 align-bottom">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.sef_tax || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-right font-mono text-gray-600 align-bottom">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.interest || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-right font-mono text-gray-600 align-bottom">
                        <span className="inline-flex items-center justify-end w-full">
                          {parseFloat(String(item.discount || '0')) > 0 ? (
                            <>
                              <span>(</span>
                              {parseFloat(String(item.discount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                      <td className="px-4 py-4 text-sm text-right font-bold font-mono text-gray-900 align-bottom">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.amount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-center align-bottom">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromQueue(idx)}
                          title="Remove from queue"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-right font-bold text-gray-900 uppercase tracking-wide text-xs">Grand Total</td>
                    <td className="px-4 py-4 text-right font-bold text-xl font-mono text-gray-900">
                      <span className="inline-flex items-center justify-end w-full">
                        <span className="invisible">(</span>
                        {paymentQueue.reduce((sum, item) => sum + item.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="invisible">)</span>
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-end gap-4 max-w-md ml-auto">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">OR#</span>
                <Input
                  placeholder="8-10 digits"
                  className="pl-10 h-12 rounded-none border-gray-200 focus:ring-indigo-500"
                  value={paymentForm.or_no}
                  onChange={(e) => {
                    const digitsOnly = e.target.value.replace(/\D/g, '');
                    setPaymentForm({ ...paymentForm, or_no: digitsOnly.slice(0, 9) });
                  }}
                />
              </div>
              <Button onClick={handlePayment} className="h-12 rounded-none px-8 bg-indigo-600 hover:bg-indigo-700">
                Process Batch Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderComputation = () => (
    <div className="space-y-6">
      {!selectedPropertyId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Calculator className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No Property Selected</h3>
            <p className="text-gray-500 mt-1">Please select a property or review a suggested computation from the Payment Queue.</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setActiveTab('payment-queue')}
            >
              Go to Payment Queue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="text-sm font-normal text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                PIN: {properties.find(p => p.id.toString() === selectedPropertyId)?.pin}
              </span>
            </CardTitle>
            <CardDescription>Review and finalize the computation before payment.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Inputs */}
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Computation:</Label>
                  <div className="flex flex-wrap gap-6">
                    {availableComputationRules.map(rule => {
                      const isDisabled = !isRuleEffective(rule);
                      const isActive = paymentForm.computationType === rule.value;

                      return (
                        <span
                          key={rule.value}
                          onClick={() => !isDisabled && setPaymentForm(prev => ({ ...prev, computationType: rule.value }))}
                          className={`cursor-pointer text-sm transition-colors duration-200 ${
                            isActive ? 'font-bold text-blue-600' : 'text-gray-600 hover:text-blue-500'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {rule.label}
                          {isDisabled ? ' (Inactive)' : ''}
                        </span>
                      );
                    })}
                  </div>
                </div>

                 <div className="space-y-2">
                   <Label>Year/Range:</Label>
                   <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. 1990 or 1990-1995"
                      value={paymentForm.year}
                      onChange={e => setPaymentForm({ ...paymentForm, year: e.target.value })}
                      required
                      className="h-12 rounded-none flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateRanges}
                      disabled={!paymentForm.year}
                      className="h-12 text-sm font-semibold px-3 leading-tight w-24 whitespace-normal"
                    >
                      Generate Ranges
                    </Button>
                    <div className="flex items-center">
                      <input
                        type="file"
                        ref={pdfInputRef}
                        className="hidden"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isPdfProcessing}
                        className="h-12 text-sm font-semibold gap-2 px-3 leading-tight w-24 whitespace-normal"
                      >
                        {isPdfProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-2" />}
                        Upload SOA
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {uploadedSoaSummary && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-emerald-900">Extracted From SOA</h4>
                  <div className="grid grid-cols-1 gap-1 text-emerald-950">
                    <div><span className="font-medium">Name:</span> {uploadedSoaSummary.ownerName || 'Not found'}</div>
                    <div><span className="font-medium">PIN:</span> {uploadedSoaSummary.pin || 'Not found'}</div>
                    <div><span className="font-medium">Lot#:</span> {uploadedSoaSummary.lotNo || 'Not found'}</div>
                    <div><span className="font-medium">Area:</span> {uploadedSoaSummary.area || 'Not found'}</div>
                    <div><span className="font-medium">Year:</span> {uploadedSoaSummary.groupedRanges.map(range => range.startYear === range.endYear ? `${range.startYear}` : `${range.startYear}-${range.endYear}`).join(', ') || 'Not found'}</div>
                    <div><span className="font-medium">Assessed Value:</span> {uploadedSoaSummary.groupedRanges.map(range => range.assessedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).join(' | ') || 'Not found'}</div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider align-bottom">Years<br />Covered</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center align-bottom">No. of<br />Years</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Assessed<br />Value</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Basic<br />Tax</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">SEF<br />Tax</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">
                        <label className="inline-flex items-center justify-end gap-2 w-full cursor-pointer">
                          <span>Interest</span>
                          <input
                            type="checkbox"
                            checked={paymentForm.applyInterest}
                            onChange={e => setPaymentForm(prev => ({ ...prev, applyInterest: e.target.checked }))}
                            className="h-4 w-4"
                          />
                        </label>
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">
                        <label className="inline-flex items-center justify-end gap-2 w-full cursor-pointer">
                          <span>Discount</span>
                          <input
                            type="checkbox"
                            checked={paymentForm.applyDiscount}
                            onChange={e => setPaymentForm(prev => ({ ...prev, applyDiscount: e.target.checked }))}
                            className="h-4 w-4"
                          />
                        </label>
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Total</th>
                      <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center align-bottom">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {previewItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-400 italic">
                          Enter a year or range to see computation preview.
                        </td>
                      </tr>
                    ) : (
                      previewItems.map((item, idx) => {
                        const startYear = parseInt(item.year.split('-')[0]);
                        const isEditable = startYear <= 2015;

                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-gray-600 font-medium">{item.year}</td>
                            <td className="px-6 py-4 text-center text-gray-600">{item.yearCount}</td>
                            <td className="px-6 py-4 text-right font-mono text-gray-700">
                              {isEditable ? (
                                <span className="inline-flex items-center justify-end w-full">
                                  <span className="invisible">(</span>
                                  <FormattedCurrencyInput
                                    className="w-32 text-right ml-auto h-8 font-mono text-gray-900"
                                    value={item.assessed_value}
                                    onChange={(val) => handlePreviewItemChange(idx, 'assessed_value', val)}
                                  />
                                  <span className="invisible">)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-end w-full">
                                  <span className="invisible">(</span>
                                  {parseFloat(String(item.assessed_value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                  <span className="invisible">)</span>
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-gray-700">
                              <span className="inline-flex items-center justify-end w-full">
                                <span className="invisible">(</span>
                                {parseFloat(String(item.basic_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="invisible">)</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-gray-700">
                              <span className="inline-flex items-center justify-end w-full">
                                <span className="invisible">(</span>
                                {parseFloat(String(item.sef_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="invisible">)</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-gray-900">
                              <span className="inline-flex items-center justify-end w-full">
                                <span className="invisible">(</span>
                                {parseFloat(String(item.interest || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="invisible">)</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono text-gray-900">
                              <span className="inline-flex items-center justify-end w-full">
                                {parseFloat(String(item.discount || 0)) > 0 ? (
                                  <>
                                    <span>(</span>
                                    {parseFloat(String(item.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                                {parseFloat(String(item.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                <span className="invisible">)</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFromPreview(idx)}
                                title="Remove range"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveTab('payment-queue');
                    setSelectedPropertyId('');
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={addToQueue} className="px-8" disabled={previewItems.length === 0}>
                  Add to Payment Queue
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderRptAbstract = () => {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
          <Card className="border-none shadow-sm bg-blue-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Collected</p>
                  <h3 className="text-2xl font-bold mt-1">₱ {parseFloat(String(abstractSummary.totalAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="p-3 bg-white/10 rounded-xl">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-xs text-blue-200 mt-4">For current search/filter</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">No. of Taxpayers</p>
                  <h3 className="text-2xl font-bold mt-1 text-gray-900">{abstractSummary.uniqueTaxpayers}</h3>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <Users className="w-6 h-6 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">Unique taxpayers in list</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">No. of PINs</p>
                  <h3 className="text-2xl font-bold mt-1 text-gray-900">{abstractSummary.uniquePins}</h3>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <Home className="w-6 h-6 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">Unique properties in list</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm font-medium">To Date</p>
                  <h3 className="text-2xl font-bold mt-1 text-gray-900">
                    ₱ {parseFloat(String(abstractSummary.toDateAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h3>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <History className="w-6 h-6 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4">Cumulative historical amount</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm">
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center no-print">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search OR No, PIN, or Taxpayer..."
                  className="pl-9 h-10 w-full rounded-md border-gray-200 bg-white"
                  value={abstractSearchQuery}
                  onChange={(e) => setAbstractSearchQuery(autoFormatPinInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setActiveAbstractSearchQuery(formatPinSearch(abstractSearchQuery));
                    }
                  }}
                />
              </div>
              <Button variant="outline" onClick={() => window.print()} className="ml-4 gap-2">
                <Printer className="w-4 h-4" />
                Print Abstract
              </Button>
            </div>
            <div className="overflow-x-auto print-area">
              <Table className="w-full border-collapse">
                <TableHeader>
                  <TableRow className="bg-gray-50/50">
                    <TableHead className="w-[100px] align-bottom pb-3 whitespace-nowrap text-sm">Date</TableHead>
                    <TableHead className="min-w-[200px] align-bottom pb-3 text-sm">Registered Owner</TableHead>
                    <TableHead className="min-w-[200px] align-bottom pb-3 text-sm">Taxpayer</TableHead>
                    <TableHead className="align-bottom pb-3 whitespace-nowrap text-sm">PIN</TableHead>
                    <TableHead className="whitespace-nowrap text-center align-bottom pb-3 text-sm">Year Covered</TableHead>
                    <TableHead className="whitespace-nowrap align-bottom pb-3 text-sm">OR No.</TableHead>
                    <TableHead className="whitespace-nowrap text-right align-bottom pb-3 text-sm">Basic Tax</TableHead>
                    <TableHead className="whitespace-nowrap text-right align-bottom pb-3 text-sm">SEF Tax</TableHead>
                    <TableHead className="whitespace-nowrap text-right align-bottom pb-3 text-sm">Interest</TableHead>
                    <TableHead className="whitespace-nowrap text-right align-bottom pb-3 text-sm">Discount</TableHead>
                    <TableHead className="whitespace-nowrap text-right font-bold align-bottom pb-3 text-sm">Total</TableHead>
                    <TableHead className="min-w-[150px] align-bottom pb-3 whitespace-nowrap text-sm">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isAbstractLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                        <p className="mt-2 text-sm text-gray-500">Loading payments...</p>
                      </TableCell>
                    </TableRow>
                  ) : abstractSummary.filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-12 text-gray-500">
                        No payment records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    abstractSummary.filtered.map(payment => (
                      <TableRow key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                        <TableCell className="text-sm whitespace-nowrap">{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm font-medium text-gray-900 whitespace-normal break-words leading-tight">{payment.registered_owner_name || '-'}</TableCell>
                        <TableCell className="text-sm text-gray-600 whitespace-normal break-words leading-tight">{payment.taxpayer_name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm text-gray-500 whitespace-nowrap">{payment.pin || '-'}</TableCell>
                        <TableCell className="text-sm text-center whitespace-nowrap">{payment.year || '-'}</TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-blue-600 whitespace-nowrap">{payment.or_no || '-'}</TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                          <span className="inline-flex items-center justify-end w-full">
                            <span className="invisible">(</span>
                            {parseFloat(String(payment.basic_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="invisible">)</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                          <span className="inline-flex items-center justify-end w-full">
                            <span className="invisible">(</span>
                            {parseFloat(String(payment.sef_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="invisible">)</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm whitespace-nowrap">
                          <span className="inline-flex items-center justify-end w-full">
                            <span className="invisible">(</span>
                            {parseFloat(String(payment.interest || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="invisible">)</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-red-500 whitespace-nowrap">
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
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono text-sm text-gray-900 whitespace-nowrap">
                          <span className="inline-flex items-center justify-end w-full">
                            <span className="invisible">(</span>
                            {parseFloat(String(payment.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            <span className="invisible">)</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500 italic whitespace-nowrap">{payment.remarks || '-'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderRPTAR = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6 space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); syncGlobalSearch(rptarSearchQuery, true); }} className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex gap-2 max-w-2xl w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search by PIN, Registered Owner, or Taxpayer..."
                  className="pl-9 h-12 rounded-md border-gray-200"
                  value={rptarSearchQuery}
                  onChange={(e) => syncGlobalSearch(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isRptarSearching} className="h-12 px-6 rounded-md bg-blue-600 hover:bg-blue-700">
                {isRptarSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            <div className="flex flex-col items-end gap-1 xl:ml-auto">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={rptarPdfInputRef}
                    className="hidden"
                    accept=".pdf"
                    multiple
                    onChange={handleRptarPdfUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => rptarPdfInputRef.current?.click()}
                    disabled={isRptarPdfProcessing || rptarSearchResults.length === 0}
                    className="h-12 gap-2"
                  >
                    {isRptarPdfProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Upload SOAs
                  </Button>
                  {Object.keys(rptarUploadedSoasByProperty).length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setRptarUploadedSoasByProperty({});
                        setRptarUploadStatus(null);
                      }}
                      className="h-12 text-gray-500 hover:text-red-600"
                    >
                      Clear Imported SOAs
                    </Button>
                  )}
                </div>
                {rptarUploadStatus && (
                  <div className="flex flex-col gap-1 text-xs text-right pr-1">
                    <span className={rptarUploadStatus.type === 'success' ? 'text-emerald-700' : 'text-red-600'}>
                      {rptarUploadStatus.text}
                    </span>
                  </div>
                )}
              </div>
          </form>
        </CardContent>
      </Card>

      {rptarSearchResults.length > 0 && (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900">Search Result{rptarSearchResults.length > 1 ? 's' : ''}</CardTitle>
            {rptarSearchResults.some(prop => (rptarPinMeta.get(prop.id)?.count || 1) > 1) && (
              <CardDescription>
                Some records share the same PIN by design. Treat each row as a separate roll entry and use the owner and other descriptors to pick the right one.
              </CardDescription>
            )}
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Registered Owner</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Taxpayer</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">PIN</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status / Class</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Lot No.</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Area</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rptarSearchResults.map((prop) => {
                  const pinMeta = rptarPinMeta.get(prop.id) || { count: 1, index: 1 };
                  const isDuplicatePin = pinMeta.count > 1;
                  return (
                  <tr
                    key={prop.id}
                    className={`transition-colors ${rptarSelectedPropertyId === prop.id ? 'bg-blue-50' : isDuplicatePin ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-6 py-4 text-gray-900 font-medium text-sm whitespace-normal break-words leading-tight">
                      <div className="flex flex-col gap-1">
                        <span>{prop.registered_owner_name}</span>
                        {isDuplicatePin && (
                          <span className="inline-flex w-fit items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                            Duplicate PIN record {pinMeta.index} of {pinMeta.count}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm whitespace-normal break-words leading-tight">
                      {prop.linked_taxpayer ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            {prop.linked_taxpayer}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Not Tagged</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span>{prop.pin}</span>
                        {isDuplicatePin && (
                          <span className="text-[10px] font-semibold text-amber-700">Shared PIN group</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        {prop.status && !prop.status.toLowerCase().includes('unpaid') && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                            {prop.status}
                          </span>
                        )}
                        {prop.classification && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                            {prop.classification}
                          </span>
                        )}
                        {prop.taxability && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {prop.taxability}
                          </span>
                        )}
                        {!prop.status && !prop.classification && !prop.taxability && <span>-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 text-sm whitespace-nowrap">{prop.lot_no}</td>
                    <td className="px-6 py-4 text-right font-mono text-gray-700 text-sm whitespace-nowrap">{prop.total_area || '-'}</td>
                    <td className="px-6 py-3 text-center text-sm whitespace-nowrap">
                      <span
                        className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
                        onClick={() => setRptarSelectedPropertyId(prop.id === rptarSelectedPropertyId ? null : prop.id)}
                      >
                        {rptarSelectedPropertyId === prop.id ? 'Hide' : 'Account History'}
                      </span>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {rptarSelectedPropertyId && (
        <Card className="border border-gray-200 shadow-sm mt-6">
          <CardHeader className="bg-white border-b border-gray-200">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-bold flex items-center gap-2 text-gray-900">
                <History className="w-5 h-5 text-gray-700" />
                Account History
              </CardTitle>
              <div className="text-xs text-gray-500">
                {selectedRptarUploadedSoas.length > 0
                  ? `${selectedRptarUploadedSoas.length} imported SOA file${selectedRptarUploadedSoas.length === 1 ? '' : 's'} attached`
                  : 'No imported SOA attached'}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
              {selectedRptarUploadedSoas.length > 0 && (
                <div className="m-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2 text-sm">
                  <h4 className="font-semibold text-emerald-900">Imported SOAs For This Record</h4>
                  <div className="space-y-2 text-emerald-950">
                    {selectedRptarUploadedSoas.map((batch, index) => (
                      <div key={`${batch.fileName}-${index}`} className="rounded border border-emerald-200 bg-white/70 px-3 py-2">
                        <div className="font-semibold">{batch.fileName}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs mt-1">
                          <div><span className="font-medium">Registered Owner:</span> {batch.summary.ownerName || 'Not found'}</div>
                          <div><span className="font-medium">PIN:</span> {batch.summary.pin || 'Not found'}</div>
                          <div><span className="font-medium">Lot#:</span> {batch.summary.lotNo || 'Not found'}</div>
                          <div><span className="font-medium">Area:</span> {batch.summary.area || 'Not found'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <table className="w-full min-w-[1220px] text-xs text-left border-separate border-spacing-0">
                <thead className="bg-slate-50 text-slate-700">
                  <tr className="border-b border-slate-200">
                    <th rowSpan={2} className="px-3 py-2.5 align-middle text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap border-r border-slate-200 bg-slate-50">TD No.</th>
                    <th rowSpan={2} className="px-3 py-2.5 align-middle text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap border-r border-slate-200 bg-slate-50">Year Covered</th>
                    <th rowSpan={2} className="px-3 py-2.5 align-middle text-[11px] font-bold uppercase tracking-[0.18em] text-right whitespace-nowrap border-r border-slate-200 bg-slate-50">Assessed Value</th>
                    <th colSpan={3} className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-center border-r border-slate-200 bg-slate-50">Collectibles</th>
                    <th colSpan={7} className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-center border-r border-slate-200 bg-slate-50">Collected</th>
                    <th colSpan={2} className="px-3 pt-2.5 pb-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-center border-r border-slate-200 bg-slate-50">Balance</th>
                    <th rowSpan={2} className="px-3 py-2.5 align-middle text-[11px] font-bold uppercase tracking-[0.18em] whitespace-nowrap bg-slate-50">Remarks</th>
                  </tr>
                  <tr className="border-t border-slate-200 border-b border-slate-200">
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">Basic Tax</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">SEF Tax</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-200 bg-white">Total</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">Date</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">OR No.</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">Basic Tax</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">SEF Tax</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">Interest</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">Discount</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-200 bg-white">Total</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-100 bg-white">Basic Tax</th>
                    <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-right whitespace-nowrap border-r border-slate-200 bg-white">SEF Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const prop = rptarSearchResults.find(p => p.id === rptarSelectedPropertyId);
                    const importedSoaRows = selectedRptarUploadedSoas.flatMap(batch => batch.rows);
                    const displayPayments = importedSoaRows.length > 0
                      ? [...importedSoaRows, ...rptarPayments]
                      : rptarPayments.length > 0 ? rptarPayments : (prop ? [{
                      id: 'synthetic-unpaid',
                      year: new Date().getFullYear().toString(),
                      assessed_value: prop.total_assessed_value || prop.assessed_value || 0,
                      basic_tax: 0,
                      sef_tax: 0,
                      interest: 0,
                      discount: 0,
                      record_type: 'assessment',
                      remarks: 'UNPAID'
                    }] : []);
                    
                    return displayPayments.map(payment => {
                    
                    // Calculate number of years from year field (can be "1983" or "1983-1985")
                    let numberOfYears = 1;
                    if (payment.year && typeof payment.year === 'string' && payment.year.includes('-')) {
                      const [startStr, endStr] = payment.year.split('-');
                      const start = parseInt(startStr);
                      const end = parseInt(endStr);
                      if (!isNaN(start) && !isNaN(end)) {
                        numberOfYears = end - start + 1;
                      }
                    }
                    
                    // Calculate collectibles: 1% of assessed value × number of years (0 if retired)
                    const isRetired = prop?.status?.toLowerCase().includes('retired') || false;
                    const assessedVal = payment.assessed_value ? parseFloat(String(payment.assessed_value)) : 0;
                    const collectiblesBasic = isRetired ? 0 : (assessedVal * 0.01) * numberOfYears;
                    const collectiblesSef = isRetired ? 0 : (assessedVal * 0.01) * numberOfYears;
                    const collectiblesTotal = collectiblesBasic + collectiblesSef;
                    
                    // Collected data comes from actual payments (RPT abstract)
                    const collectedBasic = payment.record_type === 'payment' ? parseFloat(String(payment.basic_tax || 0)) : 0;
                    const collectedSef = payment.record_type === 'payment' ? parseFloat(String(payment.sef_tax || 0)) : 0;
                    const balanceBasic = collectiblesBasic - collectedBasic;
                    const balanceSef = collectiblesSef - collectedSef;
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-gray-900 text-xs border-r border-gray-100">{payment.td_no || prop?.td_no || '-'}</td>
                        <td className="px-3 py-2.5 text-gray-600 text-xs border-r border-gray-100">{payment.year || '-'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">
                          {payment.assessed_value ? parseFloat(String(payment.assessed_value)).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '---'}
                        </td>
                        {/* Collectibles */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectiblesBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectiblesSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 text-xs border-r border-gray-100">{collectiblesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        {/* Collected */}
                        <td className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs border-r border-gray-100">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '---'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-600 text-xs border-r border-gray-100">{payment.or_no || '---'}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectedBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectedSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{parseFloat(String(payment.interest || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{parseFloat(String(payment.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-900 text-xs border-r border-gray-100">{(collectedBasic + collectedSef + parseFloat(String(payment.interest || 0)) - parseFloat(String(payment.discount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        {/* Balance */}
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{balanceBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{balanceSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs italic">{payment.remarks || '-'}</td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderActiveUsers = () => (
    <div className="space-y-6">
      <ActiveUsersList />
    </div>
  );

  const renderErptaas = () => {
    const handleSearch = () => {
      const formatted = formatPinSearch(erptaasPin);
      setErptaasPin(formatted);
      // Reverting to esearchproperty.php to show the result list with "View Details" button
      const url = `https://www.ompassessor.com.ph/etax/redirectpage/esearchproperty.php?iSearchTxt=${formatted}&iMode=2&iMunicipality=09&iGoSearch=Search`;
      setErptaasUrl(url);
    };

    return (
      <Card className="border-none shadow-sm flex flex-col h-[calc(100vh-12rem)]">
        <CardHeader className="flex-none">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            eSearch Property
          </CardTitle>
          <CardDescription>
            Search for property records in the Official eRPTAAS Portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
          <div className="flex flex-col gap-2 max-w-md flex-none">
            <Label htmlFor="erptaas-pin">Enter PIN</Label>
            <div className="flex gap-2">
              <Input
                id="erptaas-pin"
                placeholder="028-09-XXXX-XXX-XX"
                value={erptaasPin}
                onChange={(e) => syncGlobalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && syncGlobalSearch(erptaasPin, true)}
              />
              <Button onClick={() => syncGlobalSearch(erptaasPin, true)} className="bg-blue-600 hover:bg-blue-700">
                Search
              </Button>
            </div>
          </div>

          <div className="flex-1 w-full border rounded-xl overflow-hidden bg-white min-h-[600px] relative bg-gray-50/30">
            {erptaasUrl ? (
              <iframe
                src={erptaasUrl}
                className="w-[200%] h-[200%] border-none -mt-[80px] -ml-[284px]"
                title="eRPTAAS Portal"
              />
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
    );
  };

  const renderSettings = () => (

    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium">Change Password</h3>
            <p className="text-sm text-gray-500">Update your account password</p>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
            {passwordChangeStatus && (
              <div className={`p-3 rounded-md text-sm ${passwordChangeStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {passwordChangeStatus.message}
              </div>
            )}
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
            </div>
            <Button type="submit">Change Password</Button>
          </form>
        </CardContent>
      </Card>
      
      <MessagingPanel />
    </div>
  );

  const renderTaxpayerLog = () => (
    <Card className="border-none shadow-sm">
      <div className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-end px-6 py-4">
        <Button variant="ghost" size="sm" onClick={fetchTaxpayerLogs} className="text-xs">Refresh Logs</Button>
      </div>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taxpayer</TableHead>
                <TableHead>No. of PINs</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time Out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxpayerLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    No taxpayer logs found.
                  </TableCell>
                </TableRow>
              )}
              {taxpayerLogs
                .filter(log => showLogPinsModal && selectedLogId !== null ? log.id === selectedLogId : true)
                .map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.taxpayer_name}</TableCell>
                  <TableCell>
                    <button
                      className="text-blue-600 hover:underline font-medium"
                      onClick={() => {
                        try {
                          const pins = JSON.parse(log.pins);
                          setSelectedLogPins(pins);
                          setShowLogPinsModal(true);
                          setSelectedLogId(log.id);
                          setIsLoadingLogProperties(true);
                          fetch('/api/properties/by-pins', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pins })
                          })
                            .then(res => res.json())
                            .then(data => {
                              if (Array.isArray(data)) {
                                setSelectedLogProperties(data);
                              } else {
                                setSelectedLogProperties([]);
                              }
                            })
                            .catch(err => {
                              console.error('Failed to fetch properties by pins', err);
                              setSelectedLogProperties([]);
                            })
                            .finally(() => {
                              setIsLoadingLogProperties(false);
                            });
                        } catch (e) {
                          console.error('Failed to parse pins', e);
                        }
                      }}
                    >
                      {(() => {
                        try {
                          return JSON.parse(log.pins).length;
                        } catch (e) {
                          return 0;
                        }
                      })()} PINs
                    </button>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {log.time_in ? (() => {
                      let dateStr = log.time_in;
                      if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    })() : '---'}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {log.time_out ? (() => {
                      let dateStr = log.time_out;
                      if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                    })() : <span className="text-green-600 font-bold text-xs uppercase tracking-wider bg-green-100 px-2 py-1 rounded-full">Active</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {showLogPinsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl p-6 shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="font-bold text-lg">Processed PIN Details</h3>
              <button
                onClick={() => { setShowLogPinsModal(false); setSelectedLogId(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto flex-1 custom-scrollbar">
              {isLoadingLogProperties ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : selectedLogPins.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No PINs recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PIN</TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Registered Owner</TableHead>
                      <TableHead>Status / Class</TableHead>
                      <TableHead>TD No.</TableHead>
                      <TableHead>Lot No.</TableHead>
                      <TableHead className="text-right">Area</TableHead>
                      <TableHead className="text-right">Assessed Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLogPins.map((pin, i) => {
                      const matchingProps = selectedLogProperties.filter(p => p.pin === pin);

                      if (matchingProps.length === 0) {
                        return (
                          <TableRow key={`${pin}-${i}-missing`}>
                            <TableCell className="font-mono text-sm whitespace-nowrap">{pin}</TableCell>
                            <TableCell className="text-xs text-gray-400">No matched record</TableCell>
                            <TableCell className="max-w-[150px] truncate" title={getLocationFromPin(pin)}>{getLocationFromPin(pin)}</TableCell>
                            <TableCell>N/A</TableCell>
                            <TableCell>N/A</TableCell>
                            <TableCell className="whitespace-nowrap">N/A</TableCell>
                            <TableCell className="whitespace-nowrap">N/A</TableCell>
                            <TableCell className="text-right whitespace-nowrap">N/A</TableCell>
                            <TableCell className="text-right font-mono whitespace-nowrap">N/A</TableCell>
                          </TableRow>
                        );
                      }

                      return matchingProps.map((prop, matchIndex) => (
                        <TableRow key={`${pin}-${i}-${prop.id}-${matchIndex}`}>
                          <TableCell className="font-mono text-sm whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <span>{pin}</span>
                              {matchingProps.length > 1 && (
                                <span className="inline-flex w-fit items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                                  Shared PIN
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            {matchingProps.length > 1 ? `Record ${matchIndex + 1} of ${matchingProps.length}` : 'Single record'}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate" title={prop?.address || getLocationFromPin(pin)}>{prop?.address || getLocationFromPin(pin)}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={prop?.registered_owner_name || 'N/A'}>{prop?.registered_owner_name || 'N/A'}</TableCell>
                          <TableCell className="max-w-[220px]">
                            <div className="flex flex-wrap gap-1">
                              {prop?.status && (
                                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                  {prop.status}
                                </span>
                              )}
                              {prop?.classification && (
                                <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                                  {prop.classification}
                                </span>
                              )}
                              {prop?.taxability && (
                                <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                                  {prop.taxability}
                                </span>
                              )}
                              {!prop?.status && !prop?.classification && !prop?.taxability && <span>N/A</span>}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{prop?.td_no || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap">{prop?.lot_no || 'N/A'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{prop?.total_area || 'N/A'}</TableCell>
                          <TableCell className="text-right font-mono whitespace-nowrap">
                            {prop?.assessed_value ? parseFloat(String(prop.assessed_value)).toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="mt-6 flex justify-end flex-shrink-0">
              <Button onClick={() => { setShowLogPinsModal(false); setSelectedLogId(null); }}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'payment-queue': return renderPaymentQueue();
      case 'rptar': return renderRPTAR();
      case 'computation': return renderComputation();
      case 'rpt-abstract': return renderRptAbstract();
      case 'taxpayer-log': return renderTaxpayerLog();
      case 'active-users': return renderActiveUsers();
      case 'erptaas': return renderErptaas();
      case 'settings': return renderSettings();
      default: return renderPaymentQueue();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-4">
          {/* Sandwich Menu */}
          <div className="relative">
            <Button variant="outline" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <Menu className="w-5 h-5" />
            </Button>

            {isMenuOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1 overflow-hidden">
                <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                  {menuItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === 'back-to-admin') {
                          navigate('/admin');
                        } else {
                          setActiveTab(item.id);
                          setIsMenuOpen(false);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all ${activeTab === item.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-gray-400'}`} />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.id === 'active-users' && activeUsersCount > 0 && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${activeTab === item.id ? 'bg-white text-blue-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                          {activeUsersCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 p-2">
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:block">
            <h1 className="text-xl font-bold text-gray-900">
              {menuItems.find(m => m.id === activeTab)?.label}
            </h1>
            <p className="text-sm text-gray-500">
              {menuItems.find(m => m.id === activeTab)?.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
              CO
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.full_name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8">
        <div className="w-full">
          {renderContent()}
        </div>
      </main>

      <MessagePopup />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }

        @media print {
          .no-print { display: none !important; }
          .print-area { display: block !important; width: 100% !important; }
          body { background: white !important; font-size: 10pt !important; }
          .card { border: none !important; box-shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; padding: 4px !important; font-size: 8pt !important; }
          .whitespace-nowrap { white-space: nowrap !important; }
          .whitespace-normal { white-space: normal !important; }
        }
      `}</style>
    </div>
  );
}

