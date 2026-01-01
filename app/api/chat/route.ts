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
 * Incrementally parse scene commands from streaming text.
 * Extracts individual JSON objects as they complete, even before
 * the full <scene-commands> block is closed.
 */
class IncrementalCommandParser {
  private buffer = "";
  private processedIndex = 0; // Track where we've processed up to
  private insideBlock = false;
  private jsonBuffer = "";
  private braceDepth = 0;
  private inString = false;
  private escapeNext = false;

  /**
   * Add a new text chunk and return any newly complete commands.
   */
  addChunk(chunk: string): SceneCommand[] {
    this.buffer += chunk;
    return this.extractNewCommands();
  }

  /**
   * Extract individual JSON objects as they complete within the stream.
   */
  private extractNewCommands(): SceneCommand[] {
    const commands: SceneCommand[] = [];

    // Process character by character starting from where we left off
    while (this.processedIndex < this.buffer.length) {
      const char = this.buffer[this.processedIndex];

      // Check for opening tag
      if (!this.insideBlock) {
        const remaining = this.buffer.slice(this.processedIndex);
        if (remaining.startsWith("<scene-commands>")) {
          this.insideBlock = true;
          this.jsonBuffer = "";
          this.braceDepth = 0;
          this.inString = false;
          this.escapeNext = false;
          this.processedIndex += "<scene-commands>".length;
          continue;
        }
        // Check if we might have a partial tag at the end
        if (remaining.length < "<scene-commands>".length && "<scene-commands>".startsWith(remaining)) {
          break; // Wait for more data
        }
        this.processedIndex++;
        continue;
      }

      // Check for closing tag
      const remaining = this.buffer.slice(this.processedIndex);
      if (remaining.startsWith("</scene-commands>")) {
        this.insideBlock = false;
        this.jsonBuffer = "";
        this.braceDepth = 0;
        this.processedIndex += "</scene-commands>".length;
        continue;
      }
      // Check if we might have a partial closing tag
      if (remaining.length < "</scene-commands>".length && "</scene-commands>".startsWith(remaining)) {
        break; // Wait for more data
      }

      // Track JSON structure
      if (this.escapeNext) {
        this.escapeNext = false;
        this.jsonBuffer += char;
        this.processedIndex++;
        continue;
      }

      if (char === "\\" && this.inString) {
        this.escapeNext = true;
        this.jsonBuffer += char;
        this.processedIndex++;
        continue;
      }

      if (char === '"' && !this.escapeNext) {
        this.inString = !this.inString;
        this.jsonBuffer += char;
        this.processedIndex++;
        continue;
      }

      if (!this.inString) {
        if (char === "{") {
          if (this.braceDepth === 0) {
            this.jsonBuffer = "{"; // Start fresh JSON object
          } else {
            this.jsonBuffer += char;
          }
          this.braceDepth++;
          this.processedIndex++;
          continue;
        }

        if (char === "}") {
          this.braceDepth--;
          this.jsonBuffer += char;

          // Complete JSON object found at depth 0
          if (this.braceDepth === 0 && this.jsonBuffer.trim()) {
            try {
              const parsed = JSON.parse(this.jsonBuffer) as SceneCommand;
              commands.push(parsed);
            } catch {
              // Invalid JSON, skip
            }
            this.jsonBuffer = "";
          }
          this.processedIndex++;
          continue;
        }
      }

      // Add character to buffer if we're tracking an object
      if (this.braceDepth > 0) {
        this.jsonBuffer += char;
      }
      this.processedIndex++;
    }

    return commands;
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Detect if this is the first message in the conversation
  const isFirstMessage = messages.filter((m) => m.role === "user").length === 1;

  // Build system prompt - instruct to clear scene on first message
  const systemPrompt = isFirstMessage
    ? `${SCENE_SYSTEM_PROMPT}\n\n## Important: New Conversation\n\nThis is the start of a new conversation. ALWAYS begin your response with a clearScene command to start fresh, before adding any new objects or lights.`
    : SCENE_SYSTEM_PROMPT;

  // Create a UI message stream that can send both text and data parts
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Stream the response from Claude
      const result = streamText({
        model: anthropic("claude-sonnet-4-5"),
        system: systemPrompt,
        messages: await convertToModelMessages(messages),
      });

      // Create incremental parser for scene commands
      const parser = new IncrementalCommandParser();

      // Generate IDs for this response
      const messageId = crypto.randomUUID();
      const textId = crypto.randomUUID();

      // Track if we've started text content
      let textStarted = false;

      // Emit message start
      writer.write({
        type: "start",
        messageId,
      });

      // Manually iterate over fullStream and forward parts while parsing for commands
      for await (const part of result.fullStream) {
        switch (part.type) {
          case "text-delta": {
            // Emit text-start on first text chunk
            if (!textStarted) {
              writer.write({
                type: "text-start",
                id: textId,
              });
              textStarted = true;
            }

            // Forward text delta to UI
            writer.write({
              type: "text-delta",
              id: textId,
              delta: part.text,
            });

            // Parse for scene commands and emit immediately when found
            const newCommands = parser.addChunk(part.text);
            for (const command of newCommands) {
              writer.write({
                type: "data-scene-command",
                data: command,
              });
            }
            break;
          }

          case "finish": {
            // Emit text-end if we had text content
            if (textStarted) {
              writer.write({
                type: "text-end",
                id: textId,
              });
            }

            // Forward finish event
            writer.write({
              type: "finish",
              finishReason: part.finishReason,
            });
            break;
          }

          case "error": {
            // Forward error
            writer.write({
              type: "error",
              errorText: String(part.error),
            });
            break;
          }

          // Other part types can be forwarded as needed
          default:
            // Skip other parts for now (tool calls, reasoning, etc.)
            break;
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
