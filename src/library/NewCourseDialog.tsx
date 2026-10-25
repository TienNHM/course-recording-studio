import React, { useCallback, useState } from "react";
import type { Course, CourseLanguage } from "../../config/course";
import { createCourse } from "../actions/courses";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Field, NativeSelect } from "./form-fields";

export const NewCourseDialog: React.FC<{
  readonly onCreated: (course: Course) => void;
}> = ({ onCreated }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<CourseLanguage>("vi");
  const [busy, setBusy] = useState(false);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(true);
      try {
        const created = await createCourse({ name: name.trim(), language });
        setName("");
        setOpen(false);
        onCreated(created);
      } catch (err) {
        alert((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [language, name, onCreated],
  );

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        New course
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <form onSubmit={onSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>New course</DialogTitle>
              <DialogDescription>
                The language is used for transcription and subtitles.
              </DialogDescription>
            </DialogHeader>
            <Field label="Name" htmlFor="course-name">
              <Input
                id="course-name"
                placeholder="Lập trình React cơ bản"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label="Language" htmlFor="course-language">
              <NativeSelect
                id="course-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as CourseLanguage)}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </NativeSelect>
            </Field>
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()}>
                Create course
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
