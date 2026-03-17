import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BrokerageInfoStep({ data, onChange, onNext, onBack, tier }) {
  const [errors, setErrors] = useState({});

  const set = (key, val) => onChange({ ...data, [key]: val });

  const validate = () => {
    const e = {};
    if (!data.brokerage_name?.trim()) e.brokerage_name = "Required";
    if (!data.brokerage_license?.trim()) e.brokerage_license = "Required";
    if (!data.agent_count || data.agent_count < 1) e.agent_count = "Required";
    if (tier === "team" && parseInt(data.agent_count) < 2) e.agent_count = "Team tier requires at least 2 agents";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) onNext(); };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#1A3226]">Brokerage Information</h2>
        <p className="text-sm text-[#1A3226]/60 mt-1">Tell us about your business so we can review your claim.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-sm font-medium text-[#1A3226]">Brokerage / Business Name</Label>
          <Input
            value={data.brokerage_name || ""}
            onChange={e => set("brokerage_name", e.target.value)}
            placeholder="e.g. Sherwood & Company"
            className="mt-1"
          />
          {errors.brokerage_name && <p className="text-xs text-red-500 mt-1">{errors.brokerage_name}</p>}
        </div>

        <div>
          <Label className="text-sm font-medium text-[#1A3226]">Real Estate License #</Label>
          <Input
            value={data.brokerage_license || ""}
            onChange={e => set("brokerage_license", e.target.value)}
            placeholder="e.g. RE12345"
            className="mt-1"
          />
          {errors.brokerage_license && <p className="text-xs text-red-500 mt-1">{errors.brokerage_license}</p>}
        </div>

        <div>
          <Label className="text-sm font-medium text-[#1A3226]">Number of Agents in Office</Label>
          <Input
            type="number"
            min={1}
            value={data.agent_count || ""}
            onChange={e => set("agent_count", e.target.value)}
            placeholder="e.g. 5"
            className="mt-1"
          />
          {errors.agent_count && <p className="text-xs text-red-500 mt-1">{errors.agent_count}</p>}
        </div>

        <div className="sm:col-span-2">
          <Label className="text-sm font-medium text-[#1A3226]">Additional Notes (optional)</Label>
          <textarea
            value={data.notes || ""}
            onChange={e => set("notes", e.target.value)}
            placeholder="Anything you'd like us to know about your territory needs…"
            rows={3}
            className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={handleNext} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
          Continue →
        </Button>
      </div>
    </div>
  );
}