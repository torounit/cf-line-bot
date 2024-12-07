import { Hono } from "hono";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/", async (c) => {
  const body = await c.req.json();
  console.log("Received request:");
  console.log(JSON.stringify(body));
  return c.text('ok');
});

export default app;
