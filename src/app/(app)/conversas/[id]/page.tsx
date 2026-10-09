"use client";

import { useParams } from "next/navigation";
import { ChatThread } from "~/components/chat/ChatThread";

/** Fio de conversa do aluno com o personal. */
export default function ConversaPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  return <ChatThread conversationId={id} backHref="/conversas" backLabel="Conversas" />;
}
