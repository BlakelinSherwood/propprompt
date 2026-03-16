import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { MessageSquare, X, Send, Loader2, Bot, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

const RATE_LIMIT = 20;

export default function ChatbotDrawer({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [remaining, setRemaining] = useState(RATE_LIMIT);
  const [rateLimited, setRateLimited] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Hi${user?.full_name ? ` ${user.full_name.split(" ")[0]}` : ""}! I'm the PropPrompt™ assistant. How can I help you today?`,
      }]);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || rateLimited) return;

    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Build history for context (last 10 turns)
    const history = messages.filter((m) => m.role !== "system").slice(-10);

    const res = await base44.functions.invoke("chatbotMessage", {
      message: text,
      sessionId,
      history,
    });

    if (res.data?.rateLimited) {
      setRateLimited(true);
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "You've reached the daily message limit (20 messages/day). Please come back tomorrow!",
      }]);
    } else if (res.data?.error) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Sorry, something went wrong: ${res.data.error}`,
      }]);
    } else {
      const { reply, sessionId: sid, rateLimitRemaining } = res.data;
      if (sid && !sessionId) setSessionId(sid);
      setRemaining(rateLimitRemaining ?? RATE_LIMIT);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    }

    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#1A3226] text-white shadow-lg hover:bg-[#1A3226]/90 hover:shadow-xl transition-all flex items-center justify-center"
        aria-label="Open PropPrompt Assistant"
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end pointer-events-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 pointer-events-auto"
            onClick={() => setOpen(false)}
          />

          {/* Chat panel */}
          <div className="relative pointer-events-auto w-full sm:w-96 h-[75vh] sm:h-[600px] sm:mr-6 sm:mb-6 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1A3226] text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-[#B8982F] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#1A3226]" />
                </div>
                <div>
                  <p className="text-sm font-semibold">PropPrompt™ Assistant</p>
                  <p className="text-[10px] text-white/50">{remaining} messages remaining today</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#FAF8F4]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-[#1A3226]/10 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-[#1A3226]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
                      ${msg.role === "user"
                        ? "bg-[#1A3226] text-white rounded-br-sm"
                        : "bg-white border border-[#1A3226]/8 text-[#1A3226]/85 rounded-bl-sm shadow-sm"
                      }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-headings:text-[#1A3226] prose-li:my-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#1A3226]/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[#1A3226]" />
                  </div>
                  <div className="bg-white border border-[#1A3226]/8 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-[#1A3226]/40" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Rate limit warning */}
            {remaining <= 5 && !rateLimited && (
              <div className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-50 border-t border-amber-100">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-600">{remaining} messages left today</p>
              </div>
            )}

            {/* Input */}
            <div className="px-3 py-3 bg-white border-t border-[#1A3226]/8 flex items-end gap-2">
              <textarea
                className="flex-1 text-sm resize-none rounded-xl border border-[#1A3226]/15 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1A3226]/20 max-h-24 min-h-[40px]"
                placeholder={rateLimited ? "Daily limit reached" : "Ask about PropPrompt™…"}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={rateLimited || loading}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading || rateLimited}
                className="w-9 h-9 rounded-xl bg-[#1A3226] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 hover:bg-[#1A3226]/90 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}