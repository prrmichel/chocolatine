/** A single quota type snapshot returned by the Copilot account API (e.g., premium_interactions, chat, completions). */
export type CopilotQuotaSnapshot = {
  readonly isUnlimitedEntitlement: boolean;
  readonly entitlementRequests: number;
  readonly usedRequests: number;
  readonly usageAllowedWithExhaustedQuota: boolean;
  readonly overage: number;
  readonly overageAllowedWithExhaustedQuota: boolean;
  readonly resetDate?: string;
};

/** Result of the `account.getQuota()` RPC, keyed by quota type string. */
export type CopilotQuotaData = {
  readonly quotaSnapshots: Record<string, CopilotQuotaSnapshot | undefined>;
};
