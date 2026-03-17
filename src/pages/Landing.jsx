import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Check, Star, MapPin, Lock, Play,
  ChevronDown, Mail, Shield, Zap, TrendingUp
} from "lucide-react";
import { usePricing } from "@/components/pricing/usePricing";
import HeroMap from "@/components/landing/HeroMap";
import UrgencyStrip from "@/components/landing/UrgencyStrip";
import PricingSection from "@/components/landing/PricingSection";

// TODO: Replace with real testimonials
const TESTIMONIALS = [
  {
    quote: "I locked down Portsmouth the day PropPrompt launched in NH. Three competitors tried to get in after me — couldn't. My listing presentation win rate is up significantly.",
    name: "Sarah M.",
    title: "Brokerage Owner, Portsmouth NH",
    stars: 5,
  },
  {
    quote: "The pool pricing was a game-changer. I cover 9 Vermont towns for the price of a single city territory. My clients think I have a research team.",
    name: "James R.",
    title: "Team Lead, Central Vermont",
    stars: 5,
  },
  {
    quote: "I did a full buyout of a 3-seat Manchester territory. No other brokerage can even get PropPrompt there now. That's not a tool — that's infrastructure.",
    name: "Dana K.",
    title: "Principal Broker, Manchester NH",
    stars: 5,
  },
];

const FAQ_ITEMS = (pricing) => [
  {
    q: "What states does PropPrompt currently serve?",
    a: "PropPrompt currently serves Maine, New Hampshire, Vermont, and Massachusetts. We are expanding to Connecticut and Rhode Island in Q3 2026.",
  },
  {
    q: "What if my town is already claimed?",
    a: "If all seats in your town are taken, you can join a waitlist. You'll be notified first if a seat opens up, and you get right-of-first-refusal for 48 hours.",
  },
  {
    q: "How does population pool pricing work?",
    a: `Pay per ${parseInt(pricing?.territory_seat_size || 50000).toLocaleString()} residents — fill each bucket with as many small towns as you want. One bucket of small Vermont towns might be the same price as one mid-size city seat.`,
  },
  {
    q: "Can I claim multiple towns?",
    a: `Yes — bundle 2–30+ towns into a single subscription. Discounts range from ${parseFloat(pricing?.bundle_duo_discount || 0)}% (Duo) up to ${parseFloat(pricing?.bundle_master_discount || 0)}% off (Master, 20+ towns).`,
  },
  {
    q: "What is a seat in a large city?",
    a: "Larger cities (50k+ population) have multiple PropPrompt seats. Each seat is independent — you compete with others in your city unless you do a full buyout.",
  },
  {
    q: "Can I buy every seat in a city?",
    a: `Yes — full city buyouts give discounts up to ${parseFloat(pricing?.buyout_10plus_seat_discount || 0)}% off and lock out every other brokerage permanently.`,
  },
  {
    q: "Can I upgrade my tier later?",
    a: "Yes — you can upgrade your tier at any time. The price difference is prorated for the current billing cycle.",
  },
  {
    q: "What if I need more analyses?",
    a: `Top-up packs start at $${parseFloat(pricing?.topup_starter_price || 29).toFixed(0)} for ${parseInt(pricing?.topup_starter_analyses || 10)} analyses, and expire ${parseInt(pricing?.topup_expiry_days || 90)} days after purchase.`,
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#1A3226]/8 last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 text-left gap-4">
        <span className="font-semibold text-sm text-[#1A3226]">{q}</span>
        <ChevronDown className={`w-4 h-4 text-[#1A3226]/40 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-sm text-[#1A3226]/70 leading-relaxed pb-4">{a}</p>}
    </div>
  );
}

export default function Landing() {
  const { pricing, loading: pricingLoading } = usePricing();
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSent, setWaitlistSent] = useState(false);

  const handleWaitlist = (e) => {
    e.preventDefault();
    // TODO: wire to actual waitlist entity
    setWaitlistSent(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] font-sans">

      {/* Nav */}
      <header className="sticky top-0 z-50 bg-[#1A3226] text-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-sm">PP</div>
            <span className="text-base font-semibold tracking-tight">PropPrompt™</span>
            <span className="hidden sm:inline text-white/30 text-sm ml-1">by Sherwood & Company</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-white/70">
            <Link to="/territories" className="hover:text-white transition-colors">Territory Map</Link>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          </nav>
          <Link to="/Dashboard" className="text-sm bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-semibold px-4 py-2 rounded-lg transition-colors">
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-[#1A3226] text-white overflow-hidden min-h-[580px] flex items-center">
        {/* Background glow */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(ellipse at 80% 50%, #B8982F 0%, transparent 55%)" }} />
        {/* Animated map (right half) */}
        <div className="absolute right-0 top-0 bottom-0 w-1/2 hidden lg:block">
          <HeroMap />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-24 lg:py-32 w-full">
          <div className="max-w-2xl">
            <span className="inline-block text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-5 border border-[#B8982F]/30 px-3 py-1 rounded-full">
              ME · NH · VT · MA — Exclusive Territories
            </span>
            <h1 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight mb-5" style={{ fontFamily: "Georgia, serif" }}>
              Your Market.<br />Your Territory.<br />
              <span className="text-[#B8982F]">No Competition.</span>
            </h1>
            <p className="text-lg text-white/70 mb-8 leading-relaxed">
              PropPrompt gives your brokerage exclusive AI-powered market analysis for your towns — locked to you, unavailable to any competitor.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/territories"
                className="flex items-center gap-2 bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-bold px-7 py-3.5 rounded-xl transition-colors">
                Find Your Territory <ArrowRight className="w-4 h-4" />
              </Link>
              <a href="#how-it-works"
                className="flex items-center gap-2 border border-white/20 hover:border-white/50 text-white px-7 py-3.5 rounded-xl transition-colors">
                See How It Works
              </a>
            </div>
            <div className="flex flex-wrap gap-4 mt-8 text-xs text-white/50">
              {['Exclusive per-territory', 'No seat sharing', 'AI-powered CMAs', 'Branded reports'].map(f => (
                <span key={f} className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-[#B8982F]" />{f}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Urgency Strip */}
      <UrgencyStrip />

      {/* How It Works */}
      <section id="how-it-works" className="bg-[#1A3226] text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">How It Works</p>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "Georgia, serif" }}>Three Steps to Exclusivity</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-[#B8982F]/20" />
            {[
              { step: "01", icon: MapPin, title: "Find Your Territory", desc: "Browse the live map, pick your town or build a population pool across multiple small towns. See exactly what's available." },
              { step: "02", icon: Lock, title: "Claim It Exclusively", desc: "One subscriber per seat. No sharing. Once you hold Portsmouth NH, no other brokerage in Portsmouth gets PropPrompt." },
              { step: "03", icon: Zap, title: "Run AI Analysis", desc: "CMAs, market reports, buyer presentations — all branded to you. Export to PDF, sync to Drive, or push to your CRM." },
            ].map(s => (
              <div key={s.step} className="text-center relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[#B8982F]/15 border border-[#B8982F]/30 flex items-center justify-center mx-auto mb-5">
                  <s.icon className="w-6 h-6 text-[#B8982F]" />
                </div>
                <span className="text-[#B8982F] text-xs font-bold tracking-widest">{s.step}</span>
                <h3 className="font-bold text-base mt-1 mb-2">{s.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Territory Model */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-5">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest">Exclusive Territory Model</p>
            <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
              The Franchise Model for Real Estate AI
            </h2>
            <p className="text-[#1A3226]/70 text-sm leading-relaxed">
              Once you hold Portsmouth NH, no other brokerage in Portsmouth gets PropPrompt. Your territory is your competitive moat — protected by contract, not just by price.
            </p>
            <ul className="space-y-3">
              {[
                "Your town is yours alone — no competitor access",
                "All analyses branded to your brokerage",
                "Exclusive prompt library calibrated to your market",
                "Territory lock is contractual, not just first-come",
              ].map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-[#1A3226]/70">
                  <Shield className="w-4 h-4 text-[#B8982F] flex-shrink-0 mt-0.5" />{f}
                </li>
              ))}
            </ul>
            <Link to="/territories" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A3226] hover:text-[#B8982F] transition-colors">
              See full territory map → 
            </Link>

            {/* MA note */}
            <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-4 space-y-2">
              <p className="text-sm text-[#1A3226]/80 leading-relaxed">
                <span className="font-semibold text-[#1A3226]">Eastern Massachusetts</span> is already active across 351 towns covering 4.5 million residents — held by our Founding Partner.
              </p>
              <p className="text-sm text-[#1A3226]/80 leading-relaxed">
                <span className="font-semibold text-[#22c55e]">Western Massachusetts, the Cape, and the Pioneer Valley</span> are fully open for subscription today.
              </p>
            </div>
          </div>

          {/* Static SVG mini-map */}
          <div className="bg-[#1A3226] rounded-3xl p-6 aspect-square max-w-sm mx-auto w-full relative overflow-hidden">
            <svg viewBox="0 0 300 300" className="w-full h-full" fill="none">
              {/* ME */}
              <path d="M120,20 L240,25 L255,65 L235,95 L245,130 L215,148 L200,175 L165,182 L148,205 L130,195 L110,165 L80,148 L65,110 L72,65 Z"
                fill="#B8982F" fillOpacity="0.25" stroke="#B8982F" strokeWidth="1.5" />
              {/* NH */}
              <path d="M82,150 L115,168 L133,198 L128,248 L98,260 L72,238 L62,195 L65,165 Z"
                fill="#ef4444" fillOpacity="0.3" stroke="#ef4444" strokeWidth="1.5" />
              {/* VT */}
              <path d="M35,152 L62,165 L65,195 L72,238 L52,255 L25,235 L18,192 L22,162 Z"
                fill="#22c55e" fillOpacity="0.25" stroke="#22c55e" strokeWidth="1.5" />
              {/* Labels */}
              <text x="155" y="90" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">ME</text>
              <text x="98" y="210" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">NH</text>
              <text x="44" y="205" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">VT</text>

              {/* Legend dots */}
              <circle cx="20" cy="275" r="5" fill="#22c55e" fillOpacity="0.7" />
              <text x="30" y="279" fill="white" fontSize="8" fontFamily="sans-serif" fillOpacity="0.6">Available</text>
              <circle cx="90" cy="275" r="5" fill="#ef4444" fillOpacity="0.7" />
              <text x="100" y="279" fill="white" fontSize="8" fontFamily="sans-serif" fillOpacity="0.6">Claimed</text>
              <circle cx="155" cy="275" r="5" fill="#f59e0b" fillOpacity="0.7" />
              <text x="165" y="279" fill="white" fontSize="8" fontFamily="sans-serif" fillOpacity="0.6">Pending</text>
            </svg>
          </div>
        </div>
      </section>

      {/* Expansion Roadmap */}
      <section className="bg-white border-t border-[#1A3226]/8 py-16">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Expansion Roadmap</p>
            <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>Where We're Going</h2>
          </div>
          <div className="space-y-3">
            {[
              { phase: "Phase 1", timing: "Now", states: "Maine, New Hampshire, Vermont, Massachusetts", active: true },
              { phase: "Phase 2", timing: "Q3 2026", states: "Connecticut, Rhode Island", active: false },
              { phase: "Phase 3", timing: "Q4 2026", states: "New York, New Jersey, Pennsylvania", active: false },
              { phase: "Phase 4", timing: "Q1 2027", states: "Florida, Georgia, South Carolina, North Carolina", active: false },
              { phase: "Phase 5", timing: "2027–2028", states: "All remaining states", active: false },
            ].map(row => (
              <div key={row.phase} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 rounded-xl px-5 py-4 border ${row.active ? 'bg-[#1A3226] border-[#1A3226] text-white' : 'bg-[#FAF8F4] border-[#1A3226]/10 text-[#1A3226]'}`}>
                <div className="flex items-center gap-3 sm:w-40 flex-shrink-0">
                  <span className={`text-xs font-bold uppercase tracking-wider ${row.active ? 'text-[#B8982F]' : 'text-[#1A3226]/40'}`}>{row.phase}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${row.active ? 'bg-[#B8982F] text-[#1A3226]' : 'bg-[#1A3226]/10 text-[#1A3226]/50'}`}>{row.timing}</span>
                </div>
                <p className={`text-sm font-medium ${row.active ? 'text-white' : 'text-[#1A3226]/70'}`}>{row.states}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      {!pricingLoading && <PricingSection pricing={pricing} />}

      {/* Training Teaser */}
      <section className="bg-[#1A3226] text-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Training</p>
            <h2 className="text-3xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              Get Up and Running in Hours, Not Weeks
            </h2>
            <p className="text-sm text-white/60 mt-3">Step-by-step video training built into your dashboard.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5 mb-8">
            {[
              "Claiming Your Territory",
              "Running Your First CMA",
              "Exporting Client Reports",
            ].map(title => (
              <div key={title} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="aspect-video bg-white/5 flex items-center justify-center relative group cursor-pointer hover:bg-white/10 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-[#B8982F]/20 border border-[#B8982F]/40 flex items-center justify-center">
                    <Lock className="w-5 h-5 text-[#B8982F]" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs text-white/60">Available after claim</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="text-xs text-white/40 mt-0.5">Included with all plans</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link to="/territories" className="inline-flex items-center gap-2 bg-[#B8982F] text-[#1A3226] font-bold px-7 py-3.5 rounded-xl hover:bg-[#B8982F]/90 transition-colors">
              Start Your Territory <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Early Subscribers</p>
          <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            From Brokerages Already Holding Territory
          </h2>
          {/* TODO: Replace with verified testimonials */}
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {TESTIMONIALS.map(t => (
            <div key={t.name} className="bg-white rounded-2xl border border-[#1A3226]/8 p-6 hover:shadow-sm hover:border-[#B8982F]/30 transition-all">
              <div className="flex gap-0.5 mb-4">
                {[...Array(t.stars)].map((_, i) => <Star key={i} className="w-4 h-4 fill-[#B8982F] text-[#B8982F]" />)}
              </div>
              <p className="text-[#1A3226]/80 text-sm leading-relaxed mb-5 italic">"{t.quote}"</p>
              <div>
                <p className="font-bold text-[#1A3226] text-sm">{t.name}</p>
                <p className="text-xs text-[#1A3226]/50">{t.title}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-t border-[#1A3226]/8 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">FAQ</p>
            <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>Common Questions</h2>
          </div>
          <div className="rounded-2xl border border-[#1A3226]/8 bg-[#FAF8F4] px-6">
            {!pricingLoading && FAQ_ITEMS(pricing).map(item => (
              <FAQItem key={item.q} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-[#1A3226] text-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "Georgia, serif" }}>
            Your Market Is Available Right Now.
          </h2>
          <p className="text-white/60 mb-8 text-sm max-w-lg mx-auto">
            Check the territory map. If your town is green, it's yours to claim — and once you do, no competitor can touch it.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/territories" className="inline-flex items-center gap-2 bg-[#B8982F] text-[#1A3226] font-bold px-8 py-3.5 rounded-xl hover:bg-[#B8982F]/90 transition-colors">
              Check Territory Availability <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/Dashboard" className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-8 py-3.5 rounded-xl hover:border-white/50 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A3226]/95 text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-md bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-xs">PP</div>
                <span className="font-semibold text-white">PropPrompt™</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed">by Sherwood & Company<br />Brokered by Compass</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Product</p>
              <div className="space-y-2">
                {[['Territory Map', '/territories'], ['Pricing', '#pricing'], ['Training', '/Dashboard'], ['Sign In', '/Dashboard']].map(([l, h]) => (
                  <div key={l}><Link to={h} className="text-xs text-white/50 hover:text-white transition-colors">{l}</Link></div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Territories</p>
              <div className="space-y-1">
                {['Maine — Active', 'New Hampshire — Active', 'Vermont — Active', 'Massachusetts — Active'].map(s => (
                  <p key={s} className="text-xs text-white/50">{s}</p>
                ))}
                <p className="text-xs text-white/30 mt-2">Coming soon: CT, RI, NY, NJ, PA and beyond</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Waitlist — CT, RI, NY, NJ, PA & Beyond</p>
              {waitlistSent ? (
                <p className="text-xs text-[#B8982F] font-semibold">You're on the list! We'll reach out when your state launches.</p>
              ) : (
                <form onSubmit={handleWaitlist} className="space-y-2">
                  <input
                    type="email" required value={waitlistEmail}
                    onChange={e => setWaitlistEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full text-xs rounded-lg bg-white/10 border border-white/10 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-[#B8982F]/50"
                  />
                  <button type="submit" className="w-full text-xs font-semibold bg-[#B8982F]/20 hover:bg-[#B8982F]/30 text-[#B8982F] py-2 rounded-lg transition-colors">
                    Notify Me
                  </button>
                </form>
              )}
              <p className="text-xs text-white/30 mt-2">No spam. Launch notification only.</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/30">
            <p>© {new Date().getFullYear()} Sherwood & Company. All rights reserved.</p>
            <a href="mailto:blake.sherwood@compass.com" className="flex items-center gap-1.5 hover:text-white/60 transition-colors">
              <Mail className="w-3.5 h-3.5" /> blake.sherwood@compass.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}