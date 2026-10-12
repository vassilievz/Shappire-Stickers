/**
 * Remove seções de i18n órfãs após o corte offline-first.
 * Uso: node scripts/prune-locales.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

const TOP_LEVEL_REMOVE = new Set([
  'profile',
  'donations',
  'monthlyDonor',
  'avatarDecorations',
  'invites',
  'community',
  'updates',
  'sharePromo',
  'settingsContent',
  'tools',
  'aiEnhancer',
  'aiModels',
]);

const HOME_REMOVE = new Set([
  'communityTitle',
  'communityDesc',
  'communityButton',
  'referencesCleared',
]);

const SETTINGS_REMOVE = new Set([
  'account',
  'accountDesc',
  'connected',
  'notConnected',
  'noEmail',
  'defaultUserName',
  'signInHint',
  'signInGoogle',
  'signOut',
  'viewProfile',
  'accountIdLabel',
  'accountIdHint',
  'accountIdCopied',
  'signInSuccess',
  'signInError',
  'signOutSuccess',
  'signOutError',
  'logoutTitle',
  'logoutMessage',
  'appSection',
  'dataSection',
  'languageEn',
  'languagePt',
  'languageEs',
  'languageDe',
  'languageIt',
  'languageHi',
  'attributionDesc',
  'storageDesc',
  'packFiles',
  'privacy',
  'updates',
  'updatesDesc',
  'updateStatus',
  'upToDate',
  'updateAvailable',
  'updateReady',
  'updateReadyDesc',
  'checkForUpdates',
  'checkingUpdates',
  'updateNow',
  'downloadingUpdate',
  'restartNow',
  'updateError',
  'downloadError',
  'browserEnvNotice',
  'version',
  'creditsAndLicenses',
  'madeByCredit',
]);

const ERRORS_REMOVE = new Set([
  'AUTH_CANCELLED',
  'AUTH_FAILED',
  'NETWORK_ERROR',
  'NATIVE_CONFIG_MISSING',
  'OFFLINE',
  'UNAUTHORIZED',
  'USERNAME_TAKEN',
  'RATE_LIMIT_EXCEEDED',
  'UPLOAD_FAILED',
  'API_NOT_CONFIGURED',
  'MONTHLY_DONOR_REQUIRED',
  'INVALID_DECORATION',
  'INVITE_INVALID',
  'INVITE_NOT_ELIGIBLE',
  'INVITE_ALREADY_APPLIED',
  'REWARD_NOT_AVAILABLE',
  'PAYMENT_NOT_FOUND',
]);

function prune(dict) {
  const next = structuredClone(dict);
  for (const key of TOP_LEVEL_REMOVE) {
    delete next[key];
  }
  if (next.home && typeof next.home === 'object') {
    for (const key of HOME_REMOVE) {
      delete next.home[key];
    }
  }
  if (next.settings && typeof next.settings === 'object') {
    for (const key of SETTINGS_REMOVE) {
      delete next.settings[key];
    }
  }
  if (next.errors && typeof next.errors === 'object') {
    for (const key of ERRORS_REMOVE) {
      delete next.errors[key];
    }
  }
  return next;
}

function toTsExport(exportName, value) {
  return `export const ${exportName} = ${JSON.stringify(value, null, 2)};\n`;
}

const files = [
  { file: 'en.ts', exportName: 'en', importPath: '../locales/en.ts' },
  { file: 'pt-BR.ts', exportName: 'ptBR', importPath: '../locales/pt-BR.ts' },
  { file: 'es.ts', exportName: 'es', importPath: '../locales/es.ts' },
  { file: 'de.ts', exportName: 'de', importPath: '../locales/de.ts' },
  { file: 'it.ts', exportName: 'it', importPath: '../locales/it.ts' },
  { file: 'hi.ts', exportName: 'hi', importPath: '../locales/hi.ts' },
];

for (const { file, exportName, importPath } of files) {
  const mod = await import(pathToFileURL(join(root, file)).href);
  const pruned = prune(mod[exportName]);
  writeFileSync(join(root, file), toTsExport(exportName, pruned), 'utf8');
  console.log(`pruned ${file}`);
}
