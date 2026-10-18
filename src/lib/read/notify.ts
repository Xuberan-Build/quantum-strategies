/**
 * Email entry points for the Read API routes. The unlock route calls onReadUnlocked
 * from ./emails directly; this re-export stays for any other caller.
 */
export { sendReadResultEmail, scheduleReadFollowups, onReadUnlocked } from './emails';
