import * as jschardet from "jschardet"
import { maxBy } from "lodash-es"

import { flattenObject, tryParseJSONObject } from "@/utils"

/**
 * Pure, dependency-free CSV / line-separated-JSON parsing utilities.
 *
 * `parseCSV` is a drop-in replacement for the sync `parse` of csv-parse
 * (for the options used in this project) which additionally detects
 * line-separated JSON in "auto" mode. `openCSVStream` provides the same
 * functionality incrementally on File/Blob/ReadableStream input.
 *
 * Intentional deviations from csv-parse:
 * - `delimiter: "auto"` uses our own detectDelimiter() candidate set.
 * - Only the options below are supported (delimiter, bom, skip_empty_lines,
 *   relax_column_count, relax_quotes).
 * - The result carries metadata (format, delimiter, headerRow).
 */

export type CSVFormat = "csv" | "lsjson"

export interface ParseCSVOptions {
  /**
   * Field delimiter, or "auto" to detect it via detectDelimiter().
   * In "auto" mode line-separated JSON is detected as well.
   * Multi-character delimiters are supported.
   */
  delimiter?: string | "auto"
  /** Strip a leading BOM (﻿) before parsing. */
  bom?: boolean
  /** Skip lines which contain no characters at all (whitespace-only lines are kept). */
  skip_empty_lines?: boolean
  /** Allow records with varying column counts (otherwise throws CSVParseError). */
  relax_column_count?: boolean
  /** Tolerate quotes in unexpected positions (treated as literal characters). */
  relax_quotes?: boolean
}

export interface ParseCSVResult {
  records: any[][]
  format: CSVFormat
  /** The delimiter used, or null when none was detected (or format is "lsjson"). */
  delimiter: string | null
  /** Union of all (flattened) keys; only set when format === "lsjson". */
  headerRow?: string[]
}

export interface CSVStreamMeta {
  format: CSVFormat
  delimiter: string | null
  /** Only set for format === "lsjson", available after rows are fully consumed. */
  headerRow?: string[]
}

export interface CSVStream {
  meta: CSVStreamMeta
  rows: AsyncIterableIterator<any[]>
}

export type CSVErrorCode =
  | "CSV_INVALID_CLOSING_QUOTE"
  | "CSV_QUOTE_NOT_CLOSED"
  | "INVALID_OPENING_QUOTE"
  | "CSV_RECORD_INCONSISTENT_FIELDS_LENGTH"
  | "CSV_INVALID_OPTION"

export class CSVParseError extends Error {
  code: CSVErrorCode

  constructor(code: CSVErrorCode, message: string) {
    super(message)
    this.name = "CSVParseError"
    this.code = code
  }
}

const QUOTE_CODE = 34 // "
const CR_CODE = 13 // \r
const LF_CODE = 10 // \n
const BOM_CODE = 0xfeff

interface DelimitedTextParserOptions {
  delimiter: string
  skipEmptyLines: boolean
  relaxColumnCount: boolean
  relaxQuotes: boolean
}

/**
 * Incremental push-parser for delimited text, mirroring csv-parse semantics
 * for the supported options. Feed string chunks via write() and collect the
 * records completed by each chunk; pass isEnd=true on the last chunk.
 */
class DelimitedTextParser {
  private buf = ""
  private scratch = ""
  private record: string[] = []
  private quoting = false
  private wasQuoting = false
  private recordDelimiter: string | null = null
  private expectedRecordLength = -1
  private readonly delimiter: string
  private readonly delimiterLength: number
  private readonly delimiterCode: number

  constructor(private readonly options: DelimitedTextParserOptions) {
    this.delimiter = options.delimiter
    this.delimiterLength = options.delimiter.length
    this.delimiterCode = options.delimiter.charCodeAt(0)
  }

  write(chunk: string, isEnd: boolean): string[][] {
    this.buf += chunk
    const out: string[][] = []
    this.consume(isEnd, out)
    return out
  }

  parseAll(input: string): string[][] {
    return this.write(input, true)
  }

  /**
   * Match a record delimiter at position `pos`, auto-discovering and locking
   * the delimiter on first use ("\r\n" preferred over "\r"). Returns the
   * delimiter length, 0 when `pos` is not a delimiter, or -1 when more input
   * is needed to decide (only when isEnd === false).
   */
  private matchRecordDelimiter(
    buf: string,
    pos: number,
    isEnd: boolean,
  ): number {
    const len = buf.length
    const code = buf.charCodeAt(pos)
    const locked = this.recordDelimiter
    if (locked === null) {
      if (code === LF_CODE) {
        this.recordDelimiter = "\n"
        return 1
      }
      // code === CR_CODE
      if (pos + 1 >= len) {
        if (!isEnd) return -1
        this.recordDelimiter = "\r"
        return 1
      }
      if (buf.charCodeAt(pos + 1) === LF_CODE) {
        this.recordDelimiter = "\r\n"
        return 2
      }
      this.recordDelimiter = "\r"
      return 1
    }
    if (code !== locked.charCodeAt(0)) return 0
    if (locked.length === 1) return 1
    // locked === "\r\n"
    if (pos + 1 >= len) {
      return isEnd ? 0 : -1
    }
    return buf.charCodeAt(pos + 1) === LF_CODE ? 2 : 0
  }

  /**
   * Check whether the character at `pos` (following a closing-quote candidate)
   * ends the quoted section, i.e. is a field or record delimiter.
   * Returns null when more input is needed to decide.
   */
  private isValidQuoteFollower(
    buf: string,
    pos: number,
    isEnd: boolean,
  ): boolean | null {
    const code = buf.charCodeAt(pos)
    if (code === CR_CODE || code === LF_CODE) {
      const rd = this.matchRecordDelimiter(buf, pos, isEnd)
      if (rd === -1) return null
      return rd > 0
    }
    if (code === this.delimiterCode) {
      if (this.delimiterLength === 1) return true
      const remaining = buf.length - pos
      if (remaining >= this.delimiterLength) {
        return buf.startsWith(this.delimiter, pos)
      }
      if (!isEnd && this.delimiter.startsWith(buf.slice(pos))) return null
      return false
    }
    return false
  }

  private consume(isEnd: boolean, out: string[][]): void {
    const buf = this.buf
    const len = buf.length
    const delim = this.delimiter
    const delimLen = this.delimiterLength
    const relaxQuotes = this.options.relaxQuotes
    let scratch = this.scratch
    let pos = 0
    let fieldStart = 0

    outer: while (pos < len) {
      const code = buf.charCodeAt(pos)

      if (this.quoting) {
        if (code === QUOTE_CODE) {
          if (pos + 1 >= len) {
            if (!isEnd) break outer
            // Quote at end of input closes the quoted section
            scratch += buf.slice(fieldStart, pos)
            this.quoting = false
            this.wasQuoting = true
            pos++
            fieldStart = pos
            continue
          }
          const next = buf.charCodeAt(pos + 1)
          if (next === QUOTE_CODE) {
            // Escaped quote ("")
            scratch += buf.slice(fieldStart, pos) + '"'
            pos += 2
            fieldStart = pos
            continue
          }
          const follow = this.isValidQuoteFollower(buf, pos + 1, isEnd)
          if (follow === null) break outer
          if (follow) {
            scratch += buf.slice(fieldStart, pos)
            this.quoting = false
            this.wasQuoting = true
            pos++
            fieldStart = pos
            continue
          }
          if (!relaxQuotes) {
            throw new CSVParseError(
              "CSV_INVALID_CLOSING_QUOTE",
              `Invalid Closing Quote: got "${buf[pos + 1]}" instead of delimiter or record delimiter`,
            )
          }
          // relax_quotes: the opening quote was not special after all,
          // treat both quotes as literal parts of the field (the closing
          // quote stays in the raw span via fieldStart)
          scratch = '"' + scratch + buf.slice(fieldStart, pos)
          this.quoting = false
          this.wasQuoting = true
          fieldStart = pos
          pos++
          continue
        }
        pos++
        continue
      }

      // Not quoting
      if (code === QUOTE_CODE) {
        if (scratch.length === 0 && fieldStart === pos) {
          this.quoting = true
          pos++
          fieldStart = pos
          continue
        }
        if (!relaxQuotes) {
          throw new CSVParseError(
            "INVALID_OPENING_QUOTE",
            "Invalid Opening Quote: a quote is found inside a field",
          )
        }
        pos++ // literal quote inside an unquoted field
        continue
      }

      if (code === CR_CODE || code === LF_CODE) {
        const rdLen = this.matchRecordDelimiter(buf, pos, isEnd)
        if (rdLen === -1) break outer
        if (rdLen === 0) {
          pos++ // literal line break (locked on a different record delimiter)
          continue
        }
        if (
          this.options.skipEmptyLines &&
          !this.wasQuoting &&
          this.record.length === 0 &&
          scratch.length === 0 &&
          fieldStart === pos
        ) {
          pos += rdLen
          fieldStart = pos
          continue
        }
        this.record.push(scratch + buf.slice(fieldStart, pos))
        scratch = ""
        this.wasQuoting = false
        pos += rdLen
        fieldStart = pos
        this.pushRecord(out)
        continue
      }

      if (code === this.delimiterCode) {
        if (delimLen === 1) {
          this.record.push(scratch + buf.slice(fieldStart, pos))
          scratch = ""
          this.wasQuoting = false
          pos++
          fieldStart = pos
          continue
        }
        const remaining = len - pos
        if (remaining >= delimLen) {
          if (buf.startsWith(delim, pos)) {
            this.record.push(scratch + buf.slice(fieldStart, pos))
            scratch = ""
            this.wasQuoting = false
            pos += delimLen
            fieldStart = pos
            continue
          }
        } else if (!isEnd && delim.startsWith(buf.slice(pos))) {
          break outer // delimiter might span into the next chunk
        }
        pos++
        continue
      }

      pos++
    }

    if (pos < len) {
      // Stopped early, waiting for more input
      this.scratch = scratch + buf.slice(fieldStart, pos)
      this.buf = buf.slice(pos)
    } else {
      this.scratch = scratch + buf.slice(fieldStart, len)
      this.buf = ""
    }

    if (isEnd) {
      if (this.quoting) {
        throw new CSVParseError(
          "CSV_QUOTE_NOT_CLOSED",
          "Quote Not Closed: the parsing finished with an opening quote",
        )
      }
      if (
        this.wasQuoting ||
        this.record.length !== 0 ||
        this.scratch.length !== 0
      ) {
        this.record.push(this.scratch)
        this.scratch = ""
        this.wasQuoting = false
        this.pushRecord(out)
      }
    }
  }

  private pushRecord(out: string[][]): void {
    const record = this.record
    if (this.expectedRecordLength === -1) {
      this.expectedRecordLength = record.length
    }
    if (
      record.length !== this.expectedRecordLength &&
      !this.options.relaxColumnCount
    ) {
      throw new CSVParseError(
        "CSV_RECORD_INCONSISTENT_FIELDS_LENGTH",
        `Invalid Record Length: expect ${this.expectedRecordLength}, got ${record.length}`,
      )
    }
    out.push(record)
    this.record = []
  }
}

/**
 * Incremental accumulator for line-separated JSON: one JSON object per line.
 * The first non-empty line decides: if it is not a JSON object the input is
 * rejected (aborted). Later non-JSON lines are skipped.
 */
class LineSeparatedJsonAccumulator {
  private objects: Record<string, any>[] = []
  private keys: string[] = []
  private keySet = new Set<string>()
  private foundFirst = false
  private failed = false

  get aborted(): boolean {
    return this.failed
  }

  addLine(line: string): void {
    if (this.failed) return
    const trimmed = line.trim()
    if (trimmed === "") return
    const parsed = tryParseJSONObject(trimmed)
    if (parsed === false) {
      if (!this.foundFirst) this.failed = true
      return
    }
    this.foundFirst = true
    const flattened = flattenObject(parsed)
    this.objects.push(flattened)
    for (const key of Object.keys(flattened)) {
      if (!this.keySet.has(key)) {
        this.keySet.add(key)
        this.keys.push(key)
      }
    }
  }

  finish(): { data: any[][]; headerRow: string[] } | null {
    if (this.failed || this.objects.length === 0) return null
    const headerRow = this.keys
    const data = this.objects.map((obj) => headerRow.map((h) => obj[h]))
    return { data, headerRow }
  }
}

export function parseLineSeparatedJson(input: string): {
  data: any[][]
  headerRow: string[]
} | null {
  const acc = new LineSeparatedJsonAccumulator()
  let start = 0
  const len = input.length
  while (start < len && !acc.aborted) {
    let end = input.indexOf("\n", start)
    if (end === -1) end = len
    acc.addLine(input.slice(start, end))
    start = end + 1
  }
  return acc.finish()
}

export function detectDelimiter(input: string): string | null {
  const supportedDelimiters = [",", "\t", ";", "|", "~", "#"] // Note: Order matters in case of equal occurrence count!
  const counts: Record<string, number> = {}
  const linesToTest = input
    .split("\n")
    .slice(0, 50)
    .map((l) => l.replace(/['"]/g, "").slice(0, 1000).trim())
    .filter((l) => l.length > 0)

  if (!linesToTest.length) {
    return null
  }

  let delimItersToTest = supportedDelimiters.filter((sd) =>
    linesToTest[0].includes(sd),
  )
  for (const line of linesToTest) {
    // Disregard delimiter candidates which are not occurring at all for one or more line
    if (line.length > 1) {
      delimItersToTest = delimItersToTest.filter((dl) => line.includes(dl))
    }
    for (const c of line) {
      if (delimItersToTest.includes(c)) {
        counts[c] = (counts[c] || 0) + 1
      }
    }
    if (delimItersToTest.length < 2) {
      break
    }
  }
  const maxEntry = maxBy(
    Object.entries(counts).filter((c) => delimItersToTest.includes(c[0])),
    (_) => _[1],
  )!

  return maxEntry ? maxEntry[0] : null
}

function makeParser(
  delimiter: string,
  options: ParseCSVOptions,
): DelimitedTextParser {
  return new DelimitedTextParser({
    delimiter,
    skipEmptyLines: options.skip_empty_lines === true,
    relaxColumnCount: options.relax_column_count === true,
    relaxQuotes: options.relax_quotes === true,
  })
}

/**
 * Parse CSV / delimited text, or line-separated JSON (in "auto" mode).
 * Drop-in replacement for the sync csv-parse parse() for the supported
 * options, returning additional format/delimiter metadata.
 */
export function parseCSV(
  input: string,
  options: ParseCSVOptions = {},
): ParseCSVResult {
  const { delimiter = "auto", bom = false } = options
  let text = input
  if (bom && text.length > 0 && text.charCodeAt(0) === BOM_CODE) {
    text = text.slice(1)
  }
  if (delimiter === "auto") {
    const lsJson = parseLineSeparatedJson(text)
    if (lsJson && lsJson.data.length > 0) {
      return {
        records: lsJson.data,
        format: "lsjson",
        delimiter: null,
        headerRow: lsJson.headerRow,
      }
    }
    const detected = detectDelimiter(text)
    if (detected === null) {
      return { records: [], format: "csv", delimiter: null }
    }
    return {
      records: makeParser(detected, options).parseAll(text),
      format: "csv",
      delimiter: detected,
    }
  }
  if (delimiter.length === 0) {
    throw new CSVParseError(
      "CSV_INVALID_OPTION",
      "Invalid option `delimiter`: must not be empty",
    )
  }
  return {
    records: makeParser(delimiter, options).parseAll(text),
    format: "csv",
    delimiter,
  }
}

function detectEncoding(firstChunk: Uint8Array): string {
  // @ts-ignore: ts does not know about Buffer coming from next.js polyfill
  const detected = jschardet.detect(Buffer.from(firstChunk))
  console.log("file encoding: ", detected)
  return detected?.encoding || "utf-8"
}

function countNewlines(text: string, cap: number): number {
  let count = 0
  let idx = -1
  while (count < cap) {
    idx = text.indexOf("\n", idx + 1)
    if (idx === -1) break
    count++
  }
  return count
}

type FirstLineResult =
  { kind: "line"; line: string } | { kind: "none" } | { kind: "needMore" }

/** First non-empty line terminated by "\n" (or by end of input). */
function firstTerminatedLine(text: string, isEnd: boolean): FirstLineResult {
  let start = 0
  const len = text.length
  while (start < len) {
    const nl = text.indexOf("\n", start)
    if (nl === -1) break
    const line = text.slice(start, nl).trim()
    if (line !== "") return { kind: "line", line }
    start = nl + 1
  }
  if (isEnd) {
    const line = text.slice(start).trim()
    return line === "" ? { kind: "none" } : { kind: "line", line }
  }
  return { kind: "needMore" }
}

/** Feed all complete lines in `text` to `acc`, return the incomplete remainder. */
function feedLines(
  acc: LineSeparatedJsonAccumulator,
  text: string,
  isEnd: boolean,
): string {
  let start = 0
  const len = text.length
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i)
    if (code === LF_CODE) {
      acc.addLine(text.slice(start, i))
      start = i + 1
    } else if (code === CR_CODE) {
      if (i + 1 >= len && !isEnd) break // might be "\r\n" split across chunks
      acc.addLine(text.slice(start, i))
      if (i + 1 < len && text.charCodeAt(i + 1) === LF_CODE) i++
      start = i + 1
    }
  }
  return text.slice(start)
}

async function cancelReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<void> {
  try {
    await reader.cancel()
  } catch {
    // ignore
  }
  reader.releaseLock()
}

async function* csvRowGenerator(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  parser: DelimitedTextParser,
  initialText: string,
): AsyncGenerator<string[]> {
  try {
    let records = parser.write(initialText, false)
    for (let i = 0; i < records.length; i++) yield records[i]
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.length > 0) {
        records = parser.write(decoder.decode(value, { stream: true }), false)
        for (let i = 0; i < records.length; i++) yield records[i]
      }
    }
    records = parser.write(decoder.decode(), true)
    for (let i = 0; i < records.length; i++) yield records[i]
  } finally {
    await cancelReader(reader)
  }
}

async function* lsjsonRowGenerator(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  acc: LineSeparatedJsonAccumulator,
  initialText: string,
  meta: CSVStreamMeta,
): AsyncGenerator<any[]> {
  try {
    let pending = feedLines(acc, initialText, false)
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value && value.length > 0) {
        pending = feedLines(
          acc,
          pending + decoder.decode(value, { stream: true }),
          false,
        )
      }
    }
    pending = feedLines(acc, pending + decoder.decode(), true)
    if (pending.length > 0) acc.addLine(pending)
    const result = acc.finish()
    if (result !== null) {
      meta.headerRow = result.headerRow
      const data = result.data
      for (let i = 0; i < data.length; i++) yield data[i]
    }
  } finally {
    await cancelReader(reader)
  }
}

// Caps for the sniffing phase of openCSVStream
const LSJSON_SNIFF_MAX = 1024 * 1024 // max size of the first line for lsjson detection
const DELIMITER_SNIFF_MAX = 256 * 1024
const DELIMITER_SNIFF_LINES = 50 // same limit detectDelimiter uses
// Minimum amount of bytes gathered before the encoding is detected
const ENCODING_DETECTION_MIN_BYTES = 4096

/**
 * Parse CSV / line-separated JSON incrementally from a File, Blob or
 * ReadableStream, without materializing the whole input as a string first.
 *
 * The returned promise resolves once the format (and delimiter) have been
 * detected from an initial chunk of the input. Rows are then produced by the
 * async iterator as parsing progresses. For line-separated JSON the header
 * row is only known once all lines were seen, so rows are emitted when the
 * iterator completes (and meta.headerRow is set afterwards).
 */
export async function openCSVStream(
  source: File | Blob | ReadableStream<Uint8Array>,
  options: ParseCSVOptions = {},
): Promise<CSVStream> {
  const { delimiter = "auto", bom = false } = options
  if (delimiter !== "auto" && delimiter.length === 0) {
    throw new CSVParseError(
      "CSV_INVALID_OPTION",
      "Invalid option `delimiter`: must not be empty",
    )
  }

  const byteStream = source instanceof ReadableStream ? source : source.stream()
  const reader = byteStream.getReader()

  // Gather enough raw bytes for a reliable encoding detection before
  // decoding anything (a single tiny chunk would fool jschardet)
  let streamDone = false
  const headChunks: Uint8Array[] = []
  let headLength = 0
  while (!streamDone && headLength < ENCODING_DETECTION_MIN_BYTES) {
    const { done, value } = await reader.read()
    if (done) {
      streamDone = true
      break
    }
    if (value && value.length > 0) {
      headChunks.push(value)
      headLength += value.length
    }
  }
  const head = new Uint8Array(headLength)
  let headOffset = 0
  for (const chunk of headChunks) {
    head.set(chunk, headOffset)
    headOffset += chunk.length
  }
  // ignoreBOM: the BOM is stripped (or kept) by the parser itself,
  // controlled via the bom option, so sync and stream behave the same
  const decoder = new TextDecoder(
    headLength > 0 ? detectEncoding(head) : "utf-8",
    { ignoreBOM: true },
  )
  let sniffed = streamDone
    ? decoder.decode(head)
    : decoder.decode(head, { stream: true })

  const readMore = async (): Promise<void> => {
    if (streamDone) return
    const { done, value } = await reader.read()
    if (done) {
      streamDone = true
      sniffed += decoder.decode()
      return
    }
    if (value && value.length > 0) {
      sniffed += decoder.decode(value, { stream: true })
    }
  }

  if (bom && sniffed.length > 0 && sniffed.charCodeAt(0) === BOM_CODE) {
    sniffed = sniffed.slice(1)
  }

  let format: CSVFormat = "csv"
  let resolvedDelimiter: string | null = null

  if (delimiter === "auto") {
    // Line-separated JSON sniff: the first terminated non-empty line decides.
    // Note: unlike the sync parseCSV this gives up on first lines longer than
    // LSJSON_SNIFF_MAX to keep sniffing bounded.
    while (true) {
      const r = firstTerminatedLine(sniffed, streamDone)
      if (r.kind === "line") {
        if (tryParseJSONObject(r.line) !== false) format = "lsjson"
        break
      }
      if (r.kind === "none") break // no non-empty line in the whole input
      if (streamDone || sniffed.length >= LSJSON_SNIFF_MAX) break
      await readMore()
    }
  }

  if (format === "csv") {
    if (delimiter === "auto") {
      while (
        !streamDone &&
        sniffed.length < DELIMITER_SNIFF_MAX &&
        countNewlines(sniffed, DELIMITER_SNIFF_LINES) < DELIMITER_SNIFF_LINES
      ) {
        await readMore()
      }
      resolvedDelimiter = detectDelimiter(sniffed)
    } else {
      resolvedDelimiter = delimiter
    }
  }

  const meta: CSVStreamMeta = { format, delimiter: resolvedDelimiter }

  let rows: AsyncIterableIterator<any[]>
  if (format === "lsjson") {
    rows = lsjsonRowGenerator(
      reader,
      decoder,
      new LineSeparatedJsonAccumulator(),
      sniffed,
      meta,
    )
  } else if (resolvedDelimiter === null) {
    await cancelReader(reader)
    rows = (async function* (): AsyncGenerator<any[]> {})()
  } else {
    rows = csvRowGenerator(
      reader,
      decoder,
      makeParser(resolvedDelimiter, options),
      sniffed,
    )
  }

  return { meta, rows }
}
