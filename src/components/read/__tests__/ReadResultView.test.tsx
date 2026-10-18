import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadApiError } from '../api';
import { ReadApiProvider } from '../ReadApiContext';
import { ReadResultView } from '../ReadResultView';
import { createMockApi, PREVIEW, QUESTIONS, RESULT_FIXTURE } from './fixtures';

const locked = () => Promise.reject(new ReadApiError(403, 'locked'));

function renderResult(api = createMockApi(), token?: string) {
  render(
    <ReadApiProvider api={api}>
      <ReadResultView sessionId="sess-1" token={token} />
    </ReadApiProvider>
  );
  return api;
}

describe('ReadResultView', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.scrollTo = vi.fn() as never;
  });

  it('shows the week mirror, "You said", the pattern and the gate before unlock', async () => {
    sessionStorage.setItem('qs_read_preview:sess-1', JSON.stringify(PREVIEW));
    sessionStorage.setItem(
      'qs_read_progress',
      JSON.stringify({
        sessionId: 'sess-1',
        questions: QUESTIONS,
        answers: { q2: { questionId: 'q2', choice: ['say:know_dont', 'say:shoulds'], parts: { loudest: 'say:shoulds' } } },
      })
    );
    const api = renderResult(createMockApi({ getResult: vi.fn(locked) as never }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Running on shoulds' })).toBeInTheDocument();
    expect(screen.getByText(/You keep meaning to get to "writing again"/)).toBeInTheDocument();
    expect(screen.getByText(/You said: “I'm doing what I'm supposed to/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Get your full Read' })).toBeInTheDocument();
    // nothing after the gate yet
    expect(screen.queryByText(/One move this week/)).not.toBeInTheDocument();
    expect(api.complete).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(api.event).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'read_preview_view', props: expect.objectContaining({ gap: true, pattern: 'SHOULDS' }) })
      )
    );
  });

  it('asks the server for the preview when there is nothing on this device', async () => {
    const api = renderResult(createMockApi({ getResult: vi.fn(locked) as never }));
    expect(await screen.findByRole('heading', { name: 'Get your full Read' })).toBeInTheDocument();
    expect(api.complete).toHaveBeenCalledWith('sess-1');
  });

  it('validates the email, keeps the consent box unticked, then unlocks and shows the full result', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('qs_read_preview:sess-1', JSON.stringify(PREVIEW));
    const api = renderResult(createMockApi({ getResult: vi.fn(locked) as never }));

    await screen.findByRole('heading', { name: 'Get your full Read' });
    const consent = screen.getByRole('checkbox', { name: /occasional email from Austin/ });
    expect(consent).not.toBeChecked();

    await user.type(screen.getByLabelText('Your email'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Show my full Read' }));
    expect(screen.getByText(/That email looks incomplete/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your email')).toHaveAttribute('aria-invalid', 'true');
    expect(api.unlock).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Your email'));
    await user.type(screen.getByLabelText('Your email'), ' me@example.com ');
    await user.click(screen.getByRole('button', { name: 'Show my full Read' }));

    await screen.findByTestId('read-result');
    expect(api.unlock).toHaveBeenCalledWith('sess-1', { email: 'me@example.com', consentMarketing: false, utm: undefined });
    // read_email_submit and read_result_view are recorded server-side (unlock and result routes).
    expect(api.event).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'read_email_submit' }));
    expect(api.event).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'read_result_view' }));
  });

  it('shows an error and keeps the gate when unlock fails', async () => {
    const user = userEvent.setup();
    sessionStorage.setItem('qs_read_preview:sess-1', JSON.stringify(PREVIEW));
    renderResult(createMockApi({ getResult: vi.fn(locked) as never, unlock: vi.fn(() => Promise.reject(new Error('x'))) as never }));
    await screen.findByRole('heading', { name: 'Get your full Read' });
    await user.type(screen.getByLabelText('Your email'), 'me@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Show my full Read' }));
    expect(await screen.findByText(/That didn't go through/)).toBeInTheDocument();
    expect(screen.queryByTestId('read-result')).not.toBeInTheDocument();
  });

  it('renders every result block in order, from the shareable link token', async () => {
    const api = renderResult(createMockApi(), 'signed-token');
    await screen.findByTestId('read-result');
    expect(api.getResult).toHaveBeenCalledWith('sess-1', 'signed-token');

    const order = Array.from(document.querySelectorAll('[data-block]')).map((el) => el.getAttribute('data-block'));
    expect(order).toEqual(RESULT_FIXTURE.blocks.map((b) => b.id));
    expect(screen.getByRole('heading', { level: 1, name: 'Running on shoulds' })).toBeInTheDocument();
    expect(screen.getByText(/Sheldon & Elliot, 1999/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is a flaw in you/)).toBeInTheDocument();
  });

  it('commits to the move, sends accuracy feedback and links the offer to checkout', async () => {
    const user = userEvent.setup();
    const api = renderResult();
    await screen.findByTestId('read-result');

    await user.click(screen.getByRole('button', { name: "I'll do this" }));
    expect(api.feedback).toHaveBeenCalledWith({ sessionId: 'sess-1', moveCommitted: true });
    expect(await screen.findByText(/ask how it went in a week/)).toBeInTheDocument();

    const offer = screen.getByRole('link', { name: /Get Rite I and start with the Value Pattern Decoder/ });
    expect(offer).toHaveAttribute('href', '/read/checkout/?session=sess-1');
    offer.addEventListener('click', (e) => e.preventDefault());
    await user.click(offer);
    expect(api.event).toHaveBeenCalledWith(expect.objectContaining({ event: 'read_offer_click', sessionId: 'sess-1' }));

    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByText('Pick a number from 1 to 5 first.')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: '4' }));
    await user.click(screen.getByRole('radio', { name: 'The week mirror' }));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(api.feedback).toHaveBeenLastCalledWith({ sessionId: 'sess-1', accuracy: 4, hardestPart: 'week_mirror' });
    expect(await screen.findByText(/how the Read gets more accurate/)).toBeInTheDocument();
  });

  it('shows the support screen and no pattern or offer for a crisis preview', async () => {
    sessionStorage.setItem(
      'qs_read_preview:sess-1',
      JSON.stringify({ sessionId: 'sess-1', safety: { tier: 'crisis', matchedLists: ['t1'] }, mirror: null, pattern: null })
    );
    renderResult(createMockApi({ getResult: vi.fn(locked) as never }));
    expect(await screen.findByTestId('read-support')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Get your full Read' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Rite I/)).not.toBeInTheDocument();
  });

  it('says the Read is missing when the link is bad', async () => {
    renderResult(createMockApi({ getResult: vi.fn(locked) as never }), 'expired');
    expect(await screen.findByText(/couldn't find this Read/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start a new Read' })).toHaveAttribute('href', '/read/');
  });
});
