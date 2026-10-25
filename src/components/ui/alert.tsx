import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { cn } from "../../helpers/utils";

const alertVariants = cva(
  "relative flex gap-3 rounded-lg border p-3 text-body [&>svg]:mt-0.5 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-card text-card-foreground",
        info: "border-info/30 bg-info/10 text-foreground [&>svg]:text-info",
        success:
          "border-success/30 bg-success/10 text-foreground [&>svg]:text-success",
        warning:
          "border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning",
        destructive:
          "border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

const ICONS: Record<NonNullable<AlertProps["tone"]>, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
};

type AlertProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> &
  VariantProps<typeof alertVariants> & {
    readonly title?: React.ReactNode;
    /** Trailing actions (retry button...). */
    readonly action?: React.ReactNode;
  };

/**
 * Inline message banner (errors, warnings, recover-take prompts...).
 * `role="alert"` for destructive/warning, `status` otherwise.
 */
export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, tone, title, action, children, ...props }, ref) => {
    const Icon = ICONS[tone ?? "neutral"];
    return (
      <div
        ref={ref}
        role={tone === "destructive" || tone === "warning" ? "alert" : "status"}
        className={cn(alertVariants({ tone }), className)}
        {...props}
      >
        <Icon aria-hidden />
        <div className="min-w-0 flex-1">
          {title ? <div className="font-semibold">{title}</div> : null}
          {children ? (
            <div className={cn(title ? "text-muted-foreground" : null)}>
              {children}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0 self-center">{action}</div> : null}
      </div>
    );
  },
);
Alert.displayName = "Alert";
