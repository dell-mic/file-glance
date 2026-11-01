import { compileTransformerCode } from "@/utils"

addEventListener("message", async (event: MessageEvent<ValidationInput>) => {
  //   console.log("event in worker", event)
  const { transformerCode, columnIndex, header, data } = event.data
  const validationResult = applyTransformer(
    transformerCode,
    columnIndex,
    header,
    data,
  )
  postMessage(validationResult)
})

export function applyTransformer(
  transformerCode: string,
  columnIndex: number,
  header: string,
  data: any[],
) {
  const { transformer, error } = compileTransformerCode(transformerCode)

  if (transformer) {
    const sampleResults = data.map((item, index) => {
      let result
      let error

      try {
        result = transformer.apply({}, [
          item.value,
          columnIndex,
          index,
          header,
          item.value,
          item.preTransformValue,
        ])
      } catch (err: any) {
        error = err.toString()
      }

      // A function result is either a mistake or partial code (e.g. while AI
      // output is still streaming in); it also can't be structured-cloned,
      // which would make the postMessage below throw.
      if (typeof result === "function") {
        result = undefined
        error = "Transformer returned a function — did you forget to call it?"
      }

      return {
        value: item.value,
        result,
        error,
      }
    })

    return {
      compilationError: null,
      sampleResults: sampleResults,
    }
  } else if (error) {
    return {
      compilationError: error,
      sampleResults: [],
    }
  } else {
    throw "This should never happen: Should either get compiled transformer or error!"
  }
}

interface ValidationInput {
  transformerCode: string
  columnIndex: number
  header: string
  data: any[]
}
