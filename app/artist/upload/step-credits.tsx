'use client';

import type { WizardState } from './types';

interface StepStubProps {
  state: WizardState;
  setState?: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext?: () => void;
  onBack?: () => void;
  artistId?: string;
}

export function StepCredits(_props: StepStubProps) {
  return <p className="text-white/60 italic">TODO — step stub</p>;
}
