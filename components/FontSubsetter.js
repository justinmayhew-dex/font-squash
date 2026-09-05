import * as fontkit from 'fontkit';
import { Buffer as BufferPolyfill } from 'buffer';
import { subsetSfnt } from './HarfbuzzSubset.js';

/**
 * Subsets a font down to a given set of characters and repacks it as WOFF2.
 *
 * Built on HarfBuzz's real subsetting engine (the same one behind
 * pyftsubset/fonttools and Google Fonts), via a browser-compatible fetch()
 * loader - see harfbuzzSubset.js for why that matters instead of using the
 * `subset-font` package directly (it's hard-wired to Node's fs).
 *
 * Note on the `buffer` import: `fontverter` (used here for WOFF/WOFF2/SFNT
 * format conversion) internally calls Node-Buffer-specific methods like
 * `buffer.toString('ascii', 0, 4)` to sniff font signatures. A plain
 * Uint8Array doesn't have that method, and real browsers have no built-in
 * Buffer at all, so we bring the `buffer` npm package - a pure-JS polyfill
 * of Node's Buffer API - and construct actual Buffer-polyfill instances
 * before handing data to fontverter. This has no Node dependency itself
 * and works the same in a browser bundle.
 *
 * Usage:
 *   const subsetter = new FontSubsetter({ wasmUrl: '/hb-subset.wasm' });
 *   const result = await subsetter.process(file, { text: 'Hello, world!' });
 *   subsetter.download(result.blob, 'subset.woff2');
 */
export default class FontSubsetter {
  /**
   * @param {{ wasmUrl: string }} config - wasmUrl must point to a servable
   *   copy of hb-subset.wasm (see harfbuzzSubset.js header comment).
   */
  constructor(config) {
    if (!config?.wasmUrl) {
      throw new Error('FontSubsetter requires { wasmUrl } pointing to hb-subset.wasm');
    }
    this.wasmUrl = config.wasmUrl;
  }

  /**
   * @param {File|Blob} file - the source font file (ttf, otf, woff, or woff2)
   * @param {object} options
   * @param {string} [options.text] - explicit text whose characters should be kept.
   *   Takes precedence over rangeStart/rangeEnd if given.
   * @param {number} [options.rangeStart] - start code point (default 0x0020, space)
   * @param {number} [options.rangeEnd] - end code point (default 0x007F, end of ASCII)
   * @param {boolean} [options.keepLayoutFeatures] - keep OpenType layout features
   *   (ligatures, kerning tables, etc). Default false - most plain-text use
   *   doesn't need these and dropping them saves real size.
   * @param {boolean} [options.keepHinting] - keep hinting instructions. Default false.
   * @returns {Promise<{ blob: Blob, buffer: Uint8Array, originalSize: number, compressedSize: number }>}
   */
  async process(file, options = {}) {
    const {
      text,
      rangeStart = 0x0020,
      rangeEnd = 0x007F,
      keepLayoutFeatures = false,
      keepHinting = false,
    } = options;

    const arrayBuffer = await file.arrayBuffer();
    const originalSize = arrayBuffer.byteLength;

    const subsetText = text ?? this.#rangeToString(rangeStart, rangeEnd);

    const arrayBuffer = await font.arrayBuffer()
    const nodeBuffer = Buffer.from(arrayBuffer)
    const fk = fontkit.create(nodeBuffer)
    const subset = fk.createSubset();

    // Define a Unicode range (Example: Basic Latin / ASCII: U+0020 to U+007F)
    const rangeStart = 0x0020;
    const rangeEnd = 0x007F;

    for (let codePoint = rangeStart; codePoint <= rangeEnd; codePoint++) {
      // Check if the font actually contains a glyph for this code point
      if (fk.hasGlyphForCodePoint(codePoint)) {
        const glyph = fk.glyphForCodePoint(codePoint);
        subset.includeGlyph(glyph);
      }
    }

    const encodedSubsetBuffer = subset.encode();
    const compressedWoff2 = await compress(sortAndCleanSfntTableDirectory(encodedSubsetBuffer))

    // HarfBuzz's subsetter operates on raw SFNT; convert from whatever format
    // (ttf/otf/woff/woff2) the input actually is. Wrap in the Buffer polyfill -
    // see class doc comment above for why fontverter needs it.

    const sfntBuffer = await fontverter.convert(BufferPolyfill.from(arrayBuffer), 'truetype');

    const subsetSfntBytes = await subsetSfnt(sfntBuffer, subsetText, {
      wasmUrl: this.wasmUrl,
      keepFeatures: keepLayoutFeatures ? undefined : [],
      noHinting: !keepHinting,
      dropTables: keepLayoutFeatures ? undefined : ['GDEF', 'GPOS', 'GSUB', 'STAT', 'gasp'],
    });

    const compressed = await fontverter.convert(BufferPolyfill.from(subsetSfntBytes), 'woff2', 'truetype');
    const compressedBytes = new Uint8Array(compressed);

    const blob = new Blob([compressedBytes], { type: 'font/woff2' });

    return {
      blob,
      buffer: compressedBytes,
      originalSize,
      compressedSize: compressedBytes.byteLength,
    };
  }

  /** Triggers a browser download of the given blob. */
  download(blob, filename = 'subset.woff2') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  #rangeToString(start, end) {
    let s = '';
    for (let cp = start; cp <= end; cp++) s += String.fromCodePoint(cp);
    return s;
  }
}
