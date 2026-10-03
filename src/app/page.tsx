import { isUnlocked } from "@/lib/unlock";
import Chat from "./chat";

export default async function Home() {
  return <Chat initiallyUnlocked={await isUnlocked()} />;
}
