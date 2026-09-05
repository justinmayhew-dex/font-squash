'use client'

import { useEffect } from "react"
import { subsetFont } from "@/components/harfbuzz"
import { compress } from "@/components/woff2"

export type FontItem = {
  file: File
  state: "pending" | "processing" | "done" | "error"
  woff2?: Uint8Array
  error?: string
}

type Props = {
  font: FontItem
  onUpdate: (update: Partial<FontItem>) => void
}

export default function FontCompress({ font, onUpdate }: Props) {
  useEffect(() => {
    if (font.state !== "pending") return

      ; (async () => {
        try {
          onUpdate({ state: "processing" })

          const input = new Uint8Array(
            await font.file.arrayBuffer()
          )

          console.log(`Original: ${input.byteLength} bytes`)

          const subset = await subsetFont(
            input,
            0x20,
            0x7e
          )

          console.log(`Subset TTF: ${subset.byteLength} bytes`)

          const woff2 = await compress(subset)

          console.log(`WOFF2: ${woff2.byteLength} bytes`)

          onUpdate({
            state: "done",
            woff2,
          })
        } catch (error) {
          console.error(error)

          onUpdate({
            state: "error",
            error: error instanceof Error
              ? error.message
              : "Failed to process font",
          })
        }
      })()
  }, [font.state, font.file, onUpdate])

  return null
}
