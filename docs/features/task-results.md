# Task Results

> Inspect raw model outputs for completed review and summary jobs.

## Overview

The Task Results view is a debug/inspection screen that shows the raw Copilot output for completed jobs. While the Reviews Tab parses findings into a structured UI, this view displays the unprocessed model response. It is accessed through the **bug icon** in the title bar rather than the main tab list.

## How to Access

Click the **bug icon** in the application title bar to toggle the Task Results view.

## Key Capabilities

- Browse **completed job outputs**.
- See **task type**, **model**, **status**, and **batch label** for each job.
- **Copy the raw response** — The full, unprocessed text output from the model.

## Walkthrough

1. Run one or more reviews from the [Reviews Tab](pull-requests/reviews-tab.md).
2. Wait for them to complete.
3. Click the **bug icon** in the title bar.
4. Browse the completed jobs.
5. Click **Copy** on a job to get the raw model output for further analysis.

## Tips & Best Practices

- Use this view when findings in the Reviews Tab look unexpected — the raw output can reveal parsing issues or unusual model behavior.
- This is useful for debugging prompt templates. Compare the raw output to what the structured view shows.
- The raw response is the verbatim model output before any parsing or severity classification.

## Related

- [Task Queue](task-queue.md) — Monitor jobs while they're running.
- [Reviews Tab](pull-requests/reviews-tab.md) — Parsed/structured view of the same results.
