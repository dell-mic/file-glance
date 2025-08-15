import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-gray-950 placeholder:text-gray-500 selection:bg-gray-900 selection:text-gray-50  border-gray-200 flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm      ",
        "focus-visible:border-gray-950 focus-visible:ring-gray-950/50 focus-visible:ring-[3px]  ",
        "aria-invalid:ring-red-500/20  aria-invalid:border-red-500   ",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
