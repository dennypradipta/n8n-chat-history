import ChatsUI from "./page.client";

export const metadata = {
  title: "n8n Chat History",
  description: "Browse and search through your n8n workflows history.",
};

export default function Home() {
  return <ChatsUI />;
}
