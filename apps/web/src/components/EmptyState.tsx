import { useState, type DragEvent } from "react";
import { Mark } from "./Mark";

interface EmptyStateProps {
  busy: boolean;
  error: string | null;
  onUpload: (file: File) => void;
  onSample: () => void;
}

export function EmptyState({ busy, error, onUpload, onSample }: EmptyStateProps) {
  const [dragging, setDragging] = useState(false);

  function takeFile(file: File | undefined) {
    if (file) onUpload(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    takeFile(event.dataTransfer.files[0]);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-[28px] border bg-card/90 px-8 py-10 shadow-card transition sm:px-12 ${
          dragging ? "border-teal" : "border-line"
        }`}
      >
        <div className="flex items-center gap-3 text-teal">
          <Mark className="h-8 w-8" />
          <p className="font-serif text-2xl italic text-ink">Atrium</p>
        </div>
        <h1 className="mt-6 max-w-xl font-serif text-4xl leading-tight text-ink sm:text-5xl">
          A week that already knows the syllabus.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft">
          Upload a course PDF. Atrium pulls out the topics, exams, and weights, then fits a study plan
          into the hours you actually have.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <label className="btn-primary cursor-pointer">
            {busy ? "Reading the syllabus…" : "Upload a syllabus"}
            <input
              className="sr-only"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(event) => {
                takeFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={onSample} disabled={busy}>
            Try the sample course
          </button>
        </div>
        <p className="mt-3 text-sm text-ink-soft">PDF only, up to 5 MB. Drop a file anywhere on this card.</p>
        {error ? (
          <p role="alert" className="mt-4 rounded-xl bg-sienna-soft px-4 py-3 text-sm text-sienna">
            {error}
          </p>
        ) : null}

        <ol className="mt-10 grid gap-4 border-t border-line pt-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">{step.kicker}</p>
              <p className="mt-1 font-serif text-xl text-ink">{step.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-6 text-center text-sm text-ink-soft">A study planner by Maeen Alganimi</p>
    </div>
  );
}

const STEPS = [
  {
    kicker: "01",
    title: "Read the syllabus",
    body: "Topics, deadlines, and the weight of each exam come out of the PDF.",
  },
  {
    kicker: "02",
    title: "Fit the week",
    body: "Heavier work gets more time. Exams are studied before the day itself.",
  },
  {
    kicker: "03",
    title: "Ask the tutor",
    body: "Questions are answered from this course, not from a general lecture.",
  },
] as const;
