export const CompletionState = {
  UNKNOWN: "unknown",
  INCOMPLETE: "incomplete",
  COMPLETED: "completed",

  VICTORY: "victory",
  DEFEAT: "defeat",
} as const;

export type CompletionType =
  (typeof CompletionState)[keyof typeof CompletionState];

export const CompletionReason = {
  TIMER_FINISHED: "timer_finished",
  FAILED: "failed",
  MERCY: "mercy",
} as const;

export type CompletionReason =
  (typeof CompletionReason)[keyof typeof CompletionReason];

export type CompletionData = {
  count: number;
  reasons: Partial<Record<CompletionReason, number>>;
};

export type GroupCompletionInfo = Partial<Record<CompletionType, CompletionData>>;

export type Highlight = string | [string, string];

export interface AnalyzedActivity {
  hash: number;
  highlights: Highlight[];
  completionType: CompletionType;
  completionReason?: CompletionReason;

  targetUrl?: string;
  rawData?: unknown;
}

export interface AnalyzedGroup {
  hash: number;
  highlights: Highlight[];
  completion: GroupCompletionInfo;
  activities: AnalyzedActivity[];
}
