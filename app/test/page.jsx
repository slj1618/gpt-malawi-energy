"use client";

import { useEffect, useState } from "react";
import { finalCommunityChain_test } from "../lib/graphRagModel_002_test";

const chain = finalCommunityChain_test;

export default function Page() {
  const [botReply, setBotReply] = useState("");

  useEffect(() => {
    async function fetchReply() {
      const reply = await chain.invoke({
        question: "ESCOM",
        chat_history: "",
      });
      setBotReply(reply);
    }
    fetchReply();
  }, []);

  return <div>{botReply || "Loading..."}</div>;
}
