import * as jschardet from "jschardet"
import { maxBy, set, uniq, isEqual } from "lodash-es"

// Cache a default NumberFormat instance for repeated use instead of using toLocaleString(): https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/toLocaleString
const defaultNumberFormatter = new Intl.NumberFormat()

export function valueAsStringFormatted(v: any): string {
  const valueAsStringUnformatted = "" + v

  // Convert false,0 to string, but null/undefined to empty string
  if (v === "" || v === null || v === undefined) {
    return ""
  } else if (typeof v === "number") {
    // Do only format large numbers / long floats but display e.g. years as is
    if (valueAsStringUnformatted.length > 4) {
      return defaultNumberFormatter.format(v)
    } else {
      return valueAsStringUnformatted
    }
  } else if (v instanceof Date) {
    return v.toISOString()
  } else {
    return valueAsStringUnformatted
  }
}

export function valueAsString(v: any): string {
  return "" + v
}

export function valueAsStringSimplified(v: any): string {
  if (v === "" || v === null || v === undefined) {
    return ""
  } else {
    return valueAsString(v)
  }
}

// Proxy wrapper for each row to allow access by header name
export function createRowProxy(row: any[], headers: string[]) {
  return new Proxy(row, {
    get(target, prop) {
      // console.log(target, prop)
      if (typeof prop === "string") {
        const idx = headers.indexOf(prop)
        if (idx !== -1) return target[idx]
      }
      return target[prop as any]
    },
  })
}

export function trackEvent(category: string, event: string) {
  if (window?._paq) {
    window._paq.push(["trackEvent", category, event])
  }
}

export function jsonToTable(jsonArray: Array<any>): {
  data: any[][]
  headerRow: string[]
} {
  // Helper function to flatten a nested object
  function flattenObject(obj: any, prefix = "") {
    return Object.keys(obj).reduce((acc: any, k) => {
      const pre = prefix.length ? prefix + "." : ""
      if (
        typeof obj[k] === "object" &&
        obj[k] !== null &&
        !Array.isArray(obj[k])
      ) {
        Object.assign(acc, flattenObject(obj[k], pre + k))
      } else {
        acc[pre + k] = obj[k]
      }
      return acc
    }, {})
  }

  const flatArray = jsonArray.map((item) => flattenObject(item))

  const header = Array.from(
    new Set(flatArray.flatMap((item) => Object.keys(item))),
  )

  const rows = flatArray.map((item) => header.map((h) => item[h]))

  return { data: rows, headerRow: header }
}

export function tableToJson(data: any[][]) {
  const headerRow = data.shift()!
  const output = []
  for (const [, row] of data.entries()) {
    const rowAsObject = {}
    for (const [columnIndex, value] of row.entries()) {
      set(rowAsObject, headerRow[columnIndex], value)
    }
    output.push(rowAsObject)
  }
  return output
}

export const tryParseJSONObject = (jsonString: string): any => {
  try {
    const o = JSON.parse(jsonString)

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (o && typeof o === "object") {
      return o
    }
  } catch {}

  return false
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomElement(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getRandomIntNormal(min: number, max: number) {
  // Box-Muller transform for normal distribution
  let u = 0,
    v = 0
  while (u === 0) u = Math.random() // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random()
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  // Normalize to 0..1, then scale to min..max
  const mean = (min + max) / 2
  const stddev = (max - min) / 6 // 99.7% within min..max
  const value = Math.round(num * stddev + mean)
  return Math.max(min, Math.min(max, value))
}

export function generateSampleData(numRows: number): {
  data: any[]
  headerRow: string[]
} {
  const headerRow = [
    "ID",
    "Name",
    "Age",
    "Email",
    "Phone Number",
    "Country",
    "City",
    "Job Title",
    "Salary",
    "Happiness Score",
    "Favorite Emoji",
    "Date Joined",
    "Last Purchase Amount",
    "Favorite Color",
    "Has Pet",
    "Pet Type",
    "Number of Siblings",
    "Favorite Cuisine",
    "Notes",
  ]
  const firstNames = [
    "John",
    "Jane",
    "Emily",
    "Michael",
    "Alice",
    "Robert",
    "David",
    "Laura",
    "James",
    "Mary",
    "Chris",
    "Emma",
    "Matthew",
    "Olivia",
    "Daniel",
    "Sophia",
    "Andrew",
    "Sophia",
    "Logan",
    "Amelia",
    "Lucas",
    "Isabella",
    "James",
    "Evelyn",
    "Benjamin",
    "Ava",
    "Oliver",
    "Charlotte",
    "Alexander",
    "Amelia",
    "Jack",
    "Charlotte",
  ]
  const lastNames = [
    "Doe",
    "Smith",
    "Rogers",
    "Johnson",
    "Williams",
    "Brown",
    "Davis",
    "Wilson",
    "Anderson",
    "Martinez",
    "Lee",
    "Harris",
    "Clark",
    "Lewis",
    "Walker",
    "Young",
    "King",
    "Mitchell",
    "Phillips",
    "Campbell",
    "Mitchell",
    "Carter",
    "Parker",
    "Morris",
    "Roberts",
    "Scott",
    "Edwards",
    "Green",
    "Moore",
    "White",
    "Lee",
    "Harris",
  ]
  const countries = ["USA", "UK", "Canada", "Australia"]
  const countryCities: Record<string, string[]> = {
    USA: [
      "New York",
      "Chicago",
      "Los Angeles",
      "San Francisco",
      "Miami",
      "Boston",
      "Seattle",
      "Denver",
      "Houston",
    ],
    UK: ["London", "Manchester", "Edinburgh", "Liverpool", "Leeds"],
    Canada: ["Toronto", "Vancouver", "Calgary", "Ottawa", "Hamilton", "Quebec"],
    Australia: ["Sydney", "Melbourne", "Adelaide", "Brisbane", "Canberra"],
  }
  const jobTitles = [
    "Software Engineer",
    "Marketing Manager",
    "Data Analyst",
    "Project Manager",
    "Designer",
    "Teacher",
    "Engineer",
    "Accountant",
    "Manager",
    "Doctor",
    "Chef",
    "Writer",
    "Architect",
    "Artist",
    "Scientist",
    "Consultant",
    "Photographer",
    "Lawyer",
  ]
  const emojis = [
    "😊",
    "🎉",
    "❤️",
    "😎",
    "🔥",
    "⚙️",
    "🧬",
    "💻",
    "📊",
    "📋",
    "🔋",
    "🏗️",
    "✍️",
    "📸",
    "🍽️",
    "🔧",
    "📰",
  ]
  const colors = ["Blue", "Red", "Green", "Yellow", "Purple", "Orange", "Pink"]
  const cuisines = [
    "Italian",
    "Indian",
    "Chinese",
    "Mexican",
    "French",
    "Japanese",
    "Spanish",
  ]

  const data = []
  for (let i = 1; i <= numRows; i++) {
    const id = "" + i
    const name =
      getRandomElement(firstNames) + " " + getRandomElement(lastNames)
    const age = getRandomIntNormal(20, 50)
    const email = name.split(" ").join("").toLowerCase() + "@example.com"
    const phoneNumber = "555-" + getRandomInt(1000, 9999)
    const country = getRandomElement(countries)
    const city = getRandomElement(countryCities[country])
    const jobTitle = getRandomElement(jobTitles)
    const baseSalary = getRandomIntNormal(50000, 150000)
    // Adjust salary by country factor for some variance in charts
    const countrySalaryFactor: Record<string, number> = {
      USA: 1.4,
      UK: 0.8,
      Canada: 1.1,
      Australia: 1.2,
    }
    const salary = Math.round(baseSalary * (countrySalaryFactor[country] || 1))
    let happinessScore = getRandomInt(1, 5)
    if (happinessScore < 4) {
      happinessScore = getRandomInt(2, 5) // Slightly shifted
    }
    const favoriteEmoji = getRandomElement(emojis)
    const dateJoined = `${getRandomInt(2017, new Date().getFullYear() - 1)}-${getRandomInt(1, 12).toString().padStart(2, "0")}-${getRandomInt(1, 28).toString().padStart(2, "0")}`
    const lastPurchaseAmount = getRandomInt(0, 1000).toFixed(2)
    const favoriteColor = getRandomElement(colors)
    const hasPet = getRandomElement([true, false])
    const petType = "" // Simluate empty column
    let numberOfSiblings = getRandomInt(0, 4)
    if (numberOfSiblings > 2) {
      numberOfSiblings = getRandomInt(0, 4) // Slightly shifted
    }
    const favoriteCuisine = getRandomElement(cuisines)
    const note = getRandomElement([
      "",
      "",
      "",
      "Loves spicy food",
      "Works remotely",
      "Enjoys painting",
      "Frequent traveler",
      "Close to retirement",
    ])

    const notePrefix = getRandomElement(["Careful: ", "Hint: ", ""])

    data.push({
      id,
      name,
      age,
      email,
      phoneNumber,
      country,
      city,
      jobTitle,
      salary,
      happinessScore,
      favoriteEmoji,
      dateJoined,
      lastPurchaseAmount,
      favoriteColor,
      hasPet,
      petType,
      numberOfSiblings,
      favoriteCuisine,
      note: note ? notePrefix + note : note,
    })
  }
  return { data, headerRow }
}

export async function readFileToString(file: File): Promise<string> {
  return file.arrayBuffer().then((v) => {
    // @ts-ignore: ts does not know about Buffer coming from next.js polyfill
    const fileEncoding = jschardet.detect(Buffer.from(new Uint8Array(v)))
    console.log("file encoding: ", fileEncoding)
    const enc = new TextDecoder(fileEncoding?.encoding || "utf-8")
    return enc.decode(v)
  })
}

export function hasHeader(data: any[][]): boolean {
  if (data.length < 2) return true

  if (hasDuplicates(data[0])) return false

  const numRowsToCompare = Math.min(5, data.length - 1)

  // Check if value patterns from first row also occur in other rows (probably not header values then)
  for (const [headerIndex, headerValue] of data[0].entries()) {
    if (valueAsStringFormatted(headerValue).length) {
      for (const line of data.slice(1, numRowsToCompare)) {
        const rowValue = line[headerIndex]
        const headerPattern = normalizeString(headerValue)
        const valuePattern = normalizeString(valueAsStringFormatted(rowValue))
        // pattern > 3 equals meaningful pattern, ie. not just alpha numeric
        if (uniq(headerPattern).length > 3 && valuePattern === headerPattern) {
          return false
        }
        if (rowValue === headerValue) {
          return false // If the value is exactly the same, it's likely not a header
        }
      }
    }
  }

  function calculateAverageSimilarity(row: number, numRows: number): number {
    let totalDistance = 0

    // For single column/value comparisons do not exceed this limit to not get screwed by longer string length differences
    // This way 0 distances where values follow the exact same pattern get implicitly more weight
    const MaxDistance = 5
    for (let col = 0; col < data[0].length; col++) {
      let columnDistance = 0

      for (let r = row; r < row + numRows; r++) {
        // Compare distance on *patterns* such that e.g. number rows will have 0 distance, but >0 compared to header
        const distance = stringDistance(
          normalizeString(String(data[row][col])),
          normalizeString(String(data[r + 1][col])),
        )
        columnDistance += Math.min(distance, MaxDistance)
        // console.log(
        //   `Comparing '${data[row][col]}' vs '${data[r + 1][col]}': ${distance}`,
        // )
      }

      columnDistance /= numRows

      // console.log('col', col, 'columnDistance', columnDistance)

      totalDistance += columnDistance
    }

    return totalDistance / data[0].length
  }

  const averageDistanceFirstRow = calculateAverageSimilarity(
    0,
    numRowsToCompare,
  )

  // console.log("averageDistanceFirstRow", averageDistanceFirstRow)
  // console.log()

  const averageDistanceSecondRow = calculateAverageSimilarity(
    1,
    numRowsToCompare - 1,
  )
  // console.log("averageDistanceSecondRow", averageDistanceSecondRow)
  // console.log()

  // Return true if the distance between rows 2-5 is lower than the distance of the first row to the rest
  return averageDistanceSecondRow < averageDistanceFirstRow
}

/**
 * Levenshtein distance based on https://github.com/gustf/js-levenshtein as TypeScript
 * @param a
 * @param b
 * @returns
 */
function stringDistance(a: string, b: string): number {
  function _min(d0: number, d1: number, d2: number, bx: number, ay: number) {
    return d0 < d1 || d2 < d1
      ? d0 > d2
        ? d2 + 1
        : d0 + 1
      : bx === ay
        ? d1
        : d1 + 1
  }
  if (a === b) {
    return 0
  }

  if (a.length > b.length) {
    const tmp = a
    a = b
    b = tmp
  }

  let la = a.length
  let lb = b.length

  while (la > 0 && a.charCodeAt(la - 1) === b.charCodeAt(lb - 1)) {
    la--
    lb--
  }

  let offset = 0

  while (offset < la && a.charCodeAt(offset) === b.charCodeAt(offset)) {
    offset++
  }

  la -= offset
  lb -= offset

  if (la === 0 || lb < 3) {
    return lb
  }

  let x = 0
  let y
  let d0
  let d1
  let d2
  let d3
  let dd
  let dy
  let ay
  let bx0
  let bx1
  let bx2
  let bx3

  const vector = []

  for (y = 0; y < la; y++) {
    vector.push(y + 1)
    vector.push(a.charCodeAt(offset + y))
  }

  const len = vector.length - 1

  for (; x < lb - 3; ) {
    bx0 = b.charCodeAt(offset + (d0 = x))
    bx1 = b.charCodeAt(offset + (d1 = x + 1))
    bx2 = b.charCodeAt(offset + (d2 = x + 2))
    bx3 = b.charCodeAt(offset + (d3 = x + 3))
    dd = x += 4
    for (y = 0; y < len; y += 2) {
      dy = vector[y]
      ay = vector[y + 1]
      d0 = _min(dy, d0, d1, bx0, ay)
      d1 = _min(d0, d1, d2, bx1, ay)
      d2 = _min(d1, d2, d3, bx2, ay)
      dd = _min(d2, d3, dd, bx3, ay)
      vector[y] = dd
      d3 = d2
      d2 = d1
      d1 = d0
      d0 = dy
    }
  }

  for (; x < lb; ) {
    bx0 = b.charCodeAt(offset + (d0 = x))
    dd = ++x
    for (y = 0; y < len; y += 2) {
      dy = vector[y]
      vector[y] = dd = _min(dy, d0, dd, bx0, vector[y + 1])
      d0 = dy
    }
  }

  return dd!
}

export function normalizeString(input: string): string {
  return input
    .replace(/[A-Z]/g, "A") // Replace all uppercase letters with 'A'
    .replace(/[a-z]/g, "a") // Replace all lowercase letters with 'a'
    .replace(/[0-9]/g, "0") // Replace all digits with '0'
}

export const saveFile = async (blob: Blob, name: string) => {
  const a = document.createElement("a")
  a.download = name
  a.href = URL.createObjectURL(blob)
  a.addEventListener("click", () => {
    setTimeout(() => URL.revokeObjectURL(a.href), 10 * 1000)
  })
  a.click()
}

/**
 * Simple post processing to allow code snippets without explicit return statement.
 * Simulates behavior of language like scala where the last expression is the return value (in a very naively implemented manner, though)
 * @param inputCode
 * @returns
 */
export function postProcessCode(inputCode: string): string {
  let outputCode

  // Split into lines, trim each line
  const lines = inputCode.split("\n").map((line) => line.trim())

  // Remove empty lines at the start
  while (lines.length > 0 && lines[0] === "") {
    lines.shift()
  }
  // Remove empty lines at the end
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop()
  }

  outputCode = lines.join("\n")

  // Check if the query contains a return statement (not in a comment)
  const codeWithoutComments = lines
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
  const hasReturn = /(^|[^\w])return\b/.test(codeWithoutComments)
  if (!hasReturn && lines.length > 0) {
    // Add 'return ' to the last line if missing
    lines[lines.length - 1] = "return " + lines[lines.length - 1]
    outputCode = lines.join("\n")
  }

  return outputCode
}

export function detectDelimiter(input: string): string | null {
  const supportedDelimiters = [",", "\t", ";", "|"] // Note: Order matters in case of equal occurrence count!
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
  // console.log(counts)
  const maxEntry = maxBy(
    Object.entries(counts).filter((c) => delimItersToTest.includes(c[0])),
    (_) => _[1],
  )!
  // console.log("detected delimiter: ", maxEntry)

  return maxEntry ? maxEntry[0] : null
}

function hasDuplicates(arr: any[]): boolean {
  arr = arr.filter(Boolean)
  return new Set(arr).size !== arr.length
}

export function generateHeaderRow(
  length: number,
  existing?: string[],
): string[] {
  return Array.from(Array(length).keys()).map(
    (i) =>
      existing && existing[i]
        ? existing[i]
        : "col_" + `${i + 1}`.padStart(2, "0"), // Fill empty headers
  )
}

export async function compressString(
  input: string,
  format: CompressionFormat = "gzip",
): Promise<Response> {
  const encoder = new TextEncoder()
  const uint8Input = encoder.encode(input)

  const compressionStream = new CompressionStream(format)
  const writer = compressionStream.writable.getWriter()
  writer.write(uint8Input)
  writer.close()

  return new Response(compressionStream.readable)
}

export async function decompressString(
  compressedData: ArrayBuffer,
  format: CompressionFormat = "gzip",
): Promise<string> {
  const decompressionStream = new DecompressionStream(format)
  const stream = new Response(compressedData).body!.pipeThrough(
    decompressionStream,
  )
  const decompressedArrayBuffer = await new Response(stream).arrayBuffer()

  const decoder = new TextDecoder()
  return decoder.decode(decompressedArrayBuffer)
}

export async function stringToBase64Gzipped(
  input: string,
  format: CompressionFormat = "gzip",
): Promise<string> {
  const arrayBuffer = await (await compressString(input, format)).arrayBuffer()
  return arrayBufferToBase64(arrayBuffer)
}

export async function base64GzippedToString(
  base64Data: string,
  format: CompressionFormat = "gzip",
): Promise<string> {
  const arrayBuffer = base64ToArrayBuffer(base64Data)
  return await decompressString(arrayBuffer, format)
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const byteArray = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    byteArray[i] = binaryString.charCodeAt(i)
  }
  return byteArray.buffer
}

export function tryBase64Decode(str: string): string | null {
  // Quick regex check for valid Base64 characters and length multiple of 4
  const notBase64 = /[^A-Z0-9+/=]/i
  if (!str || str.length % 4 !== 0 || notBase64.test(str)) {
    return null
  }

  try {
    const decoded = fromBase64(str)
    return decoded
  } catch (_) {
    return null
  }
}

function fromBase64(base64: string): string {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder().decode(bytes) // UTF-8 decode
}

export function compileTransformerCode(code: string): {
  transformer: Function | null
  error: string | null
} {
  let transformer = null
  let error = null
  try {
    transformer = new Function(
      "value",
      "columnIndex",
      "rowIndex",
      "headerName",
      "allRows",
      "originalValue",
      postProcessCode(code),
    )
  } catch (err: any) {
    error = err.toString()
  }

  return {
    transformer,
    error,
  }
}

export function compileFilterCode(
  code: string,
  sampleRow: any[],
): {
  filter: Function | null
  error: string | null
} {
  let filter = null
  let error = null
  try {
    filter = new Function("row", "rowIndex", "cache", postProcessCode(code))
  } catch (err: any) {
    error = err.toString()
  }

  if (!error && filter) {
    try {
      const result = applyFilterFunction(sampleRow, 0, filter, {})
      if (typeof result !== "boolean") {
        error = "Filter function must return a boolean value"
        filter = null
      }
    } catch (err: any) {
      error = err.toString()
      filter = null
    }
  }

  return {
    filter,
    error,
  }
}

export function applyFilterFunction(
  row: any[],
  rowIndex: number,
  filterFunction: Function,
  cache: Record<string, any>,
): boolean {
  try {
    return filterFunction(row, rowIndex, cache)
  } catch (error) {
    console.error("Error applying filter function:", error)
    return false // If the filter function throws an error, we assume the row does not match. Can happen if the function passes validation on first row, but errors on others.
  }
}

export function generateSyntheticFile(data: string, name: string): File {
  const blob = new Blob([data], { type: "text/plain" })
  return new File([blob], name, {
    lastModified: new Date().getTime(),
  })
}

export function getMaxStringLength(input: string[]) {
  if (!input || !input.length) {
    return 0
  }

  const maxChecks = 500
  let maxLength = 0
  const arrayLength = input.length

  if (arrayLength <= maxChecks) {
    for (const str of input) {
      if (str?.length) {
        maxLength = Math.max(maxLength, str.length)
      }
    }
    return maxLength
  } else {
    // Loop over at most _maxChecks_ elements distributed across the array
    const step = Math.ceil(arrayLength / maxChecks)

    for (let i = 0; i < arrayLength; i += step) {
      maxLength = Math.max(maxLength, input[i].length)
    }

    return maxLength
  }
}
/**
 * Helper function to pick array property from json (if not root is already array)
 * Heuristic: Take the top level property with the most entries
 * @param json
 * @returns
 */
export function findArrayProp(json: any): any[] | null {
  if (Array.isArray(json)) {
    return json
  }

  let arrayProp = null
  for (const key in json) {
    if (json.hasOwnProperty(key)) {
      const value = json[key]
      const existingCandidateLength = arrayProp ? json[arrayProp]?.length : 0
      if (Array.isArray(value) && value.length > existingCandidateLength) {
        arrayProp = key
      }
    }
  }

  // console.log("array property used: ", arrayProp)

  return arrayProp ? json[arrayProp] : null
}

/**
 * Toggle item in array, if it exists remove it, otherwise add it
 * Uses deep equality for objects.
 */
export function addOrRemove(arr: any[], item: any): any[] {
  const index = arr.findIndex((i) =>
    typeof i === "object" &&
    typeof item === "object" &&
    i !== null &&
    item !== null
      ? isEqual(i, item)
      : i === item,
  )
  if (index !== -1) {
    return arr.filter((_, idx) => idx !== index)
  }
  return [...arr, item]
}

export function formatBytes(bytes: number, dp = 1): string {
  const thresh = 1000

  if (Math.abs(bytes) < thresh) {
    return bytes + " B"
  }

  const units = ["kB", "MB", "GB", "TB"]
  let u = -1
  const r = 10 ** dp

  do {
    bytes /= thresh
    ++u
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  )

  return bytes.toFixed(dp) + " " + units[u]
}

/**
 * Clean and shorten a string to be a valid Excel worksheet name.
 * - Max 31 characters
 * - Cannot contain: / \ ? * : [ ]
 * - Removes other special characters except space, _, -, ()
 * - Trims whitespace
 */
export function cleanWorksheetName(name: string): string {
  const MaxLength = 31

  let cleaned = name
    .replace(/[\/\?\*:\[\]]/g, "") // Remove Excel-forbidden chars
    .replace(/[^\w\s\-\(\)_]/g, "") // Remove all except word, space, -, _, ()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim()
  // Truncate to 31 chars
  if (cleaned.length > MaxLength) {
    cleaned = cleaned.slice(0, MaxLength)
  }
  // If empty, use default
  if (!cleaned) {
    cleaned = "Sheet1"
  }
  return cleaned
}

/**
 * Clean and shorten a string to be a valid filename for Windows, macOS, and Linux.
 * - Removes forbidden characters: \\ / : * ? " < > | (Windows), and : (macOS)
 * - Removes other special characters except space, _, -, . ()
 * - Trims whitespace
 * - Max length: 255 bytes (safe for all major OSes)
 */
export function cleanForFileName(name: string): string {
  // Remove forbidden characters for Windows and macOS
  let cleaned = name
    .replace(/[\\/:*?"<>|]/g, "") // Windows forbidden
    .replace(/:/g, "") // macOS forbidden (already included above, but explicit)
    .replace(/[^\w\s\-\.\(\)_]/g, "") // Remove all except word, space, -, _, ., ()
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim()
  // Truncate to 255 bytes (not chars)
  const encoder = new TextEncoder()
  while (encoder.encode(cleaned).length > 255) {
    cleaned = cleaned.slice(0, -1)
  }
  if (!cleaned) {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    cleaned = `fileglance_export_${yyyy}${mm}${dd}`
  }
  return cleaned
}

const LinkRegex = /^(https?:\/\/)/i

export function isLink(input: string): boolean {
  return typeof input === "string" && LinkRegex.test(input)
}

export function getScrollbarWidth(): number {
  // Creating invisible container
  const outer = document.createElement("div")
  outer.style.visibility = "hidden"
  outer.style.overflow = "scroll" // forcing scrollbar to appear
  document.body.appendChild(outer)

  // Creating inner element and placing it in the container
  const inner = document.createElement("div")
  outer.appendChild(inner)

  // Calculating difference between container's full width and the child width
  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth

  // Removing temporary elements from the DOM
  outer.parentNode!.removeChild(outer)

  return scrollbarWidth
}

export function isNonEmptyArray(v: any): boolean {
  return Array.isArray(v) && v.length > 0
}
export function isEmptyArray(v: any): boolean {
  return Array.isArray(v) && v.length === 0
}
