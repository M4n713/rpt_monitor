const DEFAULT_RULE_CONFIG = {
    advance_discount_rate: 0.2,
    share_advance_discount_rate: 0.1,
    current_year_discount_rate: 0.1,
    current_year_interest_rate: 0.02,
    delinquent_interest_rate: 0.02,
    delinquent_cap_post_1991: 0.72,
    delinquent_cap_pre_1992: 0.24,
    skip_years_older_than: null,
    waive_delinquent_interest: false,
    waive_delinquent_discount: true,
};
export const DEFAULT_COMPUTATION_RULES = [
    {
        label: 'Standard',
        value: 'standard',
        base_type: 'standard',
        special_case_hook: 'none',
        description: 'Default RPT computation rule.',
        is_active: true,
        is_builtin: true,
        config: { ...DEFAULT_RULE_CONFIG }
    },
    {
        label: 'RPVARA',
        value: 'rpvara',
        base_type: 'rpvara',
        special_case_hook: 'rpvara_2024_half',
        description: 'RPVARA amnesty rule with configurable effectivity dates.',
        effective_to: '2026-07-05',
        is_active: true,
        is_builtin: true,
        config: { ...DEFAULT_RULE_CONFIG }
    },
    {
        label: 'DENR',
        value: 'denr',
        base_type: 'denr',
        special_case_hook: 'denr_10_year_window',
        description: 'DENR rule with a 10-year window and no delinquent interest/discount.',
        is_active: true,
        is_builtin: true,
        config: {
            ...DEFAULT_RULE_CONFIG,
            skip_years_older_than: 10,
            waive_delinquent_interest: true,
            waive_delinquent_discount: true,
        }
    },
    {
        label: 'Share Area',
        value: 'share',
        base_type: 'share',
        special_case_hook: 'none',
        description: 'Computes based on the claimed share area.',
        is_active: true,
        is_builtin: true,
        config: { ...DEFAULT_RULE_CONFIG }
    }
];
export const getPHTimeNow = () => {
    const utcDate = new Date();
    return new Date(utcDate.getTime() + (8 * 60 * 60 * 1000));
};
export const normalizeRule = (rule) => ({
    ...rule,
    description: rule.description ?? '',
    effective_from: rule.effective_from ?? null,
    effective_to: rule.effective_to ?? null,
    is_active: rule.is_active !== false,
    is_builtin: rule.is_builtin === true,
    config: {
        ...DEFAULT_RULE_CONFIG,
        ...(rule.config || {}),
    }
});
export const getAvailableRules = (rules) => {
    const merged = [...DEFAULT_COMPUTATION_RULES];
    for (const incoming of rules || []) {
        const normalized = normalizeRule(incoming);
        const existingIndex = merged.findIndex(rule => rule.value === normalized.value);
        if (existingIndex >= 0) {
            merged[existingIndex] = normalized;
        }
        else {
            merged.push(normalized);
        }
    }
    return merged;
};
export const resolveComputationRule = (selectedValue, rules) => {
    const available = getAvailableRules(rules);
    return available.find(rule => rule.value === selectedValue) || available.find(rule => rule.value === 'standard');
};
export const isRuleEffective = (rule, now = getPHTimeNow()) => {
    if (!rule.is_active)
        return false;
    const start = rule.effective_from ? new Date(`${rule.effective_from}T00:00:00+08:00`) : null;
    const end = rule.effective_to ? new Date(`${rule.effective_to}T23:59:59+08:00`) : null;
    if (start && now < start)
        return false;
    if (end && now > end)
        return false;
    return true;
};
const parseAssessedValue = (manualAssessedValue, prop) => {
    const rawAssessed = manualAssessedValue ?? prop?.assessed_value ?? 0;
    if (typeof rawAssessed === 'number')
        return isNaN(rawAssessed) ? 0 : rawAssessed;
    const parsed = parseFloat(String(rawAssessed).replace(/[^0-9.-]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
};
const getShareAdjustedValue = (assessedValue, prop) => {
    const totalAreaStr = prop?.total_area ? String(prop.total_area).replace(/[^0-9.]/g, '') : '1';
    const claimedAreaStr = prop?.claimed_area ? String(prop.claimed_area).replace(/[^0-9.]/g, '') : totalAreaStr;
    const totalArea = parseFloat(totalAreaStr) || 1;
    const claimedArea = parseFloat(claimedAreaStr) || totalArea;
    return assessedValue * (claimedArea / totalArea);
};
export const calculateTaxForYear = (year, prop, selectedRuleValue, manualAssessedValue, options = {}, rules, now = getPHTimeNow()) => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const rule = normalizeRule(resolveComputationRule(selectedRuleValue, rules));
    const config = rule.config;
    let assessedVal = parseAssessedValue(manualAssessedValue, prop);
    if (rule.base_type === 'share') {
        assessedVal = getShareAdjustedValue(assessedVal, prop);
    }
    const basic = assessedVal * 0.01;
    const sef = assessedVal * 0.01;
    const taxDue = basic + sef;
    let basicInterest = 0;
    let sefInterest = 0;
    let basicDiscount = 0;
    let sefDiscount = 0;
    if (year > currentYear) {
        const advanceDiscountRate = rule.base_type === 'share'
            ? config.share_advance_discount_rate
            : config.advance_discount_rate;
        basicDiscount = Math.round((basic * advanceDiscountRate) * 100) / 100;
        sefDiscount = Math.round((sef * advanceDiscountRate) * 100) / 100;
    }
    else if (year === currentYear) {
        const basicQuarter = basic / 4;
        const sefQuarter = sef / 4;
        const monthsElapsed = currentMonth + 1;
        const interestRate = config.current_year_interest_rate;
        const discountRate = config.current_year_discount_rate;
        if (currentMonth < 3) {
            basicDiscount = Math.round((basic * discountRate) * 100) / 100;
            sefDiscount = Math.round((sef * discountRate) * 100) / 100;
        }
        else if (currentMonth < 6) {
            basicInterest = Math.round((basicQuarter * interestRate * monthsElapsed) * 100) / 100;
            sefInterest = Math.round((sefQuarter * interestRate * monthsElapsed) * 100) / 100;
            basicDiscount = Math.round((basicQuarter * 3 * discountRate) * 100) / 100;
            sefDiscount = Math.round((sefQuarter * 3 * discountRate) * 100) / 100;
        }
        else if (currentMonth < 9) {
            basicInterest = Math.round((basicQuarter * 2 * interestRate * monthsElapsed) * 100) / 100;
            sefInterest = Math.round((sefQuarter * 2 * interestRate * monthsElapsed) * 100) / 100;
            basicDiscount = Math.round((basicQuarter * 2 * discountRate) * 100) / 100;
            sefDiscount = Math.round((sefQuarter * 2 * discountRate) * 100) / 100;
        }
        else {
            basicInterest = Math.round((basicQuarter * 3 * interestRate * monthsElapsed) * 100) / 100;
            sefInterest = Math.round((sefQuarter * 3 * interestRate * monthsElapsed) * 100) / 100;
            basicDiscount = Math.round((basicQuarter * discountRate) * 100) / 100;
            sefDiscount = Math.round((sefQuarter * discountRate) * 100) / 100;
        }
    }
    else {
        const monthsDiff = (currentYear - year) * 12 + currentMonth + 1;
        if (rule.special_case_hook === 'denr_10_year_window') {
            if (config.skip_years_older_than !== null && year < currentYear - config.skip_years_older_than) {
                return { basic_tax: 0, sef_tax: 0, interest: 0, discount: 0, amount: 0 };
            }
            basicInterest = 0;
            sefInterest = 0;
            basicDiscount = 0;
            sefDiscount = 0;
        }
        else if (rule.special_case_hook === 'rpvara_2024_half' && isRuleEffective(rule, now)) {
            if (year < 2024) {
                basicInterest = 0;
                sefInterest = 0;
            }
            else if (year === 2024) {
                const rpvaraMonthsDiff = (currentYear - 2024) * 12 + currentMonth - 5;
                if (rpvaraMonthsDiff > 0) {
                    const rate = Math.min(rpvaraMonthsDiff * config.delinquent_interest_rate, config.delinquent_cap_post_1991);
                    basicInterest = Math.round(((basic * 0.5) * rate) * 100) / 100;
                    sefInterest = Math.round(((sef * 0.5) * rate) * 100) / 100;
                }
            }
            else {
                const cap = year >= 1992 ? config.delinquent_cap_post_1991 : config.delinquent_cap_pre_1992;
                const rate = Math.min(monthsDiff * config.delinquent_interest_rate, cap);
                basicInterest = Math.round((basic * rate) * 100) / 100;
                sefInterest = Math.round((sef * rate) * 100) / 100;
            }
        }
        else if (!config.waive_delinquent_interest) {
            const cap = year >= 1992 ? config.delinquent_cap_post_1991 : config.delinquent_cap_pre_1992;
            const rate = Math.min(monthsDiff * config.delinquent_interest_rate, cap);
            basicInterest = Math.round((basic * rate) * 100) / 100;
            sefInterest = Math.round((sef * rate) * 100) / 100;
        }
        if (!config.waive_delinquent_discount) {
            basicDiscount = 0;
            sefDiscount = 0;
        }
    }
    const finalInterest = basicInterest + sefInterest;
    const finalDiscount = basicDiscount + sefDiscount;
    const appliedInterest = options.includeInterest === false ? 0 : finalInterest;
    const appliedDiscount = options.includeDiscount === false ? 0 : finalDiscount;
    return {
        basic_tax: isNaN(basic) ? 0 : basic,
        sef_tax: isNaN(sef) ? 0 : sef,
        interest: isNaN(appliedInterest) ? 0 : appliedInterest,
        discount: isNaN(appliedDiscount) ? 0 : appliedDiscount,
        amount: (isNaN(taxDue) || isNaN(appliedInterest) || isNaN(appliedDiscount))
            ? 0
            : (taxDue + appliedInterest - appliedDiscount)
    };
};
export const calculateTaxForRange = (startYearInput, endYearInput, prop, selectedRuleValue, manualAssessedValue, options = {}, rules, now = getPHTimeNow()) => {
    const resolvedRule = normalizeRule(resolveComputationRule(selectedRuleValue, rules));
    const currentYear = now.getFullYear();
    let startYear = parseInt(startYearInput, 10);
    let endYear = parseInt(endYearInput, 10);
    if (typeof startYearInput === 'string' && startYearInput.includes('-')) {
        const parts = startYearInput.split('-');
        startYear = parseInt(parts[0].trim(), 10);
        endYear = parseInt(parts[1].trim(), 10);
    }
    if (isNaN(startYear))
        startYear = currentYear;
    if (isNaN(endYear))
        endYear = startYear;
    if (resolvedRule.special_case_hook === 'denr_10_year_window') {
        const maxAge = (resolvedRule.config.skip_years_older_than ?? DEFAULT_RULE_CONFIG.skip_years_older_than) || 10;
        startYear = currentYear - maxAge;
        endYear = currentYear;
    }
    let totalBasic = 0;
    let totalSef = 0;
    let totalInterest = 0;
    let totalDiscount = 0;
    let totalAmount = 0;
    const breakdown = [];
    for (let y = startYear; y <= endYear; y++) {
        const result = calculateTaxForYear(y, prop, resolvedRule.value, manualAssessedValue, options, rules, now);
        breakdown.push({ year: y, ...result });
        totalBasic += result.basic_tax;
        totalSef += result.sef_tax;
        totalInterest += result.interest;
        totalDiscount += result.discount;
        totalAmount += result.amount;
    }
    return {
        basic_tax: totalBasic.toFixed(2),
        sef_tax: totalSef.toFixed(2),
        interest: totalInterest.toFixed(2),
        discount: totalDiscount.toFixed(2),
        amount: totalAmount.toFixed(2),
        computedStartYear: startYear,
        computedEndYear: endYear,
        computedRangeLabel: startYear === endYear ? `${startYear}` : `${startYear} - ${endYear}`,
        breakdown
    };
};
