import {
  WEEKDAY_LABELS_SUNDAY_FIRST,
  formatHours,
  formatLongDate,
  type Assessment,
  type Availability,
  type StudyPlan,
  type Syllabus,
} from "@atrium/shared";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface SyllabusPanelProps {
  syllabus: Syllabus;
  plan: StudyPlan | null;
  availability: Availability;
  startDate: string;
  sessionMinutes: number;
  stale: boolean;
  busy: boolean;
  onAvailability: (next: Availability) => void;
  onStartDate: (value: string) => void;
  onSessionMinutes: (value: number) => void;
  onAssessment: (id: string, patch: Partial<Assessment>) => void;
  onRebuild: () => void;
  onReset: () => void;
}

export function SyllabusPanel({
  syllabus,
  plan,
  availability,
  startDate,
  sessionMinutes,
  stale,
  busy,
  onAvailability,
  onStartDate,
  onSessionMinutes,
  onAssessment,
  onRebuild,
  onReset,
}: SyllabusPanelProps) {
  const weekly = availability.hoursByWeekday.reduce((sum, hours) => sum + hours, 0);
  const weight = syllabus.assessments.reduce((sum, assessment) => sum + assessment.weight, 0);
  const budgets = new Map(plan?.budgets.map((budget) => [budget.assessmentId, budget]) ?? []);

  function setHours(index: number, hours: number) {
    const hoursByWeekday = [...availability.hoursByWeekday];
    hoursByWeekday[index] = hours;
    onAvailability({ hoursByWeekday });
  }

  return (
    <aside className="flex min-h-0 w-full flex-col overflow-y-auto border-line bg-card/70 lg:w-[320px] lg:border-r">
      <div className="space-y-6 px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">
            {syllabus.courseCode}
            {syllabus.term ? ` · ${syllabus.term}` : ""}
          </p>
          <h2 className="mt-1 font-serif text-3xl leading-tight text-ink">{syllabus.courseTitle}</h2>
          {syllabus.instructor ? <p className="mt-1 text-sm text-ink-soft">{syllabus.instructor}</p> : null}
          {syllabus.summary ? (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-ink-soft">{syllabus.summary}</p>
          ) : null}
        </div>

        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink">Hours you can study</h3>
            <p className="text-xs text-ink-soft">{weekly}h / week</p>
          </div>
          <div className="mt-3 space-y-1.5">
            {WEEK_ORDER.map((index) => (
              <HourStepper
                key={index}
                label={WEEKDAY_LABELS_SUNDAY_FIRST[index] ?? "Day"}
                value={availability.hoursByWeekday[index] ?? 0}
                onChange={(hours) => setHours(index, hours)}
              />
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Start</span>
            <input
              className="field mt-1"
              type="date"
              value={startDate}
              onChange={(event) => onStartDate(event.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">Block</span>
            <select
              className="field mt-1"
              value={sessionMinutes}
              onChange={(event) => onSessionMinutes(Number(event.target.value))}
            >
              <option value={45}>45 min</option>
              <option value={60}>60 min</option>
              <option value={90}>90 min</option>
            </select>
          </label>
        </section>

        <button type="button" className="btn-primary w-full" onClick={onRebuild} disabled={busy}>
          {busy ? "Fitting the week…" : "Rebuild plan"}
        </button>
        {stale ? <p className="text-xs text-brass">Deadlines or hours changed. Rebuild to update the week.</p> : null}

        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink">Deadlines</h3>
            <p className={`text-xs ${Math.round(weight) === 100 ? "text-ink-soft" : "text-brass"}`}>
              {Math.round(weight * 10) / 10}% listed
            </p>
          </div>
          <ul className="mt-3 space-y-3">
            {syllabus.assessments.map((assessment) => {
              const past = assessment.dueDate < startDate;
              const budget = budgets.get(assessment.id);
              return (
                <li key={assessment.id} className={`rounded-xl border border-line bg-card p-3 ${past ? "opacity-60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-paper-deep px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                      {assessment.type}
                    </span>
                    {past ? <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Past</span> : null}
                  </div>
                  <input
                    className="mt-2 w-full bg-transparent font-medium text-ink outline-none"
                    aria-label={`${assessment.title} name`}
                    value={assessment.title}
                    onChange={(event) => onAssessment(assessment.id, { title: event.target.value })}
                  />
                  <div className="mt-2 grid grid-cols-[1fr_4.5rem] gap-2">
                    <input
                      className="field"
                      type="date"
                      aria-label={`${assessment.title} due date`}
                      value={assessment.dueDate}
                      onChange={(event) => {
                        if (event.target.value) onAssessment(assessment.id, { dueDate: event.target.value });
                      }}
                    />
                    <label className="relative">
                      <input
                        className="field pr-6"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        aria-label={`${assessment.title} weight`}
                        value={assessment.weight}
                        onChange={(event) => {
                        const weight = Number(event.target.value);
                        if (!Number.isFinite(weight)) return;
                        onAssessment(assessment.id, { weight: Math.min(100, Math.max(0, weight)) });
                      }}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-soft">%</span>
                    </label>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper-deep">
                    <div className="h-full rounded-full bg-teal" style={{ width: `${Math.min(100, assessment.weight)}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    {formatLongDate(assessment.dueDate)}
                    {budget ? ` · ${formatHours(budget.scheduledMinutes)} planned` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Topics ({syllabus.topics.length})</summary>
          <ul className="mt-3 space-y-2">
            {syllabus.topics.map((topic) => (
              <li key={topic.id} className="text-sm">
                <p className="font-medium text-ink">
                  {topic.weekLabel ? <span className="text-ink-soft">{topic.weekLabel}. </span> : null}
                  {topic.title}
                </p>
                {topic.description ? <p className="text-ink-soft">{topic.description}</p> : null}
              </li>
            ))}
          </ul>
        </details>

        <button type="button" className="btn-quiet px-0" onClick={onReset}>
          Start a different course
        </button>
      </div>
    </aside>
  );
}

function HourStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (hours: number) => void;
}) {
  function step(delta: number) {
    const next = Math.round((value + delta) * 2) / 2;
    onChange(Math.min(12, Math.max(0, next)));
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="w-10 text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" className="btn-quiet h-8 w-8 rounded-full px-0" aria-label={`Decrease ${label} hours`} onClick={() => step(-0.5)}>
          −
        </button>
        <span className="w-10 text-center text-sm tabular-nums">{value}h</span>
        <button type="button" className="btn-quiet h-8 w-8 rounded-full px-0" aria-label={`Increase ${label} hours`} onClick={() => step(0.5)}>
          +
        </button>
      </div>
    </div>
  );
}
