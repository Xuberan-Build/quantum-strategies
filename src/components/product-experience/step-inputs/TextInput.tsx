interface TextInputProps {
  step: any;
  multiTextValues: Record<string, string>;
  textValue: string;
  isSubmitting: boolean;
  textMinLength: number;
  textLength: number;
  onMultiTextChange: (fieldName: string, value: string) => void;
  onTextChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export function TextInput({
  step,
  multiTextValues,
  textValue,
  isSubmitting,
  textMinLength,
  textLength,
  onMultiTextChange,
  onTextChange,
  onKeyDown,
}: TextInputProps) {
  return (
    <div className="space-y-6">
      {step.text_inputs && step.text_inputs.map((field: any) => (
        <div key={field.field_name} className="space-y-2">
          <label className="text-sm text-gray-400">{field.label}</label>
          <input
            value={multiTextValues[field.field_name] || ''}
            onChange={(e) => onMultiTextChange(field.field_name, e.target.value)}
            placeholder={field.placeholder || 'Type your answer...'}
            className="w-full rounded-xl border border-gray-700/60 bg-gray-900/50 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
            disabled={isSubmitting}
          />
        </div>
      ))}

      {step.text_input && (
        <div className="space-y-2">
          <label className="text-sm text-gray-400">{step.text_input.label}</label>
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={step.text_input.placeholder || 'Type your answer here...'}
            className="w-full h-64 bg-gray-900/50 border border-gray-700/50 rounded-xl px-6 py-4 text-white text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-none"
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
