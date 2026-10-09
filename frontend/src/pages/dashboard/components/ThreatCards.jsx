// OWNER: Dashboard. Two cards explaining Ring ghosts and Lone ghosts and why they are a threat.
// Static content, no API call. Consider a small animated illustration (linked dots vs one isolated dot).
import { Todo } from '../../../components/States.jsx';

export default function ThreatCards() {
  return (
    <Todo name="ThreatCards">
      {`Two side-by-side cards:
- Ring ghosts: organised groups of fake or diverted beneficiaries linked by shared payout accounts,
  phones, agents, OTP devices, timing and money flow. Threat: large, systematic leakage that
  passes unique-ID checks.
- Lone ghosts: single suspicious records (very new account, instant withdrawal, odd-hour application,
  not in registry). Threat: small individually, large in aggregate.`}
    </Todo>
  );
}
