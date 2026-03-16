import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import WizardProgress from "../components/wizard/WizardProgress";
import StepAIPlatform from "../components/wizard/StepAIPlatform";
import StepAssessmentType from "../components/wizard/StepAssessmentType";
import StepClientRelationship from "../components/wizard/StepClientRelationship";
import StepPropertyDetails from "../components/wizard/StepPropertyDetails";
import StepOutputFormat from "../components/wizard/StepOutputFormat";
import StepConfirmLaunch from "../components/wizard/StepConfirmLaunch";

const TOTAL_STEPS = 6;

const INITIAL_FORM = {
  ai_platform: "claude",
  assessment_type: "",
  client_relationship: "",
  address: "",
  property_type: "",
  location_class: "",
  output_format: "narrative",
  preparing_agent_email: "",
};

export default function NewAnalysis() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_FORM);
  const [user, setUser] = useState(null);
  const [orgMembers, setOrgMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      setUser(me);
      if (me.role === "assistant" || me.role === "team_lead" || me.role === "brokerage_admin") {
        const members = await base44.entities.User.list();
        setOrgMembers(members.filter((m) => m.email !== me.email && ["agent", "team_agent", "team_lead"].includes(m.role)));
      }
    }
    load();
  }, []);

  const update = (fields) => setForm((prev) => ({ ...prev, ...fields }));

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const canProceed = () => {
    switch (step) {
      case 1: return !!form.ai_platform;
      case 2: return !!form.assessment_type;
      case 3: return !!form.client_relationship;
      case 4: return !!form.address && !!form.property_type && !!form.location_class;
      case 5: return !!form.output_format;
      case 6: return true;
      default: return false;
    }
  };

  const handleLaunch = async () => {
    setSubmitting(true);
    const onBehalfOf = form.preparing_agent_email || null;
    await base44.entities.Analysis.create({
      org_id: user?.org_name || "default",
      run_by_email: user?.email,
      on_behalf_of_email: onBehalfOf,
      assessment_type: form.assessment_type,
      property_type: form.property_type,
      location_class: form.location_class,
      ai_platform: form.ai_platform,
      output_format: form.output_format,
      status: "draft",
      intake_data: {
        address: form.address,
        client_relationship: form.client_relationship,
      },
    });
    setSubmitting(false);
    navigate("/Analyses");
  };

  const stepProps = { form, update, user, next, back, canProceed };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">New Analysis</p>
        <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          PropPrompt™ Intake Wizard
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-1">Complete all steps to assemble and launch your AI analysis.</p>
      </div>

      <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} form={form} />

      <div className="rounded-2xl border border-[#1A3226]/10 bg-white shadow-sm overflow-hidden">
        {step === 1 && <StepAIPlatform {...stepProps} />}
        {step === 2 && <StepAssessmentType {...stepProps} />}
        {step === 3 && <StepClientRelationship {...stepProps} />}
        {step === 4 && <StepPropertyDetails {...stepProps} />}
        {step === 5 && <StepOutputFormat {...stepProps} />}
        {step === 6 && (
          <StepConfirmLaunch
            {...stepProps}
            orgMembers={orgMembers}
            submitting={submitting}
            onLaunch={handleLaunch}
          />
        )}
      </div>
    </div>
  );
}