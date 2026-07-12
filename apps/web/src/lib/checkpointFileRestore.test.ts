import { CommandId, EventId, MessageId, ThreadId } from "@synara/contracts";
import { describe, expect, it, vi } from "vitest";

import { waitForCheckpointFileRestore } from "./checkpointFileRestore";

const requestCommandId = CommandId.makeUnsafe("restore-request");

function makeHarness() {
  let listener: Parameters<
    Parameters<typeof waitForCheckpointFileRestore>[0]["subscribe"]
  >[0] = () => {};
  const wait = waitForCheckpointFileRestore({
    requestCommandId,
    subscribe: (next) => {
      listener = next;
      return () => {};
    },
    timeoutMs: 10,
  });
  const base = {
    sequence: 1,
    eventId: EventId.makeUnsafe("event-1"),
    aggregateKind: "thread" as const,
    aggregateId: ThreadId.makeUnsafe("thread-1"),
    occurredAt: "2026-07-12T00:00:00.000Z",
    commandId: null,
    causationEventId: null,
    correlationId: null,
    metadata: {},
  };
  return { wait, listener, base };
}

describe("waitForCheckpointFileRestore", () => {
  it("resolves matching success and rejects matching failure immediately", async () => {
    const success = makeHarness();
    success.listener({
      ...success.base,
      type: "thread.checkpoint-files-restored",
      payload: {
        threadId: ThreadId.makeUnsafe("thread-1"),
        messageId: MessageId.makeUnsafe("message-1"),
        turnCount: 0,
        requestCommandId,
      },
    });
    await expect(success.wait.promise).resolves.toBeUndefined();

    const failure = makeHarness();
    failure.listener({
      ...failure.base,
      type: "thread.checkpoint-files-restore-failed",
      payload: {
        threadId: ThreadId.makeUnsafe("thread-1"),
        messageId: MessageId.makeUnsafe("message-1"),
        turnCount: 0,
        requestCommandId,
        detail: "Checkpoint is unavailable.",
      },
    });
    await expect(failure.wait.promise).rejects.toThrow("Checkpoint is unavailable.");
  });

  it("rejects when no terminal event arrives before the timeout", async () => {
    vi.useFakeTimers();
    const harness = makeHarness();
    const rejection = expect(harness.wait.promise).rejects.toThrow(
      "Timed out waiting for file changes to be restored.",
    );
    await vi.advanceTimersByTimeAsync(10);
    await rejection;
    vi.useRealTimers();
  });
});
