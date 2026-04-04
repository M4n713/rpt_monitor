import assert from 'node:assert/strict';

import { extractSoaData } from '../src/lib/soaPdf.ts';

const sampleSoaText = `
TD# ASSESSED VALUE YEAR ANNUAL TAX BASIC TAX DISCOUNT INTEREST SUB-TOTAL BASIC SEF TAX DISCOUNT INTEREST SUB-TOTAL SEF TOTAL
01-0505 7,520.00 1983-1984 75.20 150.40 0.00 36.10 186.50 150.40 0.00 36.10 186.50 373.00
01-0003 8,640.00 1985 86.40 86.40 0.00 20.74 107.14 86.40 0.00 20.74 107.14 214.28
01-0003 8,640.00 1986 86.40 86.40 0.00 673.92 760.32 86.40 0.00 673.92 760.32 1,520.64
01-0003 8,640.00 1987 86.40 86.40 0.00 653.18 739.58 86.40 0.00 653.18 739.58 1,479.16
01-0003 8,640.00 1988 86.40 86.40 0.00 632.45 718.85 86.40 0.00 632.45 718.85 1,437.70
01-0003 8,640.00 1989 86.40 86.40 0.00 611.71 698.11 86.40 0.00 611.71 698.11 1,396.22
01-0003 8,640.00 1990 86.40 86.40 0.00 582.34 668.74 86.40 0.00 582.34 668.74 1,337.48
01-0003 8,640.00 1991 86.40 86.40 0.00 561.60 648.00 86.40 0.00 561.60 648.00 1,296.00
01-0003-A 16,230.00 1992-1994 162.30 486.90 0.00 350.57 837.47 486.90 0.00 350.57 837.47 1,674.94
01-0022-A 21,500.00 1995-1997 215.00 645.00 0.00 464.40 1,109.40 645.00 0.00 464.40 1,109.40 2,218.80
01-0022-A 32,020.00 1998-2000 320.20 960.60 0.00 691.63 1,652.23 960.60 0.00 691.63 1,652.23 3,304.46
01-0022-A 28,900.00 2001-2003 289.00 867.00 0.00 624.24 1,491.24 867.00 0.00 624.24 1,491.24 2,982.48
01-0022-A 40,400.00 2004-2006 404.00 1,212.00 0.00 872.64 2,084.64 1,212.00 0.00 872.64 2,084.64 4,169.28
01-0022-A 45,100.00 2007-2015 451.00 4,059.00 0.00 2,922.48 6,981.48 4,059.00 0.00 2,922.48 6,981.48 13,962.96
0001-00016 54,490.00 2016 544.90 544.90 0.00 392.33 937.23 544.90 0.00 392.33 937.23 1,874.46
0001-00016 54,490.00 2017 544.90 544.90 0.00 392.33 937.23 544.90 0.00 392.33 937.23 1,874.46
0001-00016 54,490.00 2018 544.90 544.90 0.00 392.33 937.23 544.90 0.00 392.33 937.23 1,874.46
09-0001-00016 54,490.00 2019 544.90 544.90 0.00 392.33 937.23 544.90 0.00 392.33 937.23 1,874.46
09-0001-00016 54,490.00 2020 544.90 544.90 0.00 392.33 937.23 544.90 0.00 392.33 937.23 1,874.46
09-0001-00016 54,490.00 2021 544.90 544.90 0.00 392.33 937.23 544.90 0.00 392.33 937.23 1,874.46
09-0001-00016 54,490.00 2022 544.90 544.90 0.00 272.45 817.35 544.90 0.00 272.45 817.35 1,634.70
09-0001-00016 54,490.00 2023 544.90 544.90 0.00 141.67 686.57 544.90 0.00 141.67 686.57 1,373.14
09-0001-00016 54,490.00 2024 544.90 544.90 0.00 54.49 599.39 544.90 0.00 54.49 599.39 1,198.78
09-0001-00016 54,490.00 2025 544.90 544.90 0.00 0.00 544.90 544.90 0.00 0.00 544.90 1,089.80
09-0001-00016 54,490.00 2026 544.90 544.90 0.00 0.00 544.90 544.90 0.00 0.00 544.90 1,089.80
TOTAL ==>> 14,979.60 0.00 17,685.23 35,362.83 14,979.60 0.00 17,685.23 35,362.83 70,725.66
Republic of the Philippines
Province of Occidental Mindoro
MUNICIPALITY OF SABLAYAN
OFFICE OF THE MUNICIPAL TREASURER
S T A T E M E N T O F A C C O U N T
NAME: ANGELES, ANGELITO
PIN: 028-09-0001-001-17
ADDRESS: Batong-Buhay Sablayan, Occidental Mindoro
AREA: 9.9995
LOT#: 1323 Pls-14
Sir/Madam:
This is to inform you that as per records of this Office the taxes due on the real property/ies described hereunder as of January 21, 2026 are as follows:
`;

const result = extractSoaData(sampleSoaText);

assert.equal(result.ownerName, 'ANGELES, ANGELITO');
assert.equal(result.pin, '028-09-0001-001-17');
assert.equal(result.lotNo, '1323 Pls-14');
assert.equal(result.area, '9.9995');

assert.equal(result.yearEntries.length, 44);
assert.deepEqual(result.yearEntries[0], {
  year: 1983,
  assessedValue: 7520,
  tdNo: '01-0505',
});
assert.deepEqual(result.yearEntries.at(-1), {
  year: 2026,
  assessedValue: 54490,
  tdNo: '09-0001-00016',
});

assert.deepEqual(result.groupedRanges, [
  { startYear: 1983, endYear: 1984, assessedValue: 7520 },
  { startYear: 1985, endYear: 1991, assessedValue: 8640 },
  { startYear: 1992, endYear: 1994, assessedValue: 16230 },
  { startYear: 1995, endYear: 1997, assessedValue: 21500 },
  { startYear: 1998, endYear: 2000, assessedValue: 32020 },
  { startYear: 2001, endYear: 2003, assessedValue: 28900 },
  { startYear: 2004, endYear: 2006, assessedValue: 40400 },
  { startYear: 2007, endYear: 2015, assessedValue: 45100 },
  { startYear: 2016, endYear: 2026, assessedValue: 54490 },
]);

assert.deepEqual(result.tdGroupedRanges, [
  { startYear: 1983, endYear: 1984, assessedValue: 7520, tdNo: '01-0505' },
  { startYear: 1985, endYear: 1991, assessedValue: 8640, tdNo: '01-0003' },
  { startYear: 1992, endYear: 1994, assessedValue: 16230, tdNo: '01-0003-A' },
  { startYear: 1995, endYear: 1997, assessedValue: 21500, tdNo: '01-0022-A' },
  { startYear: 1998, endYear: 2000, assessedValue: 32020, tdNo: '01-0022-A' },
  { startYear: 2001, endYear: 2003, assessedValue: 28900, tdNo: '01-0022-A' },
  { startYear: 2004, endYear: 2006, assessedValue: 40400, tdNo: '01-0022-A' },
  { startYear: 2007, endYear: 2015, assessedValue: 45100, tdNo: '01-0022-A' },
  { startYear: 2016, endYear: 2018, assessedValue: 54490, tdNo: '0001-00016' },
  { startYear: 2019, endYear: 2026, assessedValue: 54490, tdNo: '09-0001-00016' },
]);

console.log('SOA regression check passed.');
