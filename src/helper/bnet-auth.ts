import { AppContext } from "../index";
import { getCookie } from "hono/cookie";
import { Context } from "hono";

export type GetAccessTokenResponse = {
  access_token: string;
  expires_in: number;
  membership_id: string;
  refresh_token?: string;
  refresh_expires_in: number;
};

export type AccessTokenData = GetAccessTokenResponse & {
  expires_at: number;
  refresh_expires_at: number;
};

export async function getAccessToken(
  env: AppContext["Bindings"],
  data:
    | { grant_type: "authorization_code"; code: string }
    | { grant_type: "refresh_token"; refresh_token: string },
): Promise<AccessTokenData | null> {
  const body = new URLSearchParams({
    ...data,
    client_id: env.BNET_CLIENT_ID,
    client_secret: env.BNET_CLIENT_SECRET,
  });
  const resp = await fetch("https://www.bungie.net/platform/app/oauth/token/", {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!resp.ok) {
    console.log("OAuth2 failed", await resp.text());
    return null;
  }

  const tokenInfo = await resp.json<GetAccessTokenResponse>();
  return {
    ...tokenInfo,
    expires_at: new Date().getTime() + tokenInfo.expires_in,
    refresh_expires_at: new Date().getTime() + tokenInfo.refresh_expires_in,
  };
}

export enum GetAccessTokenFromCookieError {
  SESSION_ID_MISSING_COOKIE,
  SESSION_ID_MISSING_KV,
  SESSION_MALFORMED,
  SESSION_EXPIRED_CANT_REFRESH,
  SESSION_EXPIRED_REFRESH_ERROR,
}

export async function getAccessTokenInformation(
  c: Context<AppContext, any, any>,
) {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return GetAccessTokenFromCookieError.SESSION_ID_MISSING_COOKIE;
  }

  const sessionInfoStr = await c.env.BNET_TOKEN.get(`session:${sessionId}`);
  if (!sessionInfoStr) {
    return GetAccessTokenFromCookieError.SESSION_ID_MISSING_KV;
  }

  let sessionInfo: AccessTokenData;
  try {
    sessionInfo = JSON.parse(sessionInfoStr);
  } catch (e) {
    return GetAccessTokenFromCookieError.SESSION_MALFORMED;
  }

  // token expired & refresh the token
  if (sessionInfo.expires_at < new Date().getTime()) {
    if (!sessionInfo.refresh_token) {
      return GetAccessTokenFromCookieError.SESSION_EXPIRED_CANT_REFRESH;
    }

    const resp = await getAccessToken(c.env, {
      grant_type: "refresh_token",
      refresh_token: sessionInfo.refresh_token,
    });

    if (!resp) {
      return GetAccessTokenFromCookieError.SESSION_EXPIRED_REFRESH_ERROR;
    }

    // store the new access token data
    sessionInfo = resp;
    await c.env.BNET_TOKEN.put(
      `session:${sessionId}`,
      JSON.stringify(sessionInfo),
      {
        expirationTtl: sessionInfo.refresh_expires_in,
      },
    );
  }

  return sessionInfo;
}
