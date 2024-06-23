import { sum } from "lodash"
import { ColumnInfos } from "./ValueInspector"

export const DataTable = (props: {
  headerRow: string[]
  rows: Array<Array<any>>
  columnValueCounts: ColumnInfos[]
  hiddenColumns: number[]
}) => {
  // console.log(rows)

  const columnWidths = props.columnValueCounts.map((cvc) =>
    estimateColumnWidthRem(cvc.valuesMaxLength),
  )
  const isWideTable = props.columnValueCounts.length > 9 // I.e. we expect horizontal scrolling => Apply width estimations, otherwise just use 100% of space
  const tableWidth = isWideTable ? `${sum(columnWidths)}rem` : "100%"
  const sColumnWidths =
    props.columnValueCounts.length > 9
      ? columnWidths.map((cw) => `${cw}rem`)
      : ""

  return (
    <div className="h-full overflow-x-auto border-separate border border-gray-300 rounded-md shadow-sm flex flex-col">
      <div style={{ scrollbarGutter: "stable", width: tableWidth }}>
        <div className="bg-gray-200 w-full sticky top-0">
          <table className="table-fixed w-full text-left">
            <thead className="">
              <tr className="">
                {props.headerRow.map((v: string, vi: number) => {
                  return props.hiddenColumns.includes(vi) ? null : (
                    <th
                      key={vi}
                      className="p-0.5 font-normal overflow-hidden overflow-ellipsis"
                      style={{
                        width: sColumnWidths[vi],
                      }}
                      title={v}
                    >
                      {v}
                    </th>
                  )
                })}
              </tr>
            </thead>
          </table>
        </div>
        <div className="flex-1 overflow-y-auto w-full">
          <table className="table-fixed w-full text-left">
            <tbody className="">
              {props.rows.map((r, i) => {
                return (
                  <tr key={i} className="even:bg-gray-100 odd:bg-white">
                    {r.map((v, vi) => {
                      if (props.hiddenColumns.includes(vi)) {
                        return null
                      } else {
                        // Convert false,0 to string
                        const valueAsString = "" + v
                        let valueCell
                        if (v) {
                          valueCell = valueAsString
                        } else {
                          if (v === "" || v === null || v === undefined) {
                            valueCell = (
                              <span className="text-gray-500 font-mono">
                                empty
                              </span>
                            )
                          } else {
                            valueCell = valueAsString
                          }
                        }
                        return (
                          <td
                            key={vi}
                            title={
                              valueAsString.length > 5
                                ? valueAsString
                                : undefined
                            }
                            className="p-0.5 text-xs overflow-hidden whitespace-nowrap text-ellipsis"
                            style={{
                              width: sColumnWidths[vi],
                            }}
                          >
                            {valueCell}
                          </td>
                        )
                      }
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function estimateColumnWidthRem(valueMaxLength: number): number {
  if (valueMaxLength < 5) {
    return 4
  } else if (valueMaxLength < 10) {
    return 8
  } else {
    return 12
  }
}
