import { Link } from "react-router-dom";

export default function DashboardStatCard({ icon: Icon, label, value, subtitle, linkTo }) {
  const Wrapper = linkTo ? Link : "div";
  const wrapperProps = linkTo ? { to: linkTo } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`group rounded-2xl border border-[#1A3226]/10 bg-white p-5 transition-all
        ${linkTo ? "hover:border-[#B8982F]/40 hover:shadow-sm cursor-pointer" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-[#1A3226]/60" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-[#1A3226] tabular-nums">{value}</p>
      <p className="text-xs text-[#1A3226]/50 mt-0.5">{subtitle || label}</p>
    </Wrapper>
  );
}