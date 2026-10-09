"use client";

import { ChatList } from "~/components/chat/ChatList";

/** Caixa de entrada do staff (personal e gestão). */
export default function StaffConversasPage() {
  return <ChatList basePath="/personal/conversas" title="Conversas" />;
}
