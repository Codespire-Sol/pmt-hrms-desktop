import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS, OnboardingStep } from '../types';

/**
 * Onboarding Flow Component
 *
 * Multi-step onboarding wizard that guides new users through
 * the key features of codeSpire solutions.
 */

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
  initialStep?: number;
}

export function OnboardingFlow({
  onComplete,
  onSkip,
  initialStep = 0,
}: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completed, setCompleted] = useState<string[]>([]);
  const [direction, setDirection] = useState(1);

  const steps = ONBOARDING_STEPS;
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setDirection(1);
      setCompleted((prev) => [...prev, step.id]);
      setCurrentStep((prev) => prev + 1);
    } else {
      setCompleted((prev) => [...prev, step.id]);
      onComplete();
    }
  }, [currentStep, step.id, steps.length, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'Escape') {
        onSkip();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious, onSkip]);

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="max-w-2xl w-full mx-4">
        {/* Card */}
        <div className="bg-card border rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Getting Started</span>
            </div>
            <button
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close onboarding"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-6 pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>
                Step {currentStep + 1} of {steps.length}
              </span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />

            {/* Step indicators */}
            <div className="flex justify-between mt-4">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setDirection(i > currentStep ? 1 : -1);
                    setCurrentStep(i);
                  }}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    i === currentStep
                      ? 'bg-primary text-primary-foreground scale-110'
                      : completed.includes(s.id)
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {completed.includes(s.id) ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    i + 1
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 min-h-[300px] relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              >
                <OnboardingStepContent step={step} />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={onSkip}>
                Skip for now
              </Button>
              <Button onClick={handleNext} className="gap-1">
                {currentStep === steps.length - 1 ? (
                  <>
                    Get Started
                    <Sparkles className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// STEP CONTENT COMPONENT
// ============================================

interface OnboardingStepContentProps {
  step: OnboardingStep;
}

function OnboardingStepContent({ step }: OnboardingStepContentProps) {
  return (
    <div className="text-center">
      {/* Illustration */}
      <div className="mb-6">
        <StepIllustration action={step.action} />
      </div>

      {/* Title & Description */}
      <h2 className="text-2xl font-bold mb-3">{step.title}</h2>
      <p className="text-muted-foreground text-lg mb-6 max-w-md mx-auto">
        {step.description}
      </p>

      {/* Tips */}
      {step.tips && step.tips.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 text-left max-w-md mx-auto">
          <h4 className="font-semibold text-sm mb-2 text-muted-foreground">
            Quick Tips
          </h4>
          <ul className="space-y-2">
            {step.tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================
// STEP ILLUSTRATIONS
// ============================================

function StepIllustration({ action }: { action?: string }) {
  const iconClass = 'w-24 h-24 text-primary mx-auto';

  switch (action) {
    case 'welcome':
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" opacity="0.2" />
            <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" opacity="0.4" />
            <circle cx="50" cy="50" r="25" fill="currentColor" opacity="0.1" />
            <path d="M50 25L55 45H75L59 57L64 77L50 65L36 77L41 57L25 45H45L50 25Z" fill="currentColor" />
          </svg>
        </div>
      );

    case 'create_project':
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="15" y="20" width="70" height="60" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M15 35H85" stroke="currentColor" strokeWidth="2" />
            <circle cx="25" cy="27.5" r="3" fill="currentColor" opacity="0.5" />
            <circle cx="35" cy="27.5" r="3" fill="currentColor" opacity="0.5" />
            <circle cx="45" cy="27.5" r="3" fill="currentColor" opacity="0.5" />
            <path d="M50 45V65M40 55H60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'invite_members':
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="35" cy="35" r="12" stroke="currentColor" strokeWidth="2" />
            <path d="M20 70C20 58 27 52 35 52C43 52 50 58 50 70" stroke="currentColor" strokeWidth="2" />
            <circle cx="65" cy="35" r="12" stroke="currentColor" strokeWidth="2" />
            <path d="M50 70C50 58 57 52 65 52C73 52 80 58 80 70" stroke="currentColor" strokeWidth="2" />
            <path d="M70 55L85 55M77.5 47.5V62.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'create_issue':
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="20" y="15" width="60" height="70" rx="4" stroke="currentColor" strokeWidth="2" />
            <path d="M30 30H70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M30 45H60" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <path d="M30 55H55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
            <path d="M30 65H50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
            <circle cx="72" cy="68" r="15" fill="currentColor" />
            <path d="M72 60V76M64 68H80" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'explore_board':
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="20" width="23" height="60" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect x="38" y="20" width="23" height="60" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect x="66" y="20" width="23" height="60" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect x="14" y="30" width="15" height="12" rx="1" fill="currentColor" opacity="0.3" />
            <rect x="14" y="46" width="15" height="12" rx="1" fill="currentColor" opacity="0.3" />
            <rect x="42" y="30" width="15" height="12" rx="1" fill="currentColor" opacity="0.5" />
            <rect x="70" y="30" width="15" height="12" rx="1" fill="currentColor" />
          </svg>
        </div>
      );

    case 'explore_ai':
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="2" />
            <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="2" opacity="0.5" />
            <circle cx="50" cy="50" r="15" fill="currentColor" opacity="0.2" />
            <path d="M50 20V35M50 65V80M80 50H65M35 50H20" stroke="currentColor" strokeWidth="2" />
            <circle cx="50" cy="50" r="5" fill="currentColor" />
            <path d="M35 35L42 42M58 58L65 65M65 35L58 42M42 58L35 65" stroke="currentColor" strokeWidth="2" opacity="0.5" />
          </svg>
        </div>
      );

    default:
      return (
        <div className={iconClass}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" />
            <path d="M50 30V55L65 70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      );
  }
}

export default OnboardingFlow;
