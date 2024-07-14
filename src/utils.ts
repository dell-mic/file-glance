import * as jschardet from "jschardet"

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
