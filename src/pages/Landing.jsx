import { useState, useEffect } from "react";
import {
  ArrowRight, Check, Star, MapPin, Lock, Play,
  ChevronDown, Mail, Shield, Zap, TrendingUp, Home, Layers, Brain, GitMerge
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { useFounderProfile } from "@/lib/useFounderProfile";
import HeroMap from "@/components/landing/HeroMap";
import UrgencyStrip from "@/components/landing/UrgencyStrip";
import PricingSection from "@/components/landing/PricingSection";
import TerritoryLandingMap from "@/components/landing/TerritoryLandingMap";

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
  const { founder, loading: founderLoading } = useFounderProfile();
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
            <a href="/#territories" className="hover:text-white transition-colors">Territory Map</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          </nav>
          <button onClick={() => base44.auth.redirectToLogin(window.location.origin + '/Dashboard')} className="text-sm bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer">
           Sign In
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-[#1A3226] text-white overflow-hidden min-h-[580px] flex items-center">
        {/* Background glow */}
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(ellipse at 80% 50%, #B8982F 0%, transparent 55%)" }} />

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
  
              <a href="#how-it-works"
                className="flex items-center gap-2 border border-white/20 hover:border-white/50 text-white px-7 py-3.5 rounded-xl transition-colors">
                See How It Works
              </a>
            </div>
            {founder && (
              <div className="flex items-center gap-2 mt-6 text-xs text-white/60 bg-white/5 border border-white/10 rounded-lg px-4 py-3 inline-block">
                <Home className="w-3.5 h-3.5 text-[#B8982F]" />
                <span>Built by <span className="font-semibold text-white">{founder.founder_name}</span> · {founder.credentials_line} · {founder.years_experience} Years in New England</span>
              </div>
            )}
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
            {founder && <p className="text-sm text-white/60 mt-3">Designed by a working broker. Built for agents who want to compete on intelligence.</p>}
          </div>
          <div className="grid sm:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden sm:block absolute top-10 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-[#B8982F]/20" />
            {[
              { step: "01", icon: MapPin, title: "Find Your Territory", desc: "Browse the live map, pick your town or build a population pool across multiple small towns. See exactly what's available." },
              { step: "02", icon: Lock, title: "Claim It Exclusively", desc: "One subscriber per seat. No sharing. Once you hold Portsmouth NH, no other brokerage in Portsmouth gets PropPrompt." },
              { step: "03", icon: Zap, title: "Run AI Analysis", desc: "Listing pricing, CMAs, buyer intelligence, portfolio reviews — all branded to you. Export to PDF, sync to Drive, or push to your CRM." },
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
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-5">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest">Exclusive Territory Model</p>
            <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
              The Franchise Model for Real Estate AI
            </h2>
            <p className="text-[#1A3226]/70 text-sm leading-relaxed">
              Once a brokerage claims a PropPrompt territory, it's theirs. No other agent in that town gets access to the platform. No shared insights, no competing on the same data.
            </p>
            <p className="text-[#1A3226]/70 text-sm leading-relaxed">
              In larger cities, a limited number of seats are available based on population — but each seat is exclusive. When they're gone, they're gone.
            </p>
            <p className="text-[#1A3226]/70 text-sm leading-relaxed">
              This isn't a subscription you sign up for and forget. It's a competitive position you hold.
            </p>
          </div>

          {/* Mapbox map */}
          <div>
            <TerritoryLandingMap />
            <div className="text-center mt-6">
              <p className="text-xs text-[#1A3226]/60 mb-3">Four states. Thousands of territories. Most still available.</p>
            </div>
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

      {/* Ensemble AI Section */}
      <section className="bg-white border-t border-[#1A3226]/8 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[#B8982F] text-xs font-semibold uppercase tracking-widest mb-2">Ensemble AI — Pro & Team</p>
            <h2 className="text-3xl font-bold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
              Five AI Models. One Report. Zero Guesswork.
            </h2>
            <p className="text-sm text-[#1A3226]/60 mt-3 max-w-2xl mx-auto">
              PropPrompt's Ensemble AI doesn't pick one model and hope for the best. It assigns each section of your report to the model best suited for that job — all running in parallel.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              {[
                { icon: Brain, title: 'Pricing Strategy', model: 'Claude (Anthropic)', desc: 'Deep reasoning for defensible price positioning and comp analysis.' },
                { icon: Zap, title: 'Market Context', model: 'Perplexity AI', desc: 'Real-time web research on current inventory, absorption, and buyer demand.' },
                { icon: MapPin, title: 'Neighbourhood Intelligence', model: 'Gemini (Google)', desc: 'Location-aware analysis of schools, walkability, and community factors.' },
                { icon: TrendingUp, title: 'Buyer Archetypes & Listing Copy', model: 'Claude (Anthropic)', desc: 'Psychographic profiling and persuasive listing narrative written to convert.' },
              ].map(item => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#B8982F]/10 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-[#B8982F]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-[#1A3226]">{item.title}</p>
                      <span className="text-[10px] bg-[#1A3226]/8 text-[#1A3226]/60 px-2 py-0.5 rounded-full font-medium">{item.model}</span>
                    </div>
                    <p className="text-xs text-[#1A3226]/60 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl bg-[#1A3226] p-8 text-white space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <GitMerge className="w-6 h-6 text-[#B8982F]" />
                <p className="font-bold text-lg">How Ensemble Works</p>
              </div>
              {[
                { step: '01', label: 'Parallel Execution', desc: 'All section-specific models run simultaneously — no waiting for one to finish before the next begins.' },
                { step: '02', label: 'Specialist Assignment', desc: 'Each report section is assigned to the model with the strongest capability for that task.' },
                { step: '03', label: 'Claude Assembly', desc: 'Claude synthesizes all outputs into a single, cohesive, client-ready report with consistent voice and terminology.' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-4">
                  <span className="text-[#B8982F] font-bold text-xs mt-0.5 w-6 flex-shrink-0">{s.step}</span>
                  <div>
                    <p className="font-semibold text-sm mb-0.5">{s.label}</p>
                    <p className="text-xs text-white/60 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-white/10 pt-5">
                <p className="text-xs text-white/50 mb-1">The result</p>
                <p className="text-sm font-semibold text-[#B8982F]">A report no single model could produce — faster than any manual process.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection pricing={pricing} />

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
              "Running Your First Listing Pricing Analysis",
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
            <a href="/app/Territories" className="inline-flex items-center gap-2 bg-[#B8982F] text-[#1A3226] font-bold px-7 py-3.5 rounded-xl hover:bg-[#B8982F]/90 transition-colors">
              Start Your Territory <ArrowRight className="w-4 h-4" />
            </a>
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
          {founder && <p className="text-sm text-[#1A3226]/60 mt-3">PropPrompt is built on {founder.years_experience} years of real estate experience. Here's what agents in the field are saying.</p>}
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

      {/* Founder Section */}
      {founder && (
        <section className="bg-[#1A3226] text-white py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-14" style={{ fontFamily: "Georgia, serif" }}>
              Built From Inside the Industry
            </h2>
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Photo & Credentials */}
              <div className="flex flex-col items-center">
                {founder.headshot_url ? (
                  <img src={founder.headshot_url} alt={founder.founder_name} className="w-64 h-64 rounded-2xl object-cover mb-6" />
                ) : (
                  <div className="w-64 h-64 rounded-2xl bg-[#2D5A40] border-2 border-[#B8982F]/40 mb-6 flex items-center justify-center">
                    <p className="text-sm text-white/40 text-center px-4">TODO: Replace with professional headshot</p>
                  </div>
                )}
                <h3 className="text-2xl font-bold text-center">{founder.founder_name}</h3>
                <p className="text-sm text-white/70 text-center mt-1">{founder.credentials_line}</p>
                <p className="text-sm text-white/70 text-center">{founder.years_experience} Years Experience</p>
                {founder.detail_1 && <p className="text-sm text-[#B8982F] text-center mt-2 font-semibold">{founder.detail_1}</p>}
                {founder.detail_2 && <p className="text-sm text-[#B8982F] text-center">{founder.detail_2}</p>}
              </div>

              {/* Right: Statement */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-4">"I built the tool I wished I had."</h3>
                  <div className="text-white/80 leading-relaxed space-y-4 text-sm">
                    {founder.founder_statement && (
                      <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{founder.founder_statement}</p>
                    )}
                    {!founder.founder_statement && (
                      <p>For [YEARS_EXPERIENCE] years I've sat across from sellers trying to explain market data that took me hours to pull together. PropPrompt is what I built to solve that — a practitioner's tool for agents who want to compete on intelligence.</p>
                    )}
                  </div>
                  <p className="text-white/70 text-sm mt-6 italic">— {founder.founder_name}, Broker / Founder</p>
                </div>

                {/* Credential chips */}
                <div className="flex flex-wrap gap-3 pt-6">
                  <div className="bg-[#B8982F]/15 border border-[#B8982F]/40 rounded-full px-4 py-2 text-xs font-semibold text-[#B8982F]">
                    {founder.years_experience}+ Years Licensed
                  </div>
                  {founder.detail_1 && (
                    <div className="bg-[#B8982F]/15 border border-[#B8982F]/40 rounded-full px-4 py-2 text-xs font-semibold text-[#B8982F]">
                      {founder.detail_1}
                    </div>
                  )}
                  {founder.detail_2 && (
                    <div className="bg-[#B8982F]/15 border border-[#B8982F]/40 rounded-full px-4 py-2 text-xs font-semibold text-[#B8982F]">
                      {founder.detail_2}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

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
            <a href="/app/Territories" className="inline-flex items-center gap-2 bg-[#B8982F] text-[#1A3226] font-bold px-8 py-3.5 rounded-xl hover:bg-[#B8982F]/90 transition-colors">
              Check Territory Availability <ArrowRight className="w-4 h-4" />
            </a>
            <button onClick={() => base44.auth.redirectToLogin(window.location.origin + '/Dashboard')} className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-8 py-3.5 rounded-xl hover:border-white/50 transition-colors">
              Sign In
            </button>
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
            <p className="text-xs text-white/40 leading-relaxed">
              {founder ? `Founded by ${founder.founder_name}, Licensed Real Estate Broker — ${founder.licensed_states?.join(' · ') || 'MA, NH, ME, VT'}` : 'by Sherwood & Company'}
            </p>
          </div>
            <div>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Product</p>
              <div className="space-y-2">
                {[['Territory Map', '/app/Territories'], ['Pricing', '#pricing'], ['Training', '/app/Dashboard'], ['Sign In', '/app/Dashboard']].map(([l, h]) => (
                  <div key={l}><a href={h} className="text-xs text-white/50 hover:text-white transition-colors">{l}</a></div>
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