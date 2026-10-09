import {
  addDaysISO,
  formatClock,
  formatLongDate,
  formatWeekday,
  startOfWeekMonday,
  todayISO,
  type SessionKind,
  type StudyPlan,
  type StudySession,
  type Syllabus,
} from "@atrium/shared";

const HOUR_PX = 52;
const KIND_CLASS: Record<SessionKind, string> = {
  learn: "border-teal/40 bg-teal-soft text-teal-deep",
  practice: "border-brass/40 bg-brass-soft text-brass",
  review: "border-sienna/40 bg-sienna-soft text-sienna",
};

interface WeekCalendarProps {
  syllabus: Syllabus;
  plan: StudyPlan | null;
  weekStart: string;
  stale: boolean;
  busy: boolean;
  onWeek: (start: string) => void;
  onSelect: (sessionId: string) => void;
  onAdd: (date: string) => void;
  onRebuild: () => void;
}

export function WeekCalendar({
  syllabus,
  plan,
  weekStart,
  stale,
  busy,
  onWeek,
  onSelect,
  onAdd,
  onRebuild,
}: WeekCalendarProps) {
  const days = Array.from({ length: 7 }, (_, index) => addDaysISO(weekStart, index));
  const today = todayISO();
  const sessions = plan?.sessions ?? [];
  const visible = sessions.filter((session) => session.date >= days[0]! && session.date <= days[6]!);
  const weekMinutes = visible.reduce((sum, session) => sum + session.durationMinutes, 0);
  const next = [...syllabus.assessments]
    .filter((assessment) => assessment.dueDate >= (plan?.startDate ?? today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Week of {formatLongDate(weekStart)}
          </p>
          <h2 className="font-serif text-3xl text-ink">
            {formatLongDate(weekStart)} – {formatLongDate(days[6]!)}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {formatHoursShort(weekMinutes)} planned this week
            {next ? ` · Next deadline: ${next.title} on ${formatLongDate(next.dueDate)} (${next.weight}%)` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => onWeek(addDaysISO(weekStart, -7))}>
            Previous
          </button>
          <button type="button" className="btn-quiet" onClick={() => onWeek(startOfWeekMonday(today))}>
            Today
          </button>
          <button type="button" className="btn-secondary" onClick={() => onWeek(addDaysISO(weekStart, 7))}>
            Next
          </button>
        </div>
      </div>

      {plan && plan.warnings.length > 0 ? (
        <ul className="space-y-1 border-b border-line bg-brass-soft/70 px-4 py-3 text-sm text-brass sm:px-6">
          {plan.warnings.map((warning) => (
            <li key={`${warning.code}-${warning.assessmentId ?? warning.message}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}

      {stale ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-4 py-3 sm:px-6">
          <p className="text-sm text-ink">This week is out of date with the hours or deadlines.</p>
          <button type="button" className="btn-primary" onClick={onRebuild} disabled={busy}>
            {busy ? "Fitting the week…" : "Rebuild plan"}
          </button>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide">
          <Legend kind="learn" label="Learn" />
          <Legend kind="practice" label="Practice" />
          <Legend kind="review" label="Review" />
        </div>
        <button type="button" className="btn-quiet" onClick={() => onAdd(today >= days[0]! && today <= days[6]! ? today : weekStart)}>
          Add block
        </button>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-4 pb-6 sm:px-6">
        <div className="space-y-3 md:hidden">
          {days.map((date) => (
            <AgendaDay
              key={date}
              date={date}
              today={today}
              sessions={visible.filter((session) => session.date === date)}
              onSelect={onSelect}
            />
          ))}
        </div>
        <TimeGrid days={days} today={today} sessions={visible} onSelect={onSelect} />
        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-ink-soft">Nothing is scheduled in this week. Move to another week, or add a block.</p>
        ) : null}
      </div>
    </section>
  );
}

function TimeGrid({
  days,
  today,
  sessions,
  onSelect,
}: {
  days: string[];
  today: string;
  sessions: StudySession[];
  onSelect: (sessionId: string) => void;
}) {
  const edges = sessions.flatMap((session) => [session.startMinutes, session.startMinutes + session.durationMinutes]);
  const gridStart = Math.floor(Math.min(8 * 60, ...(edges.length ? edges : [8 * 60])) / 60) * 60;
  const gridEnd = Math.ceil(Math.max(20 * 60, ...(edges.length ? edges : [20 * 60])) / 60) * 60;
  const hours: number[] = [];
  for (let minute = gridStart; minute < gridEnd; minute += 60) hours.push(minute);
  const height = hours.length * HOUR_PX;

  return (
    <div className="hidden md:block">
      <div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div />
          {days.map((date) => {
            const isToday = date === today;
            return (
              <div key={date} className="px-1 pb-2 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">{formatWeekday(date)}</p>
                <p
                  className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? "bg-teal text-paper" : "text-ink"
                  }`}
                >
                  {date.slice(-2).replace(/^0/, "")}
                </p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div className="relative" style={{ height }}>
            {hours.map((minute, index) => (
              <div key={minute} className="absolute right-2 text-[11px] text-ink-soft" style={{ top: index * HOUR_PX - 6 }}>
                {formatClock(minute)}
              </div>
            ))}
          </div>
          {days.map((date) => (
            <div
              key={date}
              className={`relative border-l border-line ${date === today ? "bg-teal-soft/40" : ""}`}
              style={{ height }}
            >
              {hours.map((minute, index) => (
                <div key={minute} className="absolute inset-x-0 border-t border-line/80" style={{ top: index * HOUR_PX }} />
              ))}
              {sessions
                .filter((session) => session.date === date)
                .map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSelect(session.id)}
                    className={`absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left shadow-sm ${KIND_CLASS[session.kind]}`}
                    style={{
                      top: ((session.startMinutes - gridStart) / 60) * HOUR_PX + 2,
                      height: Math.max((session.durationMinutes / 60) * HOUR_PX - 4, 32),
                    }}
                  >
                    <span className="block text-[10px] font-semibold uppercase tracking-wide">{session.kind}</span>
                    <span className="block truncate text-xs font-semibold">{session.title.replace(/^.*·\s*/, "")}</span>
                    <span className="block text-[10px]">
                      {formatClock(session.startMinutes)}–{formatClock(session.startMinutes + session.durationMinutes)}
                    </span>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AgendaDay({
  date,
  today,
  sessions,
  onSelect,
}: {
  date: string;
  today: string;
  sessions: StudySession[];
  onSelect: (sessionId: string) => void;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-3 ${date === today ? "ring-2 ring-teal/40" : ""}`}>
      <h3 className="text-sm font-semibold text-ink">
        {formatWeekday(date, "long")} {formatLongDate(date)}
        {date === today ? <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-teal">Today</span> : null}
      </h3>
      {sessions.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Open</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                type="button"
                onClick={() => onSelect(session.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left ${KIND_CLASS[session.kind]}`}
              >
                <span className="block text-sm font-semibold">{session.title}</span>
                <span className="text-xs">
                  {formatClock(session.startMinutes)}–{formatClock(session.startMinutes + session.durationMinutes)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Legend({ kind, label }: { kind: SessionKind; label: string }) {
  return <span className={`rounded-full border px-2 py-1 ${KIND_CLASS[kind]}`}>{label}</span>;
}

function formatHoursShort(minutes: number): string {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}
