type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ChatPayload = {
  prompt?: string;
  messages?: ChatMessage[];
  repoContext?: string;
};

function getResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const response = payload as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        text?: string;
        type?: string;
      }>;
    }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

  if (!apiKey) {
    return Response.json(
      {
        error: "OpenAI is not configured yet. Add OPENAI_API_KEY to your environment, then restart the dev server.",
      },
      { status: 500 },
    );
  }

  const body = (await request.json()) as ChatPayload;
  const prompt = body.prompt?.trim();
  const repoContext = body.repoContext?.trim();

  if (!prompt) {
    return Response.json({ error: "Missing chat prompt." }, { status: 400 });
  }

  const conversation = (body.messages ?? [])
    .slice(-8)
    .map((message) => `${message.role === "user" ? "User" : "BrandRepo"}: ${message.text}`)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "developer",
          content:
            "You are BrandRepo Chat. Answer using only the provided BrandRepo context. If the context is missing or unclear, say what is missing and suggest the repo section to update. Be concise, specific, and practical. Do not invent brand facts.",
        },
        {
          role: "user",
          content: `BrandRepo context, assembled from the repo's generated Markdown files:\n\n${repoContext || "_No repo context available._"}\n\nRecent conversation:\n${conversation || "_No prior conversation._"}\n\nQuestion:\n${prompt}`,
        },
      ],
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? ((payload as { error?: { message?: string } }).error?.message ?? "OpenAI request failed.")
        : "OpenAI request failed.";
    return Response.json({ error: message }, { status: response.status });
  }

  const answer = getResponseText(payload);

  if (!answer) {
    return Response.json({ error: "OpenAI returned an empty answer." }, { status: 502 });
  }

  return Response.json({ answer });
}
