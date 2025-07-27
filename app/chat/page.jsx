// ChatPageDark.jsx – dark-themed chat interface with backend RAG + memory
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Bot, Send, User, Menu, LoaderCircle } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import FancyLoader from "../components/FancyLoader";
import GmeLoader from "../components/GmeLoader";

/*
  This component:
  • Sends user prompts to /api/chat (which hosts the RAG + memory chain)
  • Keeps conversationId so the backend can thread history
  • Stays fully on the client for live UX, but no OpenAI keys leak
*/
export default function ChatPageDark() {
  // ─── state ──────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([
    {
      id: 0,
      role: "assistant",
      content: "Hello! I\u2019m GME. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [time, setTime] = useState([]);
  const [model, setModel] = useState("von");
  // ─── refs ───────────────────────────────────────────────────────────
  const endRef = useRef(null);
  const textareaRef = useRef(null);
  const tick = useRef(null);

  // ─── helpers ────────────────────────────────────────────────────────
  const closeMobileNav = () => setMobileNavOpen(false);

  // ─── send message to backend ────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userContent = input.trim();
    setInput("");
    textareaRef.current?.style.setProperty("height", "auto");

    const userMsg = { id: Date.now(), role: "user", content: userContent };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setSeconds(0);

    const t0 = Date.now();
    tick.current = setInterval(() => setSeconds(Date.now() - t0), 1000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userContent,
          conversationId,
          model: model,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { reply, conversationId: cid } = await res.json();
      if (cid && cid !== conversationId) setConversationId(cid);

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: reply },
      ]);
      const t1 = Date.now();
      setSeconds((t1 - t0) / 1000);
      setTime((prev) => [...prev, Math.floor((t1 - t0) / 1000)]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          content:
            "⚠️ Sorry, I had trouble fetching the answer. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
      clearInterval(tick.current);
    }
  }, [input, conversationId, loading]);

  // ─── new chat ───────────────────────────────────────────────────────
  const startNewChat = () => {
    setMessages([
      {
        id: 0,
        role: "assistant",
        content: "Hello! I\u2019m GME AI. How can I help you today?",
      },
    ]);
    setConversationId(null);
    setInput("");
    setTime([]);
    setLoading(false);
  };

  // ─── effects ────────────────────────────────────────────────────────
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

  // ─── message bubble ─────────────────────────────────────────────────
  const Message = ({ role, content, id, timeTaken = 0 }) => {
    const isUser = role === "user";
    const bubbleCls = isUser ? "bg-[#3c3e4a]" : "bg-[#2a2b2d]";
    const Icon = isUser ? User : Bot;
    const iconColor = isUser ? "text-gray-400" : "text-emerald-400";
    const wrapper = clsx(
      "prose prose-invert prose-sm whitespace-pre-wrap rounded-lg p-3 shadow-md"
    );

    const renderContent =
      typeof content === "string" ? (
        <Markdown remarkPlugins={[remarkGfm]}>{content.trim()}</Markdown>
      ) : (
        content
      );

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
                className={`prose prose-invert prose-sm whitespace-pre-wrap rounded-lg p-3 shadow-sm max-w-[calc(100%-50px)] ${bubbleCls}`}
              >
                <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
              </div>
              {/* <Icon size={22} className={`${iconColor} shrink-0 pt-1`} /> */}
            </>
          ) : (
            <div className="flex items-start gap-2">
              {/* Avatar / icon */}
              {/* <Icon size={22} className={`${iconColor} shrink-0 pt-1`} /> */}

              {/* Bubble + timestamp */}
              <div className="flex flex-col">
                {/* <div
                  className={`prose prose-invert prose-sm whitespace-pre-wrap rounded-lg p-3 shadow-md ${bubbleCls}`}
                >
                  {content}
                </div> */}

                {/* <GmeLoader loading={loading} /> */}

                <div className={wrapper}>{renderContent}</div>

                {/* Timestamp */}
                {timeTaken === 0 ? null : (
                  <span className="mt-1 self-start text-xs text-gray-400">
                    {/* {timeTaken || Math.floor(seconds / 1000)}s */}
                    {timeTaken}s
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── UI ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#202123] text-gray-100 font-inter">
      {/* ── sidebar ── */}
      <aside
        /* 0. fixed for mobile, static for ≥md  */
        className={clsx(
          "fixed inset-y-0 left-0 z-40 w-64 bg-[#202123] border-r border-gray-700 transition-transform duration-200 ease-in-out",
          "md:static md:translate-x-0", // desktop
          mobileNavOpen ? "translate-x-0" : "-translate-x-full" // mobile
        )}
      >
        <header className="flex items-center gap-3 border-b border-gray-700 px-5 py-4">
          <Bot size={24} className="text-emerald-400" />
          <span className="text-xl font-bold">GME 1.5</span>
        </header>

        {/* Model Selection Dropdown */}
        <div className="m-3">
          <label
            htmlFor="model-select"
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Choose Model:
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border border-gray-600 bg-[#282933] py-2 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            disabled={loading}
          >
            <option value="flash">GME 1.5 Flash</option>
            <option value="heavy">GME 1.5 Heavy</option>
            <option value="hulk">GME 1.5 Hulk</option>
            <option value="von">GME 1.5 Von</option>
          </select>
        </div>

        <button
          onClick={startNewChat}
          className="mx-4 my-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-emerald-700"
          aria-label="Start a new chat"
        >
          <Plus size={18} /> New Chat
        </button>

        {/* 🔜 list of previous conversations (future feature) */}
        <nav className="flex-1 overflow-y-auto px-4 text-xs text-gray-400">
          <div className="rounded-xl bg-[#2a2b2d] px-3 py-2 text-center">
            No previous conversations. Start a new one!
          </div>
        </nav>

        {/* close button visible only on mobile */}
        <button
          onClick={closeMobileNav}
          className="absolute right-2 top-2 rounded p-2 text-gray-400 hover:text-white md:hidden"
          aria-label="Close menu"
        >
          ✕
        </button>
      </aside>

      {/* backdrop when sidebar is open (mobile only) */}
      {mobileNavOpen && (
        <div
          onClick={closeMobileNav}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      {/* ── main chat ── */}
      <section className="flex flex-1 flex-col">
        {/* mobile header */}
        <div className="md:hidden flex items-center gap-2 border-b border-gray-700 bg-[#202123] px-4 py-3">
          <button
            className="rounded-md p-2 hover:bg-[#2a2b2d]"
            aria-label="Menu"
            onClick={() => setMobileNavOpen((o) => !o)} // NEW
          >
            <Menu size={20} className="text-gray-300" />
          </button>
          <span className="font-semibold">GME</span>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto space-y-2 pt-4 pb-28">
          {messages.map((m, index) => (
            <div key={index}>
              <Message
                key={m.id}
                {...m}
                timeTaken={time[Math.ceil(index / 2) - 1]}
              />
            </div>
          ))}

          {loading && (
            <Message
              id="loading"
              role="assistant"
              content={
                <span className="inline-flex items-center text-gray-300">
                  {/* <LoaderCircle className="mr-2 animate-spin" size={18} />{" "} */}
                  <FancyLoader size={28} /> {"  "}
                  Thinking… {Math.floor(seconds / 1000)}s
                </span>
              }
              timeTaken={0}
            />
          )}

          <div ref={endRef} />

          {messages.length === 1 && !loading && (
            <div className="flex h-full items-center justify-center px-4 text-center text-gray-500">
              <p className="max-w-xl text-lg">
                Type your message below to start a conversation with GME AI!
              </p>
            </div>
          )}
        </div>

        {/* composer */}
        <footer className="fixed bottom-0 left-0 right-0 border-t border-gray-700 bg-[#202123] p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
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
                    sendMessage();
                  }
                }}
                placeholder="Message GME…"
                className="scrollbar-thumb-gray-700 scrollbar-track-gray-800 max-h-40 w-full resize-none overflow-y-auto rounded-xl bg-[#343541] p-3 pr-10 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed"
                style={{ minHeight: 50 }}
                disabled={loading}
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
            GME AI may produce inaccurate information. Verify facts that matter.
          </p>
        </footer>
      </section>
    </div>
  );
}
