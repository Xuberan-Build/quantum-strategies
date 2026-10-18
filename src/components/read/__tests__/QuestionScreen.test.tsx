import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReadAnswer, ReadQuestion } from '@/lib/read/types';
import { normaliseAnswer } from '../answers';
import { QuestionScreen } from '../QuestionScreen';

const Q11: ReadQuestion = {
  id: 'q11',
  order: 11,
  title: "What you've tried",
  question: 'What have you already tried for this? Pick any.',
  kind: 'multi',
  required: true,
  options: [
    { value: 'tried:content', label: 'Books, podcasts or YouTube' },
    { value: 'tried:journal', label: 'Journaling' },
    { value: 'tried:none', label: 'Nothing yet' },
    { value: 'out:slipped', label: 'It helped for a while, then I slipped back' },
    { value: 'out:helps', label: 'It helps and I still use it' },
  ],
};

const Q8: ReadQuestion = {
  id: 'q8',
  order: 8,
  title: 'Your words',
  question: 'Finish this three times, quickly.',
  kind: 'text',
  required: true,
};

function Harness({ question, onNext = vi.fn() }: { question: ReadQuestion; onNext?: () => void }) {
  const [answer, setAnswer] = useState<ReadAnswer>({ questionId: question.id });
  return (
    <>
      <QuestionScreen
        question={question}
        position={3}
        total={12}
        answer={answer}
        saving={false}
        error={null}
        onChange={setAnswer}
        onNext={onNext}
      />
      <output data-testid="answer">{JSON.stringify(normaliseAnswer(question, answer))}</output>
    </>
  );
}

const current = () => JSON.parse(screen.getByTestId('answer').textContent!);

describe('QuestionScreen', () => {
  it('shows "3 of 12" and focuses the question', () => {
    render(<Harness question={Q8} />);
    expect(screen.getByText('3 of 12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: Q8.question })).toHaveFocus();
  });

  it('Q11: the outcome follow-up appears after a pick and "Nothing yet" clears it', async () => {
    const user = userEvent.setup();
    render(<Harness question={Q11} />);
    expect(screen.queryByRole('group', { name: 'What happened, mostly?' })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Journaling'));
    await user.click(screen.getByLabelText(/slipped back/));
    expect(current()).toEqual({ questionId: 'q11', choice: ['tried:journal'], parts: { out: 'out:slipped' } });

    await user.click(screen.getByLabelText('Nothing yet'));
    expect(current()).toEqual({ questionId: 'q11', choice: ['tried:none'] });
    expect(screen.queryByRole('group', { name: 'What happened, mostly?' })).not.toBeInTheDocument();
  });

  it('Q8: three short lines, joined into the text answer, Enter moves on', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Harness question={Q8} onNext={onNext} />);
    await user.type(screen.getByLabelText(/\(1 of 3\)/), 'says yes');
    await user.type(screen.getByLabelText(/\(3 of 3\)/), 'plans a lot{Enter}');
    expect(current()).toEqual({
      questionId: 'q8',
      text: 'says yes\nplans a lot',
      parts: { line1: 'says yes', line3: 'plans a lot' },
    });
    expect(onNext).toHaveBeenCalled();
  });
});
