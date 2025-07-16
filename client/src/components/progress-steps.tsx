interface ProgressStepsProps {
  currentStep: number;
}

export function ProgressSteps({ currentStep }: ProgressStepsProps) {
  const steps = [
    { number: 1, title: "Input Source" },
    { number: 2, title: "App Configuration" },
    { number: 3, title: "Signing & Build" },
    { number: 4, title: "Download" },
  ];

  return (
    <div className="flex items-center justify-center">
      <div className="flex items-center space-x-4">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step.number <= currentStep 
                  ? 'bg-primary text-white' 
                  : 'bg-gray-300 text-gray-500'
              }`}>
                {step.number}
              </div>
              <span className={`ml-2 text-sm font-medium ${
                step.number <= currentStep 
                  ? 'text-primary' 
                  : 'text-gray-500'
              }`}>
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 ml-4 ${
                step.number < currentStep 
                  ? 'bg-primary' 
                  : 'bg-gray-300'
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
