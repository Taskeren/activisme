import { Hono } from "hono";
import { AppLike } from "../index";
import { BungieAccessTokenMiddleware } from "../middleware/bnet-auth";
import { BUNGIE_API, newClient } from "../bungie";
import { getFriendList } from "@taskeren/bungie-api-ts/social";
import {
  BungieMembershipType,
  DestinyComponentType,
  getProfile,
} from "@taskeren/bungie-api-ts/destiny2";
import {
  GeneralUser,
  getMembershipDataForCurrentUser,
} from "@taskeren/bungie-api-ts/user";
import _ from "lodash";
import { unwrapResponse } from "../helper/bnet-api";
import pLimit from "p-limit";

const app: AppLike = new Hono();

export default app;

// Must-logged-in endpoints
app.use("/me/*", BungieAccessTokenMiddleware);

/**
 * Current logged-in user data.
 */
app.get("/me", async (c) => {
  const accessToken = c.get("bungieToken");
  const resp = await getMembershipDataForCurrentUser(
    newClient({ apiKey: c.env.BNET_API_KEY, accessToken }),
  );
  const data = unwrapResponse(resp);
  return c.json({ data });
});

/**
 * Stale friends list.
 *
 * List the friends ordering by the last login time.
 */
app.get("/me/stale-friends", async (c) => {
  const accessToken = c.get("bungieToken");
  const client = newClient({ apiKey: c.env.BNET_API_KEY, accessToken });
  const resp = await getFriendList(client);
  const friendListResponse = unwrapResponse(resp);
  const friends = friendListResponse.friends;

  // use p-limit to limit the concurrency.
  const limit = pLimit(20);

  // get last played time of the players in the friend list.
  // request and collect the promises in the array, and we'll await them later.
  // the maximum size is ~200, because that's the capacity of Bungie friend list.
  const promises: Promise<
    GeneralUser & { timestampLastPlayed: number | undefined }
  >[] = [];
  for (let friend of friends) {
    const user = friend.bungieNetUser;

    // skip not allowed membership types
    if (
      friend.lastSeenAsBungieMembershipType === BungieMembershipType.None ||
      friend.lastSeenAsBungieMembershipType === BungieMembershipType.All ||
      friend.lastSeenAsBungieMembershipType === BungieMembershipType.BungieNext
    ) {
      continue;
    }

    const membershipType = friend.lastSeenAsBungieMembershipType;
    const destinyMembershipId = friend.lastSeenAsMembershipId;
    try {
      promises.push(
        limit(() =>
          getProfile(client, {
            membershipType: membershipType,
            destinyMembershipId: destinyMembershipId,
            components: [DestinyComponentType.Characters],
          }).then((data) => {
            // find the last played character, and read the last played date.
            const characters = unwrapResponse(data).characters.data ?? [];
            const lastSeen = _.max(
              _.map(Object.values(characters), (c) =>
                new Date(c.dateLastPlayed).getTime(),
              ),
            );

            // return the user itself along with the last played date.
            return { ...user, timestampLastPlayed: lastSeen };
          }),
        ),
      );
    } catch (e) {
      console.error(
        `Error occurred while getting profile for ${membershipType} @ ${destinyMembershipId}`,
        e,
      );
    }
  }
  // wait for all promises.
  const awaited = await Promise.all(promises);
  // sort them by the last played time.
  const sorted = _.sortBy(awaited, (c) => c.timestampLastPlayed);

  // and we're done!
  return c.json({ data: sorted });
});
