import React, { useCallback, useState } from "react";
import type { Course, CourseLanguage } from "../../config/course";
import { createCourse } from "../actions/courses";
import { Alert } from "../components/ui/alert";
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
import { Textarea } from "../components/ui/misc";
import { SegmentedControl } from "../components/ui/segmented-control";
import { useT } from "../i18n";
import { Field, describedBy } from "./form-fields";
import { TITLE_MAX_LENGTH, validateTitle } from "./lesson-flow";

const CreateForm: React.FC<{
  readonly onCreated: (course: Course) => void;
}> = ({ onCreated }) => {
  const t = useT("library");
  const tc = useT("common");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState<CourseLanguage>("vi");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = validateTitle(name);
  const nameMessage =
    touched && nameError
      ? nameError === "required"
        ? t("courseSettings.nameRequired")
        : t("inlineCreate.tooLong", { max: TITLE_MAX_LENGTH })
      : null;

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setTouched(true);
      if (nameError) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const created = await createCourse({
          name: name.trim(),
          description: description.trim(),
          language,
        });
        onCreated(created);
      } catch (err) {
        setError(t("newCourseDialog.failed", { message: (err as Error).message }));
      } finally {
        setBusy(false);
      }
    },
    [description, language, name, nameError, onCreated, t],
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>{t("newCourseDialog.title")}</DialogTitle>
        <DialogDescription>{t("newCourseDialog.description")}</DialogDescription>
      </DialogHeader>
      <Field
        label={t("newCourseDialog.name")}
        htmlFor="new-course-name"
        error={nameMessage}
      >
        <Input
          id="new-course-name"
          placeholder={t("newCourseDialog.namePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(name !== "" || touched)}
          aria-invalid={nameMessage ? true : undefined}
          aria-describedby={describedBy("new-course-name", { error: nameMessage })}
          autoFocus
          required
        />
      </Field>
      <Field
        label={t("newCourseDialog.descriptionLabel")}
        htmlFor="new-course-description"
        hint={tc("state.optional")}
      >
        <Textarea
          id="new-course-description"
          placeholder={t("newCourseDialog.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="grid gap-1.5">
        <span id="new-course-language" className="text-label">
          {t("newCourseDialog.language")}
        </span>
        <SegmentedControl<CourseLanguage>
          aria-labelledby="new-course-language"
          value={language}
          onValueChange={setLanguage}
          options={[
            { value: "vi", label: tc("language.vi") },
            { value: "en", label: tc("language.en") },
          ]}
          className="w-full"
        />
        <p className="text-caption text-muted-foreground">
          {t("courseSettings.languageHint")}
        </p>
      </div>
      {error ? <Alert tone="destructive">{error}</Alert> : null}
      <DialogFooter className="gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("newCourseDialog.creating") : t("newCourseDialog.create")}
        </Button>
      </DialogFooter>
    </form>
  );
};

export const NewCourseDialog: React.FC<{
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onCreated: (course: Course) => void;
}> = ({ open, onOpenChange, onCreated }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        {open ? (
          <CreateForm
            onCreated={(course) => {
              onOpenChange(false);
              onCreated(course);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
