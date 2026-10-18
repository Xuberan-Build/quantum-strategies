import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadApiProvider } from '../ReadApiContext';
import { ReadFlow } from '../ReadFlow';
import { createMockApi, PREVIEW } from './fixtures';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
  usePathname: () => '/read/start/',
}));

function renderFlow(api = createMockApi(), props: { variant?: string } = {}) {
  render(
    <ReadApiProvider api={api}>
      <ReadFlow utm={{ source: 'youtube', content: 'stall' }} variant={props.variant} />
    </ReadApiProvider>
  );
  return api;
}

async function answerQ1(user: ReturnType<typeof userEvent.setup>, label: RegExp) {
  await screen.findByRole('heading', { name: /sounds most like your week/i });
  await user.click(screen.getByLabelText(label));
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

describe('ReadFlow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.cookie = 'qs_read_sid=; Max-Age=0; Path=/';
    push.mockReset();
  });

  it('starts a session with the UTMs and shows the first question with progress', async () => {
    const api = renderFlow();
    expect(await screen.findByRole('heading', { name: /sounds most like your week/i })).toBeInTheDocument();
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
    expect(api.start).toHaveBeenCalledWith({ utm: { source: 'youtube', content: 'stall', variant: undefined }, variant: undefined });
    expect(api.getQuestions).toHaveBeenCalledWith({ segment: undefined, variant: undefined });
    expect(api.event).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_start', sessionId: 'sess-1' }));
    expect(api.event).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_step_view', step: 1 }));
  });

  it('asks for an answer before moving on, without saving', async () => {
    const user = userEvent.setup();
    const api = renderFlow();
    await screen.findByRole('heading', { name: /sounds most like your week/i });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick an answer to keep going.');
    expect(api.saveAnswer).not.toHaveBeenCalled();
  });

  it('autosaves each answer and loads segment-dependent questions after Q1', async () => {
    const user = userEvent.setup();
    const api = renderFlow();
    await answerQ1(user, /I run my own business/);

    await screen.findByRole('heading', { name: /Pick up to three/ });
    expect(api.saveAnswer).toHaveBeenCalledWith('sess-1', { questionId: 'q1', choice: ['seg:operator'] });
    expect(api.event).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_step_submit', step: 1 }));
    expect(api.getQuestions).toHaveBeenLastCalledWith({ segment: 'operator', variant: undefined });
    // operator sees the pricing option (spec v3 Q2 j)
    expect(screen.getByLabelText(/I undercharge/)).toBeInTheDocument();
    expect(screen.getByText('2 of 6')).toBeInTheDocument();
  });

  it('hides the operator-only option for a team lead', async () => {
    const user = userEvent.setup();
    const api = renderFlow();
    await answerQ1(user, /I lead a team/);
    await screen.findByRole('heading', { name: /Pick up to three/ });
    expect(api.getQuestions).toHaveBeenLastCalledWith({ segment: 'team_lead', variant: undefined });
    expect(screen.queryByLabelText(/I undercharge/)).not.toBeInTheDocument();
  });

  it('Q2 asks for the loudest pick when there is more than one, then saves it', async () => {
    const user = userEvent.setup();
    const api = renderFlow();
    await answerQ1(user, /I run my own business/);
    await screen.findByRole('heading', { name: /Pick up to three/ });

    await user.click(screen.getByLabelText(/I know what to do/));
    await user.click(screen.getByLabelText(/someone else's life/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick the one that is loudest.');

    const loudest = screen.getByRole('group', { name: 'Which one is loudest?' });
    await user.click(within(loudest).getByLabelText(/someone else's life/));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: /keep telling yourself/ });
    expect(api.saveAnswer).toHaveBeenLastCalledWith('sess-1', {
      questionId: 'q2',
      choice: ['say:know_dont', 'say:shoulds'],
      parts: { loudest: 'say:shoulds' },
    });
  });

  it('builds the Q7 week mirror answer from its four parts', async () => {
    const user = userEvent.setup();
    const api = renderFlow();
    await answerQ1(user, /I run my own business/);
    await screen.findByRole('heading', { name: /Pick up to three/ });
    await user.click(screen.getByLabelText(/I know what to do/));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: /keep telling yourself/ });
    await user.type(screen.getByLabelText(/The thing/), 'writing again');
    await user.click(screen.getByLabelText('1–2'));
    await user.click(screen.getByLabelText("Other people's asks"));
    await user.click(screen.getByLabelText('Supposed to'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: /one sentence you say about yourself/ });
    expect(api.saveAnswer).toHaveBeenLastCalledWith('sess-1', {
      questionId: 'q7',
      text: 'writing again',
      number: 1,
      parts: { thing: 'writing again', hours: 'hours:1_2', instead: 'instead:others', wantOrShould: 'should' },
    });
  });

  it('routes straight to the support screen when a text answer comes back crisis tier', async () => {
    const user = userEvent.setup();
    const api = createMockApi({
      saveAnswer: vi.fn(async (_sid: string, answer: { questionId: string }) =>
        answer.questionId === 'q9'
          ? { ok: true as const, safety: { tier: 'crisis' as const, matchedLists: ['tier1'] } }
          : { ok: true as const }
      ) as never,
    });
    renderFlow(api);
    await answerQ1(user, /I run my own business/);
    await screen.findByRole('heading', { name: /Pick up to three/ });
    await user.click(screen.getByLabelText(/I know what to do/));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: /keep telling yourself/ });
    await user.type(screen.getByLabelText(/The thing/), 'the course');
    await user.click(screen.getByLabelText('0'));
    await user.click(screen.getByLabelText('Want'));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await screen.findByRole('heading', { name: /one sentence you say about yourself/ });
    await user.type(screen.getByLabelText(/one sentence you say about yourself/), 'some words');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByTestId('read-support')).toBeInTheDocument();
    expect(screen.getByText(/Call or text 988/)).toBeInTheDocument();
    expect(screen.queryByText(/Running on shoulds/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    expect(api.complete).not.toHaveBeenCalled();
    expect(api.event).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_safety_triggered', props: { tier: 'crisis' } }));

    // "Show me my answers anyway" shows the week answers only, with no sell
    await user.click(screen.getByRole('button', { name: 'Show me my answers anyway' }));
    expect(screen.getByText(/the course/)).toBeInTheDocument();
    expect(screen.queryByText(/some words/)).not.toBeInTheDocument();
  });

  it('completes after the last question and goes to the result URL', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem(
      'qs_read_progress',
      JSON.stringify({ sessionId: 'sess-1', answers: {}, currentId: 'q12', segment: 'operator' })
    );
    const api = renderFlow();
    // resumed on the last (optional) question without a new session
    await screen.findByRole('heading', { name: /spent on fixing this/ });
    expect(api.start).not.toHaveBeenCalled();
    expect(screen.getByText('6 of 6')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'See my Read' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/read/result/sess-1/'));
    expect(api.complete).toHaveBeenCalledWith('sess-1');
    expect(api.event).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_complete' }));
    expect(JSON.parse(sessionStorage.getItem('qs_read_preview:sess-1')!)).toEqual(PREVIEW);
  });

  it('shows a save error and stays on the question when autosave fails', async () => {
    const user = userEvent.setup();
    const api = createMockApi({ saveAnswer: vi.fn(async () => Promise.reject(new Error('offline'))) as never });
    renderFlow(api);
    await answerQ1(user, /I run my own business/);
    expect(await screen.findByRole('alert')).toHaveTextContent("That didn't save.");
    expect(screen.getByText('1 of 6')).toBeInTheDocument();
  });

  it('goes back with answers kept', async () => {
    const user = userEvent.setup();
    renderFlow();
    await answerQ1(user, /I run my own business/);
    await screen.findByRole('heading', { name: /Pick up to three/ });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { name: /sounds most like your week/ });
    expect(screen.getByLabelText(/I run my own business/)).toBeChecked();
  });
});
