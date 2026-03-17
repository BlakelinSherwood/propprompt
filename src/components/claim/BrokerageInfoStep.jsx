import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function BrokerageInfoStep({ data, onChange, onNext, onBack, tier }) {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!data.brokerage_name?.trim()) e.brokerage_name = 'Required';
    if (!data.brokerage_license?.trim()) e.brokerage_license = 'Required';
    if (!data.agent_count || data.agent_count < 1) e.agent_count = 'Required';
    if (tier === 'team' && parseInt(data.agent_count) < 2) e.agent_count = 'Team tier requires at least 2 agents';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => { if (validate()) onNext(); };

  const Field = ({ id, label, type = 'text', placeholder }) => (
    <div>
      <Label htmlFor={id} className="text-sm font-medium text-[#1A3226]">{label}</Label>
      <Input
        id={id} type={type} placeholder={placeholder}
        value={data[id] || ''}
        onChange={e => onChange({ ...data, [id]: e.target.value })}
        className={`mt-1 ${errors[id] ? 'border-red-400' : ''}`}
      />
      {errors[id] && <p className="text-xs text-red-500 mt-1">{errors[id]}</p>}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[#1A3226]">Brokerage Information</h2>
        <p className="text-sm text-gray-500 mt-1">Tell us about your brokerage. This is used to verify your claim.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="brokerage_name" label="Brokerage Name" placeholder="Sherwood & Company" />
        <Field id="brokerage_license" label="Real Estate License #" placeholder="9512345" />
        <Field id="agent_count" label="Number of Agents in Office" type="number" placeholder="5" />
      </div>
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>← Back</Button>
        <Button onClick={handleNext} className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">Continue →</Button>
      </div>
    </div>
  );
}