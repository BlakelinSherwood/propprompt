export default function StepHeader({ steps, current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 ${i <= current ? "opacity-100" : "opacity-30"}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i < current ? "bg-[#1A3226] text-white" :
              i === current ? "bg-[#B8982F] text-white" :
              "bg-[#1A3226]/10 text-[#1A3226]/50"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? "text-[#1A3226]" : "text-[#1A3226]/50"}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-6 h-px flex-shrink-0 ${i < current ? "bg-[#1A3226]" : "bg-[#1A3226]/15"}`} />
          )}
        </div>
      ))}
    </div>
  );
}