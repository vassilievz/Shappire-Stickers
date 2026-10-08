import { createLogger } from '@/services/logging/logger';

const log = createLogger('perf');


export interface PerfSample {
  name: string;
  durationMs: number;
  at: string;
  ok: boolean;
  meta?: Record<string, number | string | boolean>;
}

const MAX_SAMPLES = 200;

let enabled = false;
let samples: PerfSample[] = [];

export function setDiagnosticsEnabled(value: boolean): void {
  enabled = value;
}

export function isDiagnosticsEnabled(): boolean {
  return enabled;
}

function record(
  name: string,
  durationMs: number,
  ok: boolean,
  meta?: Record<string, number | string | boolean>,
): void {
  const rounded = Math.round(durationMs * 100) / 100;
  const sample: PerfSample = {
    name,
    durationMs: rounded,
    at: new Date().toISOString(),
    ok,
    meta,
  };
  samples.push(sample);
  if (samples.length > MAX_SAMPLES) samples = samples.slice(-MAX_SAMPLES);
  if (enabled) {
    log.info(`perf:${name}`, { ms: rounded, ok, ...meta });
  }
}

export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  meta?: Record<string, number | string | boolean>,
): Promise<T> {
  if (!enabled) return fn();
  const start = Date.now();
  try {
    const result = await fn();
    record(name, Date.now() - start, true, meta);
    return result;
  } catch (error) {
    record(name, Date.now() - start, false, meta);
    throw error;
  }
}

export function measureSync<T>(
  name: string,
  fn: () => T,
  meta?: Record<string, number | string | boolean>,
): T {
  if (!enabled) return fn();
  const start = Date.now();
  try {
    const result = fn();
    record(name, Date.now() - start, true, meta);
    return result;
  } catch (error) {
    record(name, Date.now() - start, false, meta);
    throw error;
  }
}

export function getPerfSamples(): readonly PerfSample[] {
  return samples;
}

export function clearPerfSamples(): void {
  samples = [];
}

export interface PerfSummaryRow {
  name: string;
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  failures: number;
}

export function summarizePerf(): PerfSummaryRow[] {
  const byName = new Map<string, PerfSummaryRow>();
  for (const sample of samples) {
    const row = byName.get(sample.name) ?? {
      name: sample.name,
      count: 0,
      totalMs: 0,
      avgMs: 0,
      maxMs: 0,
      failures: 0,
    };
    row.count += 1;
    row.totalMs += sample.durationMs;
    row.maxMs = Math.max(row.maxMs, sample.durationMs);
    if (!sample.ok) row.failures += 1;
    row.avgMs = row.totalMs / row.count;
    byName.set(sample.name, row);
  }
  return [...byName.values()]
    .map((row) => ({ ...row, totalMs: Math.round(row.totalMs), avgMs: Math.round(row.avgMs) }))
    .sort((a, b) => b.totalMs - a.totalMs);
}
