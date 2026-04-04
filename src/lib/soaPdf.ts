export interface SoaYearEntry {
  year: number;
  assessedValue: number;
  tdNo: string;
}

export interface SoaGroupedRange {
  startYear: number;
  endYear: number;
  assessedValue: number;
}

export interface SoaTdGroupedRange extends SoaGroupedRange {
  tdNo: string;
}

export interface SoaExtractionResult {
  ownerName: string | null;
  pin: string | null;
  lotNo: string | null;
  area: string | null;
  tdNumbers: string[];
  yearEntries: SoaYearEntry[];
  groupedRanges: SoaGroupedRange[];
  tdGroupedRanges: SoaTdGroupedRange[];
}

const moneyPattern = String.raw`\d{1,3}(?:,\d{3})*\.\d{2}`;
const tdPattern = String.raw`\d{2,4}(?:-\d{3,5})+(?:-[A-Z])?`;
const yearPattern = String.raw`\d{4}(?:\s*[-–]\s*\d{4})?`;

export function normalizeSoaText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizePin(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/\./g, '-')
    .replace(/[()]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function normalizeOwnerName(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeLotNo(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizeArea(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  if (Number.isNaN(numeric)) return '';
  return numeric.toFixed(4);
}

export function extractSoaData(text: string): SoaExtractionResult {
  const normalizedText = normalizeSoaText(text);
  const ownerName = extractOwnerName(normalizedText);
  const pin = extractPin(normalizedText);
  const lotNo = extractLotNo(normalizedText);
  const area = extractArea(normalizedText);
  const yearEntries = extractYearEntries(normalizedText);

  const tdNumbers = Array.from(new Set(yearEntries.map(entry => entry.tdNo)));
  const groupedRanges = groupYearEntriesByAssessedValue(yearEntries);
  const tdGroupedRanges = groupYearEntriesByTd(yearEntries);

  return {
    ownerName,
    pin,
    lotNo,
    area,
    tdNumbers,
    yearEntries,
    groupedRanges,
    tdGroupedRanges,
  };
}

function extractOwnerName(text: string): string | null {
  const match = text.match(/NAME:\s*(.*?)\s+PIN:/i);
  return match?.[1]?.trim() || null;
}

function extractPin(text: string): string | null {
  const labeledMatch = text.match(/PIN:\s*(028[-.]09[-.]\d{4}[-.]\d{3}[-.](?:\()?(\d{2})(?:\))?(?:[-.]\d{4})?)/i);
  if (labeledMatch?.[1] !== undefined && labeledMatch[0]) {
    return labeledMatch[0].replace(/^PIN:\s*/i, '').trim();
  }

  const genericMatch = text.match(/028[-.]09[-.]\d{4}[-.]\d{3}[-.](?:\()?\d{2}(?:\))?(?:[-.]\d{4})?/i);
  return genericMatch?.[0]?.trim() || null;
}

function extractLotNo(text: string): string | null {
  const match = text.match(/LOT#:\s*(.*?)\s+(?:Sir\/Madam:|OWNER:|Prepared by:|This is to inform)/i);
  return match?.[1]?.trim() || null;
}

function extractArea(text: string): string | null {
  const match = text.match(/AREA:\s*([0-9.,]+)/i);
  return match?.[1]?.trim() || null;
}

function extractYearEntries(text: string): SoaYearEntry[] {
  const rowRegex = new RegExp(
    `(${tdPattern})\\s+(${moneyPattern})\\s+(${yearPattern})(?=\\s+${moneyPattern}\\s+${moneyPattern})`,
    'g'
  );

  const yearEntries: SoaYearEntry[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(text)) !== null) {
    const tdNo = match[1].trim().toUpperCase();
    const assessedValue = parseFloat(match[2].replace(/,/g, ''));
    const yearLabel = match[3].replace(/\s+/g, '');

    if (!tdNo || Number.isNaN(assessedValue)) continue;

    const [startText, endText] = yearLabel.split(/[-–]/);
    const startYear = parseInt(startText, 10);
    const endYear = parseInt(endText || startText, 10);

    if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) continue;

    for (let year = startYear; year <= endYear; year += 1) {
      const key = `${tdNo}-${year}-${assessedValue.toFixed(2)}`;
      if (seen.has(key)) continue;

      seen.add(key);
      yearEntries.push({ year, assessedValue, tdNo });
    }
  }

  yearEntries.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.tdNo !== b.tdNo) return a.tdNo.localeCompare(b.tdNo);
    return a.assessedValue - b.assessedValue;
  });

  return yearEntries;
}

function groupYearEntriesByTd(entries: SoaYearEntry[]): SoaTdGroupedRange[] {
  if (entries.length === 0) return [];

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.tdNo !== b.tdNo) return a.tdNo.localeCompare(b.tdNo);
    if (a.assessedValue !== b.assessedValue) return a.assessedValue - b.assessedValue;
    return a.year - b.year;
  });

  const grouped: SoaTdGroupedRange[] = [];
  let current = {
    startYear: sortedEntries[0].year,
    endYear: sortedEntries[0].year,
    assessedValue: sortedEntries[0].assessedValue,
    tdNo: sortedEntries[0].tdNo,
  };

  for (let index = 1; index < sortedEntries.length; index += 1) {
    const entry = sortedEntries[index];
    const isSameGroup =
      entry.tdNo === current.tdNo &&
      entry.assessedValue === current.assessedValue &&
      entry.year === current.endYear + 1;

    if (isSameGroup) {
      current.endYear = entry.year;
      continue;
    }

    grouped.push(current);
    current = {
      startYear: entry.year,
      endYear: entry.year,
      assessedValue: entry.assessedValue,
      tdNo: entry.tdNo,
    };
  }

  grouped.push(current);

  return grouped.sort((a, b) => a.startYear - b.startYear);
}

function groupYearEntriesByAssessedValue(entries: SoaYearEntry[]): SoaGroupedRange[] {
  if (entries.length === 0) return [];

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.assessedValue !== b.assessedValue) return a.assessedValue - b.assessedValue;
    return a.year - b.year;
  });

  const grouped: SoaGroupedRange[] = [];
  let current = {
    startYear: sortedEntries[0].year,
    endYear: sortedEntries[0].year,
    assessedValue: sortedEntries[0].assessedValue,
  };

  for (let index = 1; index < sortedEntries.length; index += 1) {
    const entry = sortedEntries[index];
    const isSameGroup =
      entry.assessedValue === current.assessedValue &&
      entry.year === current.endYear + 1;

    if (isSameGroup) {
      current.endYear = entry.year;
      continue;
    }

    grouped.push(current);
    current = {
      startYear: entry.year,
      endYear: entry.year,
      assessedValue: entry.assessedValue,
    };
  }

  grouped.push(current);

  return grouped.sort((a, b) => a.startYear - b.startYear);
}
