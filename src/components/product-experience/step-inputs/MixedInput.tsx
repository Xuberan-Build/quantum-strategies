interface MixedInputProps {
  step: any;
  structuredValue: string | string[];
  structuredOther: string;
  textValue: string;
  isSubmitting: boolean;
  textMinLength: number;
  textLength: number;
  onStructuredChange: (value: string | string[]) => void;
  onOtherChange: (value: string) => void;
  onTextChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function MixedInput({
  step,
  structuredValue,
  structuredOther,
  textValue,
  isSubmitting,
  textMinLength,
  textLength,
  onStructuredChange,
  onOtherChange,
  onTextChange,
  onKeyDown,
}: MixedInputProps) {
  const structured = step?.structured_options;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        {structured.options?.map((option: any) => {
          const isSelected = Array.isArray(structuredValue)
            ? structuredValue.includes(option.value)
            : structuredValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`text-left rounded-xl border px-4 py-3 transition ${
                isSelected
                  ? 'border-teal-400 bg-teal-500/10 text-white'
                  : 'border-gray-700/60 bg-gray-900/40 text-gray-200 hover:border-gray-500'
              }`}
              onClick={() => {
                if (structured.type === 'checkbox') {
                  const current = Array.isArray(structuredValue) ? structuredValue : [];
                  const next = current.includes(option.value)
                    ? current.filter((item) => item !== option.value)
                    : [...current, option.value];
                  onStructuredChange(next);
                } else {
                  onStructuredChange(option.value);
                }
              }}
            >
              <div className="font-semibold">{option.label}</div>
              {option.description && (
                <div className="text-sm text-gray-400">{option.description}</div>
              )}
            </button>
          );
        })}
      </div>

      {structured.allow_other && (
        <div className="space-y-2">
          <label className="text-sm text-gray-400">
            {structured.other_label || 'Other'}
          </label>
          <input
            value={structuredOther}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder="Type your response..."
            className="w-full rounded-xl border border-gray-700/60 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            disabled={isSubmitting}
          />
        </div>
      )}

      {step.text_input && (
        <div className="space-y-2">
          <label className="text-sm text-gray-400">{step.text_input.label}</label>
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={step.text_input.placeholder || 'Type your answer here...'}
            className="w-full h-48 bg-gray-900/50 border border-gray-700/50 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-none"
            disabled={isSubmitting}
          />
          {textMinLength > 0 && (
            <p className="text-xs text-gray-500">
              Minimum {textMinLength} characters · {textLength}/{textMinLength}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
