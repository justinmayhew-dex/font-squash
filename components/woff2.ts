type Woff2Module = {
  _malloc(size: number): number;
  _free(ptr: number): void;

  _woff2_compress(
    input: number,
    inputSize: number,
    resultSize: number,
  ): number;

  _woff2_free(ptr: number): void;

  HEAPU8: Uint8Array;
};

let modulePromise: Promise<Woff2Module> | null = null;

async function loadWoff2(): Promise<Woff2Module> {
  if (!modulePromise) {
    modulePromise = import("../public/woff2/woff2.js?21").then(
      async ({ default: createModule }) => {
        return await createModule({
          locateFile: (file: string) => `/woff2/${file}`,
        });
      },
    );
  }

  return modulePromise;
}

export async function compress(
  input: Uint8Array,
): Promise<Uint8Array> {
  const wasm = await loadWoff2();

  const inputPtr = wasm._malloc(input.byteLength);
  const resultSizePtr = wasm._malloc(4);

  try {
    wasm.HEAPU8.set(input, inputPtr);

    const resultPtr = wasm._woff2_compress(
      inputPtr,
      input.byteLength,
      resultSizePtr,
    );

    if (!resultPtr) {
      throw new Error("WOFF2 compression failed");
    }

    try {
      const totalSize = new DataView(
        wasm.HEAPU8.buffer,
        resultSizePtr,
        4,
      ).getUint32(0, true);

      // First 4 bytes are our size header.
      return wasm.HEAPU8.slice(
        resultPtr + 4,
        resultPtr + totalSize,
      );
    } finally {
      wasm._woff2_free(resultPtr);
    }
  } finally {
    wasm._free(inputPtr);
    wasm._free(resultSizePtr);
  }
}
