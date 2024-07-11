export function valueAsString(v: any): string {
  // Convert false,0 to string, but null/undefined to empty string
  if (v === "" || v === null || v === undefined) {
    return ""
  } else {
    return "" + v
  }
}
