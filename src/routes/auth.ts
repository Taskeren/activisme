import { Hono } from "hono";
import { AppLike } from "../index";
import { getAccessToken } from "../helper/bnet-auth";
import { getCookie, setCookie } from "hono/cookie";

const app: AppLike = new Hono();

export default app;

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30; // a month

app.get("/login", async (c) => {
  const state = crypto.randomUUID();

  setCookie(c, "oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/auth",
    maxAge: 600,
  });

  // construct a public login url
  const url = new URL("https://www.bungie.net/en/OAuth/Authorize");
  url.searchParams.set("client_id", c.env.BNET_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  return c.redirect(url);
});

app.get("/cb", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const savedState = getCookie(c, "oauth_state");

  if (!code) {
    console.log(code);
    return c.json({ message: "Code invalid or missing!" }, 400);
  }

  if (!state || state != savedState) {
    console.debug(
      `Login state mismatched, expected state ${savedState}, given state ${state}.`,
    );
    return c.json({ message: "Invalid login state!" }, 401);
  }

  const tokenData = await getAccessToken(c.env, {
    grant_type: "authorization_code",
    code,
  });

  if (!tokenData) {
    return c.json({ message: "Can't get access token!" }, 401);
  }

  const sessionId = crypto.randomUUID();
  await c.env.BNET_TOKEN.put(
    `session:${sessionId}`,
    JSON.stringify(tokenData),
    {
      expirationTtl: SESSION_DURATION_SECONDS,
    },
  );

  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });

  return c.redirect("/");
});
