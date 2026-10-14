import { CONSENT_KINDS } from '../gptour-semantic/contract.ts';
import { type Check, date, fail, list, object, record, text, values } from './checks.ts';
const id = text(128), option = text(512);
const variants: Record<string, Check> = {
  answer: object({ type: values('answer'), questionId: id, optionId: option }),
  dismiss_question: object({ type: values('dismiss_question'), questionId: id }),
  follow_up_decision: object({ type: values('follow_up_decision'), eventId: id, decision: values('include', 'exclude') }),
  propose_reschedule: object({ type: values('propose_reschedule'), eventId: id, proposedDate: date }),
  require_stop: object({ type: values('require_stop'), key: id }),
  exclude_stop: object({ type: values('exclude_stop'), key: id }),
  set_date: object({ type: values('set_date'), date }),
  reset: object({ type: values('reset') }),
  grant_consent: object({ type: values('grant_consent'), kind: values(...CONSENT_KINDS), questionId: id }, { dates: list(date, 1, 366) }),
};
export const actionCheck: Check = (v, path, issues) => {
  if (!record(v) || typeof v.type !== 'string' || !Object.hasOwn(variants, v.type)) { fail(issues, path, 'action_type'); return; }
  variants[v.type](v, path, issues);
  if (v.type === 'grant_consent') {
    if (v.kind === 'non_working_day' && !Object.hasOwn(v, 'dates')) fail(issues, `${path}.dates`, 'required_date_bound_consent');
    if (v.kind !== 'non_working_day' && Object.hasOwn(v, 'dates')) fail(issues, `${path}.dates`, 'unexpected_dates');
    if (Array.isArray(v.dates) && new Set(v.dates).size !== v.dates.length) fail(issues, `${path}.dates`, 'duplicate_dates');
  }
};