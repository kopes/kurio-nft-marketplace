import { cn } from "@/lib/utils"

/** Skeleton com shimmer (desativado com prefers-reduced-motion). Ocupa as dimensões do conteúdo final. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn("skeleton rounded-md", className)} {...props} />
}

export { Skeleton }
