import { HttpClient } from "@taskeren/bungie-api-ts/http";
import { BungieMembershipType } from "@taskeren/bungie-api-ts/destiny2";
import { HTTPException } from "hono/http-exception";

// :D
// it's ok to leak this.
const KEY = "91a8fa1d61494a89bd94e7382304dd04";

function newClient(apiKey: string): HttpClient {
  return async (config) => {
    const url = new URL(config.url);
    for (const key in config.params) {
      url.searchParams.set(key, config.params[key]);
    }

    const r = await fetch(url, {
      method: config.method,
      body: JSON.stringify(config.body),
      headers: {
        "X-API-Key": apiKey,
      },
    });

    return await r.json();
  };
}

export const BUNGIE_API = newClient(KEY);

export function parseMembershipType(
  s: string,
): BungieMembershipType {
  const i = parseInt(s);
  for (let [_, v] of Object.entries(BungieMembershipType)) {
    if (i === v) {
      return v as BungieMembershipType;
    }
  }
  throw new HTTPException(400, {
    message: `Membership type "${s}" is invalid`,
  });
}
