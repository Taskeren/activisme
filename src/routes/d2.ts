import { Hono } from "hono";
import { AppLike } from "../index";
import { BungieAccessTokenMiddleware } from "../middleware/bnet-auth";
import { newClient } from "../bungie";
import { getFriendList } from "@taskeren/bungie-api-ts/social";
import {
  BungieMembershipType,
  DestinyComponentType,
  getProfile,
} from "@taskeren/bungie-api-ts/destiny2";
import { GeneralUser } from "@taskeren/bungie-api-ts/user";
import _ from "lodash";
import { unwrapResponse } from "../helper/bnet-api";

const app: AppLike = new Hono();

export default app;

// Must-logged-in endpoints
app.use("/me/*", BungieAccessTokenMiddleware);

/**
 * Stale friends list.
 *
 * List the friends ordering by the last login time.
 */
app.get("/me/stale-friends", async (c) => {
  const accessToken = c.get("bungieToken");
  const client = newClient({ accessToken });
  const resp = await getFriendList(client);
  const friendListResponse = unwrapResponse(resp);
  const friends = friendListResponse.friends;

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

    promises.push(
      getProfile(client, {
        membershipType: friend.lastSeenAsBungieMembershipType,
        destinyMembershipId: friend.lastSeenAsMembershipId,
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
    );
  }
  // wait for all promises.
  const awaited = await Promise.all(promises);
  // sort them by the last played time.
  const sorted = _.sortBy(awaited, (c) => c.timestampLastPlayed);

  // and we're done!
  return c.json({ data: sorted });
});
