/**
 * Browser-compatible HarfBuzz font subsetting.
 *
 * The subsetting call sequence below is ported from `subset-font`
 * (https://github.com/papandreou/subset-font, BSD-3-Clause), which wraps
 * HarfBuzz's hb-subset WASM build (via the `harfbuzzjs` package). That
 * package hard-codes Node's `fs.readFile` + `require.resolve` to load the
 * .wasm binary, which makes it Node-only and unusable in a browser bundle.
 * Everything else in it - the actual hb_subset_* call sequence - has no
 * Node dependency (plain WebAssembly calls), so this module keeps that
 * logic and replaces only the loading step with `fetch()`.
 *
 * You'll need hb-subset.wasm servable as a static asset. Options:
 *   1. Copy node_modules/harfbuzzjs/hb-subset.wasm into your /public folder
 *      and pass wasmUrl: '/hb-subset.wasm'.
 *   2. If your bundler supports it (Next.js/webpack5, Vite), use:
 *      new URL('harfbuzzjs/hb-subset.wasm', import.meta.url).toString()
 */

const HB_MEMORY_MODE_WRITABLE = 2;
const HB_SUBSET_SETS_DROP_TABLE_TAG = 3;
const HB_SUBSET_SETS_NAME_ID = 4;
const HB_SUBSET_SETS_LAYOUT_FEATURE_TAG = 6;
const HB_SUBSET_FLAGS_NO_HINTING = 0x00000001;
const HB_SUBSET_FLAGS_GLYPH_NAMES = 0x00000080;
const HB_SUBSET_FLAGS_NO_LAYOUT_CLOSURE = 0x00000200;

function HB_TAG(str) {
  return str.split('').reduce((a, ch) => (a << 8) + ch.charCodeAt(0), 0);
}

let harfbuzzPromise = null;

/**
 * Fetches and instantiates the hb-subset WASM module. Cached after the first
 * call so repeated subsetting operations don't re-fetch or re-instantiate.
 */
function loadHarfbuzz(wasmUrl) {
  if (!harfbuzzPromise) {
    harfbuzzPromise = (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch hb-subset.wasm: ${response.status} ${response.statusText}`);
      }
      const bytes = await response.arrayBuffer();
      const { instance: { exports: harfbuzzJsWasm } } = await WebAssembly.instantiate(bytes);
      const heapu8 = new Uint8Array(harfbuzzJsWasm.memory.buffer);
      return { harfbuzzJsWasm, heapu8 };
    })();
  }
  return harfbuzzPromise;
}

/**
 * Subsets a font (already in raw SFNT/TrueType format) down to the given
 * text/code points using HarfBuzz. Returns a Uint8Array of the subsetted
 * SFNT font, with every OTS-required table (cmap, OS/2, name, post, etc.)
 * correctly present. Format conversion to WOFF2 is handled separately by
 * the caller via `fontverter`.
 *
 * @param {ArrayBuffer|Uint8Array} originalFontSfnt
 * @param {string} text - every character in this string will have its glyph kept
 * @param {object} options
 * @param {string} options.wasmUrl - URL to hb-subset.wasm (see module docs above)
 * @param {string[]} [options.keepFeatures] - OpenType feature tags to keep; omit to keep all, pass [] to drop all
 * @param {boolean} [options.noHinting] - drop hinting instructions
 * @param {boolean} [options.noLayoutClosure]
 * @param {boolean} [options.glyphNames] - keep PostScript glyph names
 * @param {string[]} [options.dropTables] - four-char table tags to drop, e.g. ['GSUB','GPOS']
 * @param {number[]} [options.preserveNameIds]
 * @returns {Promise<Uint8Array>}
 */
export async function subsetSfnt(originalFontSfnt, text, options = {}) {
  const { wasmUrl, preserveNameIds, keepFeatures, noLayoutClosure, glyphNames, noHinting, dropTables } = options;

  if (!wasmUrl) {
    throw new Error('subsetSfnt requires options.wasmUrl pointing to hb-subset.wasm');
  }
  if (typeof text !== 'string') {
    throw new Error('The subset text must be given as a string');
  }

  const { harfbuzzJsWasm, heapu8 } = await loadHarfbuzz(wasmUrl);

  const originalFont = originalFontSfnt instanceof ArrayBuffer
    ? originalFontSfnt
    : originalFontSfnt.buffer.slice(originalFontSfnt.byteOffset, originalFontSfnt.byteOffset + originalFontSfnt.byteLength);

  const input = harfbuzzJsWasm.hb_subset_input_create_or_fail();
  if (input === 0) {
    throw new Error('hb_subset_input_create_or_fail (harfbuzz) returned zero, indicating failure');
  }

  const fontBuffer = harfbuzzJsWasm.malloc(originalFont.byteLength);
  heapu8.set(new Uint8Array(originalFont), fontBuffer);

  const blob = harfbuzzJsWasm.hb_blob_create(fontBuffer, originalFont.byteLength, HB_MEMORY_MODE_WRITABLE, 0, 0);
  const face = harfbuzzJsWasm.hb_face_create(blob, 0);
  harfbuzzJsWasm.hb_blob_destroy(blob);

  // Equivalent of --layout-features=*, unless an explicit allowlist was supplied.
  const layoutFeatures = harfbuzzJsWasm.hb_subset_input_set(input, HB_SUBSET_SETS_LAYOUT_FEATURE_TAG);
  harfbuzzJsWasm.hb_set_clear(layoutFeatures);
  if (keepFeatures === undefined) {
    harfbuzzJsWasm.hb_set_invert(layoutFeatures);
  } else {
    for (const feature of keepFeatures) {
      harfbuzzJsWasm.hb_set_add(layoutFeatures, HB_TAG(feature));
    }
  }

  if (preserveNameIds) {
    const inputNameIds = harfbuzzJsWasm.hb_subset_input_set(input, HB_SUBSET_SETS_NAME_ID);
    for (const nameId of preserveNameIds) {
      harfbuzzJsWasm.hb_set_add(inputNameIds, nameId);
    }
  }

  if (noLayoutClosure || noHinting || glyphNames) {
    let flags = harfbuzzJsWasm.hb_subset_input_get_flags(input);
    if (noLayoutClosure) flags |= HB_SUBSET_FLAGS_NO_LAYOUT_CLOSURE;
    if (noHinting) flags |= HB_SUBSET_FLAGS_NO_HINTING;
    if (glyphNames) flags |= HB_SUBSET_FLAGS_GLYPH_NAMES;
    if (flags !== harfbuzzJsWasm.hb_subset_input_get_flags(input)) {
      harfbuzzJsWasm.hb_subset_input_set_flags(input, flags);
    }
  }

  if (dropTables) {
    const inputDropTables = harfbuzzJsWasm.hb_subset_input_set(input, HB_SUBSET_SETS_DROP_TABLE_TAG);
    for (const tag of dropTables) {
      harfbuzzJsWasm.hb_set_add(inputDropTables, HB_TAG(tag));
    }
  }

  const inputUnicodes = harfbuzzJsWasm.hb_subset_input_unicode_set(input);
  for (const c of text) {
    harfbuzzJsWasm.hb_set_add(inputUnicodes, c.codePointAt(0));
  }

  let subset;
  try {
    subset = harfbuzzJsWasm.hb_subset_or_fail(face, input);
    if (subset === 0) {
      harfbuzzJsWasm.hb_face_destroy(face);
      harfbuzzJsWasm.free(fontBuffer);
      throw new Error('hb_subset_or_fail (harfbuzz) returned zero, indicating failure. Maybe the input file is corrupted?');
    }
  } finally {
    harfbuzzJsWasm.hb_subset_input_destroy(input);
  }

  const result = harfbuzzJsWasm.hb_face_reference_blob(subset);
  const offset = harfbuzzJsWasm.hb_blob_get_data(result, 0);
  const subsetByteLength = harfbuzzJsWasm.hb_blob_get_length(result);

  if (subsetByteLength === 0) {
    harfbuzzJsWasm.hb_blob_destroy(result);
    harfbuzzJsWasm.hb_face_destroy(subset);
    harfbuzzJsWasm.hb_face_destroy(face);
    harfbuzzJsWasm.free(fontBuffer);
    throw new Error('Failed to create subset font, maybe the input file is corrupted?');
  }

  const subsetFontBytes = heapu8.slice(offset, offset + subsetByteLength);

  harfbuzzJsWasm.hb_blob_destroy(result);
  harfbuzzJsWasm.hb_face_destroy(subset);
  harfbuzzJsWasm.hb_face_destroy(face);
  harfbuzzJsWasm.free(fontBuffer);

  return subsetFontBytes;
}
