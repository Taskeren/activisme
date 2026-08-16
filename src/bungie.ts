import { HttpClient } from "@taskeren/bungie-api-ts/http";
import { BungieMembershipType } from "@taskeren/bungie-api-ts/destiny2";
import { HTTPException } from "hono/http-exception";
import _ from "lodash";

// :D
// it's ok to leak this.
const KEY = "91a8fa1d61494a89bd94e7382304dd04";

export type NewClientOptions = {
  apiKey?: string;
  accessToken?: string;
};

/**
 * Use this function to create a client with access tokens.
 */
export function newClient(options: NewClientOptions = {}): HttpClient {
  const { apiKey, accessToken } = {
    apiKey: KEY,
    // overwrite the default values.
    ...options,
  };

  return async (config) => {
    const url = new URL(config.url);
    for (const key in config.params) {
      url.searchParams.set(key, config.params[key]);
    }

    const body = JSON.stringify(config.body);

    const headers = new Headers();
    headers.set("X-API-Key", apiKey);
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    console.log(
      `Sending requests to Bungie API: ${_.trimStart(config.url, "https://www.bungie.net/Platform")}`,
      accessToken
        ? `with access token (${accessToken})`
        : "without access token",
    );

    const r = await fetch(url, {
      method: config.method,
      body,
      headers,
    });

    return await r.json();
  };
}

export const BUNGIE_API = newClient();

export function parseMembershipType(s: string): BungieMembershipType {
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

const BungieMembershipTypeInvert = _.invert(BungieMembershipType);

export function getBungieMembershipTypeName(
  type: BungieMembershipType,
): string {
  return BungieMembershipTypeInvert[type];
}
