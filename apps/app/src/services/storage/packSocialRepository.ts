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
