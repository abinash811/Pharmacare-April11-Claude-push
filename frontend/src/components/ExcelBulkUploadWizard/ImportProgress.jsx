import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { AppButton } from '@/components/shared';

export default function ImportProgress({ progress, status, onComplete }) {
  const percentage = progress?.total > 0
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {status === 'importing' && (
        <div className="text-center py-8">
          <Loader2 className="w-16 h-16 text-brand animate-spin mx-auto" />
          <p className="mt-4 text-lg font-medium text-gray-700">Importing inventory...</p>
          <p className="text-sm text-gray-500 mt-2">Please don't close this window</p>
        </div>
      )}

      {status === 'completed' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <p className="mt-4 text-lg font-medium text-green-700">Import Complete!</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="bg-gray-100 rounded-full h-4 overflow-hidden">
        <div className="bg-brand h-full transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-700">{progress?.processed || 0}</p>
          <p className="text-sm text-gray-500">Processed</p>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-700">{progress?.success || 0}</p>
          <p className="text-sm text-green-600">Successful</p>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <p className="text-2xl font-bold text-red-700">{progress?.failed || 0}</p>
          <p className="text-sm text-red-600">Failed</p>
        </div>
      </div>

      {/* Error Details */}
      {progress?.errors?.length > 0 && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50">
          <p className="font-medium text-red-800 mb-2">Import Errors:</p>
          <ul className="text-sm text-red-700 space-y-1 max-h-32 overflow-y-auto">
            {progress.errors.map((err, idx) => (
              <li key={idx}>Row {err.row_number}: {err.error}</li>
            ))}
          </ul>
        </div>
      )}

      {status === 'completed' && (
        <div className="text-center">
          <AppButton onClick={onComplete} data-testid="finish-import-btn">
            Finish & Close
          </AppButton>
        </div>
      )}
    </div>
  );
}
