# Font Optimizer

```text
  _____           _   ____                        _     
 |  ___|__  _ __ | |_/ ___|  __ _ _   _  __ _ ___| |__  
 | |_ / _ \| '_ \| __\___ \ / _` | | | |/ _` / __| '_ \ 
 |  _| (_) | | | | |_ ___) | (_| | |_| | (_| \__ \ | | |
 |_|  \___/|_| |_|\__|____/ \__, |\__,_|\__,_|___/_| |_|
                               |_|
```

A browser-based font optimizer for web developers.

Upload TTF or OTF fonts, subset them to the characters you need, and encode the result as WOFF2. Everything happens locally in the browser — font files are never uploaded to a server.

## How it works

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
```

The optimizer uses two WebAssembly components:

- **HarfBuzz** — subsets the font and produces a valid SFNT font containing only the requested glyphs.
- **Google WOFF2** — encodes the resulting SFNT font as WOFF2.

## Features

- TTF and OTF input
- Font subsetting
- WOFF2 output
- Multiple fonts can be processed
- Original and optimized file sizes
- Percentage size reduction
- Client-side processing
- No file uploads
- WebAssembly-based font processing

## Example

A font can go from:

```text
64 KB → 14 KB
```

while retaining only the required characters.

## Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open `http://localhost:3000`.

## WebAssembly

This project uses two independently compiled WebAssembly components.

### HarfBuzz

HarfBuzz handles font subsetting and produces the resulting SFNT font.

### Google WOFF2

Google's WOFF2 library takes the subsetted SFNT and produces the final WOFF2 file.

The TypeScript layer provides small wrappers around both native APIs.

## Privacy

Font files are processed entirely in the browser.

Fonts are never uploaded to a server, making the tool suitable for optimizing commercial or proprietary fonts.

## License

This project uses third-party software including:

- [HarfBuzz](https://github.com/harfbuzz/harfbuzz)
- [WOFF2](https://github.com/google/woff2)

See the respective projects for their licenses and attribution requirements.
