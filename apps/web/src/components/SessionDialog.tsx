import { useEffect, useId, useState } from "react";
import { formatClock, type SessionKind, type StudySession } from "@atrium/shared";

interface SessionDialogProps {
  session: StudySession | null;
  others: StudySession[];
  onClose: () => void;
  onSave: (patch: Pick<StudySession, "title" | "date" | "startMinutes" | "durationMinutes" | "kind">) => void;
  onDelete: () => void;
}

const DURATIONS = [30, 45, 60, 90, 120];

export function SessionDialog({ session, others, onClose, onSave, onDelete }: SessionDialogProps) {
  const titleId = useId();
  const [title, setTitle] = useState(session?.title ?? "");
  const [date, setDate] = useState(session?.date ?? "");
  const [startMinutes, setStartMinutes] = useState(session?.startMinutes ?? 9 * 60);
  const [durationMinutes, setDurationMinutes] = useState(session?.durationMinutes ?? 60);
  const [kind, setKind] = useState<SessionKind>(session?.kind ?? "learn");

  useEffect(() => {
    if (!session) return;
    setTitle(session.title);
    setDate(session.date);
    setStartMinutes(session.startMinutes);
    setDurationMinutes(session.durationMinutes);
    setKind(session.kind);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session, onClose]);

  if (!session) return null;

  const overlaps = others.some(
    (other) =>
      other.date === date &&
      startMinutes < other.startMinutes + other.durationMinutes &&
      startMinutes + durationMinutes > other.startMinutes,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-3xl border border-line bg-card p-5 shadow-card"
      >
        <h2 id={titleId} className="font-serif text-2xl text-ink">
          Edit study block
        </h2>
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim()) return;
            onSave({ title: title.trim(), date, startMinutes, durationMinutes, kind });
          }}
        >
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Title</span>
            <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Date</span>
              <input className="field mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Kind</span>
              <select className="field mt-1" value={kind} onChange={(event) => setKind(event.target.value as SessionKind)}>
                <option value="learn">Learn</option>
                <option value="practice">Practice</option>
                <option value="review">Review</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Starts</span>
              <select
                className="field mt-1"
                value={startMinutes}
                onChange={(event) => setStartMinutes(Number(event.target.value))}
              >
                {timeOptions().map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatClock(minutes)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Length</span>
              <select
                className="field mt-1"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          {overlaps ? (
            <p className="text-sm text-brass">This overlaps another block on the same day. You can still save it.</p>
          ) : null}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button type="button" className="btn-quiet px-0 text-sienna" onClick={onDelete}>
              Delete
            </button>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={title.trim().length === 0}>
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function timeOptions(): number[] {
  const options: number[] = [];
  for (let minutes = 7 * 60; minutes <= 21 * 60; minutes += 30) options.push(minutes);
  return options;
}
