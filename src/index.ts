import { Hono } from "hono";
import * as line from "@line/bot-sdk";

type Bindings = {
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
};

const app = new Hono<{ Bindings: CloudflareBindings & Bindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/", async (c) => {
  const config: line.ClientConfig = {
    channelAccessToken: c.env.LINE_CHANNEL_ACCESS_TOKEN,
  };
  const client = new line.messagingApi.MessagingApiClient(config);
  line.middleware({ channelSecret: c.env.LINE_CHANNEL_SECRET });

  async function replyMessage(replyToken: string, message: string) {
    return await client.replyMessage({
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: `You said: ${message}`,
        },
      ],
    });
  }

  const body: line.WebhookRequestBody = await c.req.json();
  console.log("Received request:");
  console.log(JSON.stringify(body));

  await Promise.all(
    body.events.map(async (event) => {
      if (event.type === "message" && event.message.type === "text") {
        await replyMessage(event.replyToken, event.message.text);
      }
    }),
  );

  return c.text("ok");
});

export default app;
