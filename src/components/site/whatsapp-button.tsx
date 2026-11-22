import { whatsappLink } from "@/lib/constants";
import { ChatIcon } from "./icons";

export function WhatsAppButton() {
  return (
    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" aria-label="Chat with us on WhatsApp"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex h-13 items-center gap-2 rounded-full bg-foreground px-4 text-background shadow-lg shadow-foreground/15 transition-transform hover:-translate-y-0.5 lg:right-8 lg:bottom-8">
      <ChatIcon width={22} height={22} />
      <span className="eyebrow hidden sm:inline">Chat with us</span>
    </a>
  );
}
