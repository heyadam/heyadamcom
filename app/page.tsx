"use client";

import {
  ChatSidebar,
  ChatSidebarEmpty,
  ChatSidebarFooter,
  ChatSidebarHeader,
  ChatSidebarInput,
  ChatSidebarMain,
  ChatSidebarMessage,
  ChatSidebarMessages,
  ChatSidebarProvider,
  ChatSidebarSuggestions,
  ChatSidebarTyping,
} from "@/components/ai-elements/chat-sidebar";
import { useCallback } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { AnimatePresence } from "motion/react";
import ThreeBackground from "./components/ThreeBackground";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useSceneStore } from "@/lib/scene-store";
import type { SceneCommand } from "@/lib/scene-types";

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

export default function Home() {
  // Get the applyCommand action from the scene store
  const applyCommand = useSceneStore((state) => state.applyCommand);

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

  // Helper to extract and clean text content from message parts
  const getMessageContent = (message: (typeof messages)[number]): string => {
    if (!message.parts || message.parts.length === 0) {
      return "";
    }

    const text = message.parts
      .filter(
        (part): part is { type: "text"; text: string } => part.type === "text"
      )
      .map((part) => part.text)
      .join("");

    // Clean out scene command tags before displaying
    return cleanMessageContent(text);
  };

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
            {messages.map((message) => (
              <ChatSidebarMessage
                content={getMessageContent(message)}
                from={message.role as "user" | "assistant"}
                key={message.id}
              />
            ))}
            <AnimatePresence>
              {isLoading && <ChatSidebarTyping />}
            </AnimatePresence>
          </ChatSidebarMessages>
        )}

        <ChatSidebarInput
          isLoading={isLoading}
          onSubmit={handleSubmit}
          placeholder="Describe your 3D scene..."
        />

        <ChatSidebarFooter>
          <span>Powered by Claude</span>
        </ChatSidebarFooter>
      </ChatSidebar>
    </ChatSidebarProvider>
  );
}
