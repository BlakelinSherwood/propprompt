import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useFounderProfile } from "@/lib/useFounderProfile";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function OnboardingWelcomeModal({ user, onClose }) {
  const { founder } = useFounderProfile();
  const navigate = useNavigate();
  const [isShowing, setIsShowing] = useState(false);

  useEffect(() => {
    if (user && !user.onboarding_welcome_shown) {
      setIsShowing(true);
    }
  }, [user]);

  const handleClose = async () => {
    if (user?.id) {
      await base44.auth.updateMe({ onboarding_welcome_shown: true });
    }
    setIsShowing(false);
    onClose?.();
  };

  if (!isShowing || !founder) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative shadow-xl">
        <button
          onClick={handleClose}
          className="absolute top-6 right-6 p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1A3226]">
              Welcome to PropPrompt, {user?.full_name?.split(" ")[0]}.
            </h2>
          </div>

          <div className="space-y-4 text-sm text-[#1A3226]/80 leading-relaxed">
            <p>Your territory is active.</p>

            <div className="bg-[#FAF8F4] rounded-lg p-4 border border-[#1A3226]/10">
              <p className="italic">
                I built PropPrompt because I wanted agents to have the kind of market intelligence that used to
                take hours to produce — available in minutes, branded to them, and grounded in real data.
              </p>
              <p className="mt-3">
                Start with the training library if you're new — Module 1 will have you running your first analysis in
                under 10 minutes.
              </p>
              <p className="mt-3">
                If you ever have feedback on how the tool is working for you in the field, I want to hear it.
              </p>
            </div>

            <p className="text-xs text-[#1A3226]/60 italic">
              — {founder.founder_name}
              <br />
              Broker · Founder
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                handleClose();
                navigate("/Training");
              }}
              variant="outline"
              className="flex-1"
            >
              Start Training
            </Button>
            <Button
              onClick={() => {
                handleClose();
                navigate("/Dashboard");
              }}
              className="flex-1"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}