import { expect, describe, it } from "bun:test"

import { openCSVStream, parseCSV, ParseCSVOptions } from "@/csvUtils"

function streamFromString(
  text: string,
  chunkSize: number,
): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize))
      }
      controller.close()
    },
  })
}

async function collect(
  source: Parameters<typeof openCSVStream>[0],
  options?: ParseCSVOptions,
) {
  const { meta, rows } = await openCSVStream(source, options)
  const collected: any[][] = []
  for await (const row of rows) {
    collected.push(row)
  }
  return { meta, rows: collected }
}

const csvCorpus: string[] = [
  "",
  "\n",
  "\n\n",
  ",",
  "a",
  "a,b\n1,2",
  "a,b\n1,2\n",
  "a,b\r\n1,2\r\n",
  "a,b\r1,2\r",
  "a,b\r\n1,2\n3,4", // mixed endings, record delimiter locks
  'a,b\n"x,y",2',
  'a,b\n"x\ny",2',
  'a,b\n"x\r\ny",2\r\n3,4',
  'a,b\n"x""y",2',
  'a,b\n"",2',
  'a,b\n"x"""",2', // field: x""
  "a,b\n1,foo bar",
  "a,,b\n,,",
  "a,b,c\n1,2", // ragged rows
  "a,b\n1,2,3", // ragged rows
  "a,b\n\n\n1,2\n", // empty lines
  'a,b\n""\n1,2', // quoted empty line
  "a,b\n \n1,2", // whitespace-only line
  'a,b\n"x"y,2', // relax_quotes case
  'a,b\n1,fo"o"bar', // relax_quotes case
  'a,b\n"xy,2', // unclosed quote
  "é,ü\n✓,😀", // unicode / multibyte
  "﻿a,b\n1,2", // BOM
  "x".repeat(10000) + ",y\n" + "z".repeat(10000) + ",2", // long fields
  'a,b\n"' + "x".repeat(5000) + "\n" + "y".repeat(5000) + '",2', // long quoted field with newline
]

const optionVariants: ParseCSVOptions[] = [
  { delimiter: "," },
  { delimiter: ",", bom: true },
  { delimiter: ",", skip_empty_lines: true, relax_column_count: true },
  { delimiter: ",", relax_quotes: true, relax_column_count: true },
  {
    delimiter: "auto",
    relax_quotes: true,
    relax_column_count: true,
    bom: true,
  },
]

const chunkSizes = [1, 2, 3, 7, 64, 65536]

describe("openCSVStream - equivalence with sync parseCSV", () => {
  for (const input of csvCorpus) {
    for (const options of optionVariants) {
      const label =
        JSON.stringify(input.slice(0, 30)) + " " + JSON.stringify(options)
      it(label, async () => {
        let expected: ReturnType<typeof parseCSV> | { error: string }
        try {
          expected = parseCSV(input, options)
        } catch (e: any) {
          expected = { error: e.code }
        }
        for (const chunkSize of chunkSizes) {
          try {
            const { meta, rows } = await collect(
              streamFromString(input, chunkSize),
              options,
            )
            if ("error" in expected) {
              throw new Error(
                `expected error ${expected.error} but got rows ${JSON.stringify(rows)} (chunkSize ${chunkSize})`,
              )
            }
            expect({ format: meta.format, delimiter: meta.delimiter }).toEqual({
              format: expected.format,
              delimiter: expected.delimiter,
            })
            expect(rows).toEqual(expected.records)
          } catch (e: any) {
            if ("error" in expected) {
              expect(e.code).toBe(expected.error)
            } else {
              throw new Error(
                `chunkSize ${chunkSize}: unexpected error ${e.code || e.message}`,
              )
            }
          }
        }
      })
    }
  }
})

describe("openCSVStream - sources", () => {
  it("reads from a Blob", async () => {
    const { meta, rows } = await collect(new Blob(["a,b\n1,2"]))
    expect(meta.delimiter).toBe(",")
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("reads from a File", async () => {
    const file = new File(["a;b\n1;2"], "test.csv", { type: "text/csv" })
    const { meta, rows } = await collect(file)
    expect(meta.delimiter).toBe(";")
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("decodes non-utf8 encodings (detected via jschardet)", async () => {
    // "ä,ö\nü,ß\n" in ISO-8859-1/windows-1252 bytes
    const bytes = new Uint8Array([
      0xe4, 0x2c, 0xf6, 0x0a, 0xfc, 0x2c, 0xdf, 0x0a,
    ])
    const { rows } = await collect(new Blob([bytes]))
    expect(rows).toEqual([
      ["ä", "ö"],
      ["ü", "ß"],
    ])
  })

  it("handles utf-16le with BOM", async () => {
    const text = "a,b\n1,2\n"
    const bytes = new Uint8Array(text.length * 2 + 2)
    bytes[0] = 0xff
    bytes[1] = 0xfe
    for (let i = 0; i < text.length; i++) {
      bytes[2 + i * 2] = text.charCodeAt(i)
      bytes[2 + i * 2 + 1] = 0
    }
    const { rows } = await collect(new Blob([bytes]), { bom: true })
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})

describe("openCSVStream - line separated JSON", () => {
  const lsjson = '{"a":1,"b":"x"}\n{"a":2,"c":[1,2]}\n{"a":3}'

  it("detects lsjson and sets meta.headerRow after consumption", async () => {
    const { meta, rows } = await collect(new Blob([lsjson]))
    expect(meta.format).toBe("lsjson")
    expect(meta.delimiter).toBeNull()
    expect(meta.headerRow).toEqual(["a", "b", "c"])
    expect(rows).toEqual([
      [1, "x", undefined],
      [2, undefined, [1, 2]],
      [3, undefined, undefined],
    ])
  })

  it("matches sync parseCSV across chunk sizes", async () => {
    const expected = parseCSV(lsjson)
    for (const chunkSize of chunkSizes) {
      const { meta, rows } = await collect(streamFromString(lsjson, chunkSize))
      expect(meta.format).toBe("lsjson")
      expect(meta.headerRow).toEqual(expected.headerRow)
      expect(rows).toEqual(expected.records)
    }
  })

  it("handles CRLF line endings", async () => {
    const { meta, rows } = await collect(
      streamFromString('{"a":1}\r\n{"a":2}\r\n', 3),
    )
    expect(meta.format).toBe("lsjson")
    expect(rows).toEqual([[1], [2]])
  })

  it("skips invalid lines after the first valid one", async () => {
    const { rows } = await collect(new Blob(['{"a":1}\ngarbage\n{"a":2}']))
    expect(rows).toEqual([[1], [2]])
  })
})

describe("openCSVStream - detection edge cases", () => {
  it("returns null delimiter and no rows when nothing is detected", async () => {
    const { meta, rows } = await collect(new Blob(["hello world\nfoo bar"]))
    expect(meta.format).toBe("csv")
    expect(meta.delimiter).toBeNull()
    expect(rows).toEqual([])
  })

  it("handles an empty stream", async () => {
    const { meta, rows } = await collect(new Blob([]))
    expect(meta.delimiter).toBeNull()
    expect(rows).toEqual([])
  })

  it("detects the delimiter even when the sniff buffer ends mid-line", async () => {
    const lines: string[] = []
    for (let i = 0; i < 100; i++) lines.push(`col${i};value${i};other${i}`)
    const { meta, rows } = await collect(
      streamFromString(lines.join("\n"), 4096),
    )
    expect(meta.delimiter).toBe(";")
    expect(rows.length).toBe(100)
  })

  it("does not mistake JSON-ish first lines spanning many chunks for CSV", async () => {
    const longValue = "x".repeat(100000)
    const input = `{"a":"${longValue}"}\n{"a":"y"}`
    const { meta, rows } = await collect(streamFromString(input, 4096))
    expect(meta.format).toBe("lsjson")
    expect(rows).toEqual([[longValue], ["y"]])
  })

  it("strips the BOM before detection", async () => {
    const { meta, rows } = await collect(streamFromString("﻿a;b\n1;2", 1), {
      bom: true,
    })
    expect(meta.delimiter).toBe(";")
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })
})

describe("openCSVStream - error handling and cancellation", () => {
  it("propagates parse errors mid-stream", async () => {
    const input = "a,b\n" + "1,2\n".repeat(100) + "1,2,3\n"
    const { rows } = await openCSVStream(streamFromString(input, 16), {
      delimiter: ",",
    })
    let error: any = null
    try {
      for await (const row of rows) void row
    } catch (e: any) {
      error = e
    }
    expect(error?.code).toBe("CSV_RECORD_INCONSISTENT_FIELDS_LENGTH")
  })

  it("propagates unclosed quote errors at end of stream", async () => {
    const { rows } = await openCSVStream(new Blob(['a,b\n"xy,2']), {
      delimiter: ",",
    })
    let error: any = null
    try {
      for await (const row of rows) void row
    } catch (e: any) {
      error = e
    }
    expect(error?.code).toBe("CSV_QUOTE_NOT_CLOSED")
  })

  it("stops reading when the consumer breaks out of the loop", async () => {
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(new TextEncoder().encode("a,b\n"))
      },
    })
    const { rows } = await openCSVStream(stream, { delimiter: "," })
    for await (const row of rows) {
      void row
      break
    }
    const pulledAfterBreak = pulled
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(pulled).toBe(pulledAfterBreak) // no further pulls after break
  })
})
