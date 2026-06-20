import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, label, error, icon, ...props }, ref) => {
        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted ml-1">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none z-10">
                            {icon}
                        </div>
                    )}
                    <input
                        type={type}
                        className={cn(
                            "w-full px-5 py-3.5 rounded-xl",
                            "bg-background-secondary border border-border",
                            "text-sm text-foreground font-medium",
                            "placeholder:text-foreground-muted",
                            "transition-all duration-200",
                            "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10",
                            icon && "pl-12",
                            error && "border-error focus:border-error focus:ring-error/10",
                            className
                        )}
                        ref={ref}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-xs text-error ml-1 font-medium mt-1">{error}</p>
                )}
            </div>
        )
    }
)
Input.displayName = "Input"

export { Input }
