"use client";

import { ChatList } from "~/components/chat/ChatList";

/** Caixa de entrada do aluno. */
export default function ConversasPage() {
  return <ChatList basePath="/conversas" title="Conversas" />;
}
