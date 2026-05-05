/**
 * Lightweight perf tracing, gated on AO_PERF=1.
 *
 * Temporary diagnostic — added to trace dashboard load slowness across
 * client → API → session-manager → plugins. Remove once the bottleneck is
 * fixed. Greppable by `[ao-perf]`.
 */

export const PERF_ON = process.env.AO_PERF === "1";

export function perfMark(
  cid: string,
  stage: string,
  ms: number,
  extra?: Record<string, unknown>,
): void {
  if (!PERF_ON) return;
  const tail = extra ? " " + JSON.stringify(extra) : "";
  // eslint-disable-next-line no-console
  console.log(`[ao-perf] cid=${cid} ${stage}=${ms}ms${tail}`);
}

export async function perfTime<T>(
  cid: string,
  stage: string,
  fn: () => Promise<T>,
  extra?: Record<string, unknown>,
): Promise<T> {
  if (!PERF_ON) return fn();
  const t = Date.now();
  try {
    return await fn();
  } finally {
    perfMark(cid, stage, Date.now() - t, extra);
  }
}

export function perfTimeSync<T>(
  cid: string,
  stage: string,
  fn: () => T,
  extra?: Record<string, unknown>,
): T {
  if (!PERF_ON) return fn();
  const t = Date.now();
  try {
    return fn();
  } finally {
    perfMark(cid, stage, Date.now() - t, extra);
  }
}

/** Random 6-char correlation id, used when caller didn't supply one. */
export function perfCid(): string {
  return Math.random().toString(36).slice(2, 8);
}
