"use client"

import * as React from "react"
import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 z-100 flex max-h-screen w-full flex-col-reverse gap-1 p-4 sm:bottom-0 sm:left-0 sm:top-auto sm:flex-col md:max-w-[420px]",
      className,
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
  "tost group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border border-gray-200 p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-left-full data-[state=open]:slide-in-from-top-full sm:data-[state=open]:slide-in-from-bottom-full dark:border-gray-800",
  {
    variants: {
      variant: {
        default:
          "border bg-white text-gray-950 dark:bg-gray-950 dark:text-gray-50",
        error:
          "error group border-red-500 bg-red-500 text-gray-50 dark:border-red-900 dark:bg-red-900 dark:text-gray-50",
        success:
          "error group border-green-500 bg-green-500 text-white dark:border-green-900 dark:bg-green-900 dark:text-gray-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-transparent px-3 text-sm font-medium ring-offset-white transition-colors hover:bg-gray-100 focus:outline-hidden focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.error]:border-gray-100/40 hover:group-[.error]:border-red-500/30 hover:group-[.error]:bg-red-500 hover:group-[.error]:text-gray-50 focus:group-[.error]:ring-red-500 dark:border-gray-800 dark:ring-offset-gray-950 dark:hover:bg-gray-800 dark:focus:ring-gray-300 dark:group-[.error]:border-gray-800/40 dark:hover:group-[.error]:border-red-900/30 dark:hover:group-[.error]:bg-red-900 dark:hover:group-[.error]:text-gray-50 dark:focus:group-[.error]:ring-red-900 group-[.success]:border-gray-100/40 hover:group-[.success]:border-green-500/30 hover:group-[.success]:bg-green-500 hover:group-[.success]:text-gray-50 focus:group-[.success]:ring-green-500 dark:group-[.success]:border-gray-800/40 dark:hover:group-[.success]:border-green-900/30 dark:hover:group-[.success]:bg-green-900 dark:hover:group-[.success]:text-gray-50 dark:focus:group-[.success]:ring-green-900",
      className,
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded-md p-1 text-gray-950/50 opacity-0 transition-opacity hover:text-gray-950 focus:opacity-100 focus:outline-hidden focus:ring-2 group-hover:opacity-100 group-[.error]:text-red-300 hover:group-[.error]:text-red-50 focus:group-[.error]:ring-red-400 focus:group-[.error]:ring-offset-red-600 dark:text-gray-50/50 dark:hover:text-gray-50 group-[.success]:text-green-300 hover:group-[.success]:text-green-50 focus:group-[.success]:ring-green-400 focus:group-[.success]:ring-offset-green-600",
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("font-medium tracking-wide", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
  type ToastProps,
  type ToastActionElement,
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
