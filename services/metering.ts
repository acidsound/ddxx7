export function normalizeOperatorLevel(level?: number) {
  if (!Number.isFinite(level) || !level || level <= 0) return 0;
  return Math.min(1, Math.log1p(level) / Math.log1p(12));
}
