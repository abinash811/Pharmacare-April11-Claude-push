import React from 'react';
import { CheckCircle } from 'lucide-react';

export default function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
              index < currentStep  ? 'bg-green-500 text-white'
              : index === currentStep ? 'bg-brand text-white ring-4 ring-blue-200'
              : 'bg-gray-200 text-gray-500'
            }`}>
              {index < currentStep ? <CheckCircle className="w-5 h-5" strokeWidth={1.5} /> : index + 1}
            </div>
            <span className={`text-xs mt-2 font-medium ${index === currentStep ? 'text-brand' : 'text-gray-500'}`}>
              {step}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className={`w-16 h-1 mx-2 rounded ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
