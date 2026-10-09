import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AVAILABILITY,
  sessionsToIcs,
  startOfWeekMonday,
  todayISO,
  defaultStartDate,
  type Assessment,
  type Availability,
  type StudyPlan,
  type StudySession,
  type Syllabus,
} from "@atrium/shared";
import { askTutor, createPlan, extractSyllabus, fetchConfig, fetchSamplePdf, type PublicConfig } from "./api";
import { EmptyState } from "./components/EmptyState";
import { Mark } from "./components/Mark";
import { SessionDialog } from "./components/SessionDialog";
import { SyllabusPanel } from "./components/SyllabusPanel";
import { TutorPanel, type TutorMessage } from "./components/TutorPanel";
import { WeekCalendar } from "./components/WeekCalendar";
import { clearWorkspace, loadWorkspace, saveWorkspace } from "./storage";

type Phase = "idle" | "reading" | "planning";
type Tab = "plan" | "course" | "tutor";

export function App() {
  const stored = useMemo(() => loadWorkspace(), []);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [syllabus, setSyllabus] = useState<Syllabus | null>(stored?.syllabus ?? null);
  const [plan, setPlan] = useState<StudyPlan | null>(stored?.plan ?? null);
  const [availability, setAvailability] = useState<Availability>(stored?.availability ?? DEFAULT_AVAILABILITY);
  const [startDate, setStartDate] = useState(stored?.startDate || todayISO());
  const [sessionMinutes, setSessionMinutes] = useState(stored?.sessionMinutes || 60);
  const [messages, setMessages] = useState<TutorMessage[]>(stored?.messages ?? []);
  const [stale, setStale] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("plan");
  const [tutorOpen, setTutorOpen] = useState(false);
  const [tutorPending, setTutorPending] = useState(false);
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeekMonday(stored?.plan?.sessions[0]?.date ?? stored?.startDate ?? todayISO()),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch(() => setConfig({ demoMode: true, provider: "mock", maxUploadBytes: 5 * 1024 * 1024 }));
  }, []);

  useEffect(() => {
    document.title = syllabus ? `${syllabus.courseCode} · Atrium` : "Atrium — Study plans from your syllabus";
  }, [syllabus]);

  useEffect(() => {
    if (!syllabus) {
      clearWorkspace();
      return;
    }
    saveWorkspace({ syllabus, plan, availability, startDate, sessionMinutes, messages });
  }, [syllabus, plan, availability, startDate, sessionMinutes, messages]);

  async function ingest(file: File) {
    const limit = config?.maxUploadBytes ?? 5 * 1024 * 1024;
    if (file.size > limit) {
      setError(`That PDF is too large. The limit is ${Math.round(limit / (1024 * 1024))} MB.`);
      return;
    }
    const namedPdf = file.name.toLowerCase().endsWith(".pdf");
    if (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream" && !namedPdf) {
      setError("Upload a PDF syllabus.");
      return;
    }
    setError(null);
    setPhase("reading");
    try {
      const extracted = await extractSyllabus(file);
      const nextStart = defaultStartDate(extracted.syllabus, todayISO());
      setSyllabus(extracted.syllabus);
      setStartDate(nextStart);
      setMessages([]);
      setStale(false);
      setPhase("planning");
      const nextPlan = await createPlan({
        syllabus: extracted.syllabus,
        availability,
        startDate: nextStart,
        sessionMinutes,
      });
      setPlan(nextPlan);
      setWeekStart(startOfWeekMonday(nextPlan.sessions[0]?.date ?? nextStart));
      setTab("plan");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read that syllabus.");
    } finally {
      setPhase("idle");
    }
  }

  async function loadSample() {
    setError(null);
    setPhase("reading");
    try {
      const file = await fetchSamplePdf();
      setPhase("idle");
      await ingest(file);
    } catch (cause) {
      setPhase("idle");
      setError(cause instanceof Error ? cause.message : "Could not load the sample course.");
    }
  }

  async function rebuild() {
    if (!syllabus) return;
    if (syllabus.assessments.some((assessment) => assessment.title.trim().length === 0)) {
      setError("Give every deadline a name before rebuilding.");
      return;
    }
    setError(null);
    setPhase("planning");
    try {
      const nextPlan = await createPlan({ syllabus, availability, startDate, sessionMinutes });
      setPlan(nextPlan);
      setStale(false);
      const anchor = nextPlan.sessions.find((session) => session.date >= startDate)?.date ?? startDate;
      setWeekStart(startOfWeekMonday(anchor));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rebuild the plan.");
    } finally {
      setPhase("idle");
    }
  }

  function reset() {
    setSyllabus(null);
    setPlan(null);
    setMessages([]);
    setStale(false);
    setError(null);
    setSelectedId(null);
    clearWorkspace();
  }

  function editAssessment(id: string, patch: Partial<Assessment>) {
    setSyllabus((current) => {
      if (!current) return current;
      return {
        ...current,
        assessments: current.assessments.map((assessment) =>
          assessment.id === id ? { ...assessment, ...patch } : assessment,
        ),
      };
    });
    setStale(true);
  }

  function addSession(date: string) {
    if (!plan || !syllabus) return;
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`;
    const session: StudySession = {
      id,
      date,
      startMinutes: plan.dayStartHour * 60,
      durationMinutes: sessionMinutes,
      assessmentId:
        syllabus.assessments.find((assessment) => assessment.dueDate >= startDate)?.id ??
        syllabus.assessments[0]?.id ??
        "custom",
      title: "New study block",
      kind: "learn",
      topicIds: [],
    };
    setPlan({ ...plan, sessions: [...plan.sessions, session].sort(bySessionTime) });
    setSelectedId(id);
  }

  function saveSession(patch: Pick<StudySession, "title" | "date" | "startMinutes" | "durationMinutes" | "kind">) {
    if (!selectedId) return;
    setPlan((current) => {
      if (!current) return current;
      return {
        ...current,
        sessions: current.sessions
          .map((session) => (session.id === selectedId ? { ...session, ...patch } : session))
          .sort(bySessionTime),
      };
    });
    setWeekStart(startOfWeekMonday(patch.date));
    setSelectedId(null);
  }

  function deleteSession() {
    if (!selectedId) return;
    setPlan((current) => {
      if (!current) return current;
      return { ...current, sessions: current.sessions.filter((session) => session.id !== selectedId) };
    });
    setSelectedId(null);
  }

  function exportCalendar() {
    if (!syllabus || !plan || plan.sessions.length === 0) return;
    const ics = sessionsToIcs({
      calendarName: `Atrium · ${syllabus.courseCode} ${syllabus.courseTitle}`,
      courseCode: syllabus.courseCode,
      sessions: plan.sessions,
    });
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${syllabus.courseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-study-plan.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function sendTutor(message: string) {
    if (!syllabus) return;
    const history = messages.slice(-8).map((item) => ({ role: item.role, content: item.content }));
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    setTutorPending(true);
    setTutorOpen(true);
    setTab("tutor");
    try {
      const reply = await askTutor({ message, syllabus, plan, history });
      setMessages([...next, { role: "assistant", content: reply.answer, citations: reply.citations }]);
    } catch (cause) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: cause instanceof Error ? cause.message : "The tutor is unavailable right now.",
        },
      ]);
    } finally {
      setTutorPending(false);
    }
  }

  const selected = plan?.sessions.find((session) => session.id === selectedId) ?? null;
  const busy = phase !== "idle";

  return (
    <div className="flex h-dvh flex-col">
      <a href="#plan" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-3 focus:py-2">
        Skip to plan
      </a>
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-card/80 px-4 backdrop-blur sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-teal">
            <Mark />
          </span>
          <div className="min-w-0">
            <p className="font-serif text-2xl italic leading-none text-ink">Atrium</p>
            {syllabus ? (
              <p className="truncate text-xs text-ink-soft">
                {syllabus.courseCode} · {syllabus.courseTitle}
              </p>
            ) : (
              <p className="text-xs text-ink-soft">Study plans from a syllabus</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {config?.demoMode ? (
            <span className="rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink-soft sm:px-3" title="No API key is set. Extraction and the tutor use the local demo provider.">
              Demo mode
            </span>
          ) : (
            <span className="rounded-full bg-teal-soft px-2.5 py-1 text-xs font-semibold text-teal sm:px-3">
              Gemini
            </span>
          )}
          {syllabus ? (
            <>
              <button type="button" className="btn-secondary hidden lg:inline-flex xl:hidden" onClick={() => { setTutorOpen(true); setTab("tutor"); }}>
                Tutor
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={exportCalendar}
                disabled={!plan || plan.sessions.length === 0}
              >
                Export .ics
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error && syllabus ? (
        <div role="alert" className="border-b border-sienna/20 bg-sienna-soft px-4 py-2 text-sm text-sienna sm:px-6">
          {error}
        </div>
      ) : null}

      {!syllabus ? (
        <EmptyState busy={busy} error={error} onUpload={(file) => void ingest(file)} onSample={() => void loadSample()} />
      ) : (
        <>
          <nav className="flex border-b border-line bg-card lg:hidden" aria-label="Sections">
            {(["plan", "course", "tutor"] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={`flex-1 px-3 py-3 text-sm font-semibold capitalize ${tab === item ? "border-b-2 border-teal text-teal" : "text-ink-soft"}`}
                onClick={() => {
                  setTab(item);
                  setTutorOpen(item === "tutor");
                }}
              >
                {item === "course" ? "Course" : item === "plan" ? "Week" : "Tutor"}
              </button>
            ))}
          </nav>
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className={tab === "course" ? "flex min-h-0 flex-1 lg:flex lg:flex-none" : "hidden lg:flex"}>
              <SyllabusPanel
                syllabus={syllabus}
                plan={plan}
                availability={availability}
                startDate={startDate}
                sessionMinutes={sessionMinutes}
                stale={stale}
                busy={phase === "planning"}
                onAvailability={(next) => {
                  setAvailability(next);
                  setStale(true);
                }}
                onStartDate={(value) => {
                  setStartDate(value);
                  setStale(true);
                }}
                onSessionMinutes={(value) => {
                  setSessionMinutes(value);
                  setStale(true);
                }}
                onAssessment={editAssessment}
                onRebuild={() => void rebuild()}
                onReset={reset}
              />
            </div>
            <div id="plan" className={tab === "plan" ? "flex min-h-0 min-w-0 flex-1" : "hidden min-h-0 min-w-0 flex-1 lg:flex"}>
              <WeekCalendar
                syllabus={syllabus}
                plan={plan}
                weekStart={weekStart}
                stale={stale}
                busy={phase === "planning"}
                onWeek={setWeekStart}
                onSelect={setSelectedId}
                onAdd={addSession}
                onRebuild={() => void rebuild()}
              />
            </div>
            <div
              className={
                tab === "tutor" || tutorOpen
                  ? "flex min-h-0 w-full flex-1 overflow-hidden xl:w-[340px] xl:flex-none"
                  : "hidden min-h-0 overflow-hidden xl:flex xl:w-[340px] xl:flex-none"
              }
            >
              <TutorPanel
                messages={messages}
                pending={tutorPending}
                disabled={false}
                onSend={(message) => void sendTutor(message)}
                onClose={() => {
                  setTutorOpen(false);
                  setTab("plan");
                }}
              />
            </div>
          </div>
        </>
      )}

      <SessionDialog
        session={selected}
        others={(plan?.sessions ?? []).filter((session) => session.id !== selectedId)}
        onClose={() => setSelectedId(null)}
        onSave={saveSession}
        onDelete={deleteSession}
      />
    </div>
  );
}

function bySessionTime(a: StudySession, b: StudySession): number {
  return a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes;
}
