import React from "react"

interface KbdProps {
  children: React.ReactNode
}

const Kbd: React.FC<KbdProps> = ({ children }) => {
  return (
    <kbd className="px-1 py-0.5 border border-gray-300 rounded text-sm font-mono">
      {children}
    </kbd>
  )
}

export default Kbd
