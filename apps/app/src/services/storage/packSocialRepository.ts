import { readJson, writeJson } from './jsonStore';
import { SCHEMA_VERSION } from '@/config/storage';

const FILE = 'library/pack-social.json';

export interface PackSocialRecord {
  publicationId: string;
  visibility: 'public' | 'private';
  lastSyncedAt: string;
  sourceAuthorName?: string;
  sourceAuthorUsername?: string | null;
  importedAt?: string;
}

interface PackSocialDocument {
  schemaVersion: number;
  byPackId: Record<string, PackSocialRecord>;
}

export async function getPackSocial(packId: string): Promise<PackSocialRecord | null> {
  const { data } = await readJson<PackSocialDocument>(FILE);
  return data?.byPackId?.[packId] ?? null;
}

export async function savePackSocial(packId: string, record: PackSocialRecord): Promise<void> {
  const { data } = await readJson<PackSocialDocument>(FILE);
  const doc: PackSocialDocument = {
    schemaVersion: SCHEMA_VERSION,
    byPackId: { ...(data?.byPackId ?? {}), [packId]: record },
  };
  await writeJson(FILE, doc);
}

export function isImportedPackSocial(record: PackSocialRecord): boolean {
  return Boolean(record.importedAt || record.sourceAuthorName);
}

export async function removePackSocial(packId: string): Promise<void> {
  const { data } = await readJson<PackSocialDocument>(FILE);
  if (!data?.byPackId?.[packId]) return;
  const { [packId]: _removed, ...rest } = data.byPackId;
  void _removed;
  await writeJson(FILE, { schemaVersion: SCHEMA_VERSION, byPackId: rest });
}

export async function findPackIdByPublicationId(publicationId: string): Promise<string | null> {
  const { data } = await readJson<PackSocialDocument>(FILE);
  const entries = data?.byPackId ?? {};
  for (const [packId, record] of Object.entries(entries)) {
    if (record.publicationId === publicationId) return packId;
  }
  return null;
}
