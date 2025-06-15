"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Bot, Send, User, Menu, LoaderCircle } from "lucide-react";
import { answerChain } from "../lib/ragModel";

/* ───── Component ───────────────────────────────────────── */
export default function ChatPage() {
  /* ── state ─────────────────────────────── */
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: "assistant",
      content: "Hello! I’m ChatMind AI. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);

  /* ── refs ──────────────────────────────── */
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  /* ── send message ──────────────────────── */
  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userMsg = {
      id: Date.now(),
      role: "user",
      content: input.trim(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    textareaRef.current?.style.setProperty("height", "auto");

    try {
      const res = await answerChain.invoke({ question: userMsg.content });

      const { reply, conversationId: newId } = {
        reply: res,
        conversationId: crypto.randomUUID(),
      };

      setMessages((m) => [
        ...m,
        { id: Date.now() + 1, role: "assistant", content: reply },
      ]);
      if (newId && newId !== conversationId) setConversationId(newId);
    } catch (e) {
      console.error(e);
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "⚠️ Sorry, something went wrong fetching the answer. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, conversationId]);

  /* ── start new chat ─────────────────────── */
  const startNewChat = () => {
    setMessages([
      {
        id: 0,
        role: "assistant",
        content: "Hello! I’m ChatMind AI. How can I help you today?",
      },
    ]);
    setConversationId(null);
    setInput("");
    setLoading(false);
  };

  /* ── side effects ───────────────────────── */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  /* ── message block ─────────────────────── */
  const MessageBlock = ({ role, content, id }) => {
    const isUser = role === "user";
    const bubble = isUser ? "bg-[#2a2b2d]" : "bg-[#3c3e4a]";
    const Icon = isUser ? User : Bot;
    const iconColor = isUser ? "text-gray-400" : "text-emerald-400";

    return (
      <div key={id} className="w-full py-6">
        <div
          className={`mx-auto flex max-w-4xl items-start gap-4 px-4 sm:px-6 lg:px-8 ${
            isUser ? "justify-end" : "justify-start"
          }`}
        >
          {isUser ? (
            <>
              <div
                className={`prose prose-invert prose-sm whitespace-pre-wrap rounded-lg p-3 shadow-sm max-w-[calc(100%-50px)] ${bubble}`}
              >
                {content}
              </div>
              <Icon size={22} className={iconColor + " shrink-0 pt-1"} />
            </>
          ) : (
            <>
              <Icon size={22} className={iconColor + " shrink-0 pt-1"} />
              <div
                className={`prose prose-invert prose-sm whitespace-pre-wrap rounded-lg p-3 shadow-md max-w-[calc(100%-50px)] ${bubble}`}
              >
                {content}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /* ── render ─────────────────────────────── */
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#202123] text-gray-100 font-inter">
      {/* sidebar */}
      <aside className="hidden md:flex h-full w-64 flex-col border-r border-gray-700 bg-[#202123]">
        <header className="flex items-center gap-3 border-b border-gray-700 px-5 py-4">
          <Bot size={24} className="text-emerald-400" />
          <span className="text-xl font-bold">ChatMind AI</span>
        </header>

        <button
          onClick={startNewChat}
          className="mx-4 my-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-emerald-700"
          aria-label="Start a new chat"
        >
          <Plus size={18} /> New Chat
        </button>

        <nav className="flex-1 overflow-y-auto px-4 text-xs text-gray-400">
          <div className="rounded-xl bg-[#2a2b2d] px-3 py-2 text-center">
            No previous conversations. Start a new one!
          </div>
        </nav>
      </aside>

      {/* main chat */}
      <section className="flex flex-1 flex-col">
        {/* mobile top-bar */}
        <div className="md:hidden flex items-center gap-2 border-b border-gray-700 bg-[#202123] px-4 py-3">
          <button
            className="rounded-md p-2 hover:bg-[#2a2b2d]"
            aria-label="Menu"
          >
            <Menu size={20} className="text-gray-300" />
          </button>
          <span className="font-semibold">ChatMind AI</span>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-4 pb-28">
          {messages.map((m) => (
            <MessageBlock key={m.id} {...m} />
          ))}

          {loading && (
            <MessageBlock
              id="loading"
              role="assistant"
              content={
                <span className="inline-flex items-center text-gray-300">
                  <LoaderCircle size={18} className="mr-2 animate-spin" />
                  Typing…
                </span>
              }
            />
          )}

          <div ref={endRef} />

          {messages.length === 1 && !loading && (
            <div className="flex h-full items-center justify-center px-4 text-center text-gray-500">
              <p className="max-w-xl text-lg">
                Type your message below to start a conversation with ChatMind
                AI!
              </p>
            </div>
          )}
        </div>

        {/* input */}
        <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-700 bg-[#202123] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="mx-auto flex w-full max-w-3xl gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Message ChatMind AI…"
                className="scrollbar-thumb-gray-700 scrollbar-track-gray-800 max-h-40 w-full resize-none overflow-y-auto rounded-xl bg-[#343541] p-3 pr-10 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ minHeight: 50 }}
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={loading || !input.trim()}
                className="absolute bottom-2 right-2 rounded-full bg-emerald-600 p-2 text-white shadow-md transition disabled:cursor-not-allowed disabled:bg-gray-600 hover:bg-emerald-700"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
          <p className="mx-auto mt-3 max-w-3xl text-center text-[11px] text-gray-400">
            ChatMind AI may produce inaccurate information. Verify facts that
            matter.
          </p>
        </footer>
      </section>
    </div>
  );
}
