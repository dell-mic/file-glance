import React, { useEffect, useRef } from "react"
import { createPortal } from "react-dom"

interface PopoverProps {
  id?: string
  open: boolean
  onClose: () => void
  anchorEl: HTMLElement | null
  anchorOrigin: {
    vertical: "top" | "bottom"
    horizontal: "left" | "right"
  }
  children: React.ReactNode
}

export const Popover = ({
  id,
  open,
  onClose,
  anchorEl,
  anchorOrigin,
  children,
}: PopoverProps) => {
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      console.log("handleClickOutside")
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (open) {
      document.addEventListener("pointerdown", handleClickOutside)
    } else {
      document.removeEventListener("pointerdown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside)
    }
  }, [open, onClose])

  if (!open || !anchorEl) return null

  const anchorRectangle = anchorEl.getBoundingClientRect()

  // TODO: This should not be needed if anchorEl would be nulled correctly?
  const isAnchorElVisible = Object.values(anchorRectangle.toJSON()).every(
    Boolean,
  )
  if (!isAnchorElVisible) return null

  const popoverStyles = {
    top:
      anchorOrigin.vertical === "bottom"
        ? anchorRectangle.bottom
        : anchorRectangle.top,
    left:
      anchorOrigin.horizontal === "left"
        ? anchorRectangle.left
        : anchorRectangle.right,
  }
  //   const popoverStyles = {
  //     top: top,
  //     left: left,
  //   }

  //   console.log("open", open)
  //   console.log("anchorEl", anchorEl)

  return createPortal(
    <div
      id={id}
      ref={popoverRef}
      className="fixed z-50 bg-white shadow-md p-1"
      style={popoverStyles}
    >
      {children}
    </div>,
    document.body,
  )
}
