/**
 * Shared, dependency-free date formatting helpers.
 * Safe to import from both server and client components (no fs access).
 */

/**
 * Arabic long-form date; returns '' for missing/unparseable input instead of
 * throwing or echoing raw garbage back into the DOM.
 */
export function formatDateAr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return '';
  }
}
