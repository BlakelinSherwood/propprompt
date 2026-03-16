import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChatbotDrawer({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm PropBot, your PropPrompt™ assistant. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, messages]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    setError(null);
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await base44.functions.invoke("chatbotChat", { message: msg, session_id: sessionId });
      if (res.data.error) {
        setError(res.data.error);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: res.data.reply }]);
        if (res.data.session_id) setSessionId(res.data.session_id);
      }
    } catch (e) {
      setError("Failed to get a response. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#1A3226] text-white shadow-lg flex items-center justify-center hover:bg-[#1A3226]/90 transition-all ${open ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
        aria-label="Open PropBot"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex flex-col w-full sm:w-96 h-[520px] sm:bottom-6 sm:right-6 rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-[#1A3226]/10 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#1A3226] text-white flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#B8982F] flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#1A3226]" />
              </div>
              <div>
                <p className="text-sm font-semibold">PropBot</p>
                <p className="text-[10px] text-white/50">PropPrompt™ AI Assistant</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#FAF8F4]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#1A3226] text-white rounded-br-sm"
                      : "bg-white text-[#1A3226] border border-[#1A3226]/8 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-[#1A3226]/8 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <Loader2 className="w-4 h-4 text-[#B8982F] animate-spin" />
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-red-500 text-center px-2 py-1 bg-red-50 rounded-lg">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-[#1A3226]/8 bg-white px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Ask PropBot anything…"
                rows={1}
                className="flex-1 resize-none text-sm border border-[#1A3226]/15 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#B8982F]/40 bg-[#FAF8F4] text-[#1A3226] placeholder:text-[#1A3226]/30 max-h-24"
                style={{ lineHeight: "1.5" }}
              />
              <Button
                onClick={send}
                disabled={!input.trim() || loading}
                size="icon"
                className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white h-9 w-9 rounded-xl flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[10px] text-[#1A3226]/30 mt-1.5 text-center">20 messages/day · S&C platform key</p>
          </div>
        </div>
      )}
    </>
  );
}