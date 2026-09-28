// Pure helpers for the values that change on launch day. Kept free of Astro
// imports so node:test can load them directly.

/** Blank or missing → null, so templates never render an empty href. */
export function normalizeUrl(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

/** Accepts `1234…`, `pub-1234…` or an app id like `ca-app-pub-1234…`; returns `pub-1234…`. */
export function normalizePubId(value: string | null | undefined): string | null {
  const digits = value?.trim().match(/(\d{10,})/)?.[1];
  return digits ? `pub-${digits}` : null;
}

/** The single line AdMob looks for. f08c47fec0942fa0 is Google's fixed certification id. */
export function appAdsTxt(pubId: string | null): string {
  return pubId ? `google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n` : '';
}
