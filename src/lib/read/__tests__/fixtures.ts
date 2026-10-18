/** Crafted answer sets for the Perception Read tests (kept in .ts: the repo ignores *.json). */
import type { ReadAnswers } from '../types';

export const SHOULDS_ANSWERS: ReadAnswers = {
  q1: { questionId: 'q1', choice: ['seg:side_builder'] },
  q2: { questionId: 'q2', choice: ['say:shoulds', 'say:know_dont'], parts: { loudest: 'say:shoulds' } },
  q3: { questionId: 'q3', choice: ['fav:no_clean'] },
  q4: { questionId: 'q4', choice: ['stall:should'] },
  q5: { questionId: 'q5', choice: ['desc:result'] },
  q6: { questionId: 'q6', choice: ['come:execute'] },
  q7: { questionId: 'q7', parts: { thing: 'writing again', hours: 'hours:0', instead: 'instead:shoulds', wantOrShould: 'own:should' } },
  q8: { questionId: 'q8', parts: { line1: 'gets things done for the team', line2: 'keeps the house running', line3: 'reads on Sundays' } },
  q9: { questionId: 'q9', text: "I'll get to it when things calm down" },
  q10: { questionId: 'q10', number: 6 },
  q11: { questionId: 'q11', choice: ['tried:systems', 'tried:content'], parts: { out: 'out:slipped' } },
  q12: { questionId: 'q12', choice: ['spent:50_500'] },
};

export const NOT_CAUGHT_UP_ANSWERS: ReadAnswers = {
  q1: { questionId: 'q1', choice: ['seg:operator'] },
  q2: { questionId: 'q2', choice: ['say:not_enough', 'say:faking'], parts: { loudest: 'say:not_enough' } },
  q3: { questionId: 'q3', choice: ['fav:avoid'] },
  q4: { questionId: 'q4', choice: ['stall:verdict'] },
  q5: { questionId: 'q5', choice: ['desc:deflect'] },
  q6: { questionId: 'q6', choice: ['come:fix'] },
  q7: { questionId: 'q7', parts: { thing: 'launching my site', hours: 'hours:3_5', instead: 'instead:work', wantOrShould: 'own:want' } },
  q8: { questionId: 'q8', parts: { line1: 'is always late', line2: 'overthinks everything', line3: 'hates a messy desk' } },
  q9: { questionId: 'q9', text: "I'm not good enough yet" },
  q10: { questionId: 'q10', number: 5 },
  q11: { questionId: 'q11', choice: ['tried:affirm', 'tried:willpower'], parts: { out: 'out:worse' } },
};

export const ON_EMPTY_ANSWERS: ReadAnswers = {
  q1: { questionId: 'q1', choice: ['seg:team_lead'] },
  q2: { questionId: 'q2', choice: ['say:no_guilt', 'say:empty'], parts: { loudest: 'say:no_guilt' } },
  q3: { questionId: 'q3', choice: ['fav:yes_late'] },
  q4: { questionId: 'q4', choice: ['stall:others'] },
  q5: { questionId: 'q5', choice: ['desc:none'] },
  q6: { questionId: 'q6', choice: ['come:support'] },
  q7: {
    questionId: 'q7',
    parts: { thing: 'the online course I started in spring', hours: 'hours:1_2', instead: 'instead:others', wantOrShould: 'own:want' },
  },
  q8: { questionId: 'q8', parts: { line1: 'always says yes to my friends', line2: 'helps everyone move house', line3: 'answers texts at midnight' } },
  q9: { questionId: 'q9', text: "I'll sleep when it's done" },
  q10: { questionId: 'q10', number: 3 },
  q11: { questionId: 'q11', choice: ['tried:none'] },
};

export const NO_THREAD_ANSWERS: ReadAnswers = {
  q1: { questionId: 'q1', choice: ['seg:multi'] },
  q2: { questionId: 'q2', choice: ['say:many', 'say:stall'], parts: { loudest: 'say:many' } },
  q3: { questionId: 'q3', choice: ['fav:no_clean'] },
  q4: { questionId: 'q4', choice: ['stall:novelty'] },
  q5: { questionId: 'q5', choice: ['desc:list'] },
  q6: { questionId: 'q6', choice: ['come:ideas'] },
  q7: { questionId: 'q7', parts: { thing: 'a podcast', hours: 'hours:3_5', instead: 'instead:projects', wantOrShould: 'own:want' } },
  q8: { questionId: 'q8', parts: { line1: 'has a new idea every week', line2: 'builds things', line3: 'learns fast' } },
  q9: { questionId: 'q9', text: 'I need to pick one thing' },
  q10: { questionId: 'q10', number: 6 },
  q11: { questionId: 'q11', choice: ['tried:coach'], parts: { out: 'out:switched' } },
};

export const SMALLER_ANSWERS: ReadAnswers = {
  q1: { questionId: 'q1', choice: ['seg:operator'] },
  q2: { questionId: 'q2', choice: ['say:hide', 'say:undercharge'], parts: { loudest: 'say:hide' } },
  q3: { questionId: 'q3', choice: ['fav:no_clean'] },
  q4: { questionId: 'q4', choice: ['stall:seen'] },
  q5: { questionId: 'q5', choice: ['desc:just'] },
  q6: { questionId: 'q6', choice: ['come:skill'], text: 'web design' },
  q7: { questionId: 'q7', parts: { thing: 'posting my portfolio', hours: 'hours:6_10', instead: null, wantOrShould: 'own:want' } },
  q8: { questionId: 'q8', parts: { line1: 'does good web design work', line2: 'keeps quiet in meetings', line3: 'over-delivers' } },
  q9: { questionId: 'q9', text: 'I just help people with their websites' },
  q10: { questionId: 'q10', number: 7 },
  q11: { questionId: 'q11', choice: ['tried:content'], parts: { out: 'out:understood' } },
};
