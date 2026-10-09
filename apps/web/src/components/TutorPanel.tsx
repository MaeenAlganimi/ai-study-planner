import { useEffect, useRef, useState } from "react";

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
  citations?: string[];
}

const SUGGESTIONS = [
  "What should I study before the midterm?",
  "How is the grade weighted?",
  "When are office hours?",
];

interface TutorPanelProps {
  messages: TutorMessage[];
  pending: boolean;
  disabled: boolean;
  onSend: (message: string) => void;
  onClose?: () => void;
}

export function TutorPanel({ messages, pending, disabled, onSend, onClose }: TutorPanelProps) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  function submit() {
    const message = draft.trim();
    if (!message || pending || disabled) return;
    setDraft("");
    onSend(message);
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-line bg-card xl:border-l">
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-4">
        <div>
          <h2 className="font-serif text-2xl text-ink">Tutor</h2>
          <p className="text-sm text-ink-soft">Answers stay inside this syllabus and your plan.</p>
        </div>
        {onClose ? (
          <button type="button" className="btn-quiet xl:hidden" onClick={onClose}>
            Close
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm leading-relaxed text-ink-soft">
            Ask what an exam covers, how the grade is weighted, or what is on the calendar. The tutor will not invent
            dates that are not in the course.
          </div>
        ) : null}
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={
              message.role === "user"
                ? "ml-6 rounded-2xl bg-teal px-3 py-2 text-sm text-paper"
                : "mr-4 rounded-2xl border border-line bg-paper px-3 py-2 text-sm leading-relaxed text-ink"
            }
          >
            <p>{message.content}</p>
            {message.citations && message.citations.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1">
                {message.citations.map((citation) => (
                  <li key={citation} className="rounded-full bg-card px-2 py-0.5 text-[11px] text-ink-soft">
                    {citation}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
        {pending ? <p className="text-sm text-ink-soft">Looking through the syllabus…</p> : null}
        <div ref={bottom} />
      </div>
      {messages.length === 0 ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-full border border-line bg-paper px-3 py-1 text-left text-xs text-ink hover:border-teal"
              disabled={disabled || pending}
              onClick={() => onSend(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
      <form
        className="border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="sr-only" htmlFor="tutor-message">
          Ask the tutor
        </label>
        <textarea
          id="tutor-message"
          className="field min-h-20 resize-none"
          placeholder={disabled ? "Load a syllabus first" : "Ask about this course"}
          value={draft}
          disabled={disabled || pending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div className="mt-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={disabled || pending || draft.trim().length === 0}>
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}
