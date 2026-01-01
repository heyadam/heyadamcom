"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  ChevronRightIcon,
  MaximizeIcon,
  MinimizeIcon,
  MessageSquareIcon,
} from "lucide-react";
import {
  type ComponentProps,
  type HTMLAttributes,
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import {
  Message,
  MessageContent,
  MessageResponse,
  type MessageProps,
} from "./message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "./prompt-input";
import { Suggestion, Suggestions } from "./suggestion";
import { Loader } from "./loader";

// ============================================================================
// Context
// ============================================================================

type ChatSidebarContextType = {
  isExpanded: boolean;
  expand: () => void;
  collapse: () => void;
};

const ChatSidebarContext = createContext<ChatSidebarContextType | null>(null);

export const useChatSidebar = () => {
  const context = useContext(ChatSidebarContext);
  if (!context) {
    throw new Error("useChatSidebar must be used within ChatSidebarProvider");
  }
  return context;
};

// ============================================================================
// Provider
// ============================================================================

export type ChatSidebarProviderProps = HTMLAttributes<HTMLDivElement>;

export function ChatSidebarProvider({
  children,
  ...props
}: ChatSidebarProviderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const expand = useCallback(() => setIsExpanded(true), []);
  const collapse = useCallback(() => setIsExpanded(false), []);

  return (
    <ChatSidebarContext.Provider
      value={{ isExpanded, expand, collapse }}
    >
      <div className="relative flex h-screen w-full" {...props}>
        {children}
      </div>
    </ChatSidebarContext.Provider>
  );
}

// ============================================================================
// Main Content Area
// ============================================================================

export type ChatSidebarMainProps = HTMLAttributes<HTMLDivElement>;

export function ChatSidebarMain({
  className,
  children,
}: ChatSidebarMainProps) {
  const { isExpanded } = useChatSidebar();

  return (
    <div
      className={cn("h-full flex-1 overflow-hidden", className)}
      style={{ marginRight: isExpanded ? "50%" : 400 }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Sidebar Container
// ============================================================================

export type ChatSidebarProps = HTMLAttributes<HTMLDivElement>;

export function ChatSidebar({ className, children }: ChatSidebarProps) {
  const { isExpanded } = useChatSidebar();

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 z-40 flex h-screen flex-col",
        "border-l border-neutral-200 dark:border-neutral-800",
        "bg-white dark:bg-neutral-950",
        className
      )}
      style={{ width: isExpanded ? "50%" : 400 }}
    >
      <div className="relative z-10 flex h-full flex-col overflow-hidden">
        {children}
      </div>
    </aside>
  );
}

// ============================================================================
// Header
// ============================================================================

export type ChatSidebarHeaderProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  showStatus?: boolean;
  isStreaming?: boolean;
};

export function ChatSidebarHeader({
  className,
  title = "Chat",
  showStatus = true,
  isStreaming = false,
  children,
  ...props
}: ChatSidebarHeaderProps) {
  const { isExpanded, expand, collapse } = useChatSidebar();

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2.5",
        "border-b border-neutral-200 dark:border-neutral-800",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        {showStatus && isStreaming && (
          <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
            <span className="size-1.5 rounded-full bg-violet-400 animate-pulse" />
            thinking
          </span>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        {children}

        <Button
          className={cn(
            "size-7 text-neutral-400",
            "hover:bg-neutral-100 hover:text-neutral-600",
            "dark:hover:bg-neutral-800 dark:hover:text-neutral-300",
            "transition-colors"
          )}
          onClick={isExpanded ? collapse : expand}
          size="icon"
          variant="ghost"
        >
          {isExpanded ? (
            <MinimizeIcon className="size-3.5" />
          ) : (
            <MaximizeIcon className="size-3.5" />
          )}
        </Button>
      </div>
    </header>
  );
}

// ============================================================================
// Messages Container
// ============================================================================

export type ChatSidebarMessagesProps = ComponentProps<typeof ScrollArea>;

export function ChatSidebarMessages({
  className,
  children,
  ...props
}: ChatSidebarMessagesProps) {
  return (
    <ScrollArea
      className={cn("flex-1 min-h-0", className)}
      {...props}
    >
      <div className="flex flex-col divide-y divide-neutral-100 dark:divide-neutral-800/50">
        {children}
      </div>
    </ScrollArea>
  );
}

// ============================================================================
// Message (Cursor-style - no bubbles)
// ============================================================================

export type ChatSidebarMessageProps = MessageProps & {
  content?: string;
  isStreaming?: boolean;
};

export function ChatSidebarMessage({
  from,
  content,
  isStreaming,
  children,
  className,
  ...props
}: ChatSidebarMessageProps) {
  const isUser = from === "user";

  return (
    <Message
      className={cn("w-full max-w-none px-4 py-3", className)}
      from={from}
      {...props}
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        initial={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.15 }}
        className="w-full"
      >
        {/* Role label */}
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "text-xs font-medium",
            isUser
              ? "text-neutral-500 dark:text-neutral-400"
              : "text-violet-600 dark:text-violet-400"
          )}>
            {isUser ? "You" : "Assistant"}
          </span>
          {isStreaming && !isUser && (
            <span className="inline-flex items-center gap-0.5">
              <span className="size-1 rounded-full bg-violet-400 animate-pulse" />
              <span className="size-1 rounded-full bg-violet-400 animate-pulse [animation-delay:75ms]" />
              <span className="size-1 rounded-full bg-violet-400 animate-pulse [animation-delay:150ms]" />
            </span>
          )}
        </div>

        {/* Message content - full width, no bubble */}
        <MessageContent
          className={cn(
            "relative w-full text-[13px] leading-relaxed",
            "text-neutral-900 dark:text-neutral-100"
          )}
        >
          {content ? (
            <MessageResponse>{content}</MessageResponse>
          ) : (
            children
          )}
        </MessageContent>
      </motion.div>
    </Message>
  );
}

// ============================================================================
// Empty State
// ============================================================================

export type ChatSidebarEmptyProps = HTMLAttributes<HTMLDivElement>;

export function ChatSidebarEmpty({
  className,
  children,
  ...props
}: ChatSidebarEmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-1 min-h-0 flex-col items-center justify-center gap-4 px-8 text-center",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <motion.div
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
            initial={{ scale: 0.95, opacity: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-2xl",
                "bg-neutral-100 dark:bg-neutral-800",
                "text-neutral-400 dark:text-neutral-500"
              )}
            >
              <MessageSquareIcon className="size-6" />
            </div>
          </motion.div>

          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
            initial={{ opacity: 0, y: 6 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-medium text-sm text-neutral-900 dark:text-neutral-100">
              Start a conversation
            </h3>
            <p className="text-xs text-neutral-500 max-w-[240px] leading-relaxed">
              Ask a question or share what&apos;s on your mind.
            </p>
          </motion.div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Suggestions
// ============================================================================

export type ChatSidebarSuggestionsProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  suggestions?: string[];
  onSelect?: (suggestion: string) => void;
};

export function ChatSidebarSuggestions({
  className,
  suggestions = [],
  onSelect,
  children,
}: ChatSidebarSuggestionsProps) {
  if (suggestions.length === 0 && !children) return null;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("px-4 py-3", className)}
      initial={{ opacity: 0, y: 6 }}
      transition={{ delay: 0.15 }}
    >
      <Suggestions className="gap-1.5">
        {children ?? suggestions.map((suggestion) => (
          <Suggestion
            className={cn(
              "border-neutral-200 dark:border-neutral-800",
              "bg-transparent",
              "text-neutral-600 dark:text-neutral-400",
              "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              "hover:text-neutral-900 dark:hover:text-neutral-100",
              "text-xs font-normal"
            )}
            key={suggestion}
            onClick={onSelect}
            suggestion={suggestion}
          >
            <ChevronRightIcon className="mr-1 size-3 text-neutral-400" />
            {suggestion}
          </Suggestion>
        ))}
      </Suggestions>
    </motion.div>
  );
}

// ============================================================================
// Input Area
// ============================================================================

export type ChatSidebarInputProps = Omit<ComponentProps<typeof PromptInput>, "onSubmit"> & {
  onSubmit?: (message: PromptInputMessage) => void | Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
};

export function ChatSidebarInput({
  className,
  onSubmit,
  isLoading = false,
  placeholder = "Message...",
  children,
  ...props
}: ChatSidebarInputProps) {
  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text.trim() && message.files.length === 0) return;
    await onSubmit?.(message);
  };

  return (
    <div
      className={cn(
        "border-t border-neutral-200 dark:border-neutral-800 p-3",
        className
      )}
    >
      <PromptInput
        className={cn(
          "overflow-hidden rounded-xl",
          "bg-neutral-100 dark:bg-neutral-800",
          "border border-transparent",
          "focus-within:bg-white dark:focus-within:bg-neutral-900",
          "focus-within:border-neutral-300 dark:focus-within:border-neutral-700",
          "transition-all duration-150"
        )}
        onSubmit={handleSubmit}
        {...props}
      >
        <PromptInputTextarea
          className={cn(
            "min-h-10 resize-none border-0 bg-transparent",
            "text-neutral-900 dark:text-neutral-100 text-sm",
            "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
            "focus:ring-0"
          )}
          placeholder={placeholder}
        />
        <PromptInputFooter className="border-t-0 bg-transparent px-2 pb-2">
          <div className="flex items-center gap-1">
            {children}
          </div>
          <PromptInputSubmit
            className={cn(
              "size-7 rounded-lg",
              "bg-neutral-900 dark:bg-neutral-100",
              "text-white dark:text-neutral-900",
              "hover:bg-neutral-700 dark:hover:bg-neutral-300",
              "disabled:opacity-40",
              "transition-colors"
            )}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader className="size-3.5" />
            ) : undefined}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

// ============================================================================
// Typing Indicator (Cursor-style)
// ============================================================================

export type ChatSidebarTypingProps = HTMLAttributes<HTMLDivElement>;

export function ChatSidebarTyping({
  className,
}: ChatSidebarTypingProps) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("px-4 py-3", className)}
      exit={{ opacity: 0, y: -6 }}
      initial={{ opacity: 0, y: 6 }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
          Assistant
        </span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              className="size-1 rounded-full bg-violet-400"
              key={i}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Footer
// ============================================================================

export type ChatSidebarFooterProps = HTMLAttributes<HTMLDivElement>;

export function ChatSidebarFooter({
  className,
  children,
  ...props
}: ChatSidebarFooterProps) {
  return (
    <footer
      className={cn(
        "flex items-center justify-center gap-1.5 px-4 py-2",
        "text-[10px] text-neutral-400 dark:text-neutral-600",
        "tracking-wide",
        className
      )}
      {...props}
    >
      {children ?? (
        <span>Powered by AI</span>
      )}
    </footer>
  );
}
