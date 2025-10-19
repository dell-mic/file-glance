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

function applyTransformer(
  transformerCode: string,
  columnIndex: number,
  header: string,
  data: any[],
) {
  const { transformer, error } = compileTransformerCode(transformerCode)

  if (transformer) {
    const sampleResults = data.map((value, index) => {
      let result
      let error

      try {
        result = transformer.apply({}, [
          value,
          columnIndex,
          index,
          header,
          value, // TODO: How to pass actual originalValue?
        ])
      } catch (err: any) {
        error = err.toString()
      }

      return {
        value,
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
