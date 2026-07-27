import { Badge } from './Badge';
import { getStatutColor } from '../../utils';

export function StatusBadge({ statut }: { statut: string }) {
  return (
    <Badge tone={getStatutColor(statut)} className="whitespace-nowrap">
      {statut}
    </Badge>
  );
}
