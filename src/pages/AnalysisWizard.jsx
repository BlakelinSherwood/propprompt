import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { selectAIModel } from "@/lib/aiModelSelector";
import WizardProgress from "../components/wizard/WizardProgress";
import Step2Assessment from "../components/wizard/Step2Assessment";
import Step3ClientRelationship from "../components/wizard/Step3ClientRelationship";
import Step4PropertyDetails from "../components/wizard/Step4PropertyDetails";
import Step5OutputFormat from "../components/wizard/Step5OutputFormat";
import Step6Confirm from "../components/wizard/Step6Confirm";
import StepClientFinancial from "../components/wizard/StepClientFinancial";
import StepBuyerIntelligence from "../components/wizard/StepBuyerIntelligence";
import StepReportEnhancements from "../components/wizard/StepReportEnhancements";
import StepPublicRecords from "../components/wizard/StepPublicRecords";
import StepComparableSales from "../components/wizard/StepComparableSales";
import StepPropertyPhotos from "../components/wizard/StepPropertyPhotos";

function getStepLabels(assessmentType) {
  const base = ["Assessment", "Client Role", "Property", "Public Records", "Comparables", "Photos"];
  const afterProperty = [];
  if (assessmentType === "listing_pricing") afterProperty.push("Buyer Context");
  else if (assessmentType === "client_portfolio") afterProperty.push("Financial Context");
  else if (["buyer_intelligence"].includes(assessmentType)) afterProperty.push("Buyer Context");
  else if (["cma", "investment_analysis"].includes(assessmentType)) afterProperty.push("Enhancements");
  return [...base, ...afterProperty, "Output", "Confirm"];
}

function getMaxStep(assessmentType) {
  const labels = getStepLabels(assessmentType);
  return labels.length;
}

const STORAGE_KEY = "wizard_draft";
function loadDraft() {
  try { const r = sessionStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveDraft(step, intake) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, intake })); } catch {}
}
function clearDraft() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}

const INITIAL_INTAKE = {
  ai_platform: "claude",
  assessment_type: "",
  client_relationship: "",
  address: "",
  property_type: "",
  location_class: "",
  output_format: "narrative",
  on_behalf_of_email: "",
  drive_sync: true,
  selected_modules: [],
  contact_id: null,
  // Comparable sales
  agent_comps: [],
  comps_source: "none",
  // Prior sale history
  prior_sale_price: null,
  prior_sale_year: null,
  // Financial context (portfolio)
  mortgage_balance: null,
  mortgage_source: "approximate",
  mortgage_rate: null,
  known_improvements: "",
  heloc_info: "",
  client_interests: [],
  // Buyer intelligence (listing pricing, buyer intelligence)
  buyer_pool_expectation: [],
  known_employer_draws: "",
  key_selling_attributes: [],
};

export default function AnalysisWizard() {
  const { user, isLoadingAuth } = useAuth();
  const [searchParams] = useSearchParams();
  const _draft = loadDraft();
  const [step, setStep] = useState(_draft?.step || 1);
  const [intake, setIntake] = useState(_draft?.intake || INITIAL_INTAKE);
  const [orgMembers, setOrgMembers] = useState([]);
  const [userTier, setUserTier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!user) return;
      
      // Load contact if contactId in URL params
      const contactId = searchParams.get("contactId");
      if (contactId) {
        try {
          const contacts = await base44.entities.Contact.filter({ id: contactId });
          if (contacts.length > 0) {
            const contact = contacts[0];
            let address = contact.property_address || "";
            if (contact.property_city) address += ` ${contact.property_city}`;
            if (contact.property_state) address += `, ${contact.property_state}`;
            if (contact.property_zip) address += ` ${contact.property_zip}`;
            update({ address: address.trim(), contact_id: contactId });
          }
        } catch (e) {
          console.error("Failed to load contact:", e);
        }
      }
      
      if (user.role === "assistant" || user.role === "team_lead") {
        const members = await base44.entities.User.list();
        setOrgMembers(members.filter((m) => m.email !== user.email && ["agent", "team_agent"].includes(m.role)));
      }
      // Resolve subscription tier
      try {
        const subs = await base44.entities.TerritorySubscription.filter({ user_id: user.id, status: 'active' });
        let resolvedTier = 'starter';
        if (subs.length > 0) {
          const tiers = subs.map(s => s.tier);
          resolvedTier = tiers.includes('team') ? 'team' : tiers.includes('pro') ? 'pro' : 'starter';
        } else if (['platform_owner', 'admin', 'team_lead', 'brokerage_admin', 'team_admin', 'team_agent'].includes(user.role)) {
          resolvedTier = 'team';
        }
        setUserTier(resolvedTier);
        // Always store 'claude' — tier-based routing in generateAnalysis handles ensemble automatically
        update({ ai_platform: 'claude' });
      } catch (e) {
        setUserTier('starter');
        update({ ai_platform: 'claude' });
      }
    }
    load();
  }, [user, searchParams]);

  function update(fields) {
    setIntake((prev) => {
      const next = { ...prev, ...fields };
      saveDraft(step, next);
      return next;
    });
  }

  function next() {
    const maxStep = getMaxStep(intake.assessment_type);
    const nextStep = Math.min(step + 1, maxStep);
    setStep(nextStep);
    saveDraft(nextStep, intake);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    const prevStep = Math.max(step - 1, 1);
    setStep(prevStep);
    saveDraft(prevStep, intake);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Validate required fields
      if (!intake.assessment_type) {
        alert("Please select an assessment type.");
        setSubmitting(false);
        return;
      }
      if (!intake.client_relationship) {
        alert("Please select a client role.");
        setSubmitting(false);
        return;
      }
      if (!intake.address) {
        alert("Please enter the property address.");
        setSubmitting(false);
        return;
      }
      if (!intake.property_type) {
        alert("Please select a property type.");
        setSubmitting(false);
        return;
      }
      if (!intake.location_class) {
        alert("Please select a location class.");
        setSubmitting(false);
        return;
      }
      if (!intake.output_format) {
        alert("Please select an output format.");
        setSubmitting(false);
        return;
      }

      // Check quota (skip if network fails — backend will validate)
      try {
        const quotaRes = await base44.functions.invoke("checkAnalysisQuota", {});
        if (!quotaRes.data?.allowed) {
          alert("You've reached your monthly analysis limit. Please upgrade or purchase a top-up pack.");
          setSubmitting(false);
          return;
        }
      } catch (quotaErr) {
        console.warn("Quota check failed, proceeding anyway:", quotaErr);
      }
      const analysisData = {
       run_by_email: user.email,
       assessment_type: intake.assessment_type,
       property_type: intake.property_type,
       location_class: intake.location_class,
       ai_platform: intake.ai_platform,
       output_format: intake.output_format,
       status: "draft",
       ...(intake.contact_id && { contact_id: intake.contact_id }),
       intake_data: {
         address: intake.address,
         client_relationship: intake.client_relationship,
         drive_sync: intake.drive_sync,
         bedrooms: intake.bedrooms ?? null,
         bathrooms: intake.bathrooms ?? null,
         sqft: intake.sqft ?? null,
         year_built: intake.year_built ?? null,
         ...(intake.assessment_type === "client_portfolio" && {
           mortgage_balance: intake.mortgage_balance,
           mortgage_source: intake.mortgage_source,
           mortgage_rate: intake.mortgage_rate,
           known_improvements: intake.known_improvements,
           heloc_info: intake.heloc_info,
           client_interests: intake.client_interests,
         }),
         ...((["listing_pricing", "buyer_intelligence"].includes(intake.assessment_type)) && {
           buyer_pool_expectation: intake.buyer_pool_expectation,
           known_employer_draws: intake.known_employer_draws,
           key_selling_attributes: intake.key_selling_attributes,
         }),
       },
        agent_comps: intake.agent_comps || [],
        comps_source: intake.comps_source || "none",
        raw_batchdata_comps: intake.raw_batchdata_comps || [],
        raw_perplexity_enrichment: intake.raw_perplexity_enrichment || [],
        comps_fetched_at: intake.comps_fetched_at ?? null,
        comps_search_tier: intake.comps_search_tier ?? null,
        comps_search_radius: intake.comps_search_radius ?? null,
        comps_fetch_triggered: intake.comps_fetch_triggered ?? false,
        comps_cache_key: intake.comps_cache_key ?? null,
        comps_researcher_note: intake.comps_researcher_note ?? null,
        large_property_flag: intake.large_property_flag ?? false,
        prior_sale_price: intake.prior_sale_price ?? null,
        prior_sale_year: intake.prior_sale_year ?? null,
        listing_photos: intake.listing_photos || [],
        condition_override: intake.condition_override || null,
        seller_mortgage_payoff: intake.seller_mortgage_payoff ?? null,
        seller_mortgage_known: intake.seller_mortgage_known ?? false,
        seller_commission_rate: intake.seller_commission_rate ?? null,
        seller_closing_cost_rate: intake.seller_closing_cost_rate ?? null,
        seller_other_costs: intake.seller_other_costs ?? null,
        drive_sync_status: intake.drive_sync ? "pending" : "not_synced",
        include_migration: intake.include_migration || false,
        include_archetypes: intake.include_archetypes || false,
      };
      if (intake.on_behalf_of_email) analysisData.on_behalf_of_email = intake.on_behalf_of_email;
      if (user.org_id) analysisData.org_id = user.org_id;
      if (intake.ai_model) analysisData.ai_model = intake.ai_model;
      const analysis = await base44.entities.Analysis.create(analysisData);
      clearDraft();
      navigate(`/AnalysisRun?id=${analysis.id}`);
    } catch (err) {
      console.error("Failed to create analysis:", err);
      const msg = err?.response?.data?.message || err?.message || 'Unable to create analysis. Please check your connection and try again.';
      alert(msg);
      setSubmitting(false);
    }
  }

  const isPlatformOwner = user?.role === 'platform_owner' || user?.role === 'admin';
  const stepProps = { intake, update, user, userTier, isPlatformOwner, onNext: next, onBack: back };
  const maxStep = getMaxStep(intake.assessment_type);
  const stepLabels = getStepLabels(intake.assessment_type);
  const hasFinancialStep = intake.assessment_type === "client_portfolio";
  const hasBuyerStep = ["listing_pricing", "buyer_intelligence"].includes(intake.assessment_type);
  const hasEnhancementStep = ["cma", "investment_analysis"].includes(intake.assessment_type);
  const hasContextStep = hasFinancialStep || hasBuyerStep || hasEnhancementStep;

  // Map step number to component based on assessment type
  function getStepComponent() {
    if (step === 1) return <Step2Assessment {...stepProps} />;
    if (step === 2) return <Step3ClientRelationship {...stepProps} />;
    if (step === 3) return <Step4PropertyDetails {...stepProps} />;
    if (step === 4) return <StepPublicRecords {...stepProps} />;
    if (step === 5) return <StepComparableSales {...stepProps} />;
    if (step === 6) return <StepPropertyPhotos {...stepProps} />;

    let nextStep = 7;

    if (hasContextStep) {
      if (step === nextStep) {
        if (hasFinancialStep) return <StepClientFinancial {...stepProps} />;
        if (hasBuyerStep) return <StepBuyerIntelligence {...stepProps} />;
        if (hasEnhancementStep) return <StepReportEnhancements {...stepProps} />;
      }
      nextStep++;
    }


    if (step === nextStep) return <Step5OutputFormat {...stepProps} />;
    nextStep++;
    if (step === nextStep) {

      return (
        <Step6Confirm
          {...stepProps}
          orgMembers={orgMembers}
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      );
    }

    return null;
  }

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">New Analysis</p>
        <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          PropPrompt™ Intake Wizard
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-1">
          Complete all 5 steps to generate your AI-calibrated analysis.
        </p>
      </div>

      <WizardProgress currentStep={step} labels={stepLabels} />

      <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden shadow-sm">
        {getStepComponent()}
      </div>
    </div>
  );
}