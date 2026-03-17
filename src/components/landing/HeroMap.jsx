import { useEffect, useState } from "react";

const MARKERS = [
  { x: 160, y: 80, label: "Portland, ME", color: "#B8982F", delay: 0 },
  { x: 210, y: 120, label: "Augusta, ME", color: "#B8982F", delay: 0.4 },
  { x: 140, y: 160, label: "Portsmouth, NH", color: "#ef4444", delay: 0.8 },
  { x: 175, y: 190, label: "Concord, NH", color: "#B8982F", delay: 1.2 },
  { x: 130, y: 220, label: "Manchester, NH", color: "#ef4444", delay: 1.6 },
  { x: 155, y: 260, label: "Burlington, VT", color: "#B8982F", delay: 2.0 },
  { x: 190, y: 280, label: "Montpelier, VT", color: "#B8982F", delay: 2.4 },
  { x: 110, y: 300, label: "Brattleboro, VT", color: "#f59e0b", delay: 2.8 },
  { x: 240, y: 100, label: "Bangor, ME", color: "#B8982F", delay: 3.2 },
  { x: 165, y: 145, label: "Laconia, NH", color: "#f59e0b", delay: 3.6 },
];

export default function HeroMap() {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    const timers = MARKERS.map((m, i) =>
      setTimeout(() => setVisible(v => [...v, i]), m.delay * 1000 + 600)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative w-full h-full opacity-30 select-none pointer-events-none">
      <svg viewBox="0 0 380 380" className="w-full h-full" fill="none">
        {/* ME rough outline */}
        <path d="M120,40 L270,40 L290,80 L270,110 L280,150 L250,170 L240,200 L200,210 L180,240 L160,230 L140,200 L100,180 L80,140 L90,90 Z"
          fill="#1A3226" stroke="#B8982F" strokeWidth="0.8" strokeOpacity="0.4" fillOpacity="0.3" />
        {/* NH outline */}
        <path d="M100,180 L140,200 L160,230 L155,280 L120,295 L90,270 L80,230 L80,200 Z"
          fill="#1A3226" stroke="#B8982F" strokeWidth="0.8" strokeOpacity="0.4" fillOpacity="0.3" />
        {/* VT outline */}
        <path d="M60,185 L80,200 L80,230 L90,270 L70,290 L40,270 L30,230 L35,200 L50,190 Z"
          fill="#1A3226" stroke="#B8982F" strokeWidth="0.8" strokeOpacity="0.4" fillOpacity="0.3" />
        {/* Grid lines */}
        {[80, 120, 160, 200, 240, 280].map(y => (
          <line key={`h${y}`} x1="20" y1={y} x2="310" y2={y} stroke="white" strokeWidth="0.3" strokeOpacity="0.08" />
        ))}
        {[80, 120, 160, 200, 240, 280].map(x => (
          <line key={`v${x}`} x1={x} y1="20" x2={x} y2="340" stroke="white" strokeWidth="0.3" strokeOpacity="0.08" />
        ))}

        {/* Animated markers */}
        {MARKERS.map((m, i) => (
          <g key={i} style={{ opacity: visible.includes(i) ? 1 : 0, transition: 'opacity 0.5s ease' }}>
            {/* Pulse ring */}
            <circle cx={m.x} cy={m.y} r="10" fill={m.color} fillOpacity="0.15">
              {visible.includes(i) && (
                <animate attributeName="r" from="6" to="16" dur="2s" repeatCount="indefinite" />
              )}
              {visible.includes(i) && (
                <animate attributeName="fillOpacity" from="0.3" to="0" dur="2s" repeatCount="indefinite" />
              )}
            </circle>
            {/* Dot */}
            <circle cx={m.x} cy={m.y} r="4" fill={m.color} />
            {/* Label */}
            <text x={m.x + 8} y={m.y + 4} fill="white" fontSize="7" fontFamily="sans-serif" fillOpacity="0.7">
              {m.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}