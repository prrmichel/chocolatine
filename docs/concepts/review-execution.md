# Review Execution

> How the review queue works: concurrency, deduplication, chunking, and usage diagnostics.

## Overview

When you start a review, the job doesn't run immediately in the renderer. Instead, it is enqueued in the main process's review queue and processed asynchronously. The queue manages concurrency, deduplication, runtime prompt assembly, branch-context preparation, diff chunking when needed, and broadcasting progress back to the UI. Standard branch-aware launch now also depends on a configured **review worktree root folder** before the queue can begin preparing branch context.

## Queue Mechanics

### Enqueue → Process → Complete

1. **Enqueue** — A review request is added to the in-memory queue with status `queued`.
2. **Dequeue** — When a slot opens (based on max concurrency), the next job moves to `running`.
3. **Process** — The main process resolves the effective review mode, builds the runtime prompt contract, sends it to Copilot, and streams the response.
4. **Complete** — The job moves to `completed` (or `failed`). Results are parsed and optionally persisted to disk.
5. **Broadcast** — Every state change emits a `REVIEW_QUEUE_CHANGED` event to the renderer.

### Concurrency

- Controlled by **Max concurrent reviews** in [Preferences](../settings/preferences.md).
- Multiple jobs can run in parallel up to this limit.
- Queued jobs wait until a running slot opens.

### Deduplication

Reviews are deduplicated by a composite key: **PR + repository + model + task type**. If you try to enqueue a review that matches an existing queued or running job, it is rejected. Completed jobs can be re-queued (see Re-review below).

## Prompt Assembly

Branch-aware and diff-only reviews no longer use the same prompt payload:

- **Branch-aware review** injects the prompt template, PR context, and a structured PR change-boundary block. The reviewer is expected to inspect the PR delta locally from the prepared review worktree.
- **Manual diff-only review** and **diff-only fallback** inject the prompt template, PR context, and pasted unified diff text.
- The main process owns this final assembly so it can switch from branch-aware to fallback review after branch-context preparation succeeds or fails.
- A missing review worktree root folder is a pre-launch prerequisite failure, not a normal fallback case. In that state the queue rejects standard branch-aware launch until the setting is configured, while the explicit diff-only override remains available.

## Diff Chunking

Large PRs with many changed files can produce diff-text payloads that exceed the model's input capacity. The app handles this by:

1. Collecting all file diffs for the PR.
2. Splitting the diffs into **batches** that fit within a character budget.
3. Sending each batch as a separate prompt to the model.
4. Aggregating the results into a single review job.

This only applies to **manual diff-only** reviews and **diff-only fallback** reviews. Standard branch-aware reviews do not use diff chunking because they inspect the PR delta from the review worktree instead of pasting diff text into the prompt.

## Usage Diagnostics

During pull request reviews, SDK usage events are normalized into token-first diagnostics:

- Live diagnostics are emitted in debug logs while a run executes.
- A compact **attempt usage summary** is persisted with each new review attempt.
- Token counts are primary; request count, duration, and cost remain secondary metadata when available.

## Re-Review

When you re-queue a completed review:

1. The previous results are saved to the job's **history**.
2. The job is re-enqueued with the same prompt and model.
3. The Copilot **session is reused**, so the model has context from prior analysis.
4. Metadata (attempt number, reuse flag) is injected into the prompt.

This lets you iterate: review → adjust instructions → re-review with accumulated context.

## Related

- [Reviews Tab](../features/pull-requests/reviews-tab.md) — Where reviews are started and inspected.
- [Task Queue](../features/task-queue.md) — Real-time job monitoring.
- [Preferences Settings](../settings/preferences.md) — Concurrency configuration.
- [Session Management](session-management.md) — How sessions are reused across re-reviews.
