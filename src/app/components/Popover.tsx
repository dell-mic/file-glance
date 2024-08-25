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

export const MenuPopover: React.FC<MenuPopoverProps> = (props) => {
  const popoverEntries = props.menuItems

  return (
    <Popover {...props}>
      <div className="" style={{ width: "260px" }}>
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
                  className="flex items-center w-full text-sm text-left text-gray-700 py-2 px-2 hover:bg-gray-100 hover:text-gray-950"
                  onPointerDown={() => {
                    menuEntry.onSelect()
                    props.onSelect(menuEntry)
                  }}
                >
                  <span className="mr-3 size-5">{menuEntry.icon}</span>
                  {menuEntry.text}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </Popover>
  )
}
