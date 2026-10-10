const STORAGE_KEY = 'shappire:share-promo:v1';
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

interface SharePromoRecord {
  permanent?: boolean;
  snoozeUntil?: number;
}

function readRecord(): SharePromoRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SharePromoRecord;
  } catch {
    return null;
  }
}

function writeRecord(record: SharePromoRecord): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota / private mode */
  }
}

export function shouldShowSharePromo(): boolean {
  const record = readRecord();
  if (!record) return true;
  if (record.permanent) return false;
  if (record.snoozeUntil && Date.now() < record.snoozeUntil) return false;
  return true;
}

export function snoozeSharePromo(): void {
  writeRecord({ snoozeUntil: Date.now() + SNOOZE_MS });
}

export function dismissSharePromoPermanent(): void {
  writeRecord({ permanent: true });
}
