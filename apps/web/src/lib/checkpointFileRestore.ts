import type { CommandId, OrchestrationEvent } from "@synara/contracts";

const FILE_RESTORE_COMPLETION_TIMEOUT_MS = 120_000;

export function waitForCheckpointFileRestore(input: {
  requestCommandId: CommandId;
  subscribe: (listener: (event: OrchestrationEvent) => void) => () => void;
  timeoutMs?: number;
}): { promise: Promise<void>; cancel: () => void } {
  let unsubscribe = () => {};
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  const cleanup = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
    unsubscribe();
  };
  const promise = new Promise<void>((resolve, reject) => {
    unsubscribe = input.subscribe((event) => {
      if (
        (event.type !== "thread.checkpoint-files-restored" &&
          event.type !== "thread.checkpoint-files-restore-failed") ||
        event.payload.requestCommandId !== input.requestCommandId
      ) {
        return;
      }
      settled = true;
      cleanup();
      if (event.type === "thread.checkpoint-files-restore-failed") {
        reject(new Error(event.payload.detail));
      } else {
        resolve();
      }
    });
    timeoutId = setTimeout(() => {
      settled = true;
      cleanup();
      reject(new Error("Timed out waiting for file changes to be restored."));
    }, input.timeoutMs ?? FILE_RESTORE_COMPLETION_TIMEOUT_MS);
  });

  return {
    promise,
    cancel: () => {
      if (!settled) cleanup();
    },
  };
}
