import React from 'react';
import { AlertCircle } from 'lucide-react';
import AppButton from './AppButton';

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  title?: string;
}

export default function ErrorState({ message, onRetry, title = 'Something went wrong' }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-500" strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-5 max-w-xs leading-relaxed">{message}</p>
      {onRetry && (
        <AppButton variant="outline" size="sm" onClick={onRetry}>
          Try again
        </AppButton>
      )}
    </div>
  );
}
