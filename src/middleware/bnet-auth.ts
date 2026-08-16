import { createMiddleware } from "hono/factory";
import { AppContext } from "../index";
import { getAccessTokenFromCookie } from "../helper/bnet-auth";

/**
 * Endpoints under this middleware can access the Bungie access token by `c.get('bungieToken')`, non-null.
 */
export const BungieAccessTokenMiddleware = createMiddleware<AppContext>(
  async (c, next) => {
    const tokenOrError = await getAccessTokenFromCookie(c);
    if (typeof tokenOrError === "string") {
      c.set("bungieToken", tokenOrError);
    } else {
      return c.json({ message: "Bungie login information is missing!" }, 401);
    }
    await next();
  },
);
