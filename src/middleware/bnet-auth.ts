import { createMiddleware } from "hono/factory";
import { AppContext } from "../index";
import {
  GetAccessTokenFromCookieError,
  getAccessTokenInformation,
} from "../helper/bnet-auth";

/**
 * Endpoints under this middleware can access the Bungie access token by `c.get('bungieToken')`, non-null.
 */
export const BungieAccessTokenMiddleware = createMiddleware<AppContext>(
  async (c, next) => {
    const info = await getAccessTokenInformation(c);
    if (typeof info !== "number") {
      c.set("bungieToken", info.access_token);
      c.set("membershipId", info.membership_id);
    } else {
      return c.json(
        { message: "Bungie login information is missing!", reason: info },
        401,
      );
    }
    await next();
  },
);
