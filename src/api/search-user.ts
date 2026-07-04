import { HTTPException } from "hono/http-exception";
import {
  BungieMembershipType,
  PlatformErrorCodes,
  searchDestinyPlayerByBungieName,
} from "@taskeren/bungie-api-ts/destiny2";
import { BUNGIE_API } from "../bungie";
import {
  searchByGlobalNamePost,
  UserInfoCard,
  UserSearchResponseDetail,
} from "@taskeren/bungie-api-ts/user";

const MAX_PAGE = 50;

export async function searchUser(
  payload: string,
  mainOnly: boolean = false,
): Promise<UserInfoCard[]> {
  const hash = payload.indexOf("#");
  if (hash !== -1) {
    // <name>#<code>
    const name = payload.substring(0, hash);
    const code = parseInt(payload.substring(hash + 1));

    if (isNaN(code)) {
      throw new HTTPException(400, { message: `Invalid code (${code})` });
    }

    const apiCall = await searchDestinyPlayerByBungieName(
      BUNGIE_API,
      { membershipType: BungieMembershipType.All },
      {
        displayName: name,
        displayNameCode: code,
      },
    );
    if (apiCall.ErrorCode !== PlatformErrorCodes.Success) {
      throw new HTTPException(500, { message: apiCall.Message });
    }
    return apiCall.Response.filter(
      (d) => !mainOnly || d.crossSaveOverride === d.membershipType,
    );
  } else {
    const list = [] as UserSearchResponseDetail[];
    for (let page = 0; ; page++) {
      const apiCall = await searchByGlobalNamePost(
        BUNGIE_API,
        { page },
        { displayNamePrefix: payload },
      );
      if (apiCall.ErrorCode !== PlatformErrorCodes.Success) {
        throw new HTTPException(500, { message: apiCall.Message });
      }
      const apiData = apiCall.Response;
      list.push(
        ...apiData.searchResults.filter((d) => d.destinyMemberships.length > 0),
      );
      if (!apiData.hasMore) break;
      if (page >= MAX_PAGE) break;
    }
    // sort by the suffix code
    list.sort((d) => d.bungieGlobalDisplayNameCode ?? -1);
    // map to UserInfoCard instances
    return list
      .map((d) => d.destinyMemberships)
      .flat()
      .filter((d) => !mainOnly || d.crossSaveOverride === d.membershipType);
  }
}
