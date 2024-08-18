import * as jschardet from "jschardet"
import { set } from "lodash"

export function valueAsString(v: any): string {
  // Convert false,0 to string, but null/undefined to empty string
  if (v === "" || v === null || v === undefined) {
    return ""
  } else {
    return "" + v
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

  // Flatten all objects in the JSON array
  const flatArray = jsonArray.map((item) => flattenObject(item))

  const header = Array.from(
    new Set(flatArray.flatMap((item) => Object.keys(item))),
  )

  const rows = flatArray.map((item) => header.map((h) => item[h] ?? ""))

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
    var o = JSON.parse(jsonString)

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns null, and typeof null === "object",
    // so we must check for that, too. Thankfully, null is falsey, so this suffices:
    if (o && typeof o === "object") {
      return o
    }
  } catch (e) {}

  return false
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomElement(arr: any[]) {
  return arr[Math.floor(Math.random() * arr.length)]
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
  const cities = [
    "New York",
    "London",
    "Toronto",
    "Sydney",
    "Chicago",
    "Los Angeles",
    "San Francisco",
    "Manchester",
    "Vancouver",
    "Melbourne",
    "Miami",
    "Calgary",
    "Edinburgh",
    "Boston",
    "Ottawa",
    "Adelaide",
    "Seattle",
    "Liverpool",
    "Hamilton",
    "Brisbane",
    "Denver",
    "Quebec",
    "Leeds",
    "Canberra",
    "Houston",
  ]
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
    const id = i
    const name =
      getRandomElement(firstNames) + " " + getRandomElement(lastNames)
    const age = getRandomInt(20, 50)
    const email = name.split(" ").join("").toLowerCase() + "@example.com"
    const phoneNumber = "555-" + getRandomInt(1000, 9999)
    const country = getRandomElement(countries)
    const city = getRandomElement(cities)
    const jobTitle = getRandomElement(jobTitles)
    const salary = getRandomInt(50000, 150000)
    const happinessScore = getRandomInt(1, 5)
    const favoriteEmoji = getRandomElement(emojis)
    const dateJoined = `${getRandomInt(2017, new Date().getFullYear() - 1)}-${getRandomInt(1, 12).toString().padStart(2, "0")}-${getRandomInt(1, 28).toString().padStart(2, "0")}`
    const lastPurchaseAmount = getRandomInt(0, 1000).toFixed(2)
    const favoriteColor = getRandomElement(colors)
    const hasPet = getRandomElement([true, false])
    const petType = "" // Simluate empty column
    const numberOfSiblings = getRandomInt(0, 4)
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
    var enc = new TextDecoder(fileEncoding?.encoding || "utf-8")
    return enc.decode(v)
  })
}

export function hasHeader(data: any[][]): boolean {
  console.time("hasHeader")
  if (data.length < 2) return true

  const numRowsToCompare = Math.min(5, data.length - 1) // Compare with up to 5 rows or all remaining rows if less than 5.

  function calculateAverageSimilarity(row: number, numRows: number): number {
    let totalDistance = 0

    // For single column/value comparisons do not exceed this limit to not get screwed by longer string length differences
    // This way 0 distances where values follow the exact same pattern get implicilty more weight
    const MaxDistance = 1
    for (let col = 0; col < data[0].length; col++) {
      let columnDistance = 0

      for (let r = row; r < row + numRows; r++) {
        // Compare distance on *patterns* such that e.g. number rows will have 0 distance, but >0 compared to header
        const distance = stringDistance(
          normalizeString(String(data[row][col])),
          normalizeString(String(data[r + 1][col])),
        )
        columnDistance += Math.min(distance, MaxDistance)
        // console.log(`Comparing '${data[row][col].toString()}' vs '${data[r + 1][col].toString()}': ${distance}`)
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

  console.log("averageDistanceFirstRow", averageDistanceFirstRow)
  console.log()

  const averageDistanceSecondRow = calculateAverageSimilarity(
    1,
    numRowsToCompare - 1,
  )
  console.log("averageDistanceSecondRow", averageDistanceSecondRow)
  console.log()

  console.timeEnd("hasHeader")

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
    var tmp = a
    a = b
    b = tmp
  }

  var la = a.length
  var lb = b.length

  while (la > 0 && a.charCodeAt(la - 1) === b.charCodeAt(lb - 1)) {
    la--
    lb--
  }

  var offset = 0

  while (offset < la && a.charCodeAt(offset) === b.charCodeAt(offset)) {
    offset++
  }

  la -= offset
  lb -= offset

  if (la === 0 || lb < 3) {
    return lb
  }

  var x = 0
  var y
  var d0
  var d1
  var d2
  var d3
  var dd
  var dy
  var ay
  var bx0
  var bx1
  var bx2
  var bx3

  var vector = []

  for (y = 0; y < la; y++) {
    vector.push(y + 1)
    vector.push(a.charCodeAt(offset + y))
  }

  var len = vector.length - 1

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
  a.addEventListener("click", (e) => {
    setTimeout(() => URL.revokeObjectURL(a.href), 30 * 1000)
  })
  a.click()
}
