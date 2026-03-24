import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

function getStepLabels(assessmentType) {
  const base = ["Assessment", "Client Role", "Property"];
  const afterProperty = [];
  
  // Add context step based on assessment type
  if (assessmentType === "client_portfolio") {
    afterProperty.push("Financial Context");
  } else if (["listing_pricing", "buyer_intelligence"].includes(assessmentType)) {
    afterProperty.push("Buyer Context");
  }
  
  return [...base, ...afterProperty, "Output", "Confirm"];
}

function getMaxStep(assessmentType) {
  const labels = getStepLabels(assessmentType);
  return labels.length;
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

export default function NewAnalysis() {
  const { user, isLoadingAuth } = useAuth();
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState(INITIAL_INTAKE);
  const [orgMembers, setOrgMembers] = useState([]);
  const [userTier, setUserTier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!user) return;
      if (user.role === "assistant" || user.role === "team_lead") {
        const members = await base44.entities.User.list();
        setOrgMembers(members.filter((m) => m.email !== user.email && ["agent", "team_agent"].includes(m.role)));
      }
      // Resolve subscription tier
      try {
        const subs = await base44.entities.TerritorySubscription.filter({ user_id: user.id, status: 'active' });
        if (subs.length > 0) {
          const tiers = subs.map(s => s.tier);
          const tier = tiers.includes('team') ? 'team' : tiers.includes('pro') ? 'pro' : 'starter';
          setUserTier(tier);
        } else {
          setUserTier(user.role === 'platform_owner' ? 'team' : 'starter');
        }
      } catch (e) {
        setUserTier('starter');
      }
    }
    load();
  }, [user]);

  function update(fields) {
    setIntake((prev) => ({ ...prev, ...fields }));
  }

  function next() {
    const maxStep = getMaxStep(intake.assessment_type);
    setStep((s) => Math.min(s + 1, maxStep));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
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
        intake_data: {
          address: intake.address,
          client_relationship: intake.client_relationship,
          drive_sync: intake.drive_sync,
          ...(intake.assessment_type === "client_portfolio" && {
            mortgage_balance: intake.mortgage_balance,
            mortgage_source: intake.mortgage_source,
            mortgage_rate: intake.mortgage_rate,
            known_improvements: intake.known_improvements,
            heloc_info: intake.heloc_info,
            client_interests: intake.client_interests,
          }),
          ...(intake.assessment_type === "listing_pricing" || intake.assessment_type === "buyer_intelligence") && {
            buyer_pool_expectation: intake.buyer_pool_expectation,
            known_employer_draws: intake.known_employer_draws,
            key_selling_attributes: intake.key_selling_attributes,
          },
        },
        drive_sync_status: intake.drive_sync ? "pending" : "not_synced",
      };
      if (intake.on_behalf_of_email) analysisData.on_behalf_of_email = intake.on_behalf_of_email;
      if (user.org_id) analysisData.org_id = user.org_id;
      if (intake.ai_model) analysisData.ai_model = intake.ai_model;
      const analysis = await base44.entities.Analysis.create(analysisData);
      navigate(`/AnalysisRun?id=${analysis.id}`);
    } catch (err) {
      console.error("Failed to create analysis:", err);
      const msg = err?.response?.data?.message || err?.message || 'Unable to create analysis. Please check your connection and try again.';
      alert(msg);
      setSubmitting(false);
    }
  }

  const stepProps = { intake, update, user, userTier, onNext: next, onBack: back };
  const maxStep = getMaxStep(intake.assessment_type);
  const stepLabels = getStepLabels(intake.assessment_type);
  const hasContextStep = intake.assessment_type === "client_portfolio" || 
                         ["listing_pricing", "buyer_intelligence"].includes(intake.assessment_type);

  // Map step number to component based on assessment type
  function getStepComponent() {
    if (step === 1) return <Step2Assessment {...stepProps} />;
    if (step === 2) return <Step3ClientRelationship {...stepProps} />;
    if (step === 3) return <Step4PropertyDetails {...stepProps} />;
    
    if (hasContextStep && step === 4) {
      if (intake.assessment_type === "client_portfolio") {
        return <StepClientFinancial {...stepProps} />;
      } else if (["listing_pricing", "buyer_intelligence"].includes(intake.assessment_type)) {
        return <StepBuyerIntelligence {...stepProps} />;
      }
    }
    
    // Output step
    const outputStep = hasContextStep ? 5 : 4;
    const confirmStep = hasContextStep ? 6 : 5;
    
    if (step === outputStep) return <Step5OutputFormat {...stepProps} />;
    if (step === confirmStep) {
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