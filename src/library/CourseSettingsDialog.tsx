import { Trash2 } from "lucide-react";
import React, { useCallback, useState } from "react";
import type {
  Course,
  CourseLanguage,
  OutputProfile,
} from "../../config/course";
import { OUTPUT_PROFILES } from "../../config/course";
import { patchCourse } from "../actions/courses";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Field, NativeSelect, TextArea } from "./form-fields";

type GlossaryRow = { term: string; aliases: string };

const toRows = (course: Course): GlossaryRow[] =>
  course.glossary.map((g) => ({ term: g.term, aliases: g.aliases.join(", ") }));

const fromRows = (rows: GlossaryRow[]) =>
  rows
    .filter((r) => r.term.trim())
    .map((r) => ({
      term: r.term.trim(),
      aliases: r.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean),
    }));

const SettingsForm: React.FC<{
  readonly course: Course;
  readonly onSaved: () => void;
}> = ({ course, onSaved }) => {
  const [name, setName] = useState(course.name);
  const [description, setDescription] = useState(course.description);
  const [language, setLanguage] = useState(course.language);
  const [outputProfile, setOutputProfile] = useState(course.outputProfile);
  const [glossary, setGlossary] = useState<GlossaryRow[]>(() => toRows(course));
  const [busy, setBusy] = useState(false);

  const updateRow = (index: number, row: Partial<GlossaryRow>) => {
    setGlossary((rows) =>
      rows.map((r, i) => (i === index ? { ...r, ...row } : r)),
    );
  };

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      try {
        await patchCourse(course.id, {
          name: name.trim(),
          description,
          language,
          outputProfile,
          glossary: fromRows(glossary),
        });
        onSaved();
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [course.id, description, glossary, language, name, onSaved, outputProfile],
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Name" htmlFor="settings-name">
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="settings-description">
        <TextArea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Language" htmlFor="settings-language">
          <NativeSelect
            id="settings-language"
            value={language}
            onChange={(e) => setLanguage(e.target.value as CourseLanguage)}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </NativeSelect>
        </Field>
        <Field label="Output profile" htmlFor="settings-output">
          <NativeSelect
            id="settings-output"
            value={outputProfile}
            onChange={(e) => setOutputProfile(e.target.value as OutputProfile)}
          >
            {Object.entries(OUTPUT_PROFILES).map(([id, p]) => (
              <option key={id} value={id}>
                {id} ({p.width}×{p.height}, {p.fps}fps)
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Glossary (term → comma-separated aliases)">
        <div className="grid gap-2">
          {glossary.map((row, i) => (
            <div key={i} className="flex gap-2">
              <Input
                className="h-8"
                placeholder="Term"
                value={row.term}
                onChange={(e) => updateRow(i, { term: e.target.value })}
              />
              <Input
                className="h-8"
                placeholder="Aliases, comma separated"
                value={row.aliases}
                onChange={(e) => updateRow(i, { aliases: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8"
                title="Remove term"
                onClick={() =>
                  setGlossary((rows) => rows.filter((_, j) => j !== i))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              setGlossary((rows) => [...rows, { term: "", aliases: "" }])
            }
          >
            Add term
          </Button>
        </div>
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={busy || !name.trim()}>
          Save settings
        </Button>
      </DialogFooter>
    </form>
  );
};

export const CourseSettingsDialog: React.FC<{
  readonly course: Course;
  readonly onSaved: () => void;
}> = ({ course, onSaved }) => {
  const [open, setOpen] = useState(false);

  const handleSaved = useCallback(() => {
    setOpen(false);
    onSaved();
  }, [onSaved]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Course settings
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Course settings</DialogTitle>
          </DialogHeader>
          {open ? <SettingsForm course={course} onSaved={handleSaved} /> : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
