import React from "react";

export const Panel: React.FC<{
  readonly title: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly testId?: string;
}> = ({ title, actions, children, testId }) => {
  return (
    <section className="grid gap-3 rounded-md border p-3" data-testid={testId}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
};
