/** Compara versões semver simples (major.minor.patch). Retorna -1, 0 ou 1. */
export function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const pb = b.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da < db) return -1;
    if (da > db) return 1;
  }
  return 0;
}

export function isVersionLessThan(current: string, target: string): boolean {
  return compareSemver(current, target) < 0;
}
