import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

export default function ChatInput({ onSend, disabled, placeholder }) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "Type your message..."}
        disabled={disabled}
        className="pr-14 min-h-[60px] max-h-[150px] resize-none bg-white border-gray-200 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
        rows={2}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!message.trim() || disabled}
        className="absolute right-2 bottom-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg h-10 w-10"
      >
        {disabled ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </Button>
    </form>
  );
}