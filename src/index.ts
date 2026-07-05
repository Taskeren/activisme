import { Hono } from "hono";
import { searchUser } from "./api/search-user";
import { parseMembershipType } from "./bungie";
import { aggregateUserActivity } from "./history";
import { analyzeUserActivityHistories } from "./api/activity-history";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use("*", cors())

app.get("/message", (c) => {
  return c.text("Bonjour!");
});

app.get("/api/get-history2/:type/:id", async (c) => {
  const typeStr = c.req.param("type");
  const destinyMembershipId = c.req.param("id");
  // ?all=1 to show the raw data
  const withRaw = c.req.query("all") === "1";
  const type = parseMembershipType(typeStr);
  const data = await aggregateUserActivity(type, destinyMembershipId);
  // replace the data. expected TS type error.
  // @ts-expect-error
  data.activities = analyzeUserActivityHistories(data.activities, withRaw);
  return c.json({ data });
});

// LEGACY ENDPOINTS

app.post("/api/search-user", async (c) => {
  const payload = await c.req.json<string>();
  const mainOnly = c.req.query("main") == "1";
  const data = await searchUser(payload, mainOnly);
  return c.json({
    data,
  });
});

app.get("/api/get-history/:type/:id", async (c) => {
  const typeStr = c.req.param("type");
  const destinyMembershipId = c.req.param("id");
  const type = parseMembershipType(typeStr);
  const data = await aggregateUserActivity(type, destinyMembershipId);
  return c.json({ data });
});

export default app;
