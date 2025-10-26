'use client';

interface ValidationWarningProps {
  missingFields: string[];
}

export function ValidationWarning({ missingFields }: ValidationWarningProps) {
  if (missingFields.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-600/30 bg-yellow-900/20 p-3 mt-4">
      <div className="flex items-start gap-2">
        <span className="text-yellow-400 text-sm">⚠️</span>
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-yellow-300 font-medium mb-1">
            누락된 필수 항목이 있습니다
          </p>
          <ul className="list-disc list-inside text-xs text-yellow-400 space-y-0.5">
            {missingFields.map((field, index) => (
              <li key={index}>{field}</li>
            ))}
          </ul>
          <p className="text-xs text-yellow-500 mt-2">
            계속 진행할 수 있지만, 나중에 입력해야 합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
