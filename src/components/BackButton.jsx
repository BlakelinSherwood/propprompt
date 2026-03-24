import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

// Routes where the back button should NOT appear (root-level tabs)
const ROOT_PATHS = [
  "/Dashboard",
  "/NewAnalysis",
  "/Analyses",
  "/training",
  "/AccountSettings",
  "/Members",
  "/Billing",
  "/PlatformAdmin",
  "/Territories",
  "/Claim",
];

export default function BackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  const isRoot = ROOT_PATHS.some(
    (p) => location.pathname === p || (p !== "/" && location.pathname.startsWith(p + "/") && p.length > 8)
  );

  if (isRoot) return null;

  return (
    <button
      onClick={() => navigate(-1)}
      className="lg:hidden flex items-center gap-1 text-sm text-[#1A3226]/60 hover:text-[#1A3226] mb-3 transition-colors"
    >
      <ChevronLeft className="w-4 h-4" />
      Back
    </button>
  );
}