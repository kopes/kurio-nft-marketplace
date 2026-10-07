import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * Variantes adaptadas ao Figma: botão cobre com texto tinta, contorno cobre e ações textuais.
 * Interação: cores e sombra transitam suavemente, o botão "afunda" levemente ao toque e o cobre ganha brilho no hover.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,scale,filter,opacity] duration-200 ease-out outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground font-bold hover:bg-highlight hover:shadow-[0_8px_24px_-10px_rgb(232_155_85/0.75)] active:bg-copper",
        destructive: "bg-destructive text-ink font-bold hover:bg-destructive/90",
        outline: "border border-primary text-highlight bg-transparent hover:bg-primary/10 hover:shadow-[0_0_0_1px_rgb(210_138_76/0.35)]",
        secondary: "bg-raised text-foreground hover:bg-deep",
        ghost: "text-foreground hover:bg-raised",
        link: "text-highlight underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-10 px-5 text-sm",
        xs: "h-7 gap-1 px-2 text-xs",
        sm: "h-9 gap-1.5 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
