import React from "react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../components/ui/hover-card"
import { FilterClause, clauseToPseudoSql } from "@/filterDescription"
import { cn } from "@/lib/utils"

interface FilterExplanationProps {
  filteredCount: number
  totalCount: number
  clauses: FilterClause[]
}

const badgeStyles: Record<FilterClause["kind"], string> = {
  include: "bg-green-100 text-green-800",
  exclude: "bg-red-100 text-red-800",
  search: "bg-blue-100 text-blue-800",
  function: "bg-purple-100 text-purple-800",
}

const badgeLabels: Record<FilterClause["kind"], string> = {
  include: "keep",
  exclude: "hide",
  search: "search",
  function: "function",
}

const FilterExplanation: React.FC<FilterExplanationProps> = ({
  filteredCount,
  totalCount,
  clauses,
}) => {
  const percentage =
    totalCount > 0 ? Math.round((filteredCount / totalCount) * 100) : null
  const hasFacetClause = clauses.some(
    (c) => c.kind === "include" || c.kind === "exclude",
  )
  const hasSearchClause = clauses.some((c) => c.kind === "search")

  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <span
          data-testid="filterExplanationTrigger"
          className="cursor-help underline decoration-dotted decoration-gray-400 underline-offset-2"
        >
          {filteredCount.toLocaleString()} filtered
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        className="w-auto max-w-lg text-sm font-normal"
        data-testid="filterExplanationCard"
      >
        <div className="mb-2 font-medium">
          {filteredCount.toLocaleString()} of {totalCount.toLocaleString()} rows
          match
          {percentage !== null && ` (${percentage}%)`}
        </div>
        <div className="flex flex-col gap-1.5">
          {clauses.map((clause, i) => (
            <div key={i} className="flex flex-row items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 inline-block w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-xs",
                  badgeStyles[clause.kind],
                )}
              >
                {badgeLabels[clause.kind]}
              </span>
              <span className="min-w-0">
                <code className="font-mono text-xs break-words">
                  {clauseToPseudoSql(clause)}
                </code>
                {clause.kind === "function" && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-gray-100 p-2 font-mono text-xs whitespace-pre-wrap">
                    {clause.code}
                  </pre>
                )}
              </span>
            </div>
          ))}
        </div>
        {(hasFacetClause || hasSearchClause) && (
          <div className="mt-3 border-t border-gray-200 pt-2 text-xs text-gray-500">
            {hasFacetClause && (
              <div>
                Keep/hide: exact match per column; array cells match if any
                element matches; IS EMPTY covers null, undefined and empty
                values.
              </div>
            )}
            {hasSearchClause && (
              <div>
                Search: case-sensitive substring match
                {clauses.some((c) => c.kind === "search" && c.column === null)
                  ? " across all columns"
                  : ""}
                .
              </div>
            )}
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}

export default FilterExplanation
