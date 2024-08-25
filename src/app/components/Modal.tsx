import React, { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

import "./Modal.css"

interface ContainerComponentPops {
  children: React.ReactNode
}

interface ModalProps extends ContainerComponentPops {
  id: string
  closeOnClickOutside?: boolean
  closeOnEsc?: boolean
  onClose: () => void
  open?: boolean
}

const Frame: React.FC<ModalProps> = ({
  id,
  children,
  closeOnClickOutside = true,
  closeOnEsc = true,
  onClose,
  open = true,
}) => {
  useEffect(() => {
    const onKeyPress = (e: KeyboardEvent) => {
      if (closeOnEsc && open && e.key === "Escape") onClose()
    }

    window.addEventListener("keydown", onKeyPress)
    return () => window.removeEventListener("keydown", onKeyPress)
  }, [closeOnEsc, onClose, open])

  const container = useRef<HTMLDivElement>(null)
  const onOverlayClick = (e: React.MouseEvent) => {
    if (!container.current?.contains(e.target as Node)) onClose()
  }

  if (!open) return null

  return createPortal(
    // transparent overlay: `inset-0` to stretch over the entire screen (combines`top-0`, `right-0`, `bottom-0`, and `left-0`)
    <div
      id={id}
      className="fixed inset-0 z-10 flex items-center bg-gray-600/80 fade-in"
      onClick={closeOnClickOutside ? onOverlayClick : undefined}
    >
      {/* container: `max-w-sm` to make it reasonably narrow, `mx-auto` to center horizontally */}
      <div
        className="relative w-full bg-gray-50 max-w-2xl m-auto p-2 rounded-md shadow-xl roll-out"
        ref={container}
      >
        {/* contents */}
        {children}
      </div>
    </div>,
    document.body,
  )
}

// const Head: React.FC<ContainerComponentPops> = ({ children }) => (
//   <div className="block p-4 bg-gray-900">
//     <h1 className="text-lg">{children}</h1>
//   </div>
// )

// const Body: React.FC<ContainerComponentPops> = ({ children }) => (
//   <div className="p-4">{children}</div>
// )

export const Modal = Frame
