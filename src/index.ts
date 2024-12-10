import { Hono } from "hono";
import * as line from "@line/bot-sdk";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/", async (c) => {
  const config: line.ClientConfig = {
    channelAccessToken: c.env.LINE_CHANNEL_ACCESS_TOKEN,
  };
  const client = new line.messagingApi.MessagingApiClient(config);
  line.middleware({ channelSecret: c.env.LINE_CHANNEL_SECRET });

  /**
   *
   */
  async function askToAI(message: string) {
    try {
      // @ts-expect-error model is not defined
      return await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
        messages: [
          {
            role: "system",
            content: "You are a friendly assistant. You answer in Japanese.",
          },
          {
            role: "user",
            content: message,
          },
        ],
      });
    } catch (e) {
      console.error(e);
      return { response: "I'm sorry, I don't understand." };
    }
  }

  async function replyMessage(replyToken: string, message: string) {
    console.log("asking:");
    const { response } = (await askToAI(message)) as Exclude<
      AiTextGenerationOutput,
      ReadableStream
    >;
    console.log(`response: ${response}`);
    return await client.replyMessage({
      replyToken,
      messages: [
        {
          type: "text",
          text: response || "",
        },
      ],
    });
  }

  const body: line.WebhookRequestBody = await c.req.json();
  console.log("Received request:");
  console.log(JSON.stringify(body));
  const { events } = body;

  c.executionCtx.waitUntil(
    Promise.all(
      events.map(async (event) => {
        if (event.type === "message" && event.message.type === "text") {
          await replyMessage(event.replyToken, event.message.text);
        }
      }),
    ),
  );

  return c.text("ok");
});

export default app;
