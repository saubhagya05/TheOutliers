// OWNER: Dashboard. Props: dataset = GET /api/dataset response.
import { Todo } from '../../../components/States.jsx';

export default function DatasetCard({ dataset }) {
  return (
    <Todo name="DatasetCard">
      {`${dataset.name}  (${dataset.recordCount} records, simulated=${dataset.simulated})
Sections to render:
1. Description + "Simulated" badge
2. columnGroups (${dataset.columnGroups.length} groups): table of column / used for (ring, lone chips) / description
3. howCreated (${dataset.howCreated.length} steps): numbered list
4. planted: ${dataset.planted.rings} rings by type, ${dataset.planted.loneGhosts} lone ghosts, hard negatives
5. pipeline (${dataset.pipeline.length} steps): horizontal step diagram
6. limitations: honest bullet list`}
    </Todo>
  );
}
