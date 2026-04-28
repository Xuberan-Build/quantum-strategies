import { SliderAllocation } from '../SliderAllocation';

interface InteractiveInputProps {
  step: any;
  textValue: string;
  isSubmitting: boolean;
  textMinLength: number;
  textLength: number;
  onTextChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onDutyCycleChange: (values: Record<string, number>) => void;
}

export function InteractiveInput({
  step,
  textValue,
  isSubmitting,
  textMinLength,
  textLength,
  onTextChange,
  onKeyDown,
  onDutyCycleChange,
}: InteractiveInputProps) {
  return (
    <div className="space-y-6">
      {step.title === 'Duty Cycle Map' ? (
        <>
          <SliderAllocation
            categories={[
              {
                key: 'green',
                label: 'Green - Energizing',
                description: 'Activities that energize and restore you (exercise, creative flow, deep connection)',
                color: 'bg-green-500',
              },
              {
                key: 'yellow',
                label: 'Yellow - Neutral',
                description: 'Necessary activities that are neither draining nor energizing (emails, errands, admin)',
                color: 'bg-yellow-500',
              },
              {
                key: 'red',
                label: 'Red - Draining',
                description: 'Draining but necessary activities (difficult conversations, hard decisions)',
                color: 'bg-red-500',
              },
              {
                key: 'black',
                label: 'Black - Recovery',
                description: 'True rest and recovery time (sleep, stillness, unplugged time)',
                color: 'bg-gray-500',
              },
            ]}
            onChange={onDutyCycleChange}
            disabled={isSubmitting}
          />
          <div className="space-y-2 mt-6">
            <label className="text-sm text-gray-400">{step.text_input.label}</label>
            <textarea
              value={textValue}
              onChange={(e) => onTextChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={step.text_input.placeholder || 'Type your answer here...'}
              className="w-full h-32 bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 md:px-6 py-4 text-white text-base md:text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-none"
              disabled={isSubmitting}
            />
            {textMinLength > 0 && (
              <p className="text-xs text-gray-500">
                Minimum {textMinLength} characters · {textLength}/{textMinLength}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <label className="text-sm text-gray-400">{step.text_input.label}</label>
          <textarea
            value={textValue}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={step.text_input.placeholder || 'Type your answer here...'}
            className="w-full h-36 md:h-64 bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 md:px-6 py-4 text-white text-base md:text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-none"
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
