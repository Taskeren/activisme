import { Hono } from "hono";
import { searchUser } from "./api/search-user";
import { parseMembershipType } from "./bungie";
import { aggregateUserActivity } from "./api/history";
import { updateResponse } from "./api/activity-history";
import { cors } from "hono/cors";
import routeAuth from "./routes/auth";
import routeDestiny2 from "./routes/d2";

type Variables = {
  bungieToken: string;
};

export type AppContext = { Bindings: CloudflareBindings; Variables: Variables };
export type AppLike = typeof app;

const app = new Hono<AppContext>();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "https://activism.taske.ren"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.route("/auth", routeAuth);
app.route("/api", routeDestiny2);

app.get("/message", (c) => {
  return c.text("Bonjour!");
});

app.get("/api/get-history2/:type/:id", async (c) => {
  const typeStr = c.req.param("type");
  const destinyMembershipId = c.req.param("id");
  // ?all=1 to show the raw data
  const withRaw = c.req.query("all") === "1";
  const type = parseMembershipType(typeStr);
  const data = updateResponse(
    await aggregateUserActivity(type, destinyMembershipId),
    withRaw,
  );
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
  return c.json(data);
});

export default app;
