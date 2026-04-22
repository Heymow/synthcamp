'use client';

import { useState } from 'react';
import { StepMetadata } from './step-metadata';
import { StepTracks } from './step-tracks';
import { StepCredits } from './step-credits';
import { StepPricingParty } from './step-pricing-party';
import { StepPublish } from './step-publish';
import { INITIAL_WIZARD_STATE, STEP_LABELS, type WizardState } from './types';

export function UploadWizard({ artistId }: { artistId: string }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_WIZARD_STATE);

  const steps = [
    <StepMetadata
      key="metadata"
      state={state}
      setState={setState}
      onNext={() => setStep(1)}
      artistId={artistId}
    />,
    <StepTracks
      key="tracks"
      state={state}
      setState={setState}
      onNext={() => setStep(2)}
      onBack={() => setStep(0)}
    />,
    <StepCredits
      key="credits"
      state={state}
      setState={setState}
      onNext={() => setStep(3)}
      onBack={() => setStep(1)}
    />,
    <StepPricingParty
      key="pricing"
      state={state}
      setState={setState}
      onNext={() => setStep(4)}
      onBack={() => setStep(2)}
    />,
    <StepPublish key="publish" state={state} onBack={() => setStep(3)} />,
  ];

  return (
    <main className="view-enter mx-auto max-w-lg space-y-6 px-6 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black italic uppercase leading-none tracking-tighter text-white">
          New Release
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">
          {step + 1} / {steps.length} · {STEP_LABELS[step]}
        </span>
      </div>
      {steps[step]}
    </main>
  );
}
