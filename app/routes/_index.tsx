import type { MetaFunction } from "@remix-run/node";
import { Chat } from "~/components/Chat";

export const meta: MetaFunction = () => {
  return [
    { title: "AI Chat App" },
    { name: "description", content: "Chat with AI" },
  ];
};

export default function Index() {
  return <Chat />;
}