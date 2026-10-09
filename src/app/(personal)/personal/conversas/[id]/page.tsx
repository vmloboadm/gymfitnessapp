"use client";

import { useParams } from "next/navigation";
import { ChatThread } from "~/components/chat/ChatThread";

/** Fio de conversa do staff com o aluno. */
export default function StaffConversaPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  return <ChatThread conversationId={id} backHref="/personal/conversas" backLabel="Conversas" />;
}
