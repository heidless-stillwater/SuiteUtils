import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'error' | 'success' | 'warning' | 'accent' | 'glass' | 'gradient';
    size?: 'sm' | 'md' | 'lg';
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: "bg-primary text-white border-transparent",
            secondary: "bg-background-secondary text-foreground-muted border-border",
            outline: "bg-transparent text-foreground border-border",
            error: "bg-error/10 text-error border-error/20",
            success: "bg-success/10 text-success border-success/20",
            warning: "bg-warning/10 text-warning border-warning/20",
            accent: "bg-accent text-white border-transparent",
            glass: "bg-white/10 backdrop-blur-md text-white border-white/20 shadow-lg",
            gradient: "bg-gradient-to-r from-primary/20 to-accent/20 text-foreground border-primary/30",
        };

        const sizes = {
            sm: "px-1.5 py-0.5 text-[8px] rounded",
            md: "px-2 py-0.5 text-[10px] rounded-md",
            lg: "px-3 py-1 text-xs rounded-lg",
        };

        return (
            <div
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center font-black uppercase tracking-widest border transition-all",
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        )
    }
)
Badge.displayName = "Badge"

export { Badge }
