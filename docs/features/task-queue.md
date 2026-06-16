# Task Queue

> Monitor and control running and queued review jobs.

## Overview

The Task Queue tab is an operational dashboard for background jobs. When you start a review, the job is enqueued and processed according to the concurrency limit. This tab shows real-time progress, lets you cancel jobs, and provides a clear view of what the app is doing at any moment.

## How to Access

Click **Task Queue** in the main navigation tab bar. The tab label also appears in the visual indicators when jobs are running.

## Key Capabilities

### Queue Summary

- **Running count** — Number of jobs currently processing.
- **Queued count** — Number of jobs waiting to start.

### Per-Job Details

- **Task type** — Code review or changes summary.
- **Status** — Queued, running, completed, failed.
- **Model** used for the job.
- **Batch label** — Identifier for runs split into multiple diff batches.
- **Progress bar** — Percentage completion for running jobs.
- **Elapsed time** — How long the job has been running.

### Job Control

- **Cancel queued jobs** — Remove jobs that haven't started yet.
- **Cancel running jobs** — Stop in-progress reviews.
- **Clear results** — Remove completed job entries from the in-memory queue display.

## Walkthrough

1. Start one or more reviews from the [Reviews Tab](pull-requests/reviews-tab.md).
2. Switch to the **Task Queue** tab to monitor progress.
3. Observe the running/queued counts and per-job progress bars.
4. If a job is taking too long or was started by mistake, click **Cancel**.
5. Once jobs complete, they remain in the list until you clear them.

## Tips & Best Practices

- The concurrency limit is configurable in [Preferences](../settings/preferences.md). Increase it if you have a fast connection and want reviews to run in parallel.
- Completed jobs also appear in the PR's [Reviews Tab](pull-requests/reviews-tab.md) with parsed findings. The Task Queue shows the raw job status.
- Use **Clear results** to keep the queue view clean after a batch of reviews finishes.

## Related

- [Reviews Tab](pull-requests/reviews-tab.md) — Where reviews are started.
- [Task Results](task-results.md) — Inspect raw model output.
- [Preferences Settings](../settings/preferences.md) — Max concurrent reviews.
- [Review Execution](../concepts/review-execution.md) — Queue mechanics and concurrency.
