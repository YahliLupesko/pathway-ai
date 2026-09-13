import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText, ArrowRight, Bot } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";

import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";

export default function AIConversation() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [readyToGenerate, setReadyToGenerate] = useState(false);
  const messagesEndRef = useRef(null);

  const { data: profiles } = useQuery({
    queryKey: ["studentProfile"],
    queryFn: () => base44.entities.StudentProfile.list("-created_date", 1)
  });

  const profile = profiles?.[0];

  useEffect(() => {
    if (profile && messages.length === 0) {
      initiateConversation();
    }
  }, [profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initiateConversation = async () => {
    const existingHistory = profile.conversation_history || [];
    
    if (existingHistory.length > 0) {
      setMessages(existingHistory);
      if (existingHistory.length >= 4) {
        setReadyToGenerate(true);
      }
      return;
    }

    setIsLoading(true);

    const systemContext = `You are a friendly, concise college counselor AI helping a high school student plan their path to college. 

Student Profile (already known — do NOT re-ask any of this):
- Grade: ${profile.grade_level}
- GPA: ${profile.gpa}
- Location: ${profile.location_preference || "Not specified"}
- High School: ${profile.school_name || "Not specified"}
- School District: ${profile.district || "Not specified"}
- School Type: ${profile.school_type || "Not specified"}
- Interests: ${profile.interests?.join(", ") || "Not specified"}
- Goals: ${profile.goals || "Not specified"}
- Budget: ${profile.budget_range || "Not specified"}
- Current Activities: ${profile.extracurriculars?.join(", ") || "None listed"}
- Test Scores: SAT: ${profile.test_scores?.sat || "N/A"}, ACT: ${profile.test_scores?.act || "N/A"}

YOUR GOAL: You already know their school and district. You need ONLY ONE piece of essential information to build a realistic plan:

1. What classes are they currently taking AND what classes have they already completed? This includes ALL core subjects:
   - Math (e.g., Algebra 1, Geometry, Algebra 2, Pre-Calc, Calculus)
   - Science (e.g., Biology, Chemistry, Physics, AP Sciences)
   - English (e.g., English 9, English 10, AP English)
   - Social Studies/History (e.g., World History, US History, Government)
   - Foreign Language (e.g., Spanish 1, Spanish 2, Spanish 3)
   - Any electives or AP/Honors courses
   This prevents recommending courses they can't take, like telling an Algebra 1 student to take AP Calc BC, or a Spanish 1 student to take AP Spanish.

That's it. Do NOT ask about anything else. Do NOT ask multiple questions. Do NOT ask follow-up questions about preferences, campus size, or anything already in their profile.

INSTRUCTIONS:
- Start with a brief, warm greeting (one sentence) that mentions you see they go to ${profile.school_name || "their school"}, then immediately ask what classes they're currently taking and have already completed.
- Ask ONE question only. 
- Be conversational but extremely focused — no filler beyond a brief friendly opener.
- Keep each response to 2-3 sentences max.
- Once they tell you their classes, you can optionally ask if they have any dream colleges in mind (one sentence), then tell them you're ready to build their plan.

Start now with a warm one-sentence greeting mentioning their school, then ask what classes they're currently taking and have already completed.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: systemContext,
      model: "gemini_3_flash",
      add_context_from_internet: true
    });

    const aiMessage = { role: "assistant", content: response };
    setMessages([aiMessage]);
    await saveConversation([aiMessage]);
    setIsLoading(false);
  };

  const handleSendMessage = async (content) => {
    const userMessage = { role: "user", content };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const systemContext = `You are a friendly, concise college counselor AI continuing a conversation with a high school student. You have web search access to look up school course catalogs.

Student Profile (already known — do NOT re-ask ANY of this):
- Grade: ${profile.grade_level}
- GPA: ${profile.gpa}
- High School: ${profile.school_name || "Not specified"}
- School District: ${profile.district || "Not specified"}
- School Type: ${profile.school_type || "Not specified"}
- Interests: ${profile.interests?.join(", ") || "Not specified"}
- Goals: ${profile.goals || "Not specified"}
- Budget: ${profile.budget_range || "Not specified"}
- Activities: ${profile.extracurriculars?.join(", ") || "None listed"}
- Test Scores: SAT: ${profile.test_scores?.sat || "N/A"}, ACT: ${profile.test_scores?.act || "N/A"}

Conversation so far:
${newMessages.map(m => `${m.role}: ${m.content}`).join("\n")}

YOUR TASK: You already know their school and district. The ONLY essential info you need is their current and completed classes. Check if they've answered that yet.

Essential info checklist:
☑ School name and district — ALREADY KNOWN
☐ Current and completed classes (all subjects: math, science, English, social studies, foreign language) — NEEDED
☐ Any dream colleges (optional — ask only after classes are known)

RULES:
- If the student just mentioned their classes, use your web search to look up what courses ${profile.school_name || "their school"}${profile.district ? ` in ${profile.district}` : ""} offers. Briefly mention what you found so they know you did the research.
- If they haven't shared their classes yet, ask for them. If they have, note the sequences for ALL subjects (math, science, English, social studies, foreign language) and move on.
- Ask ONE question at a time. Never list multiple questions.
- Be warm but concise — 2-3 sentences max per response.
- Do NOT ask about anything already in their profile (interests, goals, GPA, budget, activities, test scores, school, district).
- Once you have their current classes, optionally ask if they have any dream colleges (one sentence), then tell them you're ready to build their plan. Say something like: "I've got everything I need to build you a realistic plan. Click 'Generate My Plan' whenever you're ready!"
- Do NOT drag the conversation out. Once you have their classes, wrap up quickly.

Continue the conversation now.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt: systemContext,
      model: "gemini_3_flash",
      add_context_from_internet: true
    });

    const aiMessage = { role: "assistant", content: response };
    const updatedMessages = [...newMessages, aiMessage];
    setMessages(updatedMessages);
    await saveConversation(updatedMessages);
    setIsLoading(false);

    // Check if the AI indicated readiness (look for key phrases)
    const readinessPhrases = ["ready to build", "everything i need", "generate my plan", "whenever you're ready", "got everything"];
    const isReady = readinessPhrases.some(phrase => 
      response.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (isReady || updatedMessages.length >= 4) {
      setReadyToGenerate(true);
    }
  };

  const saveConversation = async (msgs) => {
    if (profile) {
      await base44.entities.StudentProfile.update(profile.id, {
        conversation_history: msgs
      });
    }
  };

  const handleGeneratePlan = () => {
    window.location.href = createPageUrl("GeneratePlan");
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">College Planning Assistant</h1>
              <p className="text-xs text-gray-500">Let's refine your plan together</p>
            </div>
          </div>
          
          {readyToGenerate && (
            <Button
              onClick={handleGeneratePlan}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Generate My Plan
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.map((message, index) => (
            <ChatMessage
              key={index}
              message={message}
              isLast={index === messages.length - 1}
            />
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white/80 backdrop-blur-sm border-t border-gray-100 sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-4">
          {readyToGenerate && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <p className="text-sm text-indigo-700">
                  Ready to generate your personalized college plan!
                </p>
              </div>
              <Button
                onClick={handleGeneratePlan}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Generate Plan
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}
          
          <ChatInput
            onSend={handleSendMessage}
            disabled={isLoading}
            placeholder="Share more about your college goals..."
          />
          
          <p className="text-xs text-gray-400 text-center mt-3">
            Continue chatting to refine your plan, or generate when you're ready
          </p>
        </div>
      </div>
    </div>
  );
}