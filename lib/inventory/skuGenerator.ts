/**
 * Deterministic SKU Generator
 * Format: {CATEGORY_PREFIX}-{NAME_ABBR}-{SEQUENCE}
 * Example: "Paper Towels" (cleaning) -> CLN-PAPTOW-001
 */

const CATEGORY_PREFIXES: Record<string, string> = {
  // Stock categories
  snacks: 'SNK',
  beverages: 'BEV',
  dairy: 'DRY',
  meat: 'MET',
  produce: 'PRD',
  frozen: 'FRZ',
  bakery: 'BKR',
  'dry goods': 'DRG',
  condiments: 'CND',
  alcohol: 'ALC',
  supplements: 'SPL',
  seafood: 'SFD',
  deli: 'DLI',
  pantry: 'PNT',
  // Operational categories
  cleaning: 'CLN',
  office: 'OFC',
  kitchen: 'KIT',
  packaging: 'PKG',
  tableware: 'TBW',
  maintenance: 'MNT',
  safety: 'SFT',
  other: 'OTH',
};

function getPrefix(category?: string, operationalCategory?: string): string {
  const key = (operationalCategory || category || 'other').toLowerCase().trim();
  return CATEGORY_PREFIXES[key] || 'GEN';
}

function abbreviateName(name: string): string {
  const words = name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
  if (words.length === 0) return 'ITEM';
  if (words.length === 1) return words[0].slice(0, 6).toUpperCase();
  return (words[0].slice(0, 3) + words[1].slice(0, 3)).toUpperCase();
}

export function generateSKU(
  name: string,
  category?: string,
  operationalCategory?: string,
  existingSKUs: string[] = []
): string {
  const prefix = getPrefix(category, operationalCategory);
  const abbr = abbreviateName(name);
  const pattern = `${prefix}-${abbr}-`;

  const existingSeqs = existingSKUs
    .filter(s => s?.startsWith(pattern))
    .map(s => parseInt(s.slice(pattern.length)) || 0);

  const nextSeq = existingSeqs.length > 0 ? Math.max(...existingSeqs) + 1 : 1;

  return `${prefix}-${abbr}-${String(nextSeq).padStart(3, '0')}`;
}
