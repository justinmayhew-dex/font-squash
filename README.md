````markdown
# Font Optimizer

A browser-based font optimizer for web developers.

Upload TTF or OTF fonts, subset them to the characters you need, and encode the result as WOFF2. Everything happens locally in the browser — font files are never uploaded to a server.

## How it works

The optimizer uses two WebAssembly components:

1. **HarfBuzz** — subsets the font and produces a valid SFNT font containing only the requested glyphs.
2. **Google WOFF2** — encodes the resulting SFNT font as WOFF2.

```text
TTF / OTF
   │
   ▼
HarfBuzz
   │
   │  Glyph subsetting
   ▼
SFNT / TTF
   │
   ▼
Google WOFF2
   │
   │  Compression
   ▼
WOFF2
````

The JavaScript/TypeScript layer provides a small API around both WASM modules.

## Features

* TTF and OTF input
* Font subsetting
* WOFF2 output
* Multiple fonts can be processed
* Shows original and optimized file sizes
* Shows percentage size reduction
* Client-side processing
* No file uploads
* Uses the actual HarfBuzz subsetter rather than manually modifying font tables

## Example

A font might go from:

```text
64 KB → 14 KB
```

while retaining only the required characters.

## Development

This project uses Next.js and TypeScript.

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## WebAssembly

The project includes two independently compiled WebAssembly components.

### HarfBuzz

HarfBuzz is used for font subsetting.

The wrapper exposes:

```text
_hb_subset_font
_hb_subset_free
```

The TypeScript wrapper handles copying font data into WASM memory and copying the resulting subset back into JavaScript.

### Google WOFF2

Google's WOFF2 library is used to encode the subsetted SFNT font.

The wrapper exposes:

```text
_woff2_compress
_woff2_free
```

The output of HarfBuzz is passed directly to the WOFF2 encoder.

## Why WASM?

Font processing libraries are traditionally designed for native or Node.js environments. Running the actual font-processing libraries as WebAssembly avoids trying to force Node-specific packages into a browser environment.

The browser application controls the interface while the font processing itself is performed by the native libraries compiled to WASM.

## Privacy

Font files are processed entirely in the browser.

There is no server-side font processing or font upload required.

This means the tool can be used with commercial or proprietary fonts without sending the font file to a remote service.

## License

This project contains or uses third-party software, including:

* [HarfBuzz](https://github.com/harfbuzz/harfbuzz)
* [WOFF2](https://github.com/google/woff2)

Refer to the respective projects for their licenses and attribution requirements.

## Status

Early-stage project.

The current implementation focuses on the core pipeline:

```text
font → subset → WOFF2
```

Additional subsetting controls and optimization options can be added on top of this foundation.

```
```
