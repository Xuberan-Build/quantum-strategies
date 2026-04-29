import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepView } from '../StepView';

// Mock ChatWindow component
vi.mock('../ChatWindow', () => ({
  ChatWindow: ({ title, onContinue, isSubmitting }: any) => (
    <div data-testid="chat-window">
      <h1>{title}</h1>
      <button onClick={onContinue} disabled={isSubmitting}>
        Continue
      </button>
    </div>
  ),
}));

describe('StepView', () => {
  const defaultProps = {
    step: {
      title: 'What is your goal?',
      question: 'Tell us about your business vision',
      subtitle: 'Be as specific as possible',
    },
    stepNumber: 1,
    totalSteps: 5,
    response: '',
    onResponseChange: vi.fn(),
    onSubmit: vi.fn(),
    onFileUpload: vi.fn(),
    uploadedFiles: [],
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render step header with number and title', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
      expect(screen.getByText('What is your goal?')).toBeInTheDocument();
    });

    it('should render subtitle when provided', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.getByText('Be as specific as possible')).toBeInTheDocument();
    });

    it('should render question text', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.getByText('Tell us about your business vision')).toBeInTheDocument();
    });

    it('should render textarea with placeholder', () => {
      render(<StepView {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Type your answer here...');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveFocus(); // autoFocus prop makes it focused
    });

    it('should show progress bar with correct percentage', () => {
      render(<StepView {...defaultProps} stepNumber={2} totalSteps={5} />);

      expect(screen.getByText('40%')).toBeInTheDocument();
    });

    it('should show ChatWindow for file upload steps without questions', () => {
      const props = {
        ...defaultProps,
        step: {
          title: 'Upload Your Chart',
          allow_file_upload: true,
          description: 'Upload your astrology chart',
        },
      };

      render(<StepView {...props} />);

      expect(screen.getByTestId('chat-window')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Type your answer here...')).not.toBeInTheDocument();
    });

    it('should show text input for steps with questions even if file upload allowed', () => {
      const props = {
        ...defaultProps,
        step: {
          title: 'Your Goals',
          question: 'What are your goals?',
          allow_file_upload: true,
        },
      };

      render(<StepView {...props} />);

      expect(screen.getByPlaceholderText('Type your answer here...')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-window')).not.toBeInTheDocument();
    });
  });

  describe('Assistant Reply', () => {
    it('should display assistant reply when provided', () => {
      const props = {
        ...defaultProps,
        assistantReply: 'Great! Let me help you with that.',
      };

      render(<StepView {...props} />);

      expect(screen.getByText('Wizard')).toBeInTheDocument();
      expect(screen.getByText('Great! Let me help you with that.')).toBeInTheDocument();
    });

    it('should show "Thinking..." overlay when submitting with assistant reply', () => {
      const props = {
        ...defaultProps,
        assistantReply: 'Previous reply',
        isSubmitting: true,
      };

      render(<StepView {...props} />);

      expect(screen.getByText('Thinking…')).toBeInTheDocument();
    });

    it('should not show assistant reply section when no reply', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.queryByText('Wizard')).not.toBeInTheDocument();
    });
  });

  describe('User Input', () => {
    it('should call onResponseChange when user types', async () => {
      const user = userEvent.setup();
      render(<StepView {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Type your answer here...');
      await user.type(textarea, 'Test');

      // Should be called for each character typed (plus once on mount from step-reset effect)
      expect(defaultProps.onResponseChange).toHaveBeenCalled();
      expect(defaultProps.onResponseChange).toHaveBeenCalledTimes(5);
    });

    it('should display current response value', () => {
      const props = {
        ...defaultProps,
        response: 'Current answer',
      };

      render(<StepView {...props} />);

      const textarea = screen.getByPlaceholderText('Type your answer here...');
      expect(textarea).toHaveValue('Current answer');
    });

    it('should disable textarea when submitting', () => {
      const props = {
        ...defaultProps,
        isSubmitting: true,
      };

      render(<StepView {...props} />);

      const textarea = screen.getByPlaceholderText('Type your answer here...');
      expect(textarea).toBeDisabled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should submit on Cmd+Enter', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        response: 'My answer',
      };

      render(<StepView {...props} />);

      const textarea = screen.getByPlaceholderText('Type your answer here...');
      await user.click(textarea);
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    it('should not submit on Enter without Cmd', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        response: 'My answer',
      };

      render(<StepView {...props} />);

      const textarea = screen.getByPlaceholderText('Type your answer here...');
      await user.click(textarea);
      await user.keyboard('{Enter}');

      expect(defaultProps.onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('File Upload', () => {
    it('should show file upload option when allowed', () => {
      const props = {
        ...defaultProps,
        step: {
          ...defaultProps.step,
          allow_file_upload: true,
          file_upload_prompt: 'Upload your chart (optional)',
        },
      };

      render(<StepView {...props} />);

      expect(screen.getByText('Upload your chart (optional)')).toBeInTheDocument();
      expect(screen.getByText('Attach files (optional)')).toBeInTheDocument();
    });

    it('should not show file upload when not allowed', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.queryByText('Attach files (optional)')).not.toBeInTheDocument();
    });

    it('should handle file selection', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        step: {
          ...defaultProps.step,
          allow_file_upload: true,
          file_upload_prompt: 'Upload files',
        },
      };

      render(<StepView {...props} />);

      const file = new File(['content'], 'chart.png', { type: 'image/png' });
      const input = screen.getByRole('button', { name: /attach files/i })
        .parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

      await user.upload(input, file);

      expect(defaultProps.onFileUpload).toHaveBeenCalledWith([file]);
    });

    it('should display uploaded files', () => {
      const props = {
        ...defaultProps,
        step: {
          ...defaultProps.step,
          allow_file_upload: true,
          file_upload_prompt: 'Upload files',
        },
        uploadedFiles: ['user-uploads/chart.png', 'user-uploads/birth-chart.pdf'],
      };

      render(<StepView {...props} />);

      expect(screen.getByText('chart.png')).toBeInTheDocument();
      expect(screen.getByText('birth-chart.pdf')).toBeInTheDocument();
    });

    it('should handle file removal', async () => {
      const user = userEvent.setup();
      const onRemoveFile = vi.fn();
      const props = {
        ...defaultProps,
        step: {
          ...defaultProps.step,
          allow_file_upload: true,
          file_upload_prompt: 'Upload files',
        },
        uploadedFiles: ['user-uploads/chart.png'],
        onRemoveFile,
      };

      render(<StepView {...props} />);

      const removeButton = screen.getByTitle('Remove file');
      await user.click(removeButton);

      expect(onRemoveFile).toHaveBeenCalledWith('user-uploads/chart.png');
    });

    it('should not show remove button when onRemoveFile not provided', () => {
      const props = {
        ...defaultProps,
        step: {
          ...defaultProps.step,
          allow_file_upload: true,
          file_upload_prompt: 'Upload files',
        },
        uploadedFiles: ['user-uploads/chart.png'],
      };

      render(<StepView {...props} />);

      expect(screen.queryByTitle('Remove file')).not.toBeInTheDocument();
    });
  });

  describe('Action Buttons', () => {
    it('should render Continue button by default', () => {
      const props = {
        ...defaultProps,
        response: 'My answer',
      };

      render(<StepView {...props} />);

      expect(screen.getByText('Continue →')).toBeInTheDocument();
    });

    it('should render Generate Blueprint button on last step', () => {
      const props = {
        ...defaultProps,
        stepNumber: 5,
        totalSteps: 5,
        response: 'Final answer',
      };

      render(<StepView {...props} />);

      expect(screen.getByText('Generate Your Blueprint →')).toBeInTheDocument();
    });

    it('should disable Continue button when response is empty', () => {
      render(<StepView {...defaultProps} response="" />);

      const button = screen.getByText('Continue →');
      expect(button).toBeDisabled();
    });

    it('should disable Continue button when response is only whitespace', () => {
      render(<StepView {...defaultProps} response="   " />);

      const button = screen.getByText('Continue →');
      expect(button).toBeDisabled();
    });

    it('should enable Continue button when response has content', () => {
      const props = {
        ...defaultProps,
        response: 'My answer',
      };

      render(<StepView {...props} />);

      const button = screen.getByText('Continue →');
      expect(button).not.toBeDisabled();
    });

    it('should show Processing state when submitting', () => {
      const props = {
        ...defaultProps,
        response: 'Answer',
        isSubmitting: true,
      };

      render(<StepView {...props} />);

      expect(screen.getByText('Processing...')).toBeInTheDocument();
      const button = screen.getByText('Processing...').closest('button');
      expect(button).toBeDisabled();
    });

    it('should call onSubmit when Continue clicked', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        response: 'My answer',
      };

      render(<StepView {...props} />);

      const button = screen.getByText('Continue →');
      await user.click(button);

      expect(defaultProps.onSubmit).toHaveBeenCalled();
    });

    it('should show Back button when onBack provided', () => {
      const onBack = vi.fn();
      const props = {
        ...defaultProps,
        onBack,
      };

      render(<StepView {...props} />);

      expect(screen.getByText('← Back')).toBeInTheDocument();
    });

    it('should not show Back button when onBack not provided', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.queryByText('← Back')).not.toBeInTheDocument();
    });

    it('should call onBack when Back button clicked', async () => {
      const user = userEvent.setup();
      const onBack = vi.fn();
      const props = {
        ...defaultProps,
        onBack,
      };

      render(<StepView {...props} />);

      const button = screen.getByText('← Back');
      await user.click(button);

      expect(onBack).toHaveBeenCalled();
    });

    it('should disable Back button when submitting', () => {
      const onBack = vi.fn();
      const props = {
        ...defaultProps,
        onBack,
        isSubmitting: true,
      };

      render(<StepView {...props} />);

      const button = screen.getByText('← Back');
      expect(button).toBeDisabled();
    });
  });

  describe('Keyboard Hint', () => {
    it('should show keyboard shortcut hint', () => {
      render(<StepView {...defaultProps} />);

      expect(screen.getByText(/Press/)).toBeInTheDocument();
      expect(screen.getByText('⌘')).toBeInTheDocument();
      expect(screen.getByText('Enter')).toBeInTheDocument();
    });
  });
});
