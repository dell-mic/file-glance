import * as React from "react"

interface KbdProps {
  children: React.ReactNode
}

function Kbd({ children }: KbdProps) {
  return (
    <kbd className="px-1 py-0.5 border border-gray-300 rounded text-sm font-mono">
      {children}
    </kbd>
  )
}

export { Kbd }
