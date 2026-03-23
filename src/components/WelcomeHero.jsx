export default function WelcomeHero({ user, roleLabel, marketLabel }) {
  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1A3226] to-[#1A3226]/90 p-6 lg:p-10">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#B8982F]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#B8982F]/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/4" />

      <div className="relative">
        <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-2">PropPrompt™ v3.0</p>
        <h1 className="text-2xl lg:text-3xl font-semibold text-white mb-2">
          Welcome back, {firstName}
        </h1>
        <p className="text-white/60 text-sm max-w-lg">
          {marketLabel
            ? `AI-Calibrated Real Estate Analysis System for ${marketLabel}.`
            : "AI-Calibrated Real Estate Analysis System."}
          {roleLabel && (
            <span className="inline-flex ml-2 text-[10px] uppercase tracking-wider bg-[#B8982F]/20 text-[#B8982F] px-2 py-0.5 rounded-full font-medium">
              {roleLabel}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}