import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function ChatMessage({ message, isLast }) {
  const isAI = message.role === "assistant";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-4 ${isAI ? "" : "flex-row-reverse"}`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isAI
            ? "bg-gradient-to-br from-indigo-500 to-purple-600"
            : "bg-gray-100"
        }`}
      >
        {isAI ? (
          <Bot className="w-5 h-5 text-white" />
        ) : (
          <User className="w-5 h-5 text-gray-600" />
        )}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-5 py-3 ${
          isAI
            ? "bg-white border border-gray-100 shadow-sm"
            : "bg-indigo-600 text-white"
        }`}
      >
        {isAI ? (
          <div className="prose prose-sm max-w-none text-gray-700">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{message.content}</p>
        )}
      </div>
    </motion.div>
  );
}