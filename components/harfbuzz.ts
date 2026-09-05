type HarfBuzzModule = {
  _malloc(size: number): number
  _free(ptr: number): void

  _hb_subset_font(
    input: number,
    inputSize: number,
    unicodeStart: number,
    unicodeEnd: number,
    outputSizePtr: number
  ): number

  _hb_subset_free(ptr: number): void

  HEAPU8: Uint8Array
}

let hbPromise: Promise<HarfBuzzModule> | null = null

async function loadHarfBuzz(): Promise<HarfBuzzModule> {
  if (!hbPromise) {
    hbPromise = import("../public/harfbuzz/harfbuzz.js").then(async (mod: any) => {
      return await mod.default({
        locateFile: (file: string) => `/harfbuzz/${file}`,
      })
    })
  }

  return hbPromise
}

export async function subsetFont(
  font: ArrayBuffer | Uint8Array,
  unicodeStart = 0x20,
  unicodeEnd = 0x7e
): Promise<Uint8Array> {
  const hb = await loadHarfBuzz()

  const input = font instanceof Uint8Array
    ? font
    : new Uint8Array(font)

  // Allocate input in WASM memory.
  const inputPtr = hb._malloc(input.byteLength)

  // Copy JS → WASM.
  hb.HEAPU8.set(input, inputPtr)

  // HarfBuzz writes the output size here.
  const outputSizePtr = hb._malloc(4)

  try {
    const outputPtr = hb._hb_subset_font(
      inputPtr,
      input.byteLength,
      unicodeStart,
      unicodeEnd,
      outputSizePtr
    )

    if (!outputPtr) {
      throw new Error("HarfBuzz failed to subset font")
    }

    const outputSize = new DataView(
      hb.HEAPU8.buffer
    ).getUint32(outputSizePtr, true)

    if (!outputSize) {
      hb._hb_subset_free(outputPtr)
      throw new Error("HarfBuzz returned an empty subset")
    }

    // IMPORTANT:
    // Copy the data out of WASM before freeing it.
    const result = new Uint8Array(outputSize)
    result.set(
      hb.HEAPU8.subarray(outputPtr, outputPtr + outputSize)
    )

    hb._hb_subset_free(outputPtr)

    return result
  } finally {
    hb._free(inputPtr)
    hb._free(outputSizePtr)
  }
}
