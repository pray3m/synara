// FILE: EnvironmentSubagentsSection.tsx
// Purpose: "Subagents" section of the Environment panel — one row per provider task/
//          subagent (Claude Task tool, workflows) with live status, elapsed time and
//          token usage, mirroring the Claude CLI tasks panel. Rows open the subagent's
//          child thread; running rows expose a Stop control.
// Layer: Environment panel section

import { useEffect, useMemo, useState } from "react";
import type { ThreadId } from "@t3tools/contracts";

import { IconButton } from "~/components/ui/icon-button";
import { formatContextWindowTokens } from "~/lib/contextWindow";
import { StopIcon } from "~/lib/icons";
import { subagentAccentColor } from "~/lib/subagentPresentation";
import { cn } from "~/lib/utils";
import { formatClockDuration, type SubagentTaskState } from "~/session-logic";

import { EnvironmentCollapsibleSection, EnvironmentSectionDivider } from "./EnvironmentRow";

export interface EnvironmentSubagentPanelItem {
  readonly task: SubagentTaskState;
  /** Child thread id (`subagent:{parentThreadId}:{taskId}`) the row navigates to. */
  readonly threadId: ThreadId;
}

const SUBAGENT_STATUS_LABELS: Record<SubagentTaskState["status"], string> = {
  running: "Running",
  paused: "Paused",
  completed: "Done",
  failed: "Failed",
  stopped: "Stopped",
};

function subagentElapsedMs(task: SubagentTaskState, nowMs: number): number | null {
  // While running, always show live wall-clock time: the provider-reported
  // durationMs only refreshes on sparse progress ticks, which would freeze the
  // clock next to a pulsing status dot. Settled/paused rows prefer the
  // provider's authoritative duration (it excludes paused time).
  const running = task.status === "running" && task.completedAt === null;
  if (!running && task.durationMs !== null) {
    return task.durationMs;
  }
  const startedAt = Date.parse(task.startedAt);
  if (Number.isNaN(startedAt)) {
    return task.durationMs;
  }
  const endedAt = task.completedAt !== null ? Date.parse(task.completedAt) : nowMs;
  return Number.isNaN(endedAt) || endedAt < startedAt ? task.durationMs : endedAt - startedAt;
}

function subagentTrailingLabel(task: SubagentTaskState, nowMs: number): string {
  const parts: string[] = [];
  const elapsedMs = subagentElapsedMs(task, nowMs);
  if (elapsedMs !== null) {
    parts.push(formatClockDuration(elapsedMs));
  }
  if (task.totalTokens !== null && task.totalTokens > 0) {
    parts.push(`${formatContextWindowTokens(task.totalTokens)} tok`);
  }
  if (task.status !== "running") {
    parts.push(SUBAGENT_STATUS_LABELS[task.status]);
  } else if (task.isBackgrounded) {
    parts.push("Background");
  }
  return parts.join(" · ");
}

function SubagentStatusDot({ task }: { task: SubagentTaskState }) {
  const accent = subagentAccentColor(task.description);
  const settled = task.status !== "running" && task.status !== "paused";
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        task.status === "running" && "motion-safe:animate-pulse",
        settled && "opacity-45",
      )}
      style={{
        backgroundColor: task.status === "failed" ? "var(--color-text-destructive)" : accent,
      }}
    />
  );
}

export function EnvironmentSubagentsSection({
  subagents,
  onOpenSubagent,
  onStopSubagent,
}: {
  subagents: readonly EnvironmentSubagentPanelItem[];
  onOpenSubagent: (threadId: ThreadId) => void;
  onStopSubagent: (threadId: ThreadId) => void;
}) {
  const hasRunning = useMemo(
    () => subagents.some(({ task }) => task.status === "running" && task.completedAt === null),
    [subagents],
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick the elapsed column only while something is actually running.
  useEffect(() => {
    if (!hasRunning) {
      return;
    }
    const interval = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [hasRunning]);

  if (subagents.length === 0) {
    return null;
  }

  return (
    <>
      <EnvironmentSectionDivider />
      <EnvironmentCollapsibleSection label="Subagents">
        <div className="flex flex-col gap-0.5">
          {subagents.map(({ task, threadId }) => {
            const roleLabel = task.subagentType ?? null;
            return (
              <div key={task.taskId} className="group/subagent relative">
                <button
                  type="button"
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left",
                    "text-[length:var(--app-font-size-ui,12px)] font-normal text-[var(--color-text-foreground)]",
                    "outline-none transition-colors",
                    "hover:bg-[var(--color-background-elevated-secondary)]",
                    "focus-visible:bg-[var(--color-background-elevated-secondary)]",
                  )}
                  title={task.prompt ?? task.description}
                  onClick={() => onOpenSubagent(threadId)}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <SubagentStatusDot task={task} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{task.description}</span>
                    <span className="block truncate text-[11px] text-[var(--color-text-foreground-secondary)] tabular-nums">
                      {roleLabel ? `${roleLabel} · ` : ""}
                      {subagentTrailingLabel(task, nowMs)}
                    </span>
                  </span>
                </button>
                {task.status === "running" || task.status === "paused" ? (
                  <IconButton
                    label="Stop subagent"
                    tooltip="Stop subagent"
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover/subagent:opacity-100"
                    onClick={() => onStopSubagent(threadId)}
                  >
                    <StopIcon className="size-3.5" />
                  </IconButton>
                ) : null}
              </div>
            );
          })}
        </div>
      </EnvironmentCollapsibleSection>
    </>
  );
}
