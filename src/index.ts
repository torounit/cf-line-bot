import { Hono } from "hono";
import * as line from "@line/bot-sdk";

type Bindings = {
  LINE_CHANNEL_ACCESS_TOKEN: string;
};

const app = new Hono<{ Bindings: CloudflareBindings & Bindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/", async (c) => {
  async function replyMessage(replyToken: string, message: string) {
    const requestBody = JSON.stringify({
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: message,
        },
      ],
    });

    return await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${c.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: requestBody,
    });
  }

  const body = await c.req.json();
  console.log("Received request:");
  console.log(JSON.stringify(body));

  if (body.events) {
    await Promise.all(
      body.events.map(async (event: line.WebhookEvent) => {
        if (event.type === "message" && event.message.type === "text") {
          await replyMessage(event.replyToken, event.message.text);
        }
      }),
    );
  }

  return c.text("ok");
});

export default app;
