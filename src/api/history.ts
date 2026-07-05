import {
  BungieMembershipType,
  DestinyComponentType,
  DestinyHistoricalStatsPeriodGroup,
  DestinyInventoryItemDefinition,
  getActivityHistory,
  getDestinyEntityDefinition,
  getProfile,
  PlatformErrorCodes,
} from "@taskeren/bungie-api-ts/destiny2";
import { BUNGIE_API } from "../bungie";
import { HTTPException } from "hono/http-exception";
import _ from "lodash";
import { HistoriesResponse } from "../types/response";

const MAX_PAGE = 50;

export async function aggregateUserActivity(
  membershipType: BungieMembershipType,
  destinyMembershipId: string,
): Promise<HistoriesResponse> {
  const apiCallProfile = await getProfile(BUNGIE_API, {
    membershipType,
    destinyMembershipId,
    components: [
      DestinyComponentType.Characters,
      DestinyComponentType.Profiles,
    ],
  });
  if (apiCallProfile.ErrorCode !== PlatformErrorCodes.Success) {
    throw new HTTPException(500, { message: apiCallProfile.Message });
  }
  const { characters: rCharacters, profile } = apiCallProfile.Response;
  const userInfo = profile.data?.userInfo;
  if (userInfo === undefined) {
    throw new HTTPException(500, { message: "Missing user info" });
  }

  // the last played character
  const characters = rCharacters.data ?? {};
  const lastCharacter = _.head(Object.values(characters));
  const theEmblemHash = lastCharacter?.emblemHash;

  let emblemDefinition: DestinyInventoryItemDefinition | undefined;
  if (theEmblemHash) {
    const apiCallDefinition = await getDestinyEntityDefinition(BUNGIE_API, {
      hashIdentifier: theEmblemHash,
      entityType: "DestinyInventoryItemDefinition",
    });
    // assign if success; ignore otherwise.
    if (apiCallDefinition.ErrorCode === PlatformErrorCodes.Success) {
      emblemDefinition =
        apiCallDefinition.Response as unknown as DestinyInventoryItemDefinition;
    }
  }

  const histories = await listUserActivityHistory(
    membershipType,
    destinyMembershipId,
    Object.keys(characters),
    nDaysBefore(7),
  );

  return {
    userInfo,
    emblemDefinition,
    characters,
    histories,
  };
}

async function listUserActivityHistory(
  membershipType: BungieMembershipType,
  destinyMembershipId: string,
  characters: string[],
  beforeDate: Date,
): Promise<DestinyHistoricalStatsPeriodGroup[]> {
  const accumulator = [] as DestinyHistoricalStatsPeriodGroup[];
  for await (const character of characters) {
    const list = [] as DestinyHistoricalStatsPeriodGroup[];
    for (let page = 0; ; page++) {
      const apiCall = await getActivityHistory(BUNGIE_API, {
        characterId: character,
        membershipType,
        destinyMembershipId,
        page,
        count: 50,
      });
      if (apiCall.ErrorCode !== PlatformErrorCodes.Success) {
        throw new HTTPException(500, { message: apiCall.Message });
      }
      let activities = apiCall.Response.activities;
      if (activities.length === 0) break;
      // check time before the date
      const lengthUnfiltered = activities.length;
      activities = activities.filter((g) => {
        const thisTime = new Date(g.period);
        return thisTime.getTime() >= beforeDate.getTime();
      });
      console.debug(
        `getActivityHistory(${membershipType} @ ${destinyMembershipId}, character ${characters}, page ${page}): ${lengthUnfiltered} entries (${lengthUnfiltered - activities.length} filtered)`,
      );
      list.push(...activities);
      if (lengthUnfiltered !== activities.length) {
        // something's filtered, stop fetching!
        break;
      }
      if (page >= MAX_PAGE) break;
    }
    accumulator.push(...list);
  }
  accumulator.sort(
    (a, b) => new Date(b.period).getTime() - new Date(a.period).getTime(),
  );
  return accumulator;
}

function nDaysBefore(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
