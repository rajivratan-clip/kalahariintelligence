import React, { useState, useEffect } from 'react';
import { Loader2, Database, Sparkles, TrendingUp } from 'lucide-react';

interface AnimatedReasoningProps {
  steps: string[]; // Array of reasoning steps
  currentStep?: number; // Current step index (optional, auto-advances)
  onComplete?: () => void;
}

const REASONING_ICONS = {
  scanning: Database,
  analyzing: Sparkles,
  mapping: TrendingUp,
  default: Loader2,
};

const AnimatedReasoning: React.FC<AnimatedReasoningProps> = ({
  steps,
  currentStep: controlledStep,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (controlledStep !== undefined) {
      setCurrentStep(controlledStep);
      if (controlledStep >= steps.length - 1 && onComplete) {
        setTimeout(onComplete, 500);
      }
      return;
    }

    // Auto-advance steps
    if (currentStep < steps.length - 1) {
      const timeout = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, 1500); // 1.5 seconds per step

      return () => clearTimeout(timeout);
    } else if (onComplete) {
      setTimeout(onComplete, 500);
    }
  }, [currentStep, steps.length, controlledStep, onComplete]);

  const getIcon = (step: string) => {
    const lower = step.toLowerCase();
    if (lower.includes('scan')) return REASONING_ICONS.scanning;
    if (lower.includes('analyz')) return REASONING_ICONS.analyzing;
    if (lower.includes('map')) return REASONING_ICONS.mapping;
    return REASONING_ICONS.default;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <div className="space-y-3">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isComplete = index < currentStep;
          const Icon = getIcon(step);

          return (
            <div
              key={index}
              className={`flex items-center gap-3 transition-all ${
                isActive ? 'opacity-100' : isComplete ? 'opacity-60' : 'opacity-40'
              }`}
            >
              <div className="flex-shrink-0">
                {isActive ? (
                  <Icon
                    size={18}
                    className="text-purple-600 animate-spin"
                  />
                ) : isComplete ? (
                  <div className="w-[18px] h-[18px] rounded-full bg-green-500 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                ) : (
                  <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300" />
                )}
              </div>
              <span
                className={`text-sm ${
                  isActive
                    ? 'text-slate-900 font-medium'
                    : isComplete
                    ? 'text-slate-600'
                    : 'text-slate-400'
                }`}
              >
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnimatedReasoning;
