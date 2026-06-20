import * as React from "react"
import { cn } from "@/lib/utils"
import { Icons } from "./Icons"

export interface SelectProps
    extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, label, error, ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && <label className="text-sm font-medium text-foreground-muted ml-1">{label}</label>}
                <div className="relative">
                    <select
                        className={cn(
                            "w-full px-4 py-3 rounded-xl bg-background-secondary border border-border text-foreground transition-all duration-200 cursor-pointer appearance-none focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10",
                            error && "border-error focus:border-error",
                            className
                        )}
                        ref={ref}
                        {...props}
                    >
                        {children}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-foreground-muted">
                        <Icons.chevronDown size={16} />
                    </div>
                </div>
                {error && <p className="text-xs text-error ml-1">{error}</p>}
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
