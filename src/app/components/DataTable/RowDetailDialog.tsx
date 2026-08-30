import React, { useEffect } from "react"

import {
  ArrowUpIcon,
  ArrowDownIcon,
  ClipboardDocumentCheckIcon,
} from "@heroicons/react/20/solid"

import { Modal } from "@/components/ui/Modal"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { useToast } from "@/hooks/use-toast"
import {
  rowToJson,
  rowToKeyValuePairs,
  rowToTsv,
  valueAsStringFormatted,
  valueTypeName,
} from "@/utils"

interface RowDetailDialogProps {
  open: boolean
  headerRow: string[]
  row: any[]
  /** 0-based index within the data rows (header excluded) */
  rowIndex: number
  totalRows: number
  onClose: () => void
  onNavigate: (delta: -1 | 1) => void
}

const RowDetailDialog: React.FC<RowDetailDialogProps> = ({
  open,
  headerRow,
  row,
  rowIndex,
  totalRows,
  onClose,
  onNavigate,
}) => {
  const { toast } = useToast()

  // ArrowUp/Down navigation while the dialog is open (Modal only handles Escape)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "ArrowUp" && rowIndex > 0) {
        e.preventDefault()
        onNavigate(-1)
      } else if (e.key === "ArrowDown" && rowIndex < totalRows - 1) {
        e.preventDefault()
        onNavigate(1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, rowIndex, totalRows, onNavigate])

  const copyValue = async (value: any) => {
    await navigator.clipboard.writeText("" + value)
    toast({ title: "Value copied to clipboard" })
  }

  const copyRow = async (format: "tsv" | "json" | "kv") => {
    const text =
      format === "tsv"
        ? rowToTsv(row)
        : format === "json"
          ? rowToJson(headerRow, row)
          : rowToKeyValuePairs(headerRow, row)
    await navigator.clipboard.writeText(text)
    toast({
      title: "Row values copied to clipboard",
      description:
        format === "tsv"
          ? "as tab separated"
          : format === "json"
            ? "as JSON"
            : "as key value pairs",
    })
  }

  return (
    <Modal id="rowDetailDialog" open={open} onClose={onClose}>
      <div data-testid="rowDetailDialog" className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl text-gray-700">
            Row {rowIndex + 1}
            <span className="text-base text-gray-400 font-normal">
              {" "}
              of {totalRows.toLocaleString()}
            </span>
          </h2>
          <div className="flex items-center gap-1">
            <Button
              data-testid="btnRowDetailPrev"
              variant="ghost"
              size="icon"
              disabled={rowIndex <= 0}
              title="Previous row (↑)"
              onPointerDown={() => onNavigate(-1)}
            >
              <ArrowUpIcon className="size-4" />
            </Button>
            <Button
              data-testid="btnRowDetailNext"
              variant="ghost"
              size="icon"
              disabled={rowIndex >= totalRows - 1}
              title="Next row (↓)"
              onPointerDown={() => onNavigate(1)}
            >
              <ArrowDownIcon className="size-4" />
            </Button>
          </div>
        </div>

        {/* Form-like layout: label on the left, value on the same line */}
        <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {headerRow.map((header, columnIndex) => {
            const value = row[columnIndex]
            const formatted = valueAsStringFormatted(value)
            const isEmpty = !formatted
            return (
              <div
                key={columnIndex}
                data-testid={`rowDetailField_${columnIndex}_${header}`}
                className="group grid grid-cols-[11rem_1fr] gap-4 border-b border-gray-100 py-1.5 last:border-b-0 even:bg-gray-50/60"
              >
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-gray-600 break-all">
                    {header}
                  </span>
                  <span className="font-mono text-[0.65rem] text-gray-400 shrink-0">
                    {valueTypeName(value)}
                  </span>
                </div>
                <div
                  data-testid={`rowDetailCopy_${columnIndex}_${header}`}
                  className="flex items-start gap-1 cursor-pointer"
                  title="Click to copy value"
                  onPointerDown={() => copyValue(value)}
                >
                  <div
                    className={`text-base whitespace-pre-wrap break-all ${
                      isEmpty ? "font-mono text-sm text-gray-400" : ""
                    }`}
                  >
                    {isEmpty ? "empty" : formatted}
                  </div>
                  <ClipboardDocumentCheckIcon className="invisible group-hover:visible text-gray-400 shrink-0 size-3.5 translate-y-[5px]" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Button
            data-testid="btnRowCopyTsv"
            variant="outline"
            size="sm"
            onPointerDown={() => copyRow("tsv")}
          >
            Copy row as TSV (for spreadsheets)
          </Button>
          <Button
            data-testid="btnRowCopyJson"
            variant="outline"
            size="sm"
            onPointerDown={() => copyRow("json")}
          >
            Copy row as JSON
          </Button>
          <Button
            data-testid="btnRowCopyKv"
            variant="outline"
            size="sm"
            onPointerDown={() => copyRow("kv")}
          >
            Copy row as Key: Value
          </Button>
          <span className="ml-auto text-xs text-gray-400 inline-flex items-center gap-1">
            <Kbd>
              <ArrowUpIcon className="size-3 inline-block" />
            </Kbd>
            <Kbd>
              <ArrowDownIcon className="size-3 inline-block" />
            </Kbd>
            navigate · <Kbd>Esc</Kbd> close
          </span>
        </div>
      </div>
    </Modal>
  )
}

export default RowDetailDialog
