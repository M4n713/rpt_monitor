import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPinSearch(query: string): string {
  const trimmed = query.trim();
  
  // If empty or contains letters (name search), return as is
  if (!trimmed || /[a-zA-Z]/.test(trimmed)) return query;

  // If it already starts with 028 or 28, just ensure proper formatting
  if (trimmed.startsWith('028') || trimmed.startsWith('28')) {
    return autoFormatPinInput(trimmed);
  }

  // If it looks like a PIN part (digits, dashes, dots)
  // Prepend the standard 028-09-00 prefix as requested by user
  if (/^[\d.\-\(\)]+$/.test(trimmed)) {
    // If it contains dots, use dot separator prefix
    if (trimmed.includes('.')) {
      return `028.09.00${trimmed}`;
    }
    // Default to dash separator prefix
    return `028-09-00${trimmed}`;
  }
  
  return query;
}

export function autoFormatPinInput(value: string): string {
  if (!value) return "";
  // If user is searching by name (contains letters), don't format
  if (/[a-zA-Z]/.test(value)) return value;

  // Shortcuts expansion
  if (value === "28") return "028-09-00-";

  const shortcutMatch = value.match(/^(\d{2})([.-])$/);
  if (shortcutMatch) {
    const [, num, sep] = shortcutMatch;
    return sep === "." ? `028.09.00${num}.` : `028-09-00${num}-`;
  }

  // Detect style (dashes or dots)
  const isDot = value.includes('.');
  const sep = isDot ? '.' : '-';
  const hasOpenParen = value.includes('(');

  // Get raw digits
  let digits = value.replace(/\D/g, "");
  if (digits.length === 0) return value;

  let res = "";
  
  // Segment 1: Province (3)
  res += digits.substring(0, 3);
  if (digits.length > 3 || (digits.length === 3 && value.endsWith(sep))) res += sep;
  
  // Segment 2: Municipality (2)
  if (digits.length > 3) {
    res += digits.substring(3, 5);
    if (digits.length > 5 || (digits.length === 5 && value.endsWith(sep))) res += sep;
  }
  
  // Segment 3: Barangay/Section (4)
  if (digits.length > 5) {
    res += digits.substring(5, 9);
    if (digits.length > 9 || (digits.length === 9 && value.endsWith(sep))) res += sep;
  }
  
  // Segment 4: Parcel (3)
  if (digits.length > 9) {
    res += digits.substring(9, 12);
    if (digits.length > 12 || (digits.length === 12 && (value.endsWith(sep) || value.endsWith('(')))) {
      res += sep;
      if (hasOpenParen) res += "(";
    }
  }
  
  // Segment 5: Property ID (2)
  if (digits.length > 12) {
    res += digits.substring(12, 14);
    if (hasOpenParen) {
      // Automate ) and - only if followed by next digits or manually entered
      if (digits.length > 14 || (digits.length === 14 && value.endsWith(')'))) {
        res += ")";
      }
      if (digits.length > 14 || (digits.length === 14 && value.endsWith('-'))) {
        if (!res.endsWith(')')) res += ")";
        res += "-";
      }
    } else {
      if (digits.length > 14 || (digits.length === 14 && value.endsWith('-'))) res += "-";
    }
  }
  
  // Segment 6: Suffix (4)
  if (digits.length > 14) {
    res += digits.substring(14, 18);
  }

  return res;
}
