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

export type CompletionStates = Partial<
  Record<
    CompletionType,
    {
      count: number;
      reasons: Partial<Record<CompletionReason, number>>;
    }
  >
>;

export type Highlight = string | [string, string];

export interface AnalyzedGroupEntry {
  hash: number;
  highlights: Highlight[];
  completionType: CompletionType;
  completionReason?: CompletionReason;

  targetUrl?: string;
  rawData?: unknown;
}

export interface AnalyzedGroupData {
  info: {
    // activity hash
    hash: number;
    highlights: Highlight[];
    completionStates: CompletionStates;
  };
  entries: AnalyzedGroupEntry[];
}
