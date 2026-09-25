import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ring-offset-background transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-[28px] active:translate-y-[2px] active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-spring-mint to-spring-leaf text-white shadow-lg hover:shadow-xl hover:-translate-y-[4px] hover:scale-105 dark:from-spring-mint dark:to-spring-leaf",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg hover:shadow-xl hover:-translate-y-[3px] active:shadow-sm",
        outline:
          "border-2 border-spring-leaf/40 dark:border-spring-mint/40 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:bg-spring-leaf/15 dark:hover:bg-spring-mint/15 hover:-translate-y-[2px] shadow-md hover:shadow-lg hover:border-spring-leaf/70 dark:hover:border-spring-mint/70",
        secondary:
          "bg-spring-leaf/20 dark:bg-spring-mint/20 text-spring-leaf dark:text-spring-mint shadow-md hover:bg-spring-leaf/30 dark:hover:bg-spring-mint/30 hover:-translate-y-[2px] hover:shadow-lg border border-spring-leaf/30 dark:border-spring-mint/30",
        ghost: "hover:bg-spring-leaf/15 dark:hover:bg-spring-mint/15 hover:text-spring-leaf dark:hover:text-spring-mint hover:backdrop-blur-sm transition-all",
        link: "text-spring-leaf dark:text-spring-mint underline-offset-4 hover:underline hover:text-spring-mint",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
