import { expect, describe, it } from "bun:test"

import {
  FilterClause,
  clauseToPseudoSql,
  describeFilters,
} from "@/filterDescription"

const header = ["country", "city", "status"]

describe("describeFilters", () => {
  it("returns no clauses when nothing is filtered", () => {
    expect(describeFilters(header, [], "", null)).toEqual([])
  })

  it("describes a single include filter", () => {
    const clauses = describeFilters(
      header,
      [{ columnIndex: 0, filterValues: [{ value: "DE", included: true }] }],
      "",
      null,
    )
    expect(clauses).toEqual([
      { kind: "include", column: "country", values: ["DE"] },
    ])
  })

  it("keeps OR-ed values of one column in a single clause", () => {
    const clauses = describeFilters(
      header,
      [
        {
          columnIndex: 0,
          filterValues: [
            { value: "DE", included: true },
            { value: "FR", included: true },
          ],
        },
      ],
      "",
      null,
    )
    expect(clauses).toEqual([
      { kind: "include", column: "country", values: ["DE", "FR"] },
    ])
  })

  it("splits mixed include/exclude values of one column into two clauses", () => {
    const clauses = describeFilters(
      header,
      [
        {
          columnIndex: 0,
          filterValues: [
            { value: "DE", included: true },
            { value: "FR", included: false },
          ],
        },
      ],
      "",
      null,
    )
    expect(clauses).toEqual([
      { kind: "include", column: "country", values: ["DE"] },
      { kind: "exclude", column: "country", values: ["FR"] },
    ])
  })

  it("emits one clause per filtered column (AND semantics)", () => {
    const clauses = describeFilters(
      header,
      [
        { columnIndex: 0, filterValues: [{ value: "DE", included: true }] },
        { columnIndex: 1, filterValues: [{ value: "Berlin", included: true }] },
      ],
      "",
      null,
    )
    expect(clauses).toEqual([
      { kind: "include", column: "country", values: ["DE"] },
      { kind: "include", column: "city", values: ["Berlin"] },
    ])
  })

  it("falls back to col_XX naming for unknown column indexes", () => {
    const clauses = describeFilters(
      header,
      [{ columnIndex: 5, filterValues: [{ value: "x", included: true }] }],
      "",
      null,
    )
    expect(clauses).toEqual([
      { kind: "include", column: "col_06", values: ["x"] },
    ])
  })

  it("describes a global search", () => {
    expect(describeFilters(header, [], "foo", null)).toEqual([
      { kind: "search", column: null, term: "foo" },
    ])
  })

  it("describes a column-scoped search", () => {
    expect(describeFilters(header, [], "city:ber", null)).toEqual([
      { kind: "search", column: "city", term: "ber" },
    ])
  })

  it("treats search as global when the prefix is not a column name", () => {
    expect(describeFilters(header, [], "unknown:ber", null)).toEqual([
      { kind: "search", column: null, term: "unknown:ber" },
    ])
  })

  it("keeps colons in the term of a column-scoped search", () => {
    expect(describeFilters(header, [], "city:a:b", null)).toEqual([
      { kind: "search", column: "city", term: "a:b" },
    ])
  })

  it("describes an applied filter function", () => {
    expect(describeFilters(header, [], "", "return true")).toEqual([
      { kind: "function", code: "return true" },
    ])
  })

  it("combines all filter sources", () => {
    const clauses = describeFilters(
      header,
      [
        {
          columnIndex: 0,
          filterValues: [
            { value: "DE", included: true },
            { value: "FR", included: false },
          ],
        },
      ],
      "city:ber",
      "return rowIndex < 100",
    )
    expect(clauses).toEqual([
      { kind: "include", column: "country", values: ["DE"] },
      { kind: "exclude", column: "country", values: ["FR"] },
      { kind: "search", column: "city", term: "ber" },
      { kind: "function", code: "return rowIndex < 100" },
    ])
  })
})

describe("clauseToPseudoSql", () => {
  it("renders single-value include as equality", () => {
    const clause: FilterClause = {
      kind: "include",
      column: "country",
      values: ["DE"],
    }
    expect(clauseToPseudoSql(clause)).toBe("country = 'DE'")
  })

  it("renders multi-value include as IN", () => {
    const clause: FilterClause = {
      kind: "include",
      column: "country",
      values: ["DE", "FR"],
    }
    expect(clauseToPseudoSql(clause)).toBe("country IN ('DE', 'FR')")
  })

  it("renders empty-value include as IS EMPTY", () => {
    const clause: FilterClause = {
      kind: "include",
      column: "city",
      values: [""],
    }
    expect(clauseToPseudoSql(clause)).toBe("city IS EMPTY")
  })

  it("renders mixed include with empty value as OR group", () => {
    const clause: FilterClause = {
      kind: "include",
      column: "city",
      values: ["Berlin", ""],
    }
    expect(clauseToPseudoSql(clause)).toBe("(city = 'Berlin' OR city IS EMPTY)")
  })

  it("renders single-value exclude as positive match (hide carries the negation)", () => {
    const clause: FilterClause = {
      kind: "exclude",
      column: "status",
      values: ["archived"],
    }
    expect(clauseToPseudoSql(clause)).toBe("status = 'archived'")
  })

  it("renders multi-value exclude as IN", () => {
    const clause: FilterClause = {
      kind: "exclude",
      column: "status",
      values: ["archived", "deleted"],
    }
    expect(clauseToPseudoSql(clause)).toBe("status IN ('archived', 'deleted')")
  })

  it("renders empty-value exclude as IS EMPTY", () => {
    const clause: FilterClause = {
      kind: "exclude",
      column: "city",
      values: [""],
    }
    expect(clauseToPseudoSql(clause)).toBe("city IS EMPTY")
  })

  it("renders mixed exclude with empty value as OR group", () => {
    const clause: FilterClause = {
      kind: "exclude",
      column: "city",
      values: ["Berlin", ""],
    }
    expect(clauseToPseudoSql(clause)).toBe("(city = 'Berlin' OR city IS EMPTY)")
  })

  it("renders global search with * placeholder", () => {
    const clause: FilterClause = { kind: "search", column: null, term: "foo" }
    expect(clauseToPseudoSql(clause)).toBe("* CONTAINS 'foo'")
  })

  it("renders column search", () => {
    const clause: FilterClause = { kind: "search", column: "city", term: "ber" }
    expect(clauseToPseudoSql(clause)).toBe("city CONTAINS 'ber'")
  })

  it("renders the function clause", () => {
    const clause: FilterClause = { kind: "function", code: "return true" }
    expect(clauseToPseudoSql(clause)).toBe("matches custom JavaScript filter")
  })

  it("escapes single quotes in values", () => {
    const clause: FilterClause = {
      kind: "include",
      column: "name",
      values: ["O'Brien"],
    }
    expect(clauseToPseudoSql(clause)).toBe("name = 'O''Brien'")
  })
})
