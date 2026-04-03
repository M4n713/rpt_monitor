import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { useAuth } from '../components/ui/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatPinSearch, autoFormatPinInput } from '@/src/lib/utils';
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
} from '@/src/components/ui/select';
import {
  Upload,
  LogOut,
  Search,
  CheckCircle,
  AlertCircle,
  Loader2,
  History,
  Menu,
  X,
  Tag,
  Calculator,
  Bell,
  Users,
  Settings,
  MessageSquare,
  UserPlus,
  Lock,
  MessageCircle,
  User,
  Home,
  ChevronDown,
  CreditCard,
  ClipboardList,
  FileText,
  Activity,
  AlertTriangle,
  ArrowLeft,
  Printer,
  Mail,
  Shield,
  Coins,
  Database,
  Globe,
  MapPin,
  Trash2,
  Clock as ClockIcon
} from 'lucide-react';
import { QueueManagement } from '../components/QueueManagement';

interface Inquiry {
  id: number;
  sender_name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'archived';
  created_at: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  last_active_at?: string;
  assigned_collector_id?: number | null;
  queue_number?: number;
}

interface Property {
  id: number;
  pin: string;
  td_no: string;
  lot_no: string;
  registered_owner_name: string;
  address: string;
  description: string;
  total_area: string;
  linked_taxpayer: string | null;
  assessed_value: number;
  last_payment_date: string | null;
  owner_id: number | null;
  ownership_type?: string;
  claimed_area?: string;
  owners?: { id: number; full_name: string; ownership_type?: string; claimed_area?: string }[];
  remarks?: string;
  status?: string;
  taxability?: string;
  classification?: string;
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
  taxpayer_name?: string;
  registered_owner_name?: string;
  remarks?: string;
}

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

// Helper function to get current date/time in Philippine timezone (UTC+8)
const getPHTimeNow = (): Date => {
  const utcDate = new Date();
  const phDate = new Date(utcDate.getTime() + (8 * 60 * 60 * 1000)); // UTC+8
  // Adjust the returned date to reflect PH time
  const offset = new Date().getTimezoneOffset() * 60 * 1000;
  return new Date(utcDate.getTime() + offset + (8 * 60 * 60 * 1000));
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

const calculateTaxForYear = (year: number, prop: any, computationType: string, manualAssessedValue?: number | string) => {
  const now = getPHTimeNow();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // Robustly parse assessed value so it never accidentally becomes 0 or NaN
  let rawAssessed = (manualAssessedValue !== undefined && manualAssessedValue !== null && manualAssessedValue !== '')
    ? manualAssessedValue
    : prop?.assessed_value;

  let assessedVal = 0;
  if (typeof rawAssessed === 'string') {
    assessedVal = parseFloat(rawAssessed.replace(/[^0-9.-]/g, ''));
  } else if (typeof rawAssessed === 'number') {
    assessedVal = rawAssessed;
  }
  if (isNaN(assessedVal)) assessedVal = 0;

  // Adjust for Share Area if applicable
  if (computationType === 'share' && prop?.total_area && prop?.claimed_area) {
    const totalArea = parseFloat(prop.total_area.toString().replace(/[^0-9.]/g, '')) || 1;
    const claimedArea = parseFloat(prop.claimed_area.toString().replace(/[^0-9.]/g, '')) || totalArea;
    assessedVal = assessedVal * (claimedArea / totalArea);
  }

  const basic = assessedVal * 0.01;
  const sef = assessedVal * 0.01;
  const taxDue = basic + sef;

  let basicInterest = 0;
  let sefInterest = 0;
  let basicDiscount = 0;
  let sefDiscount = 0;

  if (year > currentYear) {
    // Advance Payment
    if (computationType === 'share') {
      basicDiscount = Math.round((basic * 0.10) * 100) / 100;
      sefDiscount = Math.round((sef * 0.10) * 100) / 100;
    } else {
      basicDiscount = Math.round((basic * 0.20) * 100) / 100;
      sefDiscount = Math.round((sef * 0.20) * 100) / 100;
    }
  } else if (year === currentYear) {
    // Current Year Payment
    const basicQuarter = basic / 4;
    const sefQuarter = sef / 4;
    const monthsElapsed = currentMonth + 1;

    if (currentMonth < 3) {
      basicDiscount = Math.round((basic * 0.10) * 100) / 100;
      sefDiscount = Math.round((sef * 0.10) * 100) / 100;
    } else if (currentMonth < 6) {
      basicInterest = Math.round((basicQuarter * 0.02 * monthsElapsed) * 100) / 100;
      sefInterest = Math.round((sefQuarter * 0.02 * monthsElapsed) * 100) / 100;
      basicDiscount = Math.round((basicQuarter * 3 * 0.10) * 100) / 100;
      sefDiscount = Math.round((sefQuarter * 3 * 0.10) * 100) / 100;
    } else if (currentMonth < 9) {
      basicInterest = Math.round((basicQuarter * 2 * 0.02 * monthsElapsed) * 100) / 100;
      sefInterest = Math.round((sefQuarter * 2 * 0.02 * monthsElapsed) * 100) / 100;
      basicDiscount = Math.round((basicQuarter * 2 * 0.10) * 100) / 100;
      sefDiscount = Math.round((sefQuarter * 2 * 0.10) * 100) / 100;
    } else {
      basicInterest = Math.round((basicQuarter * 3 * 0.02 * monthsElapsed) * 100) / 100;
      sefInterest = Math.round((sefQuarter * 3 * 0.02 * monthsElapsed) * 100) / 100;
      basicDiscount = Math.round((basicQuarter * 0.10) * 100) / 100;
      sefDiscount = Math.round((sefQuarter * 0.10) * 100) / 100;
    }
  } else {
    // Delinquent Payment
    const rpvaraDeadline = new Date('2026-07-05');
    const isRpvaraActive = now <= rpvaraDeadline;

    if (computationType === 'rpvara' && isRpvaraActive) {
      if (year < 2024) {
        // Penalty fully waived for all delinquencies on or before June 30, 2024 — no interest
      } else if (year === 2024) {
        // Interest runs from July 1, 2024 up to the current month (accumulating).
        // Since RPVARA waived Jan-June, only the second half (50%) is subject to interest.
        const monthsDiff = (currentYear - 2024) * 12 + currentMonth - 5;
        if (monthsDiff > 0) {
          let interestRate = monthsDiff * 0.02;
          interestRate = Math.min(interestRate, 0.72); // 72% cap
          basicInterest = Math.round(((basic * 0.5) * interestRate) * 100) / 100;
          sefInterest = Math.round(((sef * 0.5) * interestRate) * 100) / 100;
        }
      } else {
        // 2025 onwards: standard 2% per month with the applicable cap
        const monthsDiff = (currentYear - year) * 12 + currentMonth + 1;
        let interestRate = monthsDiff * 0.02;
        interestRate = year >= 1992 ? Math.min(interestRate, 0.72) : Math.min(interestRate, 0.24);
        basicInterest = Math.round((basic * interestRate) * 100) / 100;
        sefInterest = Math.round((sef * interestRate) * 100) / 100;
      }
    } else if (computationType === 'amnesty') {
      // Amnesty waives all penalties/interest for delinquent taxes
      basicInterest = 0;
      sefInterest = 0;
      basicDiscount = 0;
      sefDiscount = 0;
    } else if (computationType === 'denr') {
      // DENR: skip years older than 10 years ago
      if (year < currentYear - 10) {
        return {
          basic_tax: 0,
          sef_tax: 0,
          interest: 0,
          discount: 0,
          amount: 0
        };
      } else {
        // Delinquent years within the 10-year window: no interest, no discount
        basicInterest = 0;
        sefInterest = 0;
        basicDiscount = 0;
        sefDiscount = 0;
      }
    } else {
      // Standard Delinquent
      const monthsDiff = (currentYear - year) * 12 + currentMonth + 1;
      let interestRate = monthsDiff * 0.02;
      interestRate = year >= 1992 ? Math.min(interestRate, 0.72) : Math.min(interestRate, 0.24);
      basicInterest = Math.round((basic * interestRate) * 100) / 100;
      sefInterest = Math.round((sef * interestRate) * 100) / 100;
    }
  }

  const finalInterest = basicInterest + sefInterest;
  const finalDiscount = basicDiscount + sefDiscount;

  return {
    basic_tax: basic,
    sef_tax: sef,
    interest: finalInterest,
    discount: finalDiscount,
    amount: taxDue + finalInterest - finalDiscount
  };
};

const calculateTaxForRange = (startYearInput: number | string, endYearInput: number | string, prop: any, computationType: string, manualAssessedValue?: number | string) => {
  const currentYear = getPHTimeNow().getFullYear();

  let startYear = parseInt(startYearInput as string, 10);
  let endYear = parseInt(endYearInput as string, 10);

  // 1. Handle case where startYearInput is a string like "2025 - 2026"
  if (typeof startYearInput === 'string' && startYearInput.includes('-')) {
    const parts = startYearInput.split('-');
    startYear = parseInt(parts[0].trim(), 10);
    endYear = parseInt(parts[1].trim(), 10);
  }

  // Fallback if parsing fails
  if (isNaN(startYear)) startYear = currentYear;
  if (isNaN(endYear)) endYear = startYear;

  // 2. DENR Override: Force the range to be exactly 10 years ago to the current year
  if (computationType === 'denr') {
    const tenYearsAgo = currentYear - 10;
    startYear = tenYearsAgo;
    endYear = currentYear;
  }

  let totalBasic = 0;
  let totalSef = 0;
  let totalInterest = 0;
  let totalDiscount = 0;
  let totalAmount = 0;

  // 3. Create an array to hold the breakdown for each individual year
  const breakdown = [];

  for (let y = startYear; y <= endYear; y++) {
    const result = calculateTaxForYear(y, prop, computationType, manualAssessedValue);

    // Push the individual year's result into the breakdown array
    breakdown.push({
      year: y,
      basic_tax: result.basic_tax,
      sef_tax: result.sef_tax,
      interest: result.interest,
      discount: result.discount,
      amount: result.amount
    });

    totalBasic += result.basic_tax;
    totalSef += result.sef_tax;
    totalInterest += result.interest;
    totalDiscount += result.discount;
    totalAmount += result.amount;
  }

  const computedRangeLabel = startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`;

  return {
    basic_tax: totalBasic.toFixed(2),
    sef_tax: totalSef.toFixed(2),
    interest: totalInterest.toFixed(2),
    discount: totalDiscount.toFixed(2),
    amount: totalAmount.toFixed(2),
    computedStartYear: startYear,
    computedEndYear: endYear,
    computedRangeLabel: computedRangeLabel, // e.g., "2016 - 2026"
    breakdown: breakdown // The array containing data for your breakdown table
  };
};
import { ActiveUsersList } from '@/src/components/ActiveUsersList';
import { MessagingPanel } from '@/src/components/MessagingPanel';
import { MessagePopup } from '@/src/components/MessagePopup';

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [collectors, setCollectors] = useState<User[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const isOnline = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = getPHTimeNow();
    return (now.getTime() - date.getTime()) < 5 * 60 * 1000; // 5 minutes
  };

  // Tagging State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Property[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [propertyDetails, setPropertyDetails] = useState<Record<number, { ownership_type: string, claimed_area: string }>>({});
  const [tagForm, setTagForm] = useState({
    taxpayer_id: '',
    assigned_collector_id: ''
  });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'linked' | 'assigned'>('idle');

  // Computation State
  const [showComputation, setShowComputation] = useState(false);
  const [taggedPropertyIds, setTaggedPropertyIds] = useState<number[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedTaxpayerId, setSelectedTaxpayerId] = useState<string>('');
  const [selectedComputationPropertyId, setSelectedComputationPropertyId] = useState<string>('');
  const [paymentQueue, setPaymentQueue] = useState<any[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    or_no: '',
    year: '',
    assessed_value: '',
    basic_tax: '',
    sef_tax: '',
    interest: '',
    discount: '',
    amount: '',
    computationType: 'standard'
  });

  const [messageForm, setMessageForm] = useState<{title: string, body: string, target_role: string, audioFile: File | null}>({
    title: '',
    body: '',
    target_role: 'all',
    audioFile: null
  });

  const messageAudioInputRef = useRef<HTMLInputElement>(null);

  const [collectorForm, setCollectorForm] = useState({
    username: '',
    full_name: ''
  });

  const [adminForm, setAdminForm] = useState({
    username: '',
    full_name: ''
  });

  const [taxpayerForm, setTaxpayerForm] = useState({
    username: '',
    full_name: ''
  });

  const [rptarSearchQuery, setRptarSearchQuery] = useState('');
  const [rptarSearchResults, setRptarSearchResults] = useState<Property[]>([]);
  const [rptarSelectedPropertyId, setRptarSelectedPropertyId] = useState<number | null>(null);
  const [rptarPayments, setRptarPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [isRptarSearching, setIsRptarSearching] = useState(false);
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isAbstractUploading, setIsAbstractUploading] = useState(false);
  const [extractedPdfData, setExtractedPdfData] = useState<Array<{ startYear: number; endYear: number; assessed_value: number }> | null>(null);
  const [abstractSearchQuery, setAbstractSearchQuery] = useState('');
  const [activeAbstractSearchQuery, setActiveAbstractSearchQuery] = useState('');
  const [abstractCollectorFilter, setAbstractCollectorFilter] = useState('all');
  const [abstractDateFilter, setAbstractDateFilter] = useState('');

  const abstractSummary = useMemo(() => {
    const filtered = allPayments.filter(p => {
      const matchSearch = activeAbstractSearchQuery === '' ||
        p.or_no?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
        p.year?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
        p.pin?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
        p.collector_name?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
        p.taxpayer_name?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase()) ||
        p.registered_owner_name?.toLowerCase().includes(activeAbstractSearchQuery.toLowerCase());

      const matchCollector = abstractCollectorFilter === 'all' || p.collector_name === abstractCollectorFilter;
      const matchDate = abstractDateFilter === '' || new Date(p.payment_date).toISOString().split('T')[0] === abstractDateFilter;

      return matchSearch && matchCollector && matchDate;
    });

    const uniqueTaxpayers = new Set(filtered.map(p => p.taxpayer_name).filter(Boolean)).size;
    const uniquePins = new Set(filtered.map(p => p.pin).filter(Boolean)).size;
    const totalAmount = filtered.reduce((sum, p) => {
      const amount = typeof p.amount === 'string' ? parseFloat(p.amount) : (p.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
    const toDateAmount = allPayments.reduce((sum, p) => {
      const amount = typeof p.amount === 'string' ? parseFloat(p.amount) : (p.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    return { uniqueTaxpayers, uniquePins, totalAmount, toDateAmount, filtered };
  }, [allPayments, activeAbstractSearchQuery]);

  const [logs, setLogs] = useState<any[]>([]);
  const [taxpayerLogs, setTaxpayerLogs] = useState<any[]>([]);
  const [selectedLogPins, setSelectedLogPins] = useState<string[]>([]);
  const [selectedLogProperties, setSelectedLogProperties] = useState<Property[]>([]);
  const [isLoadingLogProperties, setIsLoadingLogProperties] = useState(false);
  const [showLogPinsModal, setShowLogPinsModal] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [taxpayerTimeIn, setTaxpayerTimeIn] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState('tagging');
  const [activeSettingsTab, setActiveSettingsTab] = useState('create-taxpayer');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState(0);
  const [accountToDelete, setAccountToDelete] = useState<string>('');
  const [selectedUserForReset, setSelectedUserForReset] = useState<number | null>(null);
  const [resetPasswordMessage, setResetPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordMessage, setChangePasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [erptaasPin, setErptaasPin] = useState('');
  const [erptaasUrl, setErptaasUrl] = useState('');

  // Barangay State
  const [barangays, setBarangays] = useState<any[]>([]);
  const [newBarangayCode, setNewBarangayCode] = useState('');
  const [newBarangayName, setNewBarangayName] = useState('');

  const fetchBarangays = async () => {
    try {
      const res = await fetch('/api/barangays');
      if (res.ok) setBarangays(await res.json());
    } catch (err) {
      console.error('Failed to fetch barangays:', err);
    }
  };

  // Delinquency Report State
  const [delinquencyData, setDelinquencyData] = useState<any[]>([]);
  const [delinquencyReportType, setDelinquencyReportType] = useState<'5year' | 'actual'>('5year');
  const [delinquencyBarangay, setDelinquencyBarangay] = useState('all');
  const [delinquencyInterestMode, setDelinquencyInterestMode] = useState<'with' | 'without'>('with');
  const [isDelinquencyLoading, setIsDelinquencyLoading] = useState(false);
  const [delinquencyReportGenerated, setDelinquencyReportGenerated] = useState(false);

  const fetchDelinquencyReport = async () => {
    setIsDelinquencyLoading(true);
    setDelinquencyReportGenerated(false);
    try {
      const res = await fetch(`/api/admin/delinquency-report?type=${delinquencyReportType}&barangayCode=${delinquencyBarangay}`);
      if (res.ok) {
        const data = await res.json();
        setDelinquencyData(data);
        setDelinquencyReportGenerated(true);
      }
    } catch (err) {
      console.error('Failed to fetch delinquency report:', err);
    } finally {
      setIsDelinquencyLoading(false);
    }
  };

  // Remove automatic fetch of delinquency report
  /* 
  useEffect(() => {
    if (activeTab === 'delinquency-report') {
      fetchDelinquencyReport();
    }
  }, [activeTab, delinquencyReportType]);
  */

  const syncGlobalSearch = (val: string, submit: boolean = false) => {
    const formatted = autoFormatPinInput(val);
    setSearchQuery(formatted);
    setRptarSearchQuery(formatted);
    setAbstractSearchQuery(formatted);
    setErptaasPin(formatted);

    if (submit) {
      const finalFormatted = formatPinSearch(formatted);
      // Update active filters
      setActiveAbstractSearchQuery(finalFormatted);
      // Trigger tagging search
      handleSearch(finalFormatted);
      // Trigger RPTAR search
      handleRptarSearch(null, finalFormatted);
      // Trigger eRPTAAS search
      const url = `https://www.ompassessor.com.ph/etax/redirectpage/viewdetails.php?mode=2&pinno=${finalFormatted}&muncode=09`;
      setErptaasUrl(url);
    }
  };



  const latestDataRef = useRef({ users, properties, taxpayerTimeIn });
  useEffect(() => {
    latestDataRef.current = { users, properties, taxpayerTimeIn };
  }, [users, properties, taxpayerTimeIn]);

  const currentLogIdRef = useRef<number | null>(null);

  useEffect(() => {
    const handleLogChange = async () => {
      // End previous session if exists
      if (currentLogIdRef.current) {
        const timeOut = getPHTimeNow().toISOString();
        const { properties: currentProperties } = latestDataRef.current;
        // Since properties in AdminPanel are for the SELECTED taxpayer (which was the previous one),
        // we can use them to update pins.
        const pins = currentProperties.map(p => p.pin);

        await fetch(`/api/taxpayer-logs/${currentLogIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            time_out: timeOut,
            pins: JSON.stringify(pins)
          })
        }).catch(console.error);
        currentLogIdRef.current = null;
        fetchTaxpayerLogs();
      }

      // Start new session
      if (selectedTaxpayerId) {
        const { users: currentUsers } = latestDataRef.current;
        const taxpayerName = currentUsers.find(u => u.id.toString() === selectedTaxpayerId)?.full_name || 'Unknown';
        const timeIn = getPHTimeNow().toISOString();

        try {
          const res = await fetch('/api/taxpayer-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taxpayer_id: selectedTaxpayerId,
              taxpayer_name: taxpayerName,
              pins: '[]', // Initially empty, updated on end
              time_in: timeIn
            })
          });
          const data = await res.json();
          if (data.id) {
            currentLogIdRef.current = data.id;
            fetchTaxpayerLogs();
          }
        } catch (err) {
          console.error('Failed to create log:', err);
        }
      }
    };

    handleLogChange();
  }, [selectedTaxpayerId]);

  useEffect(() => {
    if (user?.username.toLowerCase() === 'manlie') {
      setActiveSettingsTab('create-collector');
    } else {
      setActiveSettingsTab('create-taxpayer');
    }
  }, [user?.username]);

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
        properties.find(p => p.id.toString() === selectedComputationPropertyId)?.pin || '';
      if (currentPin) setErptaasPin(currentPin);
    }
  }, [activeTab, rptarSelectedPropertyId, selectedComputationPropertyId, rptarSearchResults, properties]);


  const menuItems = [
    { id: 'tagging', label: 'Assessment Roll', subtitle: 'Search and Link Properties', icon: Tag },
    ...(['manlie', 'rhea', 'glaiza'].includes(user?.username?.toLowerCase() || '') ? [{ id: 'payment-queue', label: 'Payment Queue', subtitle: 'Manage Payments and Assessments', icon: CreditCard }] : []),
    { id: 'computation', label: 'RPT Computation', subtitle: 'Calculate Tax Due', icon: Calculator },
    { id: 'rptar', label: 'RPTAR', subtitle: 'RPT Account Register', icon: User },
    { id: 'rpt-abstract', label: 'RPT Abstract', subtitle: 'Record of Collections', icon: FileText },
    { id: 'erptaas', label: 'eRPTAAS', icon: Globe },
    { id: 'taxpayer-log', label: 'Taxpayer Log', subtitle: 'Monitor Taxpayer Activity', icon: ClipboardList },
    { id: 'system-log', label: 'System Log', subtitle: 'View System Activities', icon: Activity },
    { id: 'announcements', label: 'Announcements', subtitle: 'Send System-wide Messages', icon: Bell },
    { id: 'active-users', label: 'Active Users', subtitle: 'Currently Online Users', icon: Users },
    ...(user?.username.toLowerCase() === 'manlie' ? [{ id: 'delinquency-report', label: 'Delinquency Report', subtitle: 'View Delinquent Accounts', icon: AlertTriangle }] : []),
    { id: 'settings', label: 'Settings', subtitle: 'Manage System Settings', icon: Settings },
    { id: 'queue-management', label: 'Active Queue', icon: ClockIcon, subtitle: 'Real-time service queue tracker' }
  ];

  const settingsItems = [
    ...(user?.username.toLowerCase() === 'manlie' ? [{ id: 'create-admin', label: 'Create Admin', icon: Shield }] : []),
    ...(user?.username.toLowerCase() === 'manlie' ? [{ id: 'create-collector', label: 'Create Collector', icon: Coins }] : []),
    { id: 'create-taxpayer', label: 'Create Taxpayer', icon: UserPlus },
    ...(user?.username.toLowerCase() === 'manlie' ? [{ id: 'reset-password', label: 'Reset Password', icon: Lock }] : []),
    { id: 'change-password', label: 'Change Password', icon: Lock },
    { id: 'direct-messages', label: 'Direct Messages', icon: MessageSquare },
    ...(user?.username.toLowerCase() === 'manlie' ? [{ id: 'manage-barangays', label: 'Manage Barangays', icon: MapPin }] : []),
    ...(user?.username.toLowerCase() === 'manlie' ? [{ id: 'manage-data', label: 'Manage Data', icon: Database }] : []),
  ];

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

  const fetchAllPayments = async () => {
    try {
      const res = await fetch('/api/admin/payments');
      if (res.ok) {
        const data = await res.json();
        setAllPayments(data);
      }
    } catch (err) {
      console.error('Failed to fetch payments', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'rpt-abstract') {
      fetchAllPayments();
      const interval = setInterval(fetchAllPayments, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    } else if (activeTab === 'taxpayer-log') {
      fetchTaxpayerLogs();
      const interval = setInterval(fetchTaxpayerLogs, 10000);
      return () => clearInterval(interval);
    } else if (activeTab === 'system-log') {
      fetchLogs();
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    } else if (activeTab === 'delinquency-report') {
      fetchBarangays();
    }
  }, [activeTab]);

  const handleRptarSearch = async (e: React.FormEvent | null, overrideQuery?: string) => {
    e?.preventDefault();
    const queryToUse = overrideQuery || rptarSearchQuery;
    if (!queryToUse.trim()) return;
    setIsRptarSearching(true);
    setRptarSelectedPropertyId(null);
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
      if (data.length > 0) {
        const first = data[0];
        console.log('[DEBUG-RPTAR] Item Sample:', {
          registered_owner: first.registered_owner_name,
          status: first.status,
          taxability: first.taxability,
          classification: first.classification,
          remarks: first.remarks,
          raw_data: first
        });
      }
      setRptarSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRptarSearching(false);
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

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setLogs(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const handleCreateCollector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectorForm.username || !collectorForm.full_name) return;

    try {
      const res = await fetch('/api/admin/create-collector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectorForm),
      });

      if (res.ok) {
        alert('Collector account created successfully');
        setCollectorForm({ username: '', full_name: '' });
        // Refresh users list
        fetch('/api/users')
          .then(res => {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return res.json();
            }
            throw new Error('Not JSON');
          })
          .then(setUsers)
          .catch(console.error);
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(data.error || 'Failed to create collector');
        } else {
          alert('Server error occurred');
        }
      }
    } catch (err) {
      console.error('Create collector error', err);
    }
  };

  const handleAddBarangay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBarangayCode || !newBarangayName) return;

    try {
      const res = await fetch('/api/admin/barangays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: newBarangayCode, name: newBarangayName }),
      });

      if (res.ok) {
        setNewBarangayCode('');
        setNewBarangayName('');
        fetchBarangays();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to add barangay');
      }
    } catch (err) {
      console.error('Add barangay error', err);
    }
  };

  const handleDeleteBarangay = async (id: number) => {
    if (!confirm('Are you sure you want to delete this barangay?')) return;

    try {
      const res = await fetch(`/api/admin/barangays/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchBarangays();
      } else {
        alert('Failed to delete barangay');
      }
    } catch (err) {
      console.error('Delete barangay error', err);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.username || !adminForm.full_name) return;

    try {
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm),
      });

      if (res.ok) {
        alert('Admin account created successfully');
        setAdminForm({ username: '', full_name: '' });
        fetch('/api/users')
          .then(res => {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return res.json();
            }
            throw new Error('Not JSON');
          })
          .then(setUsers)
          .catch(console.error);
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(data.error || 'Failed to create admin');
        } else {
          alert('Server error occurred');
        }
      }
    } catch (err) {
      console.error('Create admin error', err);
    }
  };

  const handleCreateTaxpayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxpayerForm.username || !taxpayerForm.full_name) return;

    try {
      const res = await fetch('/api/admin/create-taxpayer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taxpayerForm),
      });

      if (res.ok) {
        alert('Taxpayer account created successfully');
        setTaxpayerForm({ username: '', full_name: '' });
        // Refresh users list
        fetch('/api/users')
          .then(res => {
            const contentType = res.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              return res.json();
            }
            throw new Error('Not JSON');
          })
          .then(setUsers)
          .catch(console.error);
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(data.error || 'Failed to create taxpayer');
        } else {
          alert('Server error occurred');
        }
      }
    } catch (err) {
      console.error('Create taxpayer error', err);
    }
  };

  const handleUpdatePaymentDate = async (paymentId: number, newDate: string) => {
    if (!newDate) return;
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_date: newDate }),
      });

      if (res.ok) {
        // Update local state
        setAllPayments(prev => prev.map(p => p.id === paymentId ? { ...p, payment_date: newDate } : p));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update payment date');
      }
    } catch (err) {
      console.error('Update payment date error', err);
    }
  };

  const handleResetPassword = async (userId: number, userRole: string) => {
    setResetPasswordMessage(null);
    try {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: userRole }),
      });

      if (res.ok) {
        const data = await res.json();
        setResetPasswordMessage({ type: 'success', text: data.message || 'Password reset successfully' });
        setSelectedUserForReset(null);
        setTimeout(() => setResetPasswordMessage(null), 3000);
      } else {
        const data = await res.json();
        setResetPasswordMessage({ type: 'error', text: data.error || 'Failed to reset password' });
      }
    } catch (err) {
      console.error('Reset password error', err);
      setResetPasswordMessage({ type: 'error', text: 'Error resetting password' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordMessage(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      setChangePasswordMessage({ type: 'error', text: 'All fields are required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordMessage({ type: 'error', text: 'New password and confirm password do not match' });
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      if (res.ok) {
        setChangePasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setChangePasswordMessage(null), 3000);
      } else {
        const data = await res.json();
        setChangePasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (err) {
      console.error('Change password error', err);
      setChangePasswordMessage({ type: 'error', text: 'Error changing password. Please try again.' });
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    if (!confirm('Are you absolutely sure you want to delete this account and ALL its data? This cannot be undone.')) return;

    try {
      const res = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_account', account_id: accountToDelete })
      });
      if (res.ok) {
        alert('Account and all associated data deleted successfully.');
        setAccountToDelete('');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete account');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
  };

  const handleResetAllData = async () => {
    if (!confirm('WARNING: This will delete ALL data in the system, including all users, properties, and transactions. Are you absolutely sure?')) return;
    if (!confirm('FINAL WARNING: This action CANNOT be undone. Proceed?')) return;

    try {
      const res = await fetch('/api/admin/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_all' })
      });
      if (res.ok) {
        alert('System data reset successfully.');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset data');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageForm.title && !messageForm.audioFile) return;

    try {
      const formData = new FormData();
      formData.append('title', messageForm.title);
      formData.append('body', messageForm.body);
      formData.append('target_role', messageForm.target_role);
      if (messageForm.audioFile) {
        formData.append('audio', messageForm.audioFile);
      }

      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        alert('Message sent successfully');
        setMessageForm({ title: '', body: '', target_role: 'all', audioFile: null });
        if (messageAudioInputRef.current) messageAudioInputRef.current.value = '';
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
      console.error('Message error', err);
    }
  };

  const fetchTaxpayerProperties = (taxpayerId: string) => {
    if (!taxpayerId) return;
    fetch(`/api/properties?taxpayer_id=${taxpayerId}`)
      .then(res => {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Not JSON');
      })
      .then(setProperties)
      .catch(console.error);
  };

  const fetchUsers = () => {
    fetch('/api/users')
      .then(res => {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Not JSON');
      })
      .then(setUsers)
      .catch(console.error);
  };

  useEffect(() => {
    fetchUsers();
    fetch('/api/admin/collectors')
      .then(res => {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        throw new Error('Not JSON');
      })
      .then(setCollectors)
      .catch(console.error);

    fetchLogs();
    fetchTaxpayerLogs();
  }, []);

  // Fetch properties when taxpayer is selected
  useEffect(() => {
    if (selectedTaxpayerId) {
      fetchTaxpayerProperties(selectedTaxpayerId);
    } else {
      setProperties([]);
    }
  }, [selectedTaxpayerId]);



  // Reset dependent fields when taxpayer changes (Computation)
  useEffect(() => {
    setSelectedComputationPropertyId('');
    setPaymentQueue([]);
    resetForm();
  }, [selectedTaxpayerId]);

  // Reset when computation section is closed
  useEffect(() => {
    if (!showComputation) {
      setSelectedComputationPropertyId('');
      setPaymentQueue([]);
      resetForm();
    }
  }, [showComputation]);

  // Update form when property changes (Computation)
  useEffect(() => {
    if (selectedComputationPropertyId) {
      const prop = properties.find(p => p.id.toString() === selectedComputationPropertyId);
      if (prop) {
        const defaultYear = prop.last_payment_date
          ? (new Date(prop.last_payment_date).getFullYear() + 1).toString()
          : getPHTimeNow().getFullYear().toString();

        const defaultYearNum = parseInt(defaultYear);
        const assessedVal = defaultYearNum >= 2016 ? (prop.assessed_value || 0) : 0;
        const basic = assessedVal * 0.01;
        const sef = assessedVal * 0.01;

        setPaymentForm(prev => ({
          ...prev,
          year: defaultYear,
          assessed_value: assessedVal.toString(),
          basic_tax: basic.toFixed(2),
          sef_tax: sef.toFixed(2),
          interest: '0.00',
          discount: '0.00',
          amount: (basic + sef).toFixed(2)
        }));
      }
    }
  }, [selectedComputationPropertyId]);

  // Recalculate Interest and Discount
  useEffect(() => {
    if (!selectedComputationPropertyId) return;

    const prop = properties.find(p => p.id.toString() === selectedComputationPropertyId);
    if (!prop) return;

    const currentYear = getPHTimeNow().getFullYear();

    // DENR: always force the range to (currentYear - 10) through currentYear,
    // overriding whatever the user typed in the year field.
    if (paymentForm.computationType === 'denr') {
      const denrStart = currentYear - 10;
      const denrEnd = currentYear;
      const denrLabel = `${denrStart}-${denrEnd}`;

      // Auto-fill AV from property for 2016+
      const avToUse = prop.assessed_value;
      const result = calculateTaxForRange(denrStart, denrEnd, prop, 'denr', avToUse);

      setPaymentForm(prev => ({
        ...prev,
        year: denrLabel,
        assessed_value: avToUse.toString(),
        basic_tax: result.basic_tax,
        sef_tax: result.sef_tax,
        interest: result.interest,
        discount: result.discount,
        amount: result.amount
      }));
      return;
    }

    if (!paymentForm.year) return;

    // Prevent overwriting carefully built sums if the year input exactly matches the queue's boundary.
    // Instead, definitively sync the Computation Breakdown panel to the queue's Grand Totals.
    if (paymentQueue.length > 0) {
      let overallMin = Infinity;
      let overallMax = -Infinity;
      let qBasic = 0, qSef = 0, qInterest = 0, qDiscount = 0, qAmount = 0;
      
      for (const qi of paymentQueue) {
        const parts = String(qi.year).split('-');
        const s = parseInt(parts[0].trim());
        const e = parts.length > 1 ? parseInt(parts[1].trim()) : s;
        if (s < overallMin) overallMin = s;
        if (e > overallMax) overallMax = e;
        
        qBasic += parseFloat(String(qi.basic_tax || 0));
        qSef += parseFloat(String(qi.sef_tax || 0));
        qInterest += parseFloat(String(qi.interest || 0));
        qDiscount += parseFloat(String(qi.discount || 0));
        qAmount += parseFloat(String(qi.amount || 0));
      }
      
      const rangeLabel = overallMin === overallMax ? `${overallMin}` : `${overallMin}-${overallMax}`;
      if (paymentForm.year === rangeLabel) {
        // The UI input exactly covers the queue. Sync the breakdown to the queue totals and abort single-calc!
        setPaymentForm(prev => ({
          ...prev,
          basic_tax: qBasic.toFixed(2),
          sef_tax: qSef.toFixed(2),
          interest: qInterest.toFixed(2),
          discount: qDiscount.toFixed(2),
          amount: qAmount.toFixed(2)
        }));
        return;
      }
    }

    let startYear: number;
    let endYear: number;

    if (paymentForm.year.includes('-')) {
      const parts = paymentForm.year.split('-');
      startYear = parseInt(parts[0]);
      endYear = parseInt(parts[1]);
    } else {
      startYear = parseInt(paymentForm.year);
      endYear = startYear;
    }

    if (isNaN(startYear) || isNaN(endYear)) return;

    // Auto-fill/Reset assessed value based on year
    const targetAV = startYear >= 2016 ? prop.assessed_value.toString() : (paymentForm.assessed_value || '0');
    if (startYear >= 2016 && paymentForm.assessed_value !== targetAV) {
      setPaymentForm(prev => ({ ...prev, assessed_value: targetAV }));
      return;
    } else if (startYear < 2016 && !paymentForm.assessed_value) {
      setPaymentForm(prev => ({ ...prev, assessed_value: '0' }));
      return;
    }

    const manualAV = parseFloat(paymentForm.assessed_value);
    const result = calculateTaxForRange(startYear, endYear, prop, paymentForm.computationType, isNaN(manualAV) ? undefined : manualAV);

    setPaymentForm(prev => ({
      ...prev,
      basic_tax: result.basic_tax,
      sef_tax: result.sef_tax,
      interest: result.interest,
      discount: result.discount,
      amount: result.amount
    }));

  }, [paymentForm.year, paymentForm.computationType, paymentForm.assessed_value, selectedComputationPropertyId, paymentQueue]);
  // Recalculate all payment queue items when computation type changes
  useEffect(() => {
    setPaymentQueue(prevQueue => {
      if (prevQueue.length === 0) return prevQueue;

      // Check if any items actually need updating to prevent infinite loops
      const needsUpdate = prevQueue.some(item => item.computationType !== paymentForm.computationType);
      if (!needsUpdate) return prevQueue;

      // Recalculate all items in payment queue with current computation type
      return prevQueue.map(item => {
        // Use the specific property for THIS item, not the currently selected one
        const prop = properties.find(p => p.id === item.property_id);
        if (!prop) return item;

        const startYear = parseInt(item.year.split('-')[0]);
        const endYear = item.year.includes('-') ? parseInt(item.year.split('-')[1]) : startYear;
        const avToUse = parseFloat(item.assessed_value);

        const result = calculateTaxForRange(
          startYear,
          endYear,
          prop,
          paymentForm.computationType,
          isNaN(avToUse) ? undefined : avToUse
        );

        return {
          ...item,
          basic_tax: result.basic_tax,
          sef_tax: result.sef_tax,
          interest: result.interest,
          discount: result.discount,
          computationType: paymentForm.computationType,
          amount: Number(result.amount)
        };
      });
    });
  }, [paymentForm.computationType, properties]);
  const handleGenerateRanges = () => {
    if (!selectedComputationPropertyId || !paymentForm.year) return;

    const currentYear = new Date().getFullYear();

    // 1. Parse the starting and ending years
    let startYear = parseInt(paymentForm.year.toString().split('-')[0].trim(), 10);
    let endYearLimit = 2026; // Default end year

    if (paymentForm.year.toString().includes('-')) {
      const parts = paymentForm.year.toString().split('-');
      const parsedEnd = parseInt(parts[1].trim(), 10);
      if (!isNaN(parsedEnd)) {
        endYearLimit = parsedEnd;
      }
    }

    if (isNaN(startYear)) return;

    const prop = properties.find(p => p.id.toString() === selectedComputationPropertyId);
    if (!prop) return;

    // 2. STRICT DENR Override: ALWAYS force to exactly 10 years ago up to current year
    if (paymentForm.computationType === 'denr') {
      startYear = currentYear - 10; // Always becomes 2016
      endYearLimit = currentYear;   // Always becomes 2026
    }

    const generatedItems = [];
    let currentStart = startYear;

    // 3. Generate the queue items
    while (currentStart <= endYearLimit) {
      const range = STANDARD_RANGES.find(r => currentStart >= r[0] && currentStart <= r[1]);

      if (range) {
        const endYear = Math.min(range[1], endYearLimit);
        const avToUse = currentStart >= 2016 ? prop.assessed_value : (paymentForm.assessed_value ? parseFloat(paymentForm.assessed_value) : 0);
        const result = calculateTaxForRange(currentStart, endYear, prop, paymentForm.computationType, isNaN(avToUse) ? 0 : avToUse);

        generatedItems.push({
          property_id: parseInt(selectedComputationPropertyId),
          pin: prop.pin,
          year: currentStart === endYear ? currentStart.toString() : `${currentStart}-${endYear}`,
          yearCount: endYear - currentStart + 1,
          assessed_value: isNaN(avToUse) ? 0 : avToUse,
          ...result,
          or_no: paymentForm.or_no,
          computationType: paymentForm.computationType,
          amount: Number(result.amount)
        });
        currentStart = endYear + 1;
      } else {
        const avToUse = currentStart >= 2016 ? prop.assessed_value : (paymentForm.assessed_value ? parseFloat(paymentForm.assessed_value) : 0);
        const result = calculateTaxForRange(currentStart, currentStart, prop, paymentForm.computationType, isNaN(avToUse) ? 0 : avToUse);

        generatedItems.push({
          property_id: parseInt(selectedComputationPropertyId),
          pin: prop.pin,
          year: currentStart.toString(),
          yearCount: 1,
          assessed_value: isNaN(avToUse) ? 0 : avToUse,
          ...result,
          or_no: paymentForm.or_no,
          computationType: paymentForm.computationType,
          amount: Number(result.amount)
        });
        currentStart++;
      }
    }

    // 4. Add items to the table
    const allQueueItems = [...paymentQueue, ...generatedItems];
    setPaymentQueue(allQueueItems);

    // 5. Sum totals across ALL queue items (existing + newly generated)
    let totalBasic = 0, totalSef = 0, totalInterest = 0, totalDiscount = 0, totalAmount = 0;
    for (const qi of allQueueItems) {
      totalBasic += parseFloat(String(qi.basic_tax || 0));
      totalSef += parseFloat(String(qi.sef_tax || 0));
      totalInterest += parseFloat(String(qi.interest || 0));
      totalDiscount += parseFloat(String(qi.discount || 0));
      totalAmount += parseFloat(String(qi.amount || 0));
    }

    // 6. Determine the final text to show in the input box
    const finalRangeLabel = startYear === endYearLimit ? `${startYear}` : `${startYear}-${endYearLimit}`;

    // 7. Reset form then restore all meaningful fields
    resetForm();
    setPaymentForm(prev => ({
      ...prev,
      year: finalRangeLabel,
      basic_tax: totalBasic.toFixed(2),
      sef_tax: totalSef.toFixed(2),
      interest: totalInterest.toFixed(2),
      discount: totalDiscount.toFixed(2),
      amount: totalAmount.toFixed(2)
    }));
  };

  const resetForm = () => {
    setPaymentForm(prev => ({
      or_no: prev.or_no,
      year: '',
      assessed_value: '',
      basic_tax: '',
      sef_tax: '',
      interest: '',
      discount: '',
      amount: '',
      computationType: prev.computationType // <-- Preserve the selected computation type
    }));
  };

  const handleQueueAssessmentChange = (index: number, newValue: string) => {
    const newQueue = [...paymentQueue];
    const item = newQueue[index];
    
    const prop = properties.find(p => p.id === item.property_id);
    if (!prop) return;

    let startYear, endYear;
    const yearStr = String(item.year);
    if (yearStr.includes('-')) {
      const parts = yearStr.split('-');
      startYear = parseInt(parts[0].trim(), 10);
      endYear = parseInt(parts[1].trim(), 10);
    } else {
      startYear = parseInt(yearStr, 10);
      endYear = startYear;
    }

    const manualAV = parseFloat(newValue.replace(/,/g, ''));
    const result = calculateTaxForRange(startYear, endYear, prop, item.computationType || paymentForm.computationType, isNaN(manualAV) ? 0 : manualAV);

    newQueue[index] = {
      ...item,
      assessed_value: newValue,
      basic_tax: result.basic_tax,
      sef_tax: result.sef_tax,
      interest: result.interest,
      discount: result.discount,
      amount: Number(result.amount)
    };

    setPaymentQueue(newQueue);
  };
  const addToQueue = () => {
    if (!selectedComputationPropertyId || !paymentForm.amount) return;

    const prop = properties.find(p => p.id.toString() === selectedComputationPropertyId);
    if (!prop) return;

    let startYear, endYear;
    if (paymentForm.year.includes('-')) {
      const parts = paymentForm.year.split('-');
      startYear = parseInt(parts[0]);
      endYear = parseInt(parts[1]);
    } else {
      startYear = parseInt(paymentForm.year);
      endYear = startYear;
    }
    const yearCount = isNaN(startYear) ? 0 : (endYear - startYear + 1);

    const newItem = {
      property_id: parseInt(selectedComputationPropertyId),
      pin: prop.pin,
      ...paymentForm,
      yearCount: yearCount,
      amount: Number(paymentForm.amount)
    };

    setPaymentQueue([...paymentQueue, newItem]);
    setSelectedComputationPropertyId('');
    resetForm();
  };

  const handleQueueItemChange = (index: number, field: string, value: string) => {
    const newQueue = [...paymentQueue];
    const item = newQueue[index];

    if (field === 'assessed_value') {
      item.assessed_value = value;

      const prop = properties.find(p => p.id === item.property_id);
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
        const result = calculateTaxForRange(startYear, endYear, prop, item.computationType, isNaN(manualAV) ? 0 : manualAV);

        item.basic_tax = result.basic_tax;
        item.sef_tax = result.sef_tax;
        item.interest = result.interest;
        item.discount = result.discount;
        item.amount = Number(result.amount);
      }
    }
    setPaymentQueue(newQueue);
  };

  const removeFromQueue = async (index: number) => {
    const removedItem = paymentQueue[index];
    const newQueue = [...paymentQueue];
    newQueue.splice(index, 1);
    setPaymentQueue(newQueue);

    // Record time_out for the taxpayer when item is removed from queue
    if (selectedTaxpayerId) {
      try {
        await fetch('/api/taxpayer-log/time-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taxpayer_id: parseInt(selectedTaxpayerId) })
        });
      } catch (err) {
        console.error('Failed to record time_out:', err);
      }
    }

    // Sync Year/Range input and Computation Breakdown to the remaining items
    if (newQueue.length > 0) {
      let overallMin = Infinity;
      let overallMax = -Infinity;
      let totalBasic = 0, totalSef = 0, totalInterest = 0, totalDiscount = 0, totalAmount = 0;
      for (const qi of newQueue) {
        const parts = String(qi.year).split('-');
        const s = parseInt(parts[0].trim());
        const e = parts.length > 1 ? parseInt(parts[1].trim()) : s;
        if (s < overallMin) overallMin = s;
        if (e > overallMax) overallMax = e;
        totalBasic += parseFloat(String(qi.basic_tax || 0));
        totalSef += parseFloat(String(qi.sef_tax || 0));
        totalInterest += parseFloat(String(qi.interest || 0));
        totalDiscount += parseFloat(String(qi.discount || 0));
        totalAmount += parseFloat(String(qi.amount || 0));
      }
      const rangeLabel = overallMin === overallMax ? `${overallMin}` : `${overallMin}-${overallMax}`;
      setPaymentForm(prev => ({
        ...prev,
        year: rangeLabel,
        basic_tax: totalBasic.toFixed(2),
        sef_tax: totalSef.toFixed(2),
        interest: totalInterest.toFixed(2),
        discount: totalDiscount.toFixed(2),
        amount: totalAmount.toFixed(2)
      }));
    } else {
      setPaymentForm(prev => ({
        ...prev,
        year: '',
        basic_tax: '',
        sef_tax: '',
        interest: '',
        discount: '',
        amount: ''
      }));
    }
  };

  const handleSubmitAssessment = async () => {
    if (paymentQueue.length === 0) return;
    if (!selectedTaxpayerId) {
      alert('Please select a taxpayer first.');
      return;
    }

    const proceedToPayment = window.confirm('Proceed with Tax Payment?');
    const timeOut = getPHTimeNow().toISOString();
    const timeIn = taxpayerTimeIn[selectedTaxpayerId] || getPHTimeNow().toISOString();
    const pins = paymentQueue.map(item => item.pin);
    const taxpayerName = users.find(u => u.id.toString() === selectedTaxpayerId)?.full_name || 'Unknown';

    if (!proceedToPayment) {
      // Log session closure even if no payment
      try {
        await fetch('/api/taxpayer-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxpayer_id: selectedTaxpayerId,
            taxpayer_name: taxpayerName,
            pins: JSON.stringify(pins),
            time_in: timeIn,
            time_out: timeOut,
            role: 'admin',
            remarks: 'Cancelled'
          })
        });

        // Also cancel queue since they are leaving
        await fetch('/api/admin/cancel-queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taxpayer_id: selectedTaxpayerId })
        });

        alert('Taxpayer session closed (No Payment)');
        setPaymentQueue([]);
        setSelectedTaxpayerId('');
        fetchTaxpayerLogs();
        fetchUsers();
      } catch (err) {
        console.error('Failed to log taxpayer timeout', err);
      }
      return;
    }

    try {
      const payload = paymentQueue.map(item => ({
        ...item,
        taxpayer_id: parseInt(selectedTaxpayerId) // Ensure taxpayer_id is included
      }));

      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || 'Failed to submit assessment');
      }

      alert('Assessment submitted to collector successfully');

      // Log taxpayer activity
      try {
        await fetch('/api/taxpayer-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxpayer_id: selectedTaxpayerId,
            taxpayer_name: taxpayerName,
            pins: JSON.stringify(pins),
            time_in: timeIn,
            time_out: timeOut
          })
        });
        fetchTaxpayerLogs();
      } catch (err) {
        console.error('Failed to log taxpayer activity', err);
      }

      setPaymentQueue([]);
      setSelectedTaxpayerId('');
      // Refresh properties if needed
      fetchUsers();
    } catch (err: any) {
      console.error('Assessment error', err);
      alert(err.message);
    }
  };

  // Filter properties for selected taxpayer (Computation)
  const taxpayerProperties = useMemo(() =>
    properties.filter(p => p.owner_id && p.owner_id.toString() === selectedTaxpayerId),
    [properties, selectedTaxpayerId]
  );

  const taggedPropertiesList = useMemo(() =>
    properties.filter(p => taggedPropertyIds.includes(p.id)),
    [properties, taggedPropertyIds]
  );

  const selectedCompProperty = useMemo(() =>
    properties.find(p => p.id.toString() === selectedComputationPropertyId),
    [properties, selectedComputationPropertyId]
  );

  const grandTotal = useMemo(() =>
    paymentQueue.reduce((sum, item) => sum + item.amount, 0),
    [paymentQueue]
  );

  // Removed useEffect for debouncedSearchQuery

  const handleSearch = async (overrideQuery?: string) => {
    try {
      const queryToUse = overrideQuery || searchQuery;
      const formattedQuery = formatPinSearch(queryToUse);
      const res = await fetch(`/api/properties?search=${encodeURIComponent(formattedQuery)}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new TypeError("Oops, we haven't got JSON!");
      }
      const data = await res.json();
      if (data.length > 0) {
        const first = data[0];
        console.log('[DEBUG] Search Result Item Sample:', {
          registered_owner: first.registered_owner_name,
          status: first.status,
          taxability: first.taxability,
          classification: first.classification,
          remarks: first.remarks,
          raw_data: first
        });
      }
      setSearchResults(data);
      return data;
    } catch (err) {
      console.error('Search failed', err);
      return [];
    }
  };

  const handleTagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProperties.length === 0) return;
    if (!tagForm.taxpayer_id) {
      alert('Please select a taxpayer account to link the properties to.');
      return;
    }

    // Check for existing tags
    const alreadyTagged = selectedProperties.filter(p => p.owners && p.owners.length > 0);

    // Filter out properties that are already tagged to the SELECTED taxpayer (updates)
    const conflicts = alreadyTagged.filter(p => !p.owners?.some(o => o.id.toString() === tagForm.taxpayer_id));

    if (conflicts.length > 0) {
      const conflictNames = conflicts.map(p => `- ${p.pin} (${p.owners?.map(o => o.name).join(', ')})`).join('\n');
      const confirmMessage = `Warning: The following properties are already tagged to OTHER taxpayers:\n${conflictNames}\n\nDo you want to proceed with adding another claimant?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setSubmitStatus('linking');
    try {
      const res = await fetch('/api/admin/link-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: selectedProperties.map(p => ({
            // Ensure IDs are numbers for PostgreSQL
            id: Number(p.id),
            ownership_type: propertyDetails[p.id]?.ownership_type || 'full',
            claimed_area: propertyDetails[p.id]?.ownership_type === 'shared' ? propertyDetails[p.id]?.claimed_area : ''
          })),
          taxpayer_id: Number(tagForm.taxpayer_id),
          assigned_collector_id: tagForm.assigned_collector_id ? Number(tagForm.assigned_collector_id) : null
        }),
      });

      if (res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.warning) {
            alert(`Success, but with warning: ${data.warning}`);
          } else {
            // Determine if it was a link or assign action based on PREVIOUS state
            const isAssignmentOnly = selectedProperties.every(p => p.owners && p.owners.length > 0);
            setSubmitStatus(isAssignmentOnly ? 'assigned' : 'linked');
          }
        } else {
          const isAssignmentOnly = selectedProperties.every(p => p.owners && p.owners.length > 0);
          setSubmitStatus(isAssignmentOnly ? 'assigned' : 'linked');
        }

        // Prepare for Computation
        setTaggedPropertyIds(selectedProperties.map(p => p.id));
        setSelectedTaxpayerId(tagForm.taxpayer_id);
        if (!taxpayerTimeIn[tagForm.taxpayer_id]) {
          setTaxpayerTimeIn(prev => ({ ...prev, [tagForm.taxpayer_id]: getPHTimeNow().toISOString() }));
        }

        // Refresh list and update selection with new data (to reflect new owners)
        const newData = await handleSearch();
        if (newData) {
          setSelectedProperties(prev => prev.map(p => newData.find((np: Property) => np.id === p.id) || p));
        }

        fetchTaxpayerProperties(tagForm.taxpayer_id); // Refresh properties for computation
        fetchUsers(); // Refresh users for assigned collector

        // Reset status after a delay
        setTimeout(() => setSubmitStatus('idle'), 3000);
      } else {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          alert(`${data.error || 'Failed to link properties'}${data.details ? ': ' + data.details : ''}`);
        } else {
          alert(`Server error: ${res.status} ${res.statusText}`);
        }
        setSubmitStatus('idle');
      }
    } catch (err) {
      console.error('Tagging error', err);
      alert('Network error or server is unreachable. Please check your connection.');
      setSubmitStatus('idle');
    }
  };

  const handleUnlinkSingle = async (
    e: React.MouseEvent<HTMLButtonElement>,
    propertyId: number,
    isRptarContext: boolean = false
  ) => {
    e.stopPropagation();

    if (!window.confirm('Unlink this property from the taxpayer?')) return;

    try {
      const property =
        searchResults.find((p) => p.id === propertyId) ||
        rptarSearchResults.find((p) => p.id === propertyId) ||
        selectedProperties.find((p) => p.id === propertyId);

      const payload: { property_ids: number[]; taxpayer_id?: number } = {
        property_ids: [propertyId]
      };

      // When we can infer a single owner, unlink only that owner for safer behavior.
      const inferredTaxpayerId =
        property?.owners?.length === 1
          ? property.owners[0].id
          : property?.owner_id || undefined;

      if (inferredTaxpayerId) {
        payload.taxpayer_id = inferredTaxpayerId;
      }

      const res = await fetch('/api/admin/unlink-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to unlink property');
        }
        throw new Error(`Server error: ${res.status} ${res.statusText}`);
      }

      setSearchResults((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, linked_taxpayer: null, owner_id: null, owners: [] }
            : p
        )
      );
      setRptarSearchResults((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? { ...p, linked_taxpayer: null, owner_id: null, owners: [] }
            : p
        )
      );
      setSelectedProperties((prev) => prev.filter((p) => p.id !== propertyId));
      setPropertyDetails((prev) => {
        const next = { ...prev };
        delete next[propertyId];
        return next;
      });

      if (isRptarContext) {
        if (rptarSearchQuery.trim()) {
          await handleRptarSearch(null, rptarSearchQuery);
        }
      } else if (searchQuery.trim()) {
        await handleSearch(searchQuery);
      }
    } catch (err: any) {
      console.error('Unlink property error:', err);
      alert(err.message || 'Failed to unlink property');
    }
  };

  const togglePropertySelection = (prop: Property) => {
    setSubmitStatus('idle');
    setSelectedProperties(prev => {
      const exists = prev.find(p => p.id === prop.id);
      let newSelection;
      if (exists) {
        newSelection = prev.filter(p => p.id !== prop.id);
        setPropertyDetails(details => {
          const newDetails = { ...details };
          delete newDetails[prop.id];
          return newDetails;
        });
      } else {
        newSelection = [...prev, prop];
        setPropertyDetails(details => ({
          ...details,
          [prop.id]: { ownership_type: 'full', claimed_area: '' }
        }));
      }

      // Auto-fill form if single property selected and linked
      if (newSelection.length === 1) {
        const selected = newSelection[0];
        if (selected.owners && selected.owners.length > 0) {
          // Use the first owner for now (or primary)
          const owner = selected.owners[0];
          // Find taxpayer to get assigned collector
          const taxpayer = users.find(u => u.id === owner.id);

          setTagForm({
            taxpayer_id: owner.id.toString(),
            assigned_collector_id: taxpayer?.assigned_collector_id?.toString() || ''
          });
          setPropertyDetails(details => ({
            ...details,
            [selected.id]: {
              ownership_type: owner.ownership_type || 'full',
              claimed_area: owner.claimed_area || ''
            }
          }));
        }
      } else if (newSelection.length === 0) {
        // Reset form
        setTagForm({
          taxpayer_id: '',
          assigned_collector_id: ''
        });
        setPropertyDetails({});
      }

      return newSelection;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      setUploadStatus('Uploading...');
      const res = await fetch('/api/admin/upload-roll', {
        method: 'POST',
        body: formData,
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok) {
          setUploadStatus(`Success: ${data.successCount} added.`);
          if (data.errors && data.errors.length > 0) {
            alert(`Errors encountered:\n${data.errors.slice(0, 5).join('\n')}${data.errors.length > 5 ? '\n...' : ''}`);
          }
          if (searchQuery) handleSearch(); // Refresh list to show new properties if searching
        } else {
          setUploadStatus(`Failed: ${data.error || 'Unknown error'}`);
          alert(data.error || 'Upload failed');
        }
      } else {
        setUploadStatus(`Error: ${res.status}`);
        alert(`Server error (${res.status}).`);
      }
    } catch (err: any) {
      console.error('Upload error', err);
      setUploadStatus(`Error: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const InquiriesList = () => {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      fetchInquiries();
    }, []);

    const fetchInquiries = async () => {
      try {
        const res = await fetch('/api/admin/inquiries');
        if (res.ok) {
          const data = await res.json();
          setInquiries(data);
        }
      } catch (err) {
        console.error('Failed to fetch inquiries:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const updateStatus = async (id: number, status: 'read' | 'archived') => {
      try {
        const res = await fetch(`/api/admin/inquiries/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        if (res.ok) {
          setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
        }
      } catch (err) {
        console.error('Failed to update status:', err);
      }
    };

    if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" /></div>;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Inquiries</h3>
          <Button variant="outline" size="sm" onClick={fetchInquiries} className="h-8 gap-2">
            <History className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        {inquiries.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-xl border-gray-100">
            <Mail className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">No inquiries yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inquiries.map(inquiry => (
              <Card key={inquiry.id} className={`border transition-all ${inquiry.status === 'unread' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{inquiry.sender_name}</span>
                        {inquiry.email && <span className="text-xs text-gray-500">&lt;{inquiry.email}&gt;</span>}
                        {inquiry.status === 'unread' && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium uppercase tracking-wide">New</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2">{inquiry.message}</p>
                      <p className="text-xs text-gray-400 mt-3">
                        {inquiry.created_at ? (() => {
                          let dateStr = inquiry.created_at;
                          if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                          return new Date(dateStr).toLocaleString();
                        })() : '---'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {inquiry.status === 'unread' && (
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(inquiry.id, 'read')} className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                          Mark Read
                        </Button>
                      )}
                      {inquiry.status !== 'archived' && (
                        <Button variant="ghost" size="sm" onClick={() => updateStatus(inquiry.id, 'archived')} className="h-8 text-gray-400 hover:text-gray-600">
                          Archive
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTagging = () => (
    <div className="space-y-8">
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-4">
            <div className="lg:col-span-8">
              <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1 block">Search Property</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search PIN, Owner or TD No."
                    className="pl-10 h-9 rounded-none border-gray-200 text-xs"
                    value={searchQuery}
                    onChange={(e) => syncGlobalSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        syncGlobalSearch(searchQuery, true);
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={() => syncGlobalSearch(searchQuery, true)}
                  className="h-9 px-6 rounded-none bg-blue-600 hover:bg-blue-700 shadow-sm font-semibold text-xs"
                >
                  Search
                </Button>
              </div>
            </div>

            <div className="lg:col-span-4 pl-6 border-l border-gray-100">
              <Label className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1 block">Select Taxpayer Account</Label>
              <Select
                value={tagForm.taxpayer_id}
                onValueChange={(v) => {
                  const user = users.find(u => u.id.toString() === v);
                  setTagForm(prev => ({
                    ...prev,
                    taxpayer_id: v,
                    assigned_collector_id: user?.assigned_collector_id?.toString() || ''
                  }));
                  if (!taxpayerTimeIn[v]) {
                    setTaxpayerTimeIn(prev => ({ ...prev, [v]: getPHTimeNow().toISOString() }));
                  }
                  // Notify taxpayer it's their turn
                  fetch('/api/admin/notify-taxpayer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taxpayer_id: v })
                  }).catch(console.error);
                }}
              >
                <SelectTrigger className="w-full h-9 rounded-none border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-none hover:border-blue-400 focus:ring-blue-500/20">
                  <SelectValue placeholder="Choose a taxpayer..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {users.filter(u => u.role === 'taxpayer').length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-500">
                      No taxpayers found.
                    </div>
                  )}
                  {users.filter(u => u.role === 'taxpayer')
                    .sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id.toString()} className="text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">
                            {u.queue_number ? `[RPT-${String(u.queue_number).padStart(3, '0')}] ` : ''}
                            {u.full_name}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {searchQuery.trim() !== '' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Search Results List */}
              <div className="lg:col-span-8 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em]">
                    {searchResults.length === 1 ? 'Search Result' : 'Search Results'}
                  </h2>
                  <span className="text-xs text-gray-400">{searchResults.length} {searchResults.length === 1 ? 'Property' : 'Properties'} Found</span>
                </div>

                <div className="space-y-1 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                  {searchResults.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed rounded-xl border-gray-100">
                      <Search className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400">No properties found. Try searching or upload a property</p>
                    </div>
                  )}
                  {searchResults.map(prop => {
                    const isSelected = selectedProperties.some(p => p.id === prop.id);
                    return (
                      <div
                        key={prop.id}
                        className={`p-2 border transition-all rounded-none cursor-pointer hover:shadow-md ${isSelected
                          ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500'
                          : 'border-gray-100 bg-white'
                          }`}
                        onClick={() => togglePropertySelection(prop)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                              }`}>
                              {isSelected && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <div>
                              {/* 1. Wrapped the name and badges in a flex container */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 text-xs">{prop.registered_owner_name}</h3>

                                <div className="flex items-center gap-1 flex-wrap">
                                  {/* Status Badge */}
                                  {prop.status && !prop.status.toLowerCase().includes('unpaid') && (
                                    <span className={`px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded-full border ${(prop.status.toLowerCase().includes('active') || prop.status.toLowerCase().startsWith('act'))
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : (prop.status.toLowerCase().includes('delinquent') || prop.status.toLowerCase().includes('del'))
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                      }`}>
                                      {prop.status}
                                    </span>
                                  )}

                                  {/* Taxability Badge */}
                                  {prop.taxability && (
                                    <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                      {prop.taxability}
                                    </span>
                                  )}

                                  {/* Classification Badge */}
                                  {prop.classification && (
                                    <span className="px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                      {prop.classification}
                                    </span>
                                  )}

                                  {/* Remarks Badge */}
                                  {prop.remarks && (
                                    <span className="px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-wider rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                      {prop.remarks}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 mt-0.5">
                                <p className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0 rounded">
                                  PIN: {prop.pin}
                                </p>
                                <p className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0 rounded">
                                  Old PIN: {prop.old_pin || '-'}
                                </p>
                                <p className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0 rounded">
                                  TD No: {prop.td_no}
                                </p>
                                <p className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0 rounded">
                                  Kind: {prop.kind}
                                </p>
                                <p className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0 rounded">
                                  Lot No: {prop.lot_no}
                                </p>
                                <p className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 py-0 rounded border border-gray-100 italic">
                                  Area: {prop.total_area}
                                </p>
                              </div>
                            </div>
                          </div>
                          {prop.linked_taxpayer && (
                            <div className="flex flex-col gap-1 items-end">
                              <div className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 pl-2.5 pr-1 py-1 rounded-full font-medium">
                                <CheckCircle className="w-3 h-3" />
                                Linked: {prop.linked_taxpayer}
                                <button
                                  onClick={(e) => handleUnlinkSingle(e, prop.id)}
                                  className="ml-1 p-0.5 hover:bg-green-200 rounded-full text-green-800 transition-colors"
                                  title="Unlink property"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tagging Form */}
              <div className="lg:col-span-4">
                <div className="sticky top-8">
                  <div className="border border-gray-100 rounded-2xl p-6 bg-white shadow-sm">
                    <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-1.5">
                      {selectedProperties.length > 1 ? 'Linked Properties' : 'Linked Property'}
                    </h2>
                    {selectedProperties.length > 0 ? (
                      <form onSubmit={handleTagSubmit} className="space-y-5">
                        <div className="space-y-1">
                          <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-2 border-t border-gray-50 pt-2">
                            {selectedProperties.map(p => (
                              <div key={p.id} className="py-0 flex items-center justify-start gap-2 last:border-0 hover:bg-gray-50/30 transition-colors px-1 border border-transparent hover:border-gray-100 rounded">
                                <div className="flex items-center gap-1.5 w-[185px] min-w-0 shrink-0">
                                  <span className="text-xs font-mono font-bold text-blue-700 truncate tracking-tighter">{p.pin}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); togglePropertySelection(p); }}
                                    className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                                  >
                                    &times;
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-[110px]">
                                    <Select
                                      value={propertyDetails[p.id]?.ownership_type || 'full'}
                                      onValueChange={v => setPropertyDetails(prev => ({
                                        ...prev,
                                        [p.id]: { ...prev[p.id], ownership_type: v }
                                      }))}
                                      disabled={p.owners && p.owners.length > 0}
                                    >
                                      <SelectTrigger className="h-8 rounded-none border-gray-200 bg-white px-2 text-xs font-bold text-gray-600 shadow-none hover:border-blue-300 transition-colors focus:ring-0">
                                        <SelectValue placeholder="Type" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="full" className="text-xs">Full Area</SelectItem>
                                        <SelectItem value="shared" className="text-xs">Share Area</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="w-[60px]">
                                    {propertyDetails[p.id]?.ownership_type === 'shared' ? (
                                      <div className="animate-in fade-in slide-in-from-right-1">
                                        <Input
                                          placeholder="Sqm"
                                          className="h-8 rounded-none text-xs font-mono border-gray-200 px-2 focus:ring-0 shadow-none"
                                          value={propertyDetails[p.id]?.claimed_area || ''}
                                          onChange={(e) => setPropertyDetails(prev => ({
                                            ...prev,
                                            [p.id]: { ...prev[p.id], claimed_area: e.target.value }
                                          }))}
                                          required
                                          disabled={p.owners && p.owners.length > 0}
                                        />
                                      </div>
                                    ) : (
                                      <div className="h-8" /> // Placeholder for alignment
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="collector" className="text-[11px] font-bold text-gray-500 uppercase tracking-[0.2em] block">Assigned to Collector</Label>
                          <Select
                            value={tagForm.assigned_collector_id}
                            onValueChange={(v) => setTagForm(prev => ({ ...prev, assigned_collector_id: v }))}
                          >
                            <SelectTrigger className="w-full h-9 rounded-none border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-none hover:border-blue-400 focus:ring-blue-500/20">
                              <SelectValue placeholder="Choose a Collector" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned" className="text-xs font-semibold">Unassigned</SelectItem>
                              {collectors.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()} className="text-xs font-semibold">
                                  <span className="flex items-center gap-2">
                                    <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span className="truncate">{c.full_name}</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button
                            type="submit"
                            className={`flex-1 h-12 rounded-none transition-all font-semibold ${submitStatus !== 'idle' ? 'bg-green-600 hover:bg-green-700 shadow-none' : 'bg-blue-600 hover:bg-blue-700 shadow-none'
                              }`}
                            disabled={submitStatus !== 'idle'}
                          >
                            {submitStatus === 'linked' ? 'Linked' :
                              submitStatus === 'assigned' ? 'Assigned' :
                                selectedProperties.every(p => p.owners && p.owners.length > 0) ? 'Assign' : 'Link'}
                          </Button>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full text-xs text-gray-400 hover:text-gray-600"
                          onClick={() => setSelectedProperties([])}
                        >
                          Cancel Selection
                        </Button>
                      </form>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-8 h-8 text-gray-200" />
                        </div>
                        <p className="text-sm text-gray-500 font-medium">Select properties</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-[180px] mx-auto">Click on properties from the list to start tagging.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tagged Properties Management Removed */}
    </div>
  );

  const renderComputation = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Taxpayer</Label>
              <Select
                value={selectedTaxpayerId}
                onValueChange={v => {
                  setSelectedTaxpayerId(v);
                  if (!taxpayerTimeIn[v]) {
                    setTaxpayerTimeIn(prev => ({ ...prev, [v]: getPHTimeNow().toISOString() }));
                  }
                  // Notify taxpayer it's their turn
                  fetch('/api/admin/notify-taxpayer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ taxpayer_id: v })
                  }).catch(console.error);
                }}
              >
                <SelectTrigger className="w-full h-12 rounded-none border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-none hover:border-blue-400 focus:ring-blue-500/20">
                  <SelectValue placeholder="Select Taxpayer..." />
                </SelectTrigger>
                <SelectContent>
                  {users.filter(u => u.role === 'taxpayer').length === 0 && (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No taxpayers found.
                    </div>
                  )}
                  {users.filter(u => u.role === 'taxpayer').map(tp => (
                    <SelectItem key={tp.id} value={tp.id.toString()}>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span>
                          {tp.queue_number ? `[RPT-${String(tp.queue_number).padStart(3, '0')}] ` : ''}
                          {tp.full_name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">PIN</Label>
              <Select
                value={selectedComputationPropertyId}
                onValueChange={setSelectedComputationPropertyId}
                disabled={!selectedTaxpayerId}
              >
                <SelectTrigger className="w-full h-12 rounded-none border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-none hover:border-blue-400 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:cursor-not-allowed">
                  <SelectValue placeholder="Select PIN" />
                </SelectTrigger>
                <SelectContent>
                  {properties.filter(p => p.owners?.some(o => o.id === Number(selectedTaxpayerId))).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>
                      <div className="flex items-center gap-2">
                        <Home className="w-4 h-4 text-gray-400" />
                        <span>{p.pin}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCompProperty && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
              <h3 className="font-semibold text-gray-900">Property Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="block text-gray-500 text-xs uppercase">Registered Owner</span>
                  <span className="font-medium">{selectedCompProperty.registered_owner_name}</span>
                </div>
                <div>
                  <span className="block text-gray-500 text-xs uppercase">Location</span>
                  <span className="font-medium">{getLocationFromPin(selectedCompProperty.pin)}</span>
                </div>
                <div>
                  <span className="block text-gray-500 text-xs uppercase">Lot No.</span>
                  <span className="font-medium">{selectedCompProperty.lot_no}</span>
                </div>
                <div>
                  <span className="block text-gray-500 text-xs uppercase">TD No.</span>
                  <span className="font-medium">{selectedCompProperty.td_no}</span>
                </div>
                <div>
                  <span className="block text-gray-500 text-xs uppercase">Assessed Value</span>
                  <span className="font-medium">{parseFloat(String(selectedCompProperty.assessed_value || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          )}

          {selectedCompProperty && (
            <div className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Computation Type</Label>
                    <Select
                      value={paymentForm.computationType}
                      onValueChange={v => setPaymentForm({ ...paymentForm, computationType: v })}
                    >
                      <SelectTrigger className="w-full h-12 rounded-none border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-none hover:border-blue-400 focus:ring-blue-500/20">
                        <SelectValue placeholder="Select Type..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="rpvara" disabled={getPHTimeNow() > new Date('2026-07-05T00:00:00Z')}>
                          RPVARA {getPHTimeNow() > new Date('2026-07-05T00:00:00Z') ? '(EXPIRED)' : ''}
                        </SelectItem>
                        <SelectItem value="denr">DENR</SelectItem>
                        <SelectItem value="share">Share Area</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Year / Range</Label>
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
                        className="h-12 rounded-none text-sm font-semibold px-3 leading-tight w-24 whitespace-normal"
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
                          className="h-12 rounded-none text-sm font-semibold gap-2 px-3 leading-tight w-24 whitespace-normal"
                        >
                          {isPdfProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-2" />}
                          Upload SOA
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Computation Breakdown</h4>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Basic Tax (1%)</span>
                    <span className="font-medium font-mono text-gray-900 inline-flex items-center">
                      <span className="invisible">(</span>
                      {parseFloat(String(paymentForm.basic_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="invisible">)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">SEF Tax (1%)</span>
                    <span className="font-medium font-mono text-gray-900 inline-flex items-center">
                      <span className="invisible">(</span>
                      {parseFloat(String(paymentForm.sef_tax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="invisible">)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Interest</span>
                    <span className="font-medium font-mono text-gray-900 inline-flex items-center">
                      <span className="invisible">(</span>
                      {parseFloat(String(paymentForm.interest || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="invisible">)</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium font-mono text-gray-900 inline-flex items-center">
                      {parseFloat(String(paymentForm.discount || '0')) > 0 ? (
                        <>
                          <span>(</span>
                          {parseFloat(String(paymentForm.discount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-2 flex justify-between items-center">
                    <span className="font-bold text-gray-900">Total Amount</span>
                    <span className="font-bold text-xl font-mono text-gray-900 inline-flex items-center">
                      <span className="invisible">(</span>
                      {parseFloat(String(paymentForm.amount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      <span className="invisible">)</span>
                    </span>
                  </div>
                </div>
              </div>

              <Button onClick={addToQueue} className="w-full text-lg h-12" variant="secondary">
                Add to Payment List
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {paymentQueue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tax Summary</CardTitle>
            <CardDescription>Review items before finalizing payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider align-bottom">Years<br />Covered</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center align-bottom">No. of<br />Years</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Assessed<br />Value</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Basic<br />Tax</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">SEF<br />Tax</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Interest</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Discount</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right align-bottom">Total</th>
                    <th className="px-4 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap text-center align-bottom">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {paymentQueue.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-gray-600 font-medium">{item.year}</td>
                      <td className="px-4 py-4 text-gray-600 text-center">{item.yearCount || 1}</td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">
                        {(() => {
                          const startYear = parseInt(String(item.year).split('-')[0].trim());
                          const isEditable = startYear <= 2015;
                          return isEditable ? (
                            <span className="inline-flex items-center justify-end w-full">
                              <span className="invisible">(</span>
                              <FormattedCurrencyInput
                                className="w-32 text-right ml-auto h-8 bg-white border-blue-200 no-spinner font-mono text-gray-900"
                                value={item.assessed_value}
                                onChange={(val) => handleQueueAssessmentChange(idx, val)}
                              />
                              <span className="invisible">)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-end w-full">
                              <span className="invisible">(</span>
                              {parseFloat(String(item.assessed_value || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              <span className="invisible">)</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.basic_tax || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.sef_tax || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.interest || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-gray-600">
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
                      <td className="px-4 py-4 text-right font-bold font-mono text-gray-900">
                        <span className="inline-flex items-center justify-end w-full">
                          <span className="invisible">(</span>
                          {parseFloat(String(item.amount || '0')).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <span className="invisible">)</span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => removeFromQueue(idx)} className="text-gray-500 hover:text-gray-900 font-medium text-xs uppercase tracking-wide transition-colors">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={7} className="px-4 py-4 text-right font-bold text-gray-900 uppercase tracking-wide text-xs">Grand Total</td>
                    <td className="px-4 py-4 text-right font-bold text-xl font-mono text-gray-900">
                      <span className="inline-flex items-center justify-end w-full">
                        <span className="invisible">(</span>
                        {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="invisible">)</span>
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex items-end gap-4 max-w-md ml-auto">
              <Button onClick={handleSubmitAssessment} className="h-10 px-8 w-full bg-green-600 hover:bg-green-700">
                Submit Assessment to Collector
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );



  const renderAnnouncements = () => (
    <Card className="border-none shadow-sm">
      <CardContent className="pt-6">
        <form onSubmit={handleSendMessage} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="msg-title" className="text-xs font-semibold">Title</Label>
            <Input
              id="msg-title"
              placeholder="e.g. System Maintenance"
              value={messageForm.title}
              onChange={(e) => setMessageForm({ ...messageForm, title: e.target.value })}
              required={!messageForm.audioFile}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg-body" className="text-xs font-semibold">Message</Label>
            <textarea
              id="msg-body"
              className="flex min-h-[150px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Type your message here..."
              value={messageForm.body}
              onChange={(e) => setMessageForm({ ...messageForm, body: e.target.value })}
              required={!messageForm.audioFile}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg-audio" className="text-xs font-semibold">Audio Announcement (Optional)</Label>
            <Input
              id="msg-audio"
              type="file"
              accept="audio/*"
              ref={messageAudioInputRef}
              onChange={(e) => setMessageForm({ ...messageForm, audioFile: e.target.files?.[0] || null })}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg-target" className="text-xs font-semibold">Target Audience</Label>
            <select
              id="msg-target"
              className="flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={messageForm.target_role}
              onChange={(e) => setMessageForm({ ...messageForm, target_role: e.target.value })}
            >
              <option value="all">All Users</option>
              <option value="taxpayer">Taxpayers Only</option>
              <option value="collector">Collectors Only</option>
              <option value="queue_system">Queue System Only</option>
            </select>
          </div>

          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            Send Announcement
          </Button>
        </form>
      </CardContent>
    </Card>
  );

  const renderActiveUsers = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <ActiveUsersList />
        </CardContent>
      </Card>
    </div>
  );

  const renderErptaas = () => {
    const handleSearch = () => {
      // Use direct viewdetails.php to skip the search list
      const url = `https://www.ompassessor.com.ph/etax/redirectpage/viewdetails.php?mode=2&pinno=${erptaasPin}&muncode=09`;
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
                className="h-9 rounded-none border-gray-200 text-xs font-mono"
                value={erptaasPin}
                onChange={(e) => syncGlobalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && syncGlobalSearch(erptaasPin, true)}
              />
              <Button onClick={handleSearch} className="h-9 px-6 rounded-none bg-blue-600 hover:bg-blue-700 shadow-sm font-semibold text-xs whitespace-nowrap">
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
    );
  };

  const renderSettings = () => (

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      <div className="lg:col-span-3">
        <div className="space-y-1">
          {settingsItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSettingsTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${activeSettingsTab === item.id
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <item.icon className={`w-4 h-4 ${activeSettingsTab === item.id ? 'text-blue-600' : 'text-gray-400'}`} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-9">
        {activeSettingsTab === 'create-admin' && user?.username.toLowerCase() === 'manlie' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Create Admin Account</CardTitle>
              <CardDescription>Add a new admin to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAdmin} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="admin-fullname" className="text-xs font-semibold">Full Name</Label>
                  <Input
                    id="admin-fullname"
                    placeholder="Admin Name"
                    value={adminForm.full_name}
                    onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-username" className="text-xs font-semibold">Username</Label>
                  <Input
                    id="admin-username"
                    placeholder="username"
                    value={adminForm.username}
                    onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
                  Create Admin
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'create-collector' && user?.username.toLowerCase() === 'manlie' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Create Collector Account</CardTitle>
              <CardDescription>Add a new collector to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCollector} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="col-fullname" className="text-xs font-semibold">Full Name</Label>
                  <Input
                    id="col-fullname"
                    placeholder="John Doe"
                    value={collectorForm.full_name}
                    onChange={(e) => setCollectorForm({ ...collectorForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-username" className="text-xs font-semibold">Username</Label>
                  <Input
                    id="col-username"
                    placeholder="username"
                    value={collectorForm.username}
                    onChange={(e) => setCollectorForm({ ...collectorForm, username: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  Create Collector
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'create-taxpayer' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Create Taxpayer Account</CardTitle>
              <CardDescription>Add a new taxpayer to the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTaxpayer} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="tax-fullname" className="text-xs font-semibold">Full Name</Label>
                  <Input
                    id="tax-fullname"
                    placeholder="Jane Doe"
                    value={taxpayerForm.full_name}
                    onChange={(e) => setTaxpayerForm({ ...taxpayerForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-username" className="text-xs font-semibold">Username</Label>
                  <Input
                    id="tax-username"
                    placeholder="username"
                    value={taxpayerForm.username}
                    onChange={(e) => setTaxpayerForm({ ...taxpayerForm, username: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Create Taxpayer
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'reset-password' && user?.username.toLowerCase() === 'manlie' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Reset User Password</CardTitle>
              <CardDescription>Reset a user's password to their default password</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="reset-user-select" className="text-xs font-semibold">Select User</Label>
                  <Select
                    value={selectedUserForReset?.toString() || ''}
                    onValueChange={(val) => setSelectedUserForReset(parseInt(val))}
                  >
                    <SelectTrigger id="reset-user-select" className="w-full">
                      <SelectValue placeholder="Choose a user to reset password" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => u.id !== user?.id).map(u => (
                        <SelectItem key={u.id} value={u.id.toString()}>
                          {u.full_name} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedUserForReset && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      The user's password will be reset to the default password for their role.
                    </p>
                  </div>
                )}
                {resetPasswordMessage && (
                  <div className={`p-3 rounded-md ${resetPasswordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {resetPasswordMessage.text}
                  </div>
                )}
                {selectedUserForReset && (
                  <Button
                    onClick={() => {
                      const selectedUser = users.find(u => u.id === selectedUserForReset);
                      if (selectedUser) {
                        handleResetPassword(selectedUserForReset, selectedUser.role);
                      }
                    }}
                    className="w-full bg-yellow-600 hover:bg-yellow-700"
                  >
                    Reset Password
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'change-password' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="admin-old-password" className="text-xs font-semibold">Current Password</Label>
                  <input
                    id="admin-old-password"
                    type="password"
                    placeholder="Enter current password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-new-password" className="text-xs font-semibold">New Password</Label>
                  <input
                    id="admin-new-password"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-confirm-password" className="text-xs font-semibold">Confirm Password</Label>
                  <input
                    id="admin-confirm-password"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {changePasswordMessage && (
                  <div className={`p-3 rounded-md ${changePasswordMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {changePasswordMessage.text}
                  </div>
                )}
                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Change Password</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'direct-messages' && (
          <MessagingPanel />
        )}

        {activeSettingsTab === 'manage-barangays' && user?.username.toLowerCase() === 'manlie' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Manage Barangays</CardTitle>
              <CardDescription>Add or remove barangays in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBarangay} className="flex gap-4 mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-gray-500">Location Code</Label>
                  <Input
                    placeholder="e.g. 0001"
                    value={newBarangayCode}
                    onChange={(e) => setNewBarangayCode(e.target.value)}
                    required
                  />
                </div>
                <div className="flex-[2] space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-gray-500">Barangay Name</Label>
                  <Input
                    placeholder="e.g. Batong Buhay"
                    value={newBarangayName}
                    onChange={(e) => setNewBarangayName(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">Add Barangay</Button>
                </div>
              </form>

              <div className="overflow-hidden border border-gray-100 rounded-xl">
                <Table>
                  <TableHeader className="bg-gray-50/50">
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barangays.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono">{b.code}</TableCell>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteBarangay(b.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {barangays.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-gray-400">No barangays found.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'manage-data' && user?.username.toLowerCase() === 'manlie' && (
          <div className="space-y-6">
            <Card className="border-red-200 shadow-sm">
              <CardHeader className="bg-red-50 border-b border-red-100">
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-red-600/80">
                  Destructive actions that cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Delete Account & Data</h3>
                    <p className="text-sm text-gray-500">Permanently delete a user account and all associated properties, assessments, and payments.</p>
                  </div>
                  <div className="flex items-end gap-4 max-w-md">
                    <div className="flex-1 space-y-2">
                      <Label>Select Account to Delete</Label>
                      <Select value={accountToDelete} onValueChange={setAccountToDelete}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {users.filter(u => u.username.toLowerCase() !== 'manlie').map(u => (
                            <SelectItem key={u.id} value={u.id.toString()}>
                              {u.full_name} ({u.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={!accountToDelete}
                    >
                      Delete Account
                    </Button>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Factory Reset</h3>
                    <p className="text-sm text-gray-500">Wipe all data from the system. This deletes all users (except Manlie account), properties, assessments, payments, and logs.</p>
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full sm:w-auto"
                    onClick={handleResetAllData}
                  >
                    Reset All System Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSettingsTab === 'inquiries' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Inquiries</CardTitle>
              <CardDescription>Messages from the login page.</CardDescription>
            </CardHeader>
            <CardContent>
              <InquiriesList />
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'feedback' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="capitalize">{activeSettingsTab.replace('-', ' ')}</CardTitle>
              <CardDescription>This feature is coming soon.</CardDescription>
            </CardHeader>
            <CardContent className="py-12 text-center">
              <Settings className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 italic">Module under development</p>
            </CardContent>
          </Card>
        )}

        {activeSettingsTab === 'queue-kiosk' && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Queue Kiosk</CardTitle>
              <CardDescription>Open the taxpayer registration kiosk interface.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-8 text-center space-y-4">
                <Users className="w-16 h-16 text-blue-600 mx-auto" />
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Taxpayer Queueing System</h3>
                  <p className="text-gray-500 max-w-sm mx-auto">Launch the kiosk mode in a new browser window for taxpayers to register and join the queue.</p>
                </div>
                <Button
                  onClick={() => window.open('/queue', 'QueueKioskWindow', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')}
                  className="bg-blue-600 hover:bg-blue-700 shadow-lg px-8 h-12 text-lg font-bold"
                >
                  Launch Kiosk Mode
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderRPTAR = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-sm">
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); syncGlobalSearch(rptarSearchQuery, true); }} className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search PIN, Owner, or Taxpayer..."
                className="pl-9 h-9 rounded-none border-gray-200 text-xs"
                value={rptarSearchQuery}
                onChange={(e) => syncGlobalSearch(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={isRptarSearching} className="h-9 px-6 rounded-none bg-blue-600 hover:bg-blue-700 shadow-sm font-semibold text-xs transition-all">
              {isRptarSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Search'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {rptarSearchResults.length > 0 && (
        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-900">Search Results</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-bottom">Kind</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider align-bottom">Registered Owner</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider align-bottom">Taxpayer</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-bottom">PIN</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-bottom">Old PIN</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap align-bottom">Lot No.</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap align-bottom">Area</th>
                  <th className="px-6 py-3 text-sm font-semibold text-gray-500 uppercase tracking-wider text-left whitespace-nowrap align-bottom">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rptarSearchResults
                  .filter(p => !rptarSelectedPropertyId || p.id === rptarSelectedPropertyId)
                  .map((prop) => (
                    <tr
                      key={prop.id}
                      className={`transition-colors ${rptarSelectedPropertyId === prop.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-6 py-4 text-sm font-normal text-gray-600 text-left align-middle leading-tight">
                        <div className="flex flex-col gap-1 items-start">
                          <span>{prop.kind || prop.description || '-'}</span>
                          {prop.classification && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                              {prop.classification}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-gray-600 text-left align-middle leading-tight">
                        <div className="flex flex-col gap-2 items-start">
                          <span className="break-words">{prop.registered_owner_name}</span>
                          <div className="flex items-center gap-x-1.5 gap-y-1.5 flex-wrap mt-1">
                            {/* Status Badge */}
                            {prop.status && !prop.status.toLowerCase().includes('unpaid') && (
                              <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border align-middle leading-none h-[20px] flex items-center ${(prop.status.toLowerCase().includes('active') || prop.status.toLowerCase().startsWith('act'))
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : (prop.status.toLowerCase().includes('delinquent') || prop.status.toLowerCase().includes('del'))
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                {prop.status}
                              </span>
                            )}
                            {prop.taxability && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 border border-blue-200 align-middle leading-none h-[20px] flex items-center">
                                {prop.taxability}
                              </span>
                            )}
                            {prop.remarks && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-orange-50 text-orange-700 border border-orange-200 align-middle leading-none h-[20px] flex items-center">
                                {prop.remarks}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-normal text-gray-600 text-left align-middle leading-tight">
                        {prop.linked_taxpayer ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {prop.linked_taxpayer}
                              <button
                                onClick={(e) => handleUnlinkSingle(e, prop.id, true)}
                                className="ml-1 p-0.5 hover:bg-green-200 rounded-full text-green-800 transition-colors"
                                title="Unlink property"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-600 text-sm">Not Tagged</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 text-left whitespace-nowrap align-middle leading-tight">{prop.pin}</td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 text-left whitespace-nowrap align-middle leading-tight">{prop.old_pin || '-'}</td>
                      <td className="px-6 py-4 text-sm font-normal text-gray-600 text-left whitespace-nowrap align-middle leading-tight">{prop.lot_no}</td>
                      <td className="px-6 py-4 font-mono text-sm text-gray-600 text-right whitespace-nowrap align-middle leading-tight">{prop.total_area || '-'}</td>
                      <td className="px-6 py-4 text-sm font-normal text-gray-600 text-left whitespace-nowrap align-middle leading-none">
                        <button
                          onClick={() => setRptarSelectedPropertyId(prop.id === rptarSelectedPropertyId ? null : prop.id)}
                          className="text-sm font-normal text-gray-600 hover:text-gray-900 bg-transparent border border-gray-300 px-3 py-1 rounded h-8 w-fit hover:bg-gray-50 inline-flex items-center justify-center gap-2"
                        >
                          <History className="w-4 h-4" />
                          {rptarSelectedPropertyId === prop.id ? 'Hide History' : 'Account History'}
                        </button>
                      </td>
                    </tr>
                  ))}
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
            </div>
          </CardHeader>
          <CardContent className="pt-0 overflow-x-auto">
            {rptarPayments.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">No payment records found for this property.</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  {/* Main header row */}
                  <tr>
                    <th className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap border-r border-gray-200">TD No.</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap border-r border-gray-200">Year<br />Covered</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider text-right border-r border-gray-200">Assessed<br />Value</th>
                    <th colSpan={3} className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider text-center border-r border-gray-200">Collectibles</th>
                    <th colSpan={7} className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider text-center border-r border-gray-200">Collected</th>
                    <th colSpan={2} className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider text-center border-r border-gray-200">Balance</th>
                    <th className="px-3 py-3 font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">Remarks</th>
                  </tr>
                  {/* Sub-header row */}
                  <tr className="border-t border-gray-200">
                    <th colSpan={3}></th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Basic<br />Tax</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">SEF<br />Tax</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Total</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Date</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">OR No.</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Basic<br />Tax</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">SEF<br />Tax</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Interest</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Discount</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Total</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">Basic<br />Tax</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs border-r border-gray-100">SEF<br />Tax</th>
                    <th className="px-3 py-2 font-semibold text-gray-600 text-right text-xs"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rptarPayments.map(payment => {
                    const prop = rptarSearchResults.find(p => p.id === rptarSelectedPropertyId);
                    
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
                    
                    // Calculate collectibles: 1% of assessed value × number of years
                    const assessedVal = payment.assessed_value ? parseFloat(String(payment.assessed_value)) : 0;
                    const collectiblesBasic = (assessedVal * 0.01) * numberOfYears;
                    const collectiblesSef = (assessedVal * 0.01) * numberOfYears;
                    const collectiblesTotal = collectiblesBasic + collectiblesSef;
                    
                    // Collected data comes from actual payments (RPT abstract)
                    const collectedBasic = payment.record_type === 'payment' ? parseFloat(String(payment.basic_tax || 0)) : 0;
                    const collectedSef = payment.record_type === 'payment' ? parseFloat(String(payment.sef_tax || 0)) : 0;
                    const balanceBasic = collectiblesBasic - collectedBasic;
                    const balanceSef = collectiblesSef - collectedSef;
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3 font-medium text-gray-900 text-xs border-r border-gray-100">{prop?.td_no || '-'}</td>
                        <td className="px-3 py-3 text-gray-600 text-xs border-r border-gray-100">{payment.year || '-'}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">
                          {payment.assessed_value ? parseFloat(String(payment.assessed_value)).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '---'}
                        </td>
                        {/* Collectibles */}
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectiblesBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectiblesSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-gray-900 text-xs border-r border-gray-100">{collectiblesTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        {/* Collected */}
                        <td className="px-3 py-3 text-right font-medium text-gray-600 text-xs border-r border-gray-100">{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : '---'}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-600 text-xs border-r border-gray-100">{payment.or_no || '---'}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectedBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{collectedSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{parseFloat(String(payment.interest || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{parseFloat(String(payment.discount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-gray-900 text-xs border-r border-gray-100">{(collectedBasic + collectedSef + parseFloat(String(payment.interest || 0)) - parseFloat(String(payment.discount || 0))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        {/* Balance */}
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{balanceBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 text-xs border-r border-gray-100">{balanceSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs italic">{payment.remarks || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedComputationPropertyId) return;

    setIsPdfProcessing(true);
    try {
      // Set worker to local file served from public folder
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

      const prop = properties.find(p => p.id.toString() === selectedComputationPropertyId);
      if (!prop) {
        alert("Selected property not found.");
        return;
      }

      // Extract and verify PIN from PDF
      // PIN patterns: 028-09-0001-001-01, 028-09-0001-001-01-1001, 028-09-0001-001-(01)-1001, 028.09.0001.001.01-2001, 028.09.0001.001.(01)-2001
      const pinRegex = /028[-.]09[-.](\d{4})[-.](\d{3})[-.](?:\()?(\d{2})(?:\))?(?:[-.](\d{4}))?/g;
      let extractedPin: string | null = null;
      let pinMatch;

      while ((pinMatch = pinRegex.exec(fullText)) !== null) {
        const part2 = pinMatch[1]; // 0001
        const part3 = pinMatch[2]; // 001
        const part4 = pinMatch[3]; // 01
        const part5 = pinMatch[4]; // 1001 or 2001 (optional)

        // Determine separator (dash or dot) from the matched text
        const matchedText = pinMatch[0];
        const separator = matchedText.includes('.') ? '.' : '-';

        if (part5) {
          // Full format with year/number: 028-09-0001-001-01-1001
          extractedPin = `028${separator}09${separator}${part2}${separator}${part3}${separator}${part4}${separator}${part5}`;
        } else {
          // Basic format without year: 028-09-0001-001-01
          extractedPin = `028${separator}09${separator}${part2}${separator}${part3}${separator}${part4}`;
        }
        break; // Use the first match
      }

      // Verify PIN matches
      if (extractedPin) {
        const normalizedExtracted = extractedPin.replace(/\./g, '-').toUpperCase();
        const normalizedProperty = prop.pin.replace(/\./g, '-').toUpperCase();

        if (normalizedExtracted !== normalizedProperty) {
          alert(`PIN Mismatch!\nPDF PIN: ${extractedPin}\nProperty PIN: ${prop.pin}\n\nPlease ensure you uploading the correct document for this property.`);
          return;
        }
      } else {
        alert("Warning: Could not find PIN in PDF. Proceeding with extraction.\nPlease manually verify this is the correct property document.");
      }

      // Extract years and assessed values from PDF
      // Pattern: Assessed Value (left column) followed by Year(s) (right column)
      // Matches: "1,234.56 1983" or "500.00 1983-1984"
      const extractRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d{2}))\s+(\d{4}(?:-\d{4})?)/g;
      const yearEntries: Array<{ year: number; assessed_value: number }> = [];
      let match;

      while ((match = extractRegex.exec(fullText)) !== null) {
        const valueStr = match[1].trim();
        const yearStr = match[2].trim();
        const value = parseFloat(valueStr.replace(/,/g, ''));

        if (isNaN(value) || value <= 0) continue;

        // Parse year or year range
        if (yearStr.includes('-')) {
          const parts = yearStr.split('-');
          const startY = parseInt(parts[0]);
          const endY = parseInt(parts[1]);
          if (!isNaN(startY) && !isNaN(endY) && startY >= 1900 && endY <= 2100) {
            for (let y = startY; y <= endY; y++) {
              yearEntries.push({ year: y, assessed_value: value });
            }
          }
        } else {
          const y = parseInt(yearStr);
          if (!isNaN(y) && y >= 1900 && y <= 2100) {
            yearEntries.push({ year: y, assessed_value: value });
          }
        }
      }

      if (yearEntries.length === 0) {
        alert("No valid year and assessed value entries found in the PDF.\n\nTroubleshooting:\n• Format should be: Assessed Value (left) then Year (right)\n• Example: 1,234.56 1983 or 500.00 1983-1984");
        return;
      }

      // Sort by year
      yearEntries.sort((a, b) => a.year - b.year);

      // Group consecutive years with the same assessed value
      const groupedRanges: Array<{ startYear: number; endYear: number; assessed_value: number }> = [];
      let currentStart = yearEntries[0].year;
      let currentAV = yearEntries[0].assessed_value;

      for (let i = 1; i <= yearEntries.length; i++) {
        const nextEntry = yearEntries[i];

        if (i === yearEntries.length || nextEntry.assessed_value !== currentAV || nextEntry.year !== yearEntries[i - 1].year + 1) {
          // End of current group
          const endYear = yearEntries[i - 1].year;
          groupedRanges.push({
            startYear: currentStart,
            endYear: endYear,
            assessed_value: currentAV
          });

          if (i < yearEntries.length) {
            currentStart = nextEntry.year;
            currentAV = nextEntry.assessed_value;
          }
        }
      }

      // Create payment queue items from grouped ranges
      const newItems: any[] = [];
      for (const range of groupedRanges) {
        const result = calculateTaxForRange(range.startYear, range.endYear, prop, paymentForm.computationType, range.assessed_value);

        newItems.push({
          property_id: parseInt(selectedComputationPropertyId),
          pin: prop.pin,
          year: range.startYear === range.endYear ? range.startYear.toString() : `${range.startYear}-${range.endYear}`,
          yearCount: range.endYear - range.startYear + 1,
          computationType: paymentForm.computationType,
          assessed_value: range.assessed_value.toString(),
          basic_tax: result.basic_tax,
          sef_tax: result.sef_tax,
          interest: result.interest,
          discount: result.discount,
          amount: Number(result.amount),
          or_no: paymentForm.or_no,
          fromPdfExtraction: true
        });
      }

      if (newItems.length > 0) {
        // Derive the overall year range from extracted data and update the Year/Range input
        const overallMin = groupedRanges.reduce((min, r) => Math.min(min, r.startYear), Infinity);
        const overallMax = groupedRanges.reduce((max, r) => Math.max(max, r.endYear), -Infinity);
        const rangeLabel = overallMin === overallMax ? `${overallMin}` : `${overallMin}-${overallMax}`;

        // Sum totals from all items (existing queue + new PDF items)
        const allItems = [...paymentQueue, ...newItems];
        const totalBasic = allItems.reduce((s, qi) => s + parseFloat(String(qi.basic_tax || 0)), 0);
        const totalSef = allItems.reduce((s, qi) => s + parseFloat(String(qi.sef_tax || 0)), 0);
        const totalInterest = allItems.reduce((s, qi) => s + parseFloat(String(qi.interest || 0)), 0);
        const totalDiscount = allItems.reduce((s, qi) => s + parseFloat(String(qi.discount || 0)), 0);
        const totalAmount = allItems.reduce((s, qi) => s + parseFloat(String(qi.amount || 0)), 0);

        setPaymentForm(prev => ({
          ...prev,
          year: rangeLabel,
          basic_tax: totalBasic.toFixed(2),
          sef_tax: totalSef.toFixed(2),
          interest: totalInterest.toFixed(2),
          discount: totalDiscount.toFixed(2),
          amount: totalAmount.toFixed(2)
        }));

        // Store the extracted data for real-time recalculation
        setExtractedPdfData(groupedRanges);
        setPaymentQueue(prev => [...prev, ...newItems]);

        // Save extracted data to assessments table so it persists for later payment
        if (selectedTaxpayerId) {
          try {
            const assessmentsToSave = newItems.map(item => ({
              property_id: item.property_id,
              taxpayer_id: parseInt(selectedTaxpayerId),
              amount: item.amount,
              year: item.year,
              assessed_value: parseFloat(String(item.assessed_value)),
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
            // Don't alert user as this is a background operation
          }
        }

        alert(`Successfully extracted and added ${newItems.length} year range(s) from SOA.\nGrouped by assessed value: ${newItems.length} group(s) created.`);
      } else {
        alert("No valid ranges could be generated from the extracted years.");
      }
    } catch (err: any) {
      console.error('PDF processing error:', err);
      const errorMsg = err?.message || 'Unknown error';
      alert(`Failed to process PDF.\n\nError: ${errorMsg}\n\nPlease ensure:\n• Your file is a valid PDF document\n• The PDF is not corrupted\n• The PDF contains readable text (not image-only)\n• File size is reasonable (< 10MB)`);
    } finally {
      setIsPdfProcessing(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleAbstractUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsAbstractUploading(true);
    try {
      const res = await fetch('/api/admin/upload-abstract', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Successfully uploaded RPT Abstract: ${result.successCount} records imported.`);
        fetchAllPayments();
      } else {
        const error = await res.json();
        alert(`Upload failed: ${error.error}`);
      }
    } catch (err) {
      console.error('Upload error', err);
      alert('An error occurred during upload');
    } finally {
      setIsAbstractUploading(false);
      e.target.value = '';
    }
  };

  const renderRptAbstract = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
        <Card className="border-none shadow-sm bg-blue-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Collected</p>
                <h3 className="text-2xl font-bold mt-1">₱ {abstractSummary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</h3>
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
                  ₱ {abstractSummary.toDateAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/10 flex flex-wrap gap-4 items-end no-print">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Collector</Label>
              <Select value={abstractCollectorFilter} onValueChange={setAbstractCollectorFilter}>
                <SelectTrigger className="h-9 w-[120px] rounded-none border-gray-200 bg-white text-xs font-semibold">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All</SelectItem>
                  {collectors.map(c => (
                    <SelectItem key={c.id} value={c.full_name} className="text-xs">{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Payment Date</Label>
              <Input
                type="date"
                className="h-9 rounded-none border-gray-200 bg-white text-xs font-semibold w-[140px]"
                value={abstractDateFilter}
                onChange={(e) => setAbstractDateFilter(e.target.value)}
              />
            </div>

            <div className="flex-1 min-w-[300px] space-y-1">
              <Label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Search</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <Input
                    placeholder="Search OR No, PIN, or Taxpayer..."
                    className="pl-9 h-9 w-full rounded-none border-gray-200 bg-white text-xs"
                    value={abstractSearchQuery}
                    onChange={(e) => setAbstractSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setActiveAbstractSearchQuery(abstractSearchQuery)}
                  />
                </div>
                <Button
                  onClick={() => setActiveAbstractSearchQuery(abstractSearchQuery)}
                  className="h-9 px-6 rounded-none bg-blue-600 hover:bg-blue-700 shadow-sm font-semibold text-xs whitespace-nowrap"
                >
                  Search
                </Button>
              </div>
            </div>

            <Button variant="outline" onClick={() => window.print()} className="h-9 w-9 p-0 rounded-none border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center">
              <Printer className="w-4 h-4 text-gray-600" />
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
                  <TableHead className="whitespace-nowrap align-bottom pb-3 text-sm">Collector</TableHead>
                  <TableHead className="min-w-[150px] align-bottom pb-3 whitespace-nowrap text-sm">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abstractSummary.filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="text-center py-12 text-gray-500">
                      No payment records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  abstractSummary.filtered.map(payment => (
                    <TableRow key={payment.id} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="text-sm whitespace-nowrap py-1">
                        <Input
                          type="date"
                          className="h-7 w-fit border-transparent bg-transparent hover:border-gray-200 focus:bg-white text-[11px] font-semibold px-1 py-0 shadow-none ring-0 focus-visible:ring-0 rounded-none transition-all"
                          value={new Date(payment.payment_date).toISOString().split('T')[0]}
                          onChange={(e) => handleUpdatePaymentDate(payment.id, e.target.value)}
                        />
                      </TableCell>
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
                      <TableCell className="text-sm text-gray-500 font-medium uppercase tracking-wider whitespace-nowrap">{payment.collector_name || 'System'}</TableCell>
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

  const renderSystemLog = () => (
    <Card className="border-none shadow-sm">
      <div className="bg-gray-50 border-b border-gray-200 flex flex-row items-center justify-end px-6 py-4">
        <Button variant="ghost" size="sm" onClick={fetchLogs} className="text-xs">Refresh Logs</Button>
      </div>
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Admin ID</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    No system logs found.
                  </TableCell>
                </TableRow>
              )}
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">{log.action_type}</TableCell>
                  <TableCell className="text-gray-600">{log.details}</TableCell>
                  <TableCell className="text-gray-500">{log.admin_id}</TableCell>
                  <TableCell className="text-gray-500">
                    {log.created_at ? (() => {
                      let dateStr = log.created_at;
                      if (typeof dateStr === 'string' && !dateStr.includes('Z') && !dateStr.includes('+')) dateStr = dateStr.replace(' ', 'T') + 'Z';
                      return new Date(dateStr).toLocaleString();
                    })() : '---'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
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
                <TableHead>Collector</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxpayerLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
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
                    <TableCell className="text-gray-600">
                      {log.user_name} <span className="text-xs text-gray-400">({log.role})</span>
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
                      <TableHead>Location</TableHead>
                      <TableHead>Registered Owner</TableHead>
                      <TableHead>TD No.</TableHead>
                      <TableHead>Lot No.</TableHead>
                      <TableHead className="text-right">Area</TableHead>
                      <TableHead className="text-right">Assessed Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedLogPins.map((pin, i) => {
                      const prop = selectedLogProperties.find(p => p.pin === pin);
                      return (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm whitespace-nowrap">{pin}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={prop?.address || getLocationFromPin(pin)}>{prop?.address || getLocationFromPin(pin)}</TableCell>
                          <TableCell className="max-w-[150px] truncate" title={prop?.registered_owner_name || 'N/A'}>{prop?.registered_owner_name || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap">{prop?.td_no || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap">{prop?.lot_no || 'N/A'}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">{prop?.total_area || 'N/A'}</TableCell>
                          <TableCell className="text-right font-mono whitespace-nowrap">
                            {prop?.assessed_value ? parseFloat(String(prop.assessed_value)).toLocaleString(undefined, { minimumFractionDigits: 2 }) : 'N/A'}
                          </TableCell>
                        </TableRow>
                      );
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

  const renderDelinquencyReport = () => {
    // Data is already filtered by the server if requested
    const filteredData = delinquencyData;

    const totalBasic = filteredData.reduce((sum, d) => sum + (d.basic || 0), 0);
    const totalSEF = filteredData.reduce((sum, d) => sum + (d.sef || 0), 0);
    const totalInterest = filteredData.reduce((sum, d) => sum + (d.interest || 0), 0);
    const totalAmount = filteredData.reduce((sum, d) => sum + (d.amount || 0), 0);
    const totalPrincipal = filteredData.reduce((sum, d) => sum + (d.principal || 0), 0);

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={delinquencyReportType} onValueChange={setDelinquencyReportType}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5year">5-Year Report</SelectItem>
                <SelectItem value="actual">Actual Report</SelectItem>
              </SelectContent>
            </Select>

            <Select value={delinquencyBarangay} onValueChange={setDelinquencyBarangay}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue placeholder="Barangay" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Consolidated (All)</SelectItem>
                {barangays.map(b => (
                  <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={delinquencyInterestMode} onValueChange={(v: any) => setDelinquencyInterestMode(v)}>
              <SelectTrigger className="w-[160px] bg-white">
                <SelectValue placeholder="Interest Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="with">With Interest</SelectItem>
                <SelectItem value="without">Principal Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="default" onClick={fetchDelinquencyReport} disabled={isDelinquencyLoading} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
              <History className={`w-4 h-4 mr-2 ${isDelinquencyLoading ? 'animate-spin' : ''}`} />
              Generate Report
            </Button>
            {delinquencyReportGenerated && (
              <Button variant="outline" onClick={() => window.print()} className="bg-white">
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            )}
          </div>
        </div>

        {!delinquencyReportGenerated && !isDelinquencyLoading && (
          <Card className="border-dashed border-2">
            <CardContent className="py-24 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Report Generated</h3>
              <p className="text-gray-500 max-w-sm mx-auto mt-2">
                Select the report type and barangay above, then click <strong>Generate Report</strong> to view delinquent accounts.
              </p>
            </CardContent>
          </Card>
        )}

        {(isDelinquencyLoading || delinquencyReportGenerated) && (
          <Card className="print-area">
            <CardHeader className="text-center pt-8 border-b border-gray-100 pb-8">
              <CardTitle className="text-3xl font-black tracking-tighter text-slate-900">
                {delinquencyReportType === '5year' ? '5-YEAR' : 'ACTUAL'} DELINQUENCY REPORT
              </CardTitle>
              <CardDescription className="text-sm font-bold mt-2 text-slate-500">
                {delinquencyBarangay === 'all'
                  ? 'CONSOLIDATED REPORT (ALL BARANGAYS)'
                  : `BARANGAY: ${barangays.find(b => b.code === delinquencyBarangay)?.name?.toUpperCase() || ''}`}
              </CardDescription>
              <div className="mt-4 text-xs text-gray-400 font-mono">
                Generated on {new Date().toLocaleString()}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isDelinquencyLoading ? (
                <div className="text-center py-24">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                  <p className="text-gray-500 font-medium tracking-wide">Calculating delinquency data...</p>
                  <p className="text-xs text-gray-400 mt-2">This may take a moment depending on the volume of records</p>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="text-center py-24 text-gray-400 flex flex-col items-center gap-3">
                  <CheckCircle className="w-12 h-12 text-gray-100" />
                  <p className="font-medium">No delinquent accounts found for the current selection.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="w-full">
                    <TableHeader className="bg-gray-50/50">
                      <TableRow className="hover:bg-transparent border-b-2 border-slate-200 bg-slate-50/50">
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[140px]">PIN</TableHead>
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800">Registered Owner</TableHead>
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[70px] text-center px-1">Lot No.</TableHead>
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[70px] text-right px-1">Area (sq.m)</TableHead>
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[120px] text-center">Year Covered</TableHead>
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[110px] text-right">Basic Tax</TableHead>
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[110px] text-right">SEF Tax</TableHead>
                        {delinquencyInterestMode === 'with' && (
                          <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[110px] text-right">Interest</TableHead>
                        )}
                        <TableHead className="py-4 text-sm font-bold uppercase tracking-tight text-slate-800 w-[130px] text-right pr-8">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((d, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/30 border-b border-slate-100 last:border-0">
                          <TableCell className="text-[11px] font-mono py-4 text-slate-500 tracking-tighter whitespace-nowrap">{d.pin}</TableCell>
                          <TableCell className="text-[13px] py-4 text-slate-900 font-semibold tracking-tight">{d.registered_owner}</TableCell>
                          <TableCell className="text-xs py-4 text-slate-600 text-center px-1">{d.lot_no || '-'}</TableCell>
                          <TableCell className="text-xs py-4 text-slate-600 text-right px-1">{d.area || '-'}</TableCell>
                          <TableCell className="text-[12px] py-4 text-slate-600 text-center font-medium">
                            {d.year_covered}
                          </TableCell>
                          <TableCell className="text-right text-[12px] text-slate-600 py-4 font-mono">
                            {parseFloat(String(d.basic || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right text-[12px] text-slate-600 py-4 font-mono">
                            {parseFloat(String(d.sef || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </TableCell>
                          {delinquencyInterestMode === 'with' && (
                            <TableCell className="text-right text-[12px] text-slate-600 py-4 font-mono">
                              {parseFloat(String(d.interest || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </TableCell>
                          )}
                          <TableCell className="text-right text-[13px] font-bold text-slate-900 py-4 pr-8 font-mono">
                            {(delinquencyInterestMode === 'with' ? d.amount : d.principal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="p-8 bg-slate-50 border-t-2 border-slate-100 flex flex-wrap justify-between items-end gap-x-12 gap-y-8">
                    <div className="flex gap-12">
                      <div className="text-left">
                        <p className="text-[10px] font-bold text-slate-400 border-b border-slate-200 pb-1 mb-2 uppercase tracking-widest">Prepared by:</p>
                        <div className="mt-6 border-b border-slate-900 w-48 h-px"></div>
                        <p className="text-sm font-bold mt-1 uppercase">Municipal Assessor</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-x-12 gap-y-4">
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Basic Tax</p>
                        <p className="text-sm font-semibold text-slate-900"> {totalBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total SEF Tax</p>
                        <p className="text-sm font-semibold text-slate-900"> {totalSEF.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                      </div>
                      {delinquencyInterestMode === 'with' && (
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Interest</p>
                          <p className="text-sm font-semibold text-slate-900"> {totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        </div>
                      )}
                      <div className="text-right border-l-2 border-slate-200 pl-12 bg-white p-4 rounded-lg shadow-sm">
                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-tighter mb-1">
                          {delinquencyInterestMode === 'with' ? 'GRAND TOTAL' : 'TOTAL PRINCIPAL'}
                        </p>
                        <div className="text-4xl font-black text-slate-900 tracking-tighter flex items-baseline justify-end gap-2">
                          <span className="text-sm font-bold">₱</span>
                          <span>{(delinquencyInterestMode === 'with' ? totalAmount : totalPrincipal).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'rptar': return renderRPTAR();
      case 'rpt-abstract': return renderRptAbstract();
      case 'taxpayer-log': return renderTaxpayerLog();
      case 'system-log': return renderSystemLog();
      case 'tagging': return renderTagging();
      case 'computation': return renderComputation();
      case 'announcements': return renderAnnouncements();
      case 'active-users': return renderActiveUsers();
      case 'erptaas': return renderErptaas();
      case 'settings': return renderSettings();
      case 'delinquency-report': return renderDelinquencyReport();
      case 'queue-management': return <QueueManagement />;
      default: return renderRPTAR();
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
                        if (item.id === 'payment-queue') {
                          navigate('/collector');
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
          {activeTab === 'tagging' && (
            <div className="flex items-center gap-3">
              <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileChange} />
              {uploadStatus && (
                <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider hidden md:block ${uploadStatus.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                  {uploadStatus}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading} title="Upload Roll">
                <Upload className="w-4 h-4" />
              </Button>
            </div>
          )}
          {activeTab === 'rpt-abstract' && user?.username === 'Manlie' && (
            <div className="flex items-center gap-3">
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".csv"
                  onChange={handleAbstractUpload}
                  disabled={isAbstractUploading}
                />
                <Button variant="outline" size="sm" asChild disabled={isAbstractUploading} title="Upload Abstract">
                  <div>
                    {isAbstractUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </div>
                </Button>
              </label>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
              {user?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:inline">{user?.full_name || 'Admin'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 md:p-8">
        <div className="w-full">
          {renderContent()}
        </div>
      </main>

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
      <MessagePopup />
    </div>
  );
}
