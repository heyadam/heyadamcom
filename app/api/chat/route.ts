import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { SCENE_SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { SceneCommand } from "@/lib/scene-types";

export const maxDuration = 30;

/**
 * Parse scene commands from Claude's response.
 * Commands are wrapped in <scene-commands>...</scene-commands> tags.
 */
function parseSceneCommands(text: string): SceneCommand[] {
  const regex = /<scene-commands>([\s\S]*?)<\/scene-commands>/g;
  const commands: SceneCommand[] = [];

  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        commands.push(...parsed);
      } else {
        commands.push(parsed);
      }
    } catch (e) {
      console.error("Failed to parse scene commands:", e);
    }
  }

  return commands;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Create a UI message stream that can send both text and data parts
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Stream the response from Claude
      const result = streamText({
        model: anthropic("claude-sonnet-4-5"),
        system: SCENE_SYSTEM_PROMPT,
        messages: await convertToModelMessages(messages),
      });

      // Merge the text stream into the UI message stream
      writer.merge(result.toUIMessageStream());

      // Wait for the full text to be available, then parse and send scene commands
      const fullText = await result.text;
      const commands = parseSceneCommands(fullText);

      for (const command of commands) {
        writer.write({
          type: "data-scene-command",
          data: command,
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
