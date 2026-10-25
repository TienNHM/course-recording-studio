import { Plus } from "lucide-react";
import React, { useCallback, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export const InlineCreate: React.FC<{
  readonly placeholder: string;
  readonly onCreate: (title: string) => Promise<unknown>;
}> = ({ placeholder, onCreate }) => {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) {
        return;
      }

      setBusy(true);
      try {
        await onCreate(title.trim());
        setTitle("");
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [onCreate, title],
  );

  return (
    <form className="flex gap-2" onSubmit={onSubmit}>
      <Input
        className="h-8"
        placeholder={placeholder}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={busy || !title.trim()}
        title={placeholder}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
};
