import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { selectAIModel } from "@/lib/aiModelSelector";
import WizardProgress from "../components/wizard/WizardProgress";
import Step1Platform from "../components/wizard/Step1Platform";
import Step2Assessment from "../components/wizard/Step2Assessment";
import Step3ClientRelationship from "../components/wizard/Step3ClientRelationship";
import Step4PropertyDetails from "../components/wizard/Step4PropertyDetails";
import Step5OutputFormat from "../components/wizard/Step5OutputFormat";
import Step6Confirm from "../components/wizard/Step6Confirm";

const STEP_LABELS = [
  "AI Platform",
  "Assessment",
  "Client Role",
  "Property",
  "Output",
  "Confirm",
];

const INITIAL_INTAKE = {
  ai_platform: "",
  assessment_type: "",
  client_relationship: "",
  address: "",
  property_type: "",
  location_class: "",
  output_format: "narrative",
  on_behalf_of_email: "",
  drive_sync: true,
  selected_modules: [],
};

export default function NewAnalysis() {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [intake, setIntake] = useState(INITIAL_INTAKE);
  const [orgMembers, setOrgMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!user) return;
      if (user.role === "assistant" || user.role === "team_lead") {
        const members = await base44.entities.User.list();
        setOrgMembers(members.filter((m) => m.email !== user.email && ["agent", "team_agent"].includes(m.role)));
      }
    }
    load();
  }, [user]);

  function update(fields) {
    setIntake((prev) => ({ ...prev, ...fields }));
  }

  function next() {
    setStep((s) => Math.min(s + 1, 6));
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
      if (!intake.ai_platform) {
        alert("Please select an AI platform.");
        setSubmitting(false);
        return;
      }
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
      const analysis = await base44.entities.Analysis.create({
        run_by_email: user.email,
        on_behalf_of_email: intake.on_behalf_of_email || null,
        org_id: user.org_id || null,
        assessment_type: intake.assessment_type,
        property_type: intake.property_type,
        location_class: intake.location_class,
        ai_platform: intake.ai_platform,
        ai_model: intake.ai_model || null,
        output_format: intake.output_format,
        status: "draft",
        intake_data: {
          address: intake.address,
          client_relationship: intake.client_relationship,
          drive_sync: intake.drive_sync,
        },
        drive_sync_status: intake.drive_sync ? "pending" : "not_synced",
      });
      navigate(`/AnalysisRun?id=${analysis.id}`);
    } catch (err) {
      console.error("Failed to create analysis:", err);
      alert("Failed to create analysis. Please try again.");
      setSubmitting(false);
    }
  }

  const stepProps = { intake, update, user, onNext: next, onBack: back };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">New Analysis</p>
        <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          PropPrompt™ Intake Wizard
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-1">
          Complete all 6 steps to generate your AI-calibrated analysis.
        </p>
      </div>

      <WizardProgress currentStep={step} labels={STEP_LABELS} />

      <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden shadow-sm">
        {step === 1 && <Step1Platform {...stepProps} />}
        {step === 2 && <Step2Assessment {...stepProps} />}
        {step === 3 && <Step3ClientRelationship {...stepProps} />}
        {step === 4 && <Step4PropertyDetails {...stepProps} />}
        {step === 5 && <Step5OutputFormat {...stepProps} />}
        {step === 6 && (
          <Step6Confirm
            {...stepProps}
            orgMembers={orgMembers}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}