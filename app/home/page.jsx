import React from "react";
import { Bot, MessageCircle, SendHorizonal } from "lucide-react";

/**
 * HomePage – landing page for an AI-powered chatbot
 * TailwindCSS + lucide-react icons (tree-shakable)
 *
 * Usage:
 *   import HomePage from "./HomePage";
 *   export default function App() { return <HomePage />; }
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-800 flex flex-col">
      {/* ─── Nav Bar ─────────────────────────────────────────── */}
      <header className="backdrop-blur bg-white/70 border-b border-zinc-200">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="/" className="flex items-center gap-2 font-bold text-lg">
            <Bot size={24} /> ChatMind AI
          </a>

          <div className="flex items-center gap-6 text-sm">
            <a href="#features" className="hover:text-sky-600">
              Features
            </a>
            <a href="#faq" className="hover:text-sky-600">
              FAQ
            </a>
            <a
              href="/chat"
              className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-4 py-2 font-medium text-white shadow hover:bg-sky-700 transition"
            >
              Start Chatting <SendHorizonal size={16} />
            </a>
          </div>
        </nav>
      </header>

      {/* ─── Hero Section ────────────────────────────────────── */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Instant answers&nbsp;— in your pocket, on demand.
        </h1>
        <p className="mb-8 max-w-xl text-lg text-zinc-600">
          ChatMind AI is your personal knowledge companion, powered by
          state-of-the-art language models. Ask anything, learn faster, and
          create without limits.
        </p>
        <a
          href="/chat"
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-lg font-semibold text-white shadow-lg hover:bg-sky-700 transition"
        >
          Try it now <MessageCircle size={20} />
        </a>
      </section>

      {/* ─── Feature Highlights ─────────────────────────────── */}
      <section
        id="features"
        className="bg-white py-16 border-t border-zinc-200"
      >
        <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Conversational",
              desc: "Engage in natural dialogue and get human-like responses.",
              Icon: MessageCircle,
            },
            {
              title: "Context-Aware",
              desc: "Upload your docs or links and receive tailored insights.",
              Icon: Bot,
            },
            {
              title: "Secure & Private",
              desc: "Your data is encrypted and never sold to third parties.",
              Icon: SendHorizonal,
            },
          ].map(({ title, desc, Icon }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 shadow-sm transition hover:shadow-md"
            >
              <Icon className="mb-4 h-8 w-8 text-sky-600" />
              <h3 className="mb-2 text-xl font-semibold">{title}</h3>
              <p className="text-zinc-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-zinc-200 bg-zinc-100 py-6 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} ChatMind AI. All rights reserved.
      </footer>
    </main>
  );
}
