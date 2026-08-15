import { expect, describe, it } from "bun:test"
import { parse } from "csv-parse/sync"

import { parseCSV, ParseCSVOptions } from "@/csvUtils"

/**
 * Differential tests: parseCSV must behave exactly like csv-parse (sync API)
 * for the supported option subset (delimiter, bom, skip_empty_lines,
 * relax_column_count, relax_quotes). Records are compared on success,
 * error codes on failure.
 */

type Outcome = { records: any[][] } | { error: string }

function runOurs(input: string, options: ParseCSVOptions): Outcome {
  try {
    return { records: parseCSV(input, options).records }
  } catch (e: any) {
    if (e.code) return { error: e.code }
    throw e
  }
}

function runTheirs(input: string, options: ParseCSVOptions): Outcome {
  try {
    return { records: parse(input, options as any) }
  } catch (e: any) {
    if (e.code) return { error: e.code }
    throw e
  }
}

function compare(input: string, options: ParseCSVOptions) {
  const ours = runOurs(input, options)
  const theirs = runTheirs(input, options)
  expect({ input, options, outcome: ours }).toEqual({
    input,
    options,
    outcome: theirs,
  })
}

const corpus: string[] = [
  "",
  "\n",
  "\n\n",
  "\r",
  "\r\n",
  ",",
  "a",
  "a\n",
  "a,b\n1,2",
  "a,b\n1,2\n",
  "a,b\r\n1,2\r\n",
  "a,b\r1,2\r",
  "a,b\r\n1,2\n3,4",
  "a,b\n1,2\r3,4",
  '"a",b\n1,2',
  '"a""b",c',
  '"a""",b',
  '"",b',
  '""',
  '"a"',
  '"a',
  'a,"b\nc"',
  'a,"b\r\nc"',
  'a,"b\rc"',
  '"a"x,b',
  '"a" ,b',
  'a"b",c',
  'a,"b"c',
  "'a','b'",
  " a , b ",
  "a,,b",
  ",,",
  ",\n,",
  "a,\n1,",
  ",a\n,1",
  "﻿a,b\n1,2",
  "a,b\n\n1,2",
  "a,b\n\n\n1,2\n",
  'a,b\n""\n1,2',
  "a,b\n \n1,2",
  "a,b\n\t\n1,2",
  "a,b\n1,2,3",
  "a,b,c\n1,2",
  "a;b;c\n1;2;3",
  "a\tb\tc",
  "a|b\nc|d",
  "a||b\n1||2",
  "a||b\n1|2",
  "x".repeat(5000) + ",y",
  "a,b\n" + "1,2\n".repeat(500),
  '"a""b""c",d',
  '"a""",b',
  '""a,b',
  '"",',
  '""\n""',
  'a,"b""\nc"',
  "é,ü\n✓,😀",
  "a\u0000b,c",
  'key,value\n"multi\nline\n\nfield",x',
  "a,b,c\n1,2,3\n4,5,6\n",
  "\n\na,b",
  "a,b\n\n",
]

const delimiters = [",", ";", "\t", "|", "||"]

function optionMatrix(): ParseCSVOptions[] {
  const matrix: ParseCSVOptions[] = []
  for (const delimiter of delimiters) {
    for (const bom of [false, true]) {
      for (const skip_empty_lines of [false, true]) {
        for (const relax_column_count of [false, true]) {
          for (const relax_quotes of [false, true]) {
            matrix.push({
              delimiter,
              bom,
              skip_empty_lines,
              relax_column_count,
              relax_quotes,
            })
          }
        }
      }
    }
  }
  return matrix
}

describe("parseCSV differential vs csv-parse - fixed corpus", () => {
  const matrix = optionMatrix()
  for (const input of corpus) {
    it(JSON.stringify(input.slice(0, 40)), () => {
      for (const options of matrix) {
        compare(input, options)
      }
    })
  }
})

// Simple deterministic PRNG (mulberry32) for reproducible fuzzing
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe("parseCSV differential vs csv-parse - seeded fuzz", () => {
  const rand = mulberry32(42)
  const alphabet = ["a", "b", "1", '"', ",", ";", "\n", "\r", " ", "\t", "|"]
  const fuzzDelimiters = [",", ";", "||"]

  for (let i = 0; i < 300; i++) {
    it(`fuzz case ${i}`, () => {
      const length = Math.floor(rand() * 120)
      let input = ""
      for (let j = 0; j < length; j++) {
        input += alphabet[Math.floor(rand() * alphabet.length)]
      }
      const options: ParseCSVOptions = {
        delimiter: fuzzDelimiters[Math.floor(rand() * fuzzDelimiters.length)],
        bom: rand() < 0.5,
        skip_empty_lines: rand() < 0.5,
        relax_column_count: rand() < 0.5,
        relax_quotes: rand() < 0.5,
      }
      compare(input, options)
    })
  }
})
