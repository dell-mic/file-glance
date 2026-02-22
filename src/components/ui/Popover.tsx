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

interface MenuItem {
  text: string
  icon: React.ReactElement
  onSelect: () => void
  disabled?: boolean
}

interface MenuPopoverProps extends Omit<PopoverProps, "children"> {
  menuItems: MenuItem[][]
  onSelect: (item: MenuItem) => void
}

export const Popover: React.FC<PopoverProps> = ({
  id,
  open,
  onClose,
  anchorEl,
  anchorOrigin,
  children,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [adjustedStyles, setAdjustedStyles] = React.useState<any>(null)

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

  React.useLayoutEffect(() => {
    if (!open || !anchorEl || !popoverRef.current) return
    const anchorRectangle = anchorEl.getBoundingClientRect()
    const popover = popoverRef.current
    const popoverRect = popover.getBoundingClientRect()
    let top =
      anchorOrigin.vertical === "bottom"
        ? anchorRectangle.bottom
        : anchorRectangle.top
    let left =
      anchorOrigin.horizontal === "left"
        ? anchorRectangle.left
        : anchorRectangle.right

    // Adjust if out of viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    if (left + popoverRect.width > viewportWidth) {
      left = Math.max(0, viewportWidth - popoverRect.width - 8)
    }
    if (left < 0) left = 8
    if (top + popoverRect.height > viewportHeight) {
      top = Math.max(0, viewportHeight - popoverRect.height - 8)
    }
    if (top < 0) top = 8
    setAdjustedStyles({ top, left })
  }, [open, anchorEl, anchorOrigin])

  if (!open || !anchorEl) return null

  const anchorRectangle = anchorEl.getBoundingClientRect()
  const isAnchorElVisible = Object.values(anchorRectangle.toJSON()).every(
    Boolean,
  )
  if (!isAnchorElVisible) return null

  const popoverStyles = adjustedStyles || {
    top:
      anchorOrigin.vertical === "bottom"
        ? anchorRectangle.bottom
        : anchorRectangle.top,
    left:
      anchorOrigin.horizontal === "left"
        ? anchorRectangle.left
        : anchorRectangle.right,
  }

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

export const MenuPopover: React.FC<MenuPopoverProps> = (props) => {
  const popoverEntries = props.menuItems

  return (
    <Popover {...props}>
      <div className="" style={{}}>
        {popoverEntries.map((group, gi) => {
          return (
            <div
              key={gi}
              className="flex flex-col align-middle items-start py-1 border-gray-200"
              style={{
                borderBottomWidth: gi === popoverEntries.length - 1 ? 0 : "1px",
              }}
            >
              {group.map((menuEntry, mi) => (
                <button
                  key={mi}
                  data-testid={`menuEntry-${menuEntry.text}`}
                  disabled={menuEntry.disabled}
                  className={`flex items-center w-full text-sm text-left py-2 pl-2 pr-4 whitespace-nowrap ${
                    menuEntry.disabled
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-950"
                  }`}
                  onPointerDown={() => {
                    if (!menuEntry.disabled) {
                      menuEntry.onSelect()
                      props.onSelect(menuEntry)
                    }
                  }}
                >
                  <span className="mr-3 size-5">{menuEntry.icon}</span>
                  <span>{menuEntry.text}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </Popover>
  )
}
