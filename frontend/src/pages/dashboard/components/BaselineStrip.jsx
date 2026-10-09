// OWNER: Dashboard. Props: baseline = GET /api/baseline response.
// "Unique-ID check vs. our system" side by side. This is a key pitch moment.
import { Todo } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';

export default function BaselineStrip({ baseline }) {
  const b = baseline.baseline;
  const o = baseline.ours;
  return (
    <Todo name="BaselineStrip">
      {`${b.method}: ${b.ringsDetected} rings, ${b.recordsFlagged} records, ${formatInr(b.amountCaughtInr)}
${o.method}: ${o.ringsDetected} rings, ${o.recordsFlagged} records, ${formatInr(o.amountCaughtInr)}
Headline: ${baseline.headline}
Two columns: left greyed (baseline), right red (ours). Animate the numbers counting up.`}
    </Todo>
  );
}
