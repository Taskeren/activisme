import {
  DestinyActivityModeType,
  DestinyHistoricalStatsPeriodGroup,
} from "@taskeren/bungie-api-ts/destiny2";
import { HighlightBuilder } from "../helper/hightlight";
import {
  AnalyzedGroup,
  AnalyzedActivity,
  CompletionReason,
  CompletionState,
  GroupCompletionInfo,
  CompletionType,
  Highlight,
} from "../types/analyze";
import { HistoriesResponse, HistoriesResponse2 } from "../types/response";

export function updateResponse(
  response: HistoriesResponse,
  withRaw: boolean,
): HistoriesResponse2 {
  const analyzed = analyzeUserActivityHistories(response.histories, withRaw);
  return {
    ...response,
    histories: analyzed,
  };
}

export function analyzeUserActivityHistories(
  histories: DestinyHistoricalStatsPeriodGroup[],
  withRaw: boolean = false,
) {
  const groups = [] as DestinyHistoricalStatsPeriodGroup[][];
  for (let history of histories) {
    if (ignorable(history)) continue;

    const last = groups.at(-1);
    if (last !== undefined && mergeable(last[0], history)) {
      // merge if mergeable
      last.push(history);
    } else {
      // otherwise, create new group
      groups.push([history]);
    }
  }
  return groups.map((g) => analyze(g, withRaw));
}

function mergeable(
  a: DestinyHistoricalStatsPeriodGroup,
  b: DestinyHistoricalStatsPeriodGroup,
): boolean {
  return (
    a.activityDetails.directorActivityHash ===
      b.activityDetails.directorActivityHash ||
    a.activityDetails.referenceId === b.activityDetails.referenceId
  );
}

function ignorable(a: DestinyHistoricalStatsPeriodGroup): boolean {
  // ignore patrols (destination), so that they don't split Lost Sector histories.
  return hasAny(a.activityDetails.modes, DestinyActivityModeType.Patrol);
}

function analyze(
  gs: DestinyHistoricalStatsPeriodGroup[],
  withRaw: boolean,
): AnalyzedGroup {
  if (gs.length === 0) throw new Error("Empty groups are not allowed");

  const highlights = [] as Highlight[];
  const completion = {} as GroupCompletionInfo;
  const activities = gs.map((g) => analyzeOne(g, completion, withRaw));
  return {
    hash: gs[0].activityDetails.directorActivityHash,
    highlights,
    completion,
    activities,
  };
}

function analyzeOne(
  h: DestinyHistoricalStatsPeriodGroup,
  completionStates: GroupCompletionInfo,
  withRaw: boolean,
): AnalyzedActivity {
  const highlights = new HighlightBuilder();

  const modes = h.activityDetails.modes;

  const vCompleted = h.values.completed;
  let completionType: CompletionType = vCompleted
    ? vCompleted.basic.value === 1
      ? CompletionState.COMPLETED
      : CompletionState.INCOMPLETE
    : CompletionState.UNKNOWN;
  const vCompleteReason = h.values.completionReason;
  let completionReason: CompletionReason | undefined = undefined;

  if (hasAny(modes, DestinyActivityModeType.AllPvP)) {
    const standing = h.values.standing;
    if (standing) {
      // PvP specific completion state
      completionType =
        standing.basic.value === 0
          ? CompletionState.VICTORY
          : CompletionState.DEFEAT;

      if (vCompleteReason) {
        switch (vCompleteReason.basic.value) {
          case 0:
            // normal
            break;
          case 1:
            completionReason = CompletionReason.TIMER_FINISHED;
            break;
          case 2:
            completionReason = CompletionReason.FAILED;
            break;
          case 4:
            completionReason = CompletionReason.MERCY;
            break;
          default:
        }
      } else {
        console.warn("Unexpected PvP history data without 'standing'");
      }
    }
  }

  if (
    hasAny(
      modes,
      DestinyActivityModeType.Raid,
      DestinyActivityModeType.Nightfall,
      DestinyActivityModeType.ScoredNightfall,
    )
  ) {
    if (vCompleteReason && vCompleteReason.basic.value === 2) {
      // "completed" but failed, where you can see the PGCR screen, but you didn't actually complete it
      // situations:
      // 1) wiped on grandmaster
      // 2) died in legacy flawless runs, eg: Petra's Runs (Last Wish), Scourge of the Past, Crown of Sorrow
      // 3) harder version of seasonal activities, eg: The Coil (Season of Wish), Tomb of Elders (Episode: Revenant)
      completionReason = CompletionReason.FAILED;
    }
  }

  if (hasAny(modes, DestinyActivityModeType.AllPvP)) {
    // PvP highlights
    // K
    const vKills = h.values.kills;
    if (vKills && vKills.basic.value > 10) {
      highlights.addInt("kills", vKills.basic.value);
    }
    // KD
    const vKillsDeathsRatio = h.values.killsDeathsRatio;
    if (vKillsDeathsRatio && vKillsDeathsRatio.basic.value > 1.0) {
      highlights.addNum("kd", vKillsDeathsRatio.basic.value);
    }
    // KDA
    const vKillsDeathsAssists = h.values.killsDeathsAssists;
    if (vKillsDeathsAssists && vKillsDeathsAssists.basic.value > 1.5) {
      highlights.addNum("kda", vKillsDeathsAssists.basic.value);
    }
  }

  if (hasAny(modes, DestinyActivityModeType.Story)) {
    // Story highlights
    const vKills = h.values.kills;
    if (vKills && vKills.basic.value > 100) {
      highlights.addInt("kills", vKills.basic.value);
    }
  }

  if (
    hasAny(modes, DestinyActivityModeType.Dungeon, DestinyActivityModeType.Raid)
  ) {
    // End-game highlights
    // flawless
    const vDeaths = h.values.deaths;
    if (vDeaths && vDeaths.basic.value < 1) {
      highlights.addFlag("flawless");
    }
  }

  // finalize
  updateCompletionState(completionStates, completionType, completionReason);

  // find URLs
  let targetUrl: string | undefined;
  if (modes.includes(DestinyActivityModeType.Raid)) {
    targetUrl = `https://raid.report/pgcr/${h.activityDetails.instanceId}`;
  } else if (modes.includes(DestinyActivityModeType.Dungeon)) {
    targetUrl = `https://dungeon.report/pgcr/${h.activityDetails.instanceId}`;
  } else if (modes.includes(DestinyActivityModeType.ScoredNightfall)) {
    targetUrl = `https://gm.report/pgcr/${h.activityDetails.instanceId}`;
  } else if (modes.includes(DestinyActivityModeType.TrialsOfOsiris)) {
    targetUrl = `https://trials.report/pgcr/${h.activityDetails.instanceId}`;
  } else if (modes.includes(DestinyActivityModeType.AllPvP)) {
    targetUrl = `https://crucible.report/pgcr/${h.activityDetails.instanceId}`;
  }

  return {
    hash: h.activityDetails.referenceId,
    highlights: highlights.build(),
    completionType,
    completionReason,
    targetUrl,
    rawData: withRaw ? h : undefined,
  };
}

function hasAny<T>(src: T[], ...els: T[]): boolean {
  for (const el of els) {
    if (src.includes(el)) return true;
  }
  return false;
}

function updateCompletionState(
  c: GroupCompletionInfo,
  completion: CompletionType,
  reason?: CompletionReason,
) {
  let type = c[completion];
  if (!type) {
    // initialize if missing
    type = c[completion] = { count: 0, reasons: {} };
  }
  type.count += 1;
  if (reason) {
    type.reasons[reason] = (type.reasons[reason] ?? 0) + 1;
  }
}
