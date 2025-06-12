import ChatsUI from "./page.client";

export const metadata = {
  title: "n8n Chat History",
  description: "Browse and search through your n8n workflows history.",
};

export default function Home() {
  const n8nBaseURL = process.env.NEXT_PUBLIC_N8N_URL;
  return <ChatsUI n8nBaseURL={n8nBaseURL} />;
}
