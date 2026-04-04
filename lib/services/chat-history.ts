import { prisma } from "@/lib/prisma";
import type OpenAI from "openai";

/**
 * Loads the last `limit` messages for a phone number, ordered chronologically.
 * Returns an array ready to pass as OpenAI chat history.
 */
export async function loadChatHistory(
  phone: string,
  limit: number
): Promise<OpenAI.ChatCompletionMessageParam[]> {
  const recent = await prisma.chatMessage.findMany({
    where: { phone },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return recent.reverse().map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
}

/**
 * Persists a single chat message. Errors are propagated so callers can decide
 * how to handle them — wrap in try/catch at the call site if non-blocking.
 */
export async function saveChatMessage(
  phone: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  await prisma.chatMessage.create({ data: { phone, role, content } });
}
