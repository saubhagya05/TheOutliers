// OWNER: Dashboard. Props: overview = GET /api/overview response.
// Thin strip of 4-5 big numbers: records scanned, rings found, ring members, lone ghosts, ₹ at risk.
import { Todo } from '../../../components/States.jsx';
import { formatInr } from '../../../components/format.js';

export default function StatStrip({ overview }) {
  return (
    <Todo name="StatStrip">
      {`recordsScanned=${overview.recordsScanned}  ringsFound=${overview.ringsFound}  ringMembers=${overview.ringMembers}
loneGhostsFound=${overview.loneGhostsFound}  totalAtRisk=${formatInr(overview.totalAtRiskInr)}
Render as big mono numbers with small muted labels; ₹ at risk in red.`}
    </Todo>
  );
}
