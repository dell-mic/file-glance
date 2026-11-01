import { readFileSync } from "node:fs"
import { describe, expect, it } from "bun:test"
import { toDecoderLabel } from "@/utils"

// Every name the installed jschardet can return as detect().encoding:
// detector registry `name:` fields plus the special-cased returns in dist.
function jschardetOutputNames(): string[] {
  const dist = readFileSync(
    new URL(
      "../../node_modules/jschardet/dist/jschardet.esm.js",
      import.meta.url,
    ),
    "utf8",
  )
  const names = new Set<string>()
  for (const m of dist.matchAll(/\bname: "([^"]+)"/g)) names.add(m[1])
  for (const m of dist.matchAll(/encoding: "([^"]+)"/g)) names.add(m[1])
  return [...names]
}

describe("toDecoderLabel", () => {
  it("maps every possible jschardet output name to a supported TextDecoder label", () => {
    const names = jschardetOutputNames()
    expect(names.length).toBeGreaterThan(50)
    for (const name of names) {
      const label = toDecoderLabel(name)
      // must not throw: toDecoderLabel must never return an invalid label
      expect(() => new TextDecoder(label)).not.toThrow()
    }
  })

  it("maps names to their exact WHATWG equivalents", () => {
    expect(toDecoderLabel("utf-8-sig")).toBe("utf-8")
    expect(toDecoderLabel("cp437")).toBe("windows-1252")
    expect(toDecoderLabel("big5hkscs")).toBe("big5")
    expect(toDecoderLabel("cp932")).toBe("shift_jis")
    expect(toDecoderLabel("cp949")).toBe("euc-kr")
    expect(toDecoderLabel("euc_kr")).toBe("euc-kr")
    expect(toDecoderLabel("tis-620")).toBe("windows-874")
    expect(toDecoderLabel("utf-16-be")).toBe("utf-16be")
    expect(toDecoderLabel("mac-roman")).toBe("macintosh")
    expect(toDecoderLabel("mac-cyrillic")).toBe("x-mac-cyrillic")
  })

  it("falls back to utf-8 for unknown/unsupported encodings", () => {
    expect(toDecoderLabel("utf-7")).toBe("utf-8")
    expect(toDecoderLabel("utf-32")).toBe("utf-8")
    expect(toDecoderLabel("not-an-encoding")).toBe("utf-8")
    expect(toDecoderLabel(undefined)).toBe("utf-8")
    expect(toDecoderLabel(null)).toBe("utf-8")
  })
})
