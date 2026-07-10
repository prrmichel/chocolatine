# Quota Indicator

> Monitor your Copilot `premium_interactions` usage right from the app header.

## Overview

The Quota Indicator is a compact progress bar in the Chocolatine header bar that displays your current Copilot `premium_interactions` quota. It shows how many requests you've used out of your entitlement, color-coded by consumption level, and includes overage visualization when you've exceeded your monthly limit.

The indicator polls the Copilot account API every 5 minutes and lets you manually refresh at any time.

## How to Access

The Quota Indicator is always visible in the top-right area of the app header, next to the navigation actions. No configuration is required — it appears automatically once you're signed into Copilot.

## Key Capabilities

### Color-Coded Usage Bar

The progress bar changes color based on your consumption percentage:

| Color  | Consumption     |
| ------ | --------------- |
| Green  | Under 50%       |
| Yellow | 50% to 80%      |
| Red    | Over 80%        |

### Overage Visualization

When you exceed your monthly entitlement, the bar extends with a striped segment showing overage requests. The label switches from percentage to absolute counts (e.g., `1.2K / 1K (+200)`).

### Detailed Tooltip

Click the bar to open a tooltip with a full breakdown:

- Used vs. entitlement counts
- Consumption percentage with remaining requests
- A mini progress bar matching the compact version
- Overage details when applicable
- Whether usage and overage are allowed after exhaustion
- Last refresh timestamp

### Manual Refresh

Hover over the bar to reveal a refresh button on the left edge. Click it to fetch the latest quota data immediately. The icon spins while a refresh is in progress.

## States

| State           | Description                                                        |
| --------------- | ------------------------------------------------------------------ |
| **Loading**     | Initial state — quota data is being fetched.                       |
| **Loaded**      | Normal state — shows the color-coded bar with usage data.          |
| **Refreshing**  | Manual refresh in progress — shows the previous snapshot dimmed.   |
| **Unlimited**   | Account has an unlimited plan — displays an infinity (`∞`) symbol. |
| **Not Available** | The `premium_interactions` quota type is not present in the API response. |
| **Error**       | API call failed — displays "Err" with a retry option.              |

## Edge Cases

- **Unlimited plans** — When `isUnlimitedEntitlement` is `true`, the bar fills green at 100% width with an `∞` label.
- **Missing quota type** — If the Copilot API doesn't return a `premium_interactions` snapshot, the indicator shows "N/A".
- **Network or API errors** — Errors are caught gracefully and displayed as "Err" in the bar. You can retry with the refresh button.

## Tips

- The indicator only tracks `premium_interactions`. Other quota types (`chat`, `completions`) from the API are not displayed.
- The bar updates automatically every 5 minutes. Use manual refresh if you've just completed a large batch of reviews and want immediate feedback.
- Tooltip closes when you click outside the component — click the bar again to toggle it.
