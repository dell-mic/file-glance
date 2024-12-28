import React, { useCallback, ReactNode } from "react"

// Adopted to TS best practices, fixed for Webkit. Original from: https://github.com/bluepeter/react-middle-ellipsis

interface ComponentProps {
  width?: string | number
  children: ReactNode
}

const Component: React.FC<ComponentProps> = ({ width, children }) => {
  const prepEllipse = (node: HTMLElement) => {
    const parent = node.parentNode as HTMLElement
    const child = node.childNodes[0] as HTMLElement
    const txtToEllipse =
      (parent.querySelector(".ellipseMe") as HTMLElement) || child

    if (child !== null && txtToEllipse !== null) {
      // (Re)-set text back to data-original-text if it exists.
      if (txtToEllipse.hasAttribute("data-original")) {
        txtToEllipse.textContent = txtToEllipse.getAttribute("data-original")
      }

      ellipse(
        // Use the smaller width.
        node.getBoundingClientRect().width >
          parent.getBoundingClientRect().width
          ? parent
          : node,
        child,
        txtToEllipse,
      )
    }
  }

  const measuredParent = useCallback((node: HTMLElement | null) => {
    if (node !== null) {
      const handleResize = () => prepEllipse(node)
      window.addEventListener("resize", handleResize)
      prepEllipse(node)

      return () => window.removeEventListener("resize", handleResize)
    }
  }, [])

  return (
    <div
      ref={measuredParent}
      style={{
        wordBreak: "keep-all",
        overflowWrap: "normal",
        ...(width && { width }),
      }}
    >
      {children}
    </div>
  )
}

const ellipse = (
  parentNode: HTMLElement,
  childNode: HTMLElement,
  txtNode: HTMLElement,
) => {
  const childWidth = childNode.getBoundingClientRect().width
  const containerWidth = parentNode.getBoundingClientRect().width
  const txtWidth = txtNode.getBoundingClientRect().width
  const targetWidth = childWidth > txtWidth ? childWidth : txtWidth

  if (targetWidth > containerWidth) {
    const str = txtNode.textContent || ""
    const txtChars = str.length
    const avgLetterSize = txtWidth / txtChars
    const canFit = (containerWidth - (targetWidth - txtWidth)) / avgLetterSize
    const delEachSide = (txtChars - canFit + 5) / 2
    const endLeft = Math.floor(txtChars / 2 - delEachSide)
    const startRight = Math.ceil(txtChars / 2 + delEachSide)

    txtNode.setAttribute("data-original", str)
    txtNode.textContent = txtNode.textContent =
      str.substring(0, endLeft) + "…" + str.substring(startRight)
  }
}

export default Component
