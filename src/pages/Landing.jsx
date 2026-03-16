import { Link } from "react-router-dom";
import { Check, Shield, Brain, TrendingUp, Users, FileText, Star, ArrowRight, MapPin, Phone, Mail } from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Calibrated Analysis",
    desc: "Multi-layer prompt engineering tuned specifically for Eastern Massachusetts real estate — not a generic AI tool.",
  },
  {
    icon: TrendingUp,
    title: "5 Analysis Types",
    desc: "Listing pricing, buyer intelligence, investment analysis, CMA, and rental market analysis — all in one platform.",
  },
  {
    icon: Shield,
    title: "Fair Housing Compliance",
    desc: "Automated monthly compliance reviews with e-signature workflows built for brokerage accountability.",
  },
  {
    icon: Users,
    title: "Team & Brokerage Scale",
    desc: "Role-based access for agents, assistants, team leads, and brokerage admins — with per-seat billing.",
  },
  {
    icon: FileText,
    title: "Exportable Reports",
    desc: "Every analysis exports to PDF and syncs to Google Drive — ready to share with clients instantly.",
  },
  {
    icon: MapPin,
    title: "Market-Licensed Territories",
    desc: "Exclusive market licensing by state, submarket, town, or ZIP — your competitive edge, protected.",
  },
];

const PLANS = [
  {
    name: "Standalone Team",
    price: "$99",
    interval: "/mo",
    desc: "For independent teams of up to 10 agents.",
    features: ["Team dashboard", "Analyses history", "Drive sync", "Agent + assistant seats"],
    cta: "Get Started",
  },
  {
    name: "Brokerage",
    price: "$199",
    interval: "/mo",
    desc: "Full brokerage platform with compliance tools.",
    features: ["Unlimited agents", "Fair housing compliance reviews", "CRM integrations", "White-label branding", "Market licensing"],
    cta: "Get Started",
    highlight: true,
  },
];

const TESTIMONIALS = [
  {
    quote: "PropPrompt has completely changed how I price listings. The AI output is more nuanced than anything I've built manually.",
    name: "Sarah M.",
    title: "Senior Agent, North Shore",
  },
  {
    quote: "The buyer intelligence reports alone are worth the subscription. My conversion rate on listing appointments is up 30%.",
    name: "James R.",
    title: "Team Lead, Greater Boston",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans">

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[#1A3226] text-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-sm">
              PP
            </div>
            <span className="text-base font-semibold tracking-tight">PropPrompt™</span>
            <span className="hidden sm:inline text-white/30 text-sm ml-1">by Sherwood & Company</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block">Pricing</a>
            <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block">Features</a>
            <Link
              to="/Dashboard"
              className="text-sm bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-[#1A3226] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, #B8982F 0%, transparent 60%)" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-block text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-4 border border-[#B8982F]/30 px-3 py-1 rounded-full">
              Eastern Massachusetts Real Estate AI
            </span>
            <h1 className="text-4xl lg:text-6xl font-bold leading-tight mb-6" style={{ fontFamily: "Georgia, serif" }}>
              AI-Powered Analysis for Serious Real Estate Professionals
            </h1>
            <p className="text-lg text-white/70 mb-8 leading-relaxed max-w-2xl">
              PropPrompt™ is the only AI analysis platform built exclusively for Eastern Massachusetts brokerages and teams — with market-calibrated prompts, fair housing compliance, and exportable client-ready reports.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/Dashboard"
                className="flex items-center gap-2 bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
              >
                Start Your Analysis <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#features"
                className="flex items-center gap-2 border border-white/20 hover:border-white/40 text-white px-6 py-3 rounded-xl transition-colors text-sm"
              >
                See How It Works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <div className="bg-[#B8982F]/10 border-y border-[#B8982F]/20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-6 text-sm text-[#1A3226]/70">
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B8982F]" /> Built for Eastern MA markets</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B8982F]" /> Fair Housing compliant</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B8982F]" /> Claude AI powered</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B8982F]" /> Google Drive sync</span>
          <span className="flex items-center gap-2"><Check className="w-4 h-4 text-[#B8982F]" /> CRM integrations</span>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Platform Features</p>
          <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            Everything a Top-Performing Agent Needs
          </h2>
          <p className="text-[#1A3226]/60 mt-3 max-w-xl mx-auto text-sm">
            Every feature was designed around how real agents actually work — not a generic AI wrapper.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-[#1A3226]/8 p-6 hover:border-[#B8982F]/30 hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#B8982F]/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-[#B8982F]" />
              </div>
              <h3 className="font-semibold text-[#1A3226] mb-2">{f.title}</h3>
              <p className="text-sm text-[#1A3226]/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-[#1A3226] text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">How It Works</p>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              From Intake to Analysis in Minutes
            </h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Complete the Intake Wizard", desc: "6 guided steps capture property details, client relationship, AI platform preference, and output format." },
              { step: "02", title: "PropPrompt Assembles Your Prompt", desc: "Our multi-layer prompt engine assembles a fully calibrated, market-specific prompt — encrypted server-side." },
              { step: "03", title: "Stream Your AI Analysis", desc: "Watch your analysis generate in real time. Export to PDF, sync to Drive, or push directly to your CRM." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#B8982F]/20 border border-[#B8982F]/40 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[#B8982F] font-bold text-sm">{s.step}</span>
                </div>
                <h3 className="font-semibold mb-2">{s.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Testimonials</p>
          <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            Trusted by Eastern MA Professionals
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-white rounded-2xl border border-[#1A3226]/8 p-6">
              <div className="flex gap-0.5 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-[#B8982F] text-[#B8982F]" />
                ))}
              </div>
              <p className="text-[#1A3226]/80 text-sm leading-relaxed mb-4 italic">"{t.quote}"</p>
              <div>
                <p className="font-semibold text-[#1A3226] text-sm">{t.name}</p>
                <p className="text-xs text-[#1A3226]/50">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-[#FAF8F4] border-t border-[#1A3226]/8 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Pricing</p>
            <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
              Simple, Transparent Pricing
            </h2>
            <p className="text-sm text-[#1A3226]/60 mt-3">Per-seat pricing added on top of your base license. No hidden fees.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-7 flex flex-col gap-5 ${
                  plan.highlight
                    ? "bg-[#1A3226] text-white border border-[#1A3226]"
                    : "bg-white border border-[#1A3226]/10"
                }`}
              >
                {plan.highlight && (
                  <span className="text-[10px] uppercase tracking-wider bg-[#B8982F] text-[#1A3226] font-bold px-3 py-0.5 rounded-full self-start">
                    Most Popular
                  </span>
                )}
                <div>
                  <p className={`font-semibold text-lg ${plan.highlight ? "text-white" : "text-[#1A3226]"}`}>{plan.name}</p>
                  <p className={`text-xs mt-0.5 ${plan.highlight ? "text-white/60" : "text-[#1A3226]/50"}`}>{plan.desc}</p>
                </div>
                <p className={`text-4xl font-bold ${plan.highlight ? "text-white" : "text-[#1A3226]"}`}>
                  {plan.price}<span className={`text-base font-normal ${plan.highlight ? "text-white/50" : "text-[#1A3226]/40"}`}>{plan.interval}</span>
                </p>
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-white/80" : "text-[#1A3226]/70"}`}>
                      <Check className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-[#B8982F]" : "text-[#B8982F]"}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/Dashboard"
                  className={`text-center text-sm font-semibold px-5 py-3 rounded-xl transition-colors ${
                    plan.highlight
                      ? "bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226]"
                      : "bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-[#1A3226]/40 mt-8">
            + Per-seat add-ons: Brokerage Admin $99/mo · Team Lead $79/mo · Agent $49/mo · Assistant $29/mo
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1A3226] text-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "Georgia, serif" }}>
            Ready to Elevate Your Practice?
          </h2>
          <p className="text-white/60 mb-8 text-sm">
            Join the Eastern Massachusetts agents and brokerages using PropPrompt™ to win more listings and serve clients better.
          </p>
          <Link
            to="/Dashboard"
            className="inline-flex items-center gap-2 bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-semibold px-8 py-3.5 rounded-xl transition-colors"
          >
            Get Started Today <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A3226]/95 text-white/50 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-[10px]">PP</div>
            <span>PropPrompt™ by Sherwood & Company · Brokered by Compass</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="mailto:blake.sherwood@compass.com" className="flex items-center gap-1.5 hover:text-white/80 transition-colors">
              <Mail className="w-3.5 h-3.5" /> blake.sherwood@compass.com
            </a>
          </div>
          <p>© {new Date().getFullYear()} Sherwood & Company. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}