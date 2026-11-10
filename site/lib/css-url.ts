/**
 * Escape a value for use inside a CSS `url('...')` string.
 * `encodeURI` deliberately leaves `'` and `)` intact, so a cover path containing
 * a single quote would otherwise close the string and inject arbitrary CSS.
 *
 * The backslash is escaped too: in CSS `\27` is the hex escape for `'`, so a
 * raw backslash could otherwise smuggle a quote past the string boundary.
 *
 * Kept in a standalone module (no fs / server-only imports) so client
 * components can use it without pulling the data layer into the browser bundle.
 */
export function cssUrl(u: string): string {
  return encodeURI(u)
    .replace(/'/g, '%27')
    .replace(/\)/g, '%29')
    .replace(/"/g, '%22')
    .replace(/\\/g, '%5C');
}
