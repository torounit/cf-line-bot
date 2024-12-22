import { Hono } from "hono";
import * as line from "@line/bot-sdk";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.post("/", async (c) => {
  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: c.env.LINE_CHANNEL_ACCESS_TOKEN,
  });
  line.middleware({ channelSecret: c.env.LINE_CHANNEL_SECRET });

  const adapter = new PrismaD1(c.env.DB);
  const prisma = new PrismaClient({ adapter });

  async function askToAI(messages: RoleScopedChatInput[]) {
    // @ts-expect-error model is not defined
    return await c.env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        {
          role: "system",
          content: "You are a friendly assistant. You answer in Japanese.",
        },
        ...messages,
      ],
    });
  }

  async function replyMessage(
    replyToken: string,
    message: string,
    userId: string,
  ) {
    const savedMessages = await prisma.message.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const messages = [
      ...savedMessages.map(({ role, content }) => ({
        role: role as "user" | "assistant",
        content,
      })),
      {
        role: "user",
        content: message,
      } as const,
    ];
    console.log(`asking:${JSON.stringify(messages)}`);

    const { response } = (await askToAI(messages)) as Exclude<
      AiTextGenerationOutput,
      ReadableStream
    >;

    console.log(`response: ${response}`);

    await prisma.message.createMany({
      data: [
        {
          userId: userId,
          content: message,
          role: "user",
        },
        {
          userId: userId,
          content: `${response}`,
          role: "assistant",
        },
      ],
    });

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
        console.log("Received event:", JSON.stringify(event));
        if (event.type === "message") {
          if (event.message.type === "text" && event.source.type === "user") {
            await replyMessage(
              event.replyToken,
              event.message.text,
              event.source.userId,
            );
          }
        }
      }),
    ),
  );

  return c.text("ok");
});

export default app;
