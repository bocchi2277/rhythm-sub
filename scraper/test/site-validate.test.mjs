import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The site's series.json shape validator (site/lib/validate.ts) is exercised
 * through Node's type stripping (Node >= 22.18 / 23+), like the sanitizer and
 * parity tests. validate.ts is pure (type-only imports), so it loads without
 * the data layer's filesystem side effects. When the runtime does not support
 * type stripping, the checks are skipped rather than failing the build.
 */
let assertSeriesShape = null;
try {
  ({ assertSeriesShape } = await import('../../site/lib/validate.ts'));
} catch {
  assertSeriesShape = null;
}

const SKIP = assertSeriesShape ? false : 'Node type stripping unavailable — site validator not checked';

const ep = (over = {}) => ({ slug: 'show-1', label: 'Show - 1', qualities: [], ...over });
const series = (over = {}) => ({ key: 'slug:show', slug: 'show', title: 'Show', episodes: [ep()], ...over });

test('validator accepts a well-formed series array', { skip: SKIP }, () => {
  assertSeriesShape([series()]);
});

test('validator rejects non-array / non-object entries', { skip: SKIP }, () => {
  assert.throws(() => assertSeriesShape({}), /must be a JSON array/);
  assert.throws(() => assertSeriesShape([null]), /is not an object/);
  assert.throws(() => assertSeriesShape([series({ episodes: null })]), /episodes must be an array/);
});

test('validator names the offending episode field and index', { skip: SKIP }, () => {
  // Regression: episodes used to be validated only as "object", so a missing
  // label/qualities crashed later as a bare TypeError in lib/data.ts.
  assert.throws(
    () => assertSeriesShape([series({ episodes: [ep({ label: undefined })] })]),
    /episodes\[0\]\.label must be a string/
  );
  assert.throws(
    () => assertSeriesShape([series({ episodes: [ep(), ep({ qualities: undefined })] })]),
    /episodes\[1\]\.qualities must be an array/
  );
  assert.throws(
    () => assertSeriesShape([series({ episodes: [ep({ slug: 5 })] })]),
    /episodes\[0\]\.slug must be a string/
  );
});
