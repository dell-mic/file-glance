import { expect, describe, it } from "bun:test"

import { addOrRemove } from "../../src/utils"

describe("addOrRemove", () => {
  it("adds item if not present", () => {
    const arr = [1, 2, 3]
    const result = addOrRemove(arr, 4)
    expect(result).toEqual([1, 2, 3, 4])
  })

  it("removes item if present", () => {
    const arr = [1, 2, 3]
    const result = addOrRemove(arr, 2)
    expect(result).toEqual([1, 3])
  })

  it("does not mutate original array", () => {
    const arr = [1, 2, 3]
    addOrRemove(arr, 2)
    expect(arr).toEqual([1, 2, 3])
  })

  it("works with strings", () => {
    const arr = ["a", "b"]
    expect(addOrRemove(arr, "c")).toEqual(["a", "b", "c"])
    expect(addOrRemove(arr, "a")).toEqual(["b"])
  })

  it("works with objects by reference", () => {
    const obj = { x: 1 }
    const arr = [obj]
    expect(addOrRemove(arr, obj)).toEqual([])
    expect(addOrRemove(arr, { x: 1 })).toEqual([])
  })

  it("works with objects comparing object contents", () => {
    const arr = [{ x: 1 }]
    // Different object with same content
    const anotherObj = { x: 1 }

    // Should remove, since contents are equal
    const result = addOrRemove(arr, anotherObj)
    expect(result).toEqual([])

    // Add a new object with different content
    const arr2 = [{ x: 1 }]
    const result2 = addOrRemove(arr2, { x: 2 })
    expect(result2).toEqual([{ x: 1 }, { x: 2 }])
  })
})
