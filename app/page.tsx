"use client";

import {
  ChatSidebar,
  ChatSidebarEmpty,
  ChatSidebarFooter,
  ChatSidebarHeader,
  ChatSidebarInput,
  ChatSidebarMain,
  ChatSidebarMessages,
  ChatSidebarProvider,
  ChatSidebarSuggestions,
  ChatSidebarTyping,
} from "@/components/ai-elements/chat-sidebar";
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
  ChainOfThoughtCode,
} from "@/components/ai-elements/chain-of-thought";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { useCallback, useEffect, useRef } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { AnimatePresence, motion } from "motion/react";
import ThreeBackground from "./components/ThreeBackground";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSceneStore } from "@/lib/scene-store";
import type { SceneCommand } from "@/lib/scene-types";
import { cn } from "@/lib/utils";
import { CodeIcon, SparklesIcon, LoaderIcon } from "lucide-react";

// Scene-focused suggestions for the empty state
const INITIAL_SUGGESTIONS = [
  "Create a floating sphere",
  "Make a colorful abstract scene",
  "Add some dramatic lighting",
  "Build a simple solar system",
];

/**
 * Strip <scene-commands> tags from text so they don't show in the chat.
 */
function cleanMessageContent(text: string): string {
  return text.replace(/<scene-commands>[\s\S]*?<\/scene-commands>/g, "").trim();
}

/**
 * Extract scene commands from raw text for display in chain of thought.
 */
function extractSceneCommands(text: string): SceneCommand[] {
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
    } catch {
      // Ignore parse errors during streaming
    }
  }

  return commands;
}

/**
 * Check if we're in the middle of generating scene commands.
 * This happens when there's an opening tag but no closing tag yet.
 */
function isGeneratingCommands(text: string): boolean {
  const openTags = (text.match(/<scene-commands>/g) || []).length;
  const closeTags = (text.match(/<\/scene-commands>/g) || []).length;
  return openTags > closeTags;
}

/**
 * Extract partial command text that's still being generated.
 * Returns the content after the last unclosed <scene-commands> tag.
 */
function getPartialCommandText(text: string): string {
  const lastOpenTag = text.lastIndexOf("<scene-commands>");
  if (lastOpenTag === -1) return "";

  const afterTag = text.slice(lastOpenTag + "<scene-commands>".length);
  // Check if this tag is already closed
  if (afterTag.includes("</scene-commands>")) return "";

  return afterTag.trim();
}

/**
 * Get a human-readable description for a scene command.
 */
function getCommandDescription(command: SceneCommand): string {
  switch (command.action) {
    case "addObject":
      return `Add ${command.object.geometry.type} "${command.object.id}"`;
    case "updateObject":
      return `Update object "${command.id}"`;
    case "removeObject":
      return `Remove object "${command.id}"`;
    case "addLight":
      return `Add ${command.light.type} light "${command.light.id}"`;
    case "updateLight":
      return `Update light "${command.id}"`;
    case "removeLight":
      return `Remove light "${command.id}"`;
    case "setCamera":
      return "Update camera position";
    case "setConfig":
      return "Update scene configuration";
    case "clearScene":
      return "Clear all objects from scene";
    case "resetScene":
      return "Reset scene to default";
    default:
      return "Scene command";
  }
}

export default function Home() {
  // Get the applyCommand action from the scene store
  const applyCommand = useSceneStore((state) => state.applyCommand);

  // Ref for auto-scrolling to bottom of messages
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    // Handle data parts from the stream - this is where scene commands arrive
    onData: (dataPart) => {
      // Check if this is a scene command data part
      if (dataPart.type === "data-scene-command") {
        const command = dataPart.data as SceneCommand;
        applyCommand(command);
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim()) return;
      sendMessage({ text: message.text });
    },
    [sendMessage]
  );

  const handleSuggestionSelect = useCallback(
    (suggestion: string) => {
      handleSubmit({ text: suggestion, files: [] });
    },
    [handleSubmit]
  );

  // Helper to extract raw text content from message parts
  const getRawMessageContent = (
    message: (typeof messages)[number]
  ): string => {
    if (!message.parts || message.parts.length === 0) {
      return "";
    }

    return message.parts
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((part) => part.text)
      .join("");
  };

  // Helper to get cleaned message content (without scene commands)
  const getCleanMessageContent = (
    message: (typeof messages)[number]
  ): string => {
    return cleanMessageContent(getRawMessageContent(message));
  };

  // Helper to extract scene commands from message
  const getMessageCommands = (
    message: (typeof messages)[number]
  ): SceneCommand[] => {
    return extractSceneCommands(getRawMessageContent(message));
  };

  // Check if a message is currently being streamed
  const isMessageStreaming = (
    message: (typeof messages)[number],
    index: number
  ): boolean => {
    return (
      isLoading &&
      message.role === "assistant" &&
      index === messages.length - 1
    );
  };

  // Get streaming info for a message
  const getStreamingInfo = (message: (typeof messages)[number]) => {
    const rawContent = getRawMessageContent(message);
    return {
      isGenerating: isGeneratingCommands(rawContent),
      partialText: getPartialCommandText(rawContent),
    };
  };

  // Get the last message content for scroll dependency
  const lastMessage = messages[messages.length - 1];
  const lastMessageContent = lastMessage
    ? getRawMessageContent(lastMessage)
    : "";

  // Auto-scroll to bottom when messages change or during streaming
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, lastMessageContent, isLoading]);

  return (
    <ChatSidebarProvider>
      {/* Main content area with 3D scene */}
      <ChatSidebarMain className="relative">
        <ThreeBackground />
      </ChatSidebarMain>

      {/* AI Chat Sidebar */}
      <ChatSidebar>
        <ChatSidebarHeader isStreaming={isLoading} title="Scene Creator" />

        {messages.length === 0 ? (
          <>
            <ChatSidebarEmpty>
              <div className="space-y-1 text-center">
                <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
                  Create Your 3D Scene
                </h3>
                <p className="text-xs text-neutral-500 max-w-[240px] leading-relaxed">
                  Describe what you want to see and I&apos;ll build it in 3D.
                </p>
              </div>
            </ChatSidebarEmpty>
            <ChatSidebarSuggestions
              onSelect={handleSuggestionSelect}
              suggestions={INITIAL_SUGGESTIONS}
            />
          </>
        ) : (
          <ChatSidebarMessages>
            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const content = getCleanMessageContent(message);
              const commands = isUser ? [] : getMessageCommands(message);
              const streaming = isMessageStreaming(message, index);
              const streamingInfo = streaming ? getStreamingInfo(message) : null;
              const hasCommands = commands.length > 0;
              const showChainOfThought =
                hasCommands || (streaming && streamingInfo?.isGenerating);

              if (isUser) {
                // User messages - simple bubble
                return (
                  <Message
                    className="max-w-[85%]"
                    from="user"
                    key={message.id}
                  >
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                    >
                      <MessageContent
                        className={cn(
                          "relative text-[13px] leading-relaxed",
                          "bg-neutral-900 dark:bg-neutral-100",
                          "text-white dark:text-neutral-900",
                          "rounded-2xl rounded-br-sm",
                          "px-3.5 py-2.5"
                        )}
                      >
                        <MessageResponse>{content}</MessageResponse>
                      </MessageContent>
                    </motion.div>
                  </Message>
                );
              }

              // Assistant messages - with chain of thought for scene commands
              return (
                <Message
                  className="max-w-[85%]"
                  from="assistant"
                  key={message.id}
                >
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MessageContent
                      className={cn(
                        "relative text-[13px] leading-relaxed",
                        "bg-neutral-100 dark:bg-neutral-800",
                        "text-neutral-900 dark:text-neutral-100",
                        "rounded-2xl rounded-bl-sm",
                        "px-3.5 py-2.5"
                      )}
                    >
                      {/* Chain of Thought for scene commands */}
                      {showChainOfThought && (
                        <ChainOfThought
                          className="mb-2.5 pb-2.5 border-b border-neutral-200 dark:border-neutral-700"
                          defaultOpen={streaming}
                          open={streaming ? true : undefined}
                        >
                          <ChainOfThoughtHeader>
                            {streaming && streamingInfo?.isGenerating ? (
                              <>
                                <LoaderIcon className="size-3 animate-spin" />
                                <span>
                                  Generating scene
                                  {commands.length > 0
                                    ? ` (${commands.length} command${commands.length === 1 ? "" : "s"})...`
                                    : "..."}
                                </span>
                              </>
                            ) : (
                              <>
                                <SparklesIcon className="size-3" />
                                <span>
                                  Generated {commands.length} scene{" "}
                                  {commands.length === 1 ? "command" : "commands"}
                                </span>
                              </>
                            )}
                          </ChainOfThoughtHeader>
                          <ChainOfThoughtContent>
                            <AnimatePresence mode="popLayout">
                              {commands.map((command, cmdIndex) => (
                                <motion.div
                                  key={`${message.id}-cmd-${cmdIndex}`}
                                  initial={{ opacity: 0, y: -8 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -8 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChainOfThoughtStep
                                    icon={CodeIcon}
                                    label={getCommandDescription(command)}
                                    status={streaming ? "active" : "complete"}
                                  >
                                    <ChainOfThoughtCode
                                      language="json"
                                      code={JSON.stringify(command, null, 2)}
                                    />
                                  </ChainOfThoughtStep>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {/* Show streaming indicator when generating but no complete commands yet */}
                            {streaming &&
                              streamingInfo?.isGenerating &&
                              streamingInfo.partialText && (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400"
                                >
                                  <LoaderIcon className="size-3 animate-spin" />
                                  <span className="font-mono truncate max-w-[200px]">
                                    {streamingInfo.partialText.slice(0, 50)}
                                    {streamingInfo.partialText.length > 50 ? "..." : ""}
                                  </span>
                                </motion.div>
                              )}
                          </ChainOfThoughtContent>
                        </ChainOfThought>
                      )}

                      {/* Main message content */}
                      {content && <MessageResponse>{content}</MessageResponse>}

                      {/* Show streaming indicator if no content yet */}
                      {streaming && !content && !showChainOfThought && (
                        <span className="inline-flex items-center gap-0.5">
                          <span className="size-1 rounded-full bg-neutral-400 animate-pulse" />
                          <span className="size-1 rounded-full bg-neutral-400 animate-pulse [animation-delay:75ms]" />
                          <span className="size-1 rounded-full bg-neutral-400 animate-pulse [animation-delay:150ms]" />
                        </span>
                      )}
                    </MessageContent>
                  </motion.div>
                </Message>
              );
            })}
            {/* Scroll anchor for auto-scrolling */}
            <div ref={messagesEndRef} />
          </ChatSidebarMessages>
        )}

        {/* Fixed input area at bottom */}
        <div className="mt-auto shrink-0 bg-white dark:bg-neutral-950">
          <ChatSidebarInput
            isLoading={isLoading}
            onSubmit={handleSubmit}
            placeholder="Describe your 3D scene..."
          />

          <ChatSidebarFooter>
            <span>Powered by Claude</span>
          </ChatSidebarFooter>
        </div>
      </ChatSidebar>
    </ChatSidebarProvider>
  );
}
