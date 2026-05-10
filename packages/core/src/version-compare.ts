/**
 * Channel-aware semver comparison for the AO release pipeline.
 *
 * Lives in core (not the CLI) because both the CLI's update-check and the
 * dashboard's `/api/version` route compare versions and must stay in lockstep.
 * Keeping the implementation here means there is exactly one tested copy.
 *
 * Spec: release-process.html §07 (Auto-update mechanics).
 */

/**
 * Returns true if `current` is an older version than `latest`.
 *
 * Compares numeric major/minor/patch first, then handles prereleases:
 *   - When base versions are equal:
 *       prerelease vs stable     → prerelease is OLDER (`0.5.0-nightly < 0.5.0`)
 *       prerelease vs prerelease → compare the prerelease identifiers
 *                                  segment-by-segment (numeric or lexical),
 *                                  so `0.5.0-nightly-abc < 0.5.0-nightly-def`
 *                                  works for SHA-suffixed snapshots.
 *
 * Channel-aware comparison happens at the *cache layer* (callers only cache
 * the tag they're tracking), so this function just answers: is current < latest?
 */
export function isVersionOutdated(current: string, latest: string): boolean {
  const c = parseVersion(current);
  const l = parseVersion(latest);

  for (let i = 0; i < 3; i++) {
    const cp = c.parts[i] ?? 0;
    const lp = l.parts[i] ?? 0;
    if (Number.isNaN(cp) || Number.isNaN(lp)) return false;
    if (cp < lp) return true;
    if (cp > lp) return false;
  }

  // Numeric base equal — compare prerelease tags.
  if (!c.prerelease && !l.prerelease) return false;
  if (c.prerelease && !l.prerelease) return true; // prerelease < stable
  if (!c.prerelease && l.prerelease) return false; // stable > prerelease
  return comparePrereleaseSegments(c.prerelease ?? "", l.prerelease ?? "") < 0;
}

function parseVersion(version: string): { parts: number[]; prerelease: string | undefined } {
  const [base, ...rest] = version.split("-");
  const prerelease = rest.length > 0 ? rest.join("-") : undefined;
  return {
    parts: (base ?? "").split(".").map(Number),
    prerelease,
  };
}

/**
 * Compare two prerelease identifiers segment-by-segment.
 * Returns -1 if a < b, 0 if equal, 1 if a > b.
 *
 * Per semver: numeric segments compare numerically; non-numeric compare
 * lexically; numeric < non-numeric; longer wins when all shared segments
 * are equal.
 */
function comparePrereleaseSegments(a: string, b: string): number {
  const aSeg = a.split(".");
  const bSeg = b.split(".");
  const max = Math.max(aSeg.length, bSeg.length);
  for (let i = 0; i < max; i++) {
    const ax = aSeg[i];
    const bx = bSeg[i];
    if (ax === undefined) return -1;
    if (bx === undefined) return 1;
    const aNum = /^\d+$/.test(ax);
    const bNum = /^\d+$/.test(bx);
    if (aNum && bNum) {
      const an = Number(ax);
      const bn = Number(bx);
      if (an !== bn) return an < bn ? -1 : 1;
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1; // numeric < non-numeric
    } else if (ax !== bx) {
      return ax < bx ? -1 : 1;
    }
  }
  return 0;
}
