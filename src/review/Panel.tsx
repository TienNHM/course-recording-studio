import React from "react";
import { cn } from "../helpers/utils";

/** Titled block inside a Review tab: heading + toolbar, then content. */
export const Panel: React.FC<{
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly testId?: string;
  readonly className?: string;
}> = ({ title, description, actions, children, testId, className }) => {
  return (
    <section className={cn("grid gap-3", className)} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-heading">{title}</h2>
          {description ? (
            <p className="text-caption text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
};
