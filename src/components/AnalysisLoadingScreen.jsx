import React, { useEffect, useState } from 'react';

const MODELS = [
  { id: 'perplexity', name: 'Perplexity', task: 'Fetching live market data...', delay: 0 },
  { id: 'claude', name: 'Claude Sonnet', task: 'Analyzing price trends...', delay: 300 },
  { id: 'gpt4o', name: 'GPT-4o', task: 'Synthesizing neighborhood context...', delay: 600 },
  { id: 'gemini', name: 'Gemini', task: 'Building location intelligence...', delay: 900 },
  { id: 'grok', name: 'Grok', task: 'Generating buyer archetypes...', delay: 1200 },
];

export default function AnalysisLoadingScreen({ status = 'loading', onComplete, primaryColor = '#1A3226', accentColor = '#B8982F' }) {
  const [progress, setProgress] = useState(0);
  const [completedModels, setCompletedModels] = useState(new Set());

  // Simulate progress increments
  useEffect(() => {
    if (status !== 'loading') return;
    const interval = setInterval(() => {
      setProgress((p) => Math.min(p + Math.random() * 15, 95));
    }, 800);
    return () => clearInterval(interval);
  }, [status]);

  // Mark models as complete on a cycle
  useEffect(() => {
    if (status !== 'loading') return;
    const cycle = setInterval(() => {
      setCompletedModels((prev) => {
        const next = new Set(prev);
        const nextIdx = prev.size % MODELS.length;
        next.add(MODELS[nextIdx].id);
        return next;
      });
    }, 12000);
    return () => clearInterval(cycle);
  }, [status]);

  // Handle completion
  useEffect(() => {
    if (status === 'complete') {
      setProgress(100);
      const timer = setTimeout(() => onComplete?.(), 500);
      return () => clearTimeout(timer);
    }
  }, [status, onComplete]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden" style={{ backgroundColor: primaryColor }}>
      {/* Market Pulse Background */}
      <div className="absolute inset-0 opacity-15">
        <svg
          className="w-full h-full animate-pulse-market"
          viewBox="0 0 1200 400"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Blurred grid background */}
          <defs>
            <linearGradient id="gridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={accentColor} stopOpacity="0.2" />
              <stop offset="50%" stopColor={primaryColor} stopOpacity="0.1" />
              <stop offset="100%" stopColor={accentColor} stopOpacity="0.2" />
            </linearGradient>
            <filter id="chartBlur">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
            </filter>
          </defs>

          {/* Animated candlestick-like chart */}
          <g filter="url(#chartBlur)" className="animate-chart-shift">
            {/* Vertical bars (price movement) */}
            {[0, 80, 160, 240, 320, 400, 480, 560, 640, 720, 800, 880, 960, 1040].map(
              (x, i) => (
                <g key={i}>
                  <rect
                    x={x}
                    y={150 + Math.sin(i * 0.5) * 40}
                    width="40"
                    height={100 + Math.cos(i * 0.5) * 50}
                    fill={accentColor}
                    opacity={0.3 + Math.sin(i) * 0.15}
                  />
                  <line
                    x1={x + 20}
                    y1={120 + Math.sin(i * 0.7) * 50}
                    x2={x + 20}
                    y2={250 + Math.cos(i * 0.7) * 50}
                    stroke={accentColor}
                    strokeWidth="1"
                    opacity="0.4"
                  />
                </g>
              )
            )}

            {/* Flowing line chart */}
            <polyline
              points={[0, 200, 80, 180, 160, 200, 240, 160, 320, 190, 400, 170, 480, 195, 560, 175, 640, 190, 720, 160, 800, 185, 880, 170, 960, 200, 1040, 180, 1120, 195].join(
                ' '
              )}
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              opacity="0.4"
            />
          </g>

          {/* Grid pattern overlay */}
          <rect x="0" y="0" width="1200" height="400" fill="url(#gridGrad)" />
        </svg>
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-lg px-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: accentColor }}>
            PropPrompt™ Ensemble AI
          </p>
          <h2 className="text-2xl font-semibold text-white mb-1" style={{ fontFamily: 'Georgia, serif' }}>
            Compiling Your Analysis
          </h2>
          <p className="text-sm text-[#E0E0E0]/60">
            {60 + Math.floor(Math.random() * 30)} seconds of AI research in progress...
          </p>
        </div>

        {/* Research Feed Cards */}
        <div className="w-full space-y-3 h-80 overflow-hidden">
          {MODELS.map((model, idx) => {
            const isCompleted = completedModels.has(model.id);
            return (
              <div
                key={model.id}
                className="animate-cascade-in"
                style={{
                  animationDelay: `${model.delay}ms`,
                  opacity: isCompleted ? 0.5 : 1,
                }}
              >
                <div className="rounded-lg border backdrop-blur-sm p-4 flex items-center gap-3 transition-all duration-300" style={{ borderColor: `${accentColor}4D`, backgroundColor: `${primaryColor}14` }}>
                  {/* Status Indicator */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}99` }}>
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${accentColor}66`, borderTopColor: accentColor }} />
                    )}
                  </div>

                  {/* Model Info */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{model.name}</p>
                    <p className={`text-xs transition-colors duration-300 ${isCompleted ? 'text-[#E0E0E0]/40' : 'text-[#E0E0E0]/70'}`}>
                      {model.task}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar */}
        <div className="w-full">
          <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${primaryColor}66` }}>
            <div
              className="h-full transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%`, background: `linear-gradient(to right, ${accentColor}, ${primaryColor})` }}
            />
          </div>
          <p className="text-xs text-[#E0E0E0]/50 mt-2 text-center">
            {Math.floor(progress)}% complete
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse-market {
          0%, 100% {
            opacity: 0.15;
          }
          50% {
            opacity: 0.2;
          }
        }

        @keyframes chart-shift {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(60px);
          }
        }

        @keyframes cascade-in {
          0% {
            opacity: 0;
            transform: translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-pulse-market {
          animation: pulse-market 4s ease-in-out infinite;
        }

        .animate-chart-shift {
          animation: chart-shift 8s linear infinite;
        }

        .animate-cascade-in {
          animation: cascade-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
      `}</style>
    </div>
  );
}