import React from "react";
import { cn } from "../helpers/utils";
import { Label } from "../components/ui/label";

export const Field: React.FC<{
  readonly label: string;
  readonly htmlFor?: string;
  readonly children: React.ReactNode;
}> = ({ label, htmlFor, children }) => {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
};

export const TextArea: React.FC<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
> = ({ className, ...props }) => {
  return (
    <textarea
      className={cn(
        "min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
};

export const Checkbox: React.FC<{
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="h-4 w-4 accent-sky-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
};

export const NativeSelect: React.FC<
  React.SelectHTMLAttributes<HTMLSelectElement>
> = ({ className, ...props }) => {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-input bg-background px-3 text-sm [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
};
