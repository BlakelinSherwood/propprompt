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
  { x: 120, y: 330, label: "Boston, MA", color: "#ef4444", delay: 4.0 },
  { x: 90, y: 320, label: "Worcester, MA", color: "#B8982F", delay: 4.4 },
  { x: 75, y: 345, label: "Springfield, MA", color: "#B8982F", delay: 4.8 },
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
        {/* ME accurate outline */}
        <path d="M165,35 Q200,40 245,50 Q265,55 275,75 Q280,95 275,130 Q270,155 255,165 Q240,172 225,178 Q210,185 200,200 Q190,215 180,225 Q165,235 155,230 Q145,215 140,195 Q135,170 130,145 Q128,120 130,95 Q135,70 145,55 Q155,42 165,35 Z"
          fill="#1A3226" stroke="#B8982F" strokeWidth="1" strokeOpacity="0.5" fillOpacity="0.35" />
        {/* NH accurate outline */}
        <path d="M110,165 Q130,175 155,185 Q165,190 170,210 Q172,245 160,280 Q150,295 125,300 Q100,300 85,285 Q75,270 75,240 Q78,210 85,190 Q95,170 110,165 Z"
          fill="#1A3226" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.5" fillOpacity="0.35" />
        {/* VT accurate outline */}
        <path d="M75,165 Q85,170 95,180 Q100,190 95,225 Q90,265 80,285 Q70,300 50,305 Q40,300 35,280 Q32,250 35,220 Q40,190 50,175 Q60,165 75,165 Z"
          fill="#1A3226" stroke="#22c55e" strokeWidth="1" strokeOpacity="0.5" fillOpacity="0.35" />
        {/* MA accurate outline */}
        <path d="M85,285 Q115,290 160,295 Q170,300 168,315 Q160,335 140,345 Q110,350 75,340 Q50,332 45,315 Q50,300 85,285 Z"
          fill="#1A3226" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.5" fillOpacity="0.35" />
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