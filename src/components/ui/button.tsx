import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed  ",
  {
    variants: {
      variant: {
        default: "bg-gray-900 text-gray-50 enabled:hover:bg-gray-900/90   ",
        error: "bg-red-500 text-gray-50 enabled:hover:bg-red-500/90   ",
        outline:
          "border border-gray-200 bg-white enabled:hover:bg-gray-100 enabled:hover:text-gray-900    ",
        secondary: "bg-gray-100 text-gray-900 enabled:hover:bg-gray-100/80   ",
        ghost: "enabled:hover:bg-gray-100 enabled:hover:text-gray-900  ",
        link: "text-gray-900 underline-offset-4 enabled:hover:underline ",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
