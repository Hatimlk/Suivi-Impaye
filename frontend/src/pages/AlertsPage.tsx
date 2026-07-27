import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, Eye } from 'lucide-react';
import { useAlerts } from '../hooks/useAlerts';
import { formatMontant, cn } from '../utils';
import type { SemanticTone } from '../utils';
import {
  Card, Table, Thead, Tbody, Tr, Th, Td, Badge, StatusBadge, Button, EmptyState,
  PageSpinner, PageHeader,
} from '../components/ui';

function joursTone(jours: number): SemanticTone {
  if (jours >= 30) return 'danger';
  if (jours >= 14) return 'warning';
  return 'warning';
}

export default function AlertsPage() {
  const { dormants, contentieux, loading, refresh } = useAlerts();
  const navigate = useNavigate();

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alertes"
        actions={
          <Button onClick={() => refresh()} loading={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      {loading && <PageSpinner label="Chargement des alertes..." />}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
              <Clock className="h-5 w-5 text-warning-600" />
              <h2 className="text-lg font-semibold text-gray-900">Dossiers dormants</h2>
              <Badge tone="warning">{dormants.length}</Badge>
            </div>
            <p className="px-6 pt-2 text-xs text-gray-500">Sans action depuis 7+ jours</p>
            {dormants.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-6 w-6 text-success-600" />}
                title="Aucune alerte"
                description="Tous les dossiers sont à jour"
              />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Nom du tiré</Th>
                    <Th>Banque</Th>
                    <Th align="right">Montant</Th>
                    <Th align="center">Jours</Th>
                    <Th>Commercial</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <Tbody>
                  {dormants.map((d) => (
                    <Tr key={d.id}>
                      <Td className="whitespace-nowrap font-medium text-gray-900">{d.nom_tire}</Td>
                      <Td className="whitespace-nowrap">{d.banque}</Td>
                      <Td align="right" className="whitespace-nowrap font-medium text-gray-900">
                        {formatMontant(d.montant)}
                      </Td>
                      <Td align="center">
                        <Badge tone={joursTone(d.jours_sans_action)}>{d.jours_sans_action}j</Badge>
                      </Td>
                      <Td className="whitespace-nowrap">{d.commercial_nom}</Td>
                      <Td>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/dossiers/${d.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                          Voir
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>

          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
              <AlertTriangle className="h-5 w-5 text-danger-600" />
              <h2 className="text-lg font-semibold text-gray-900">Dossiers en contentieux</h2>
              <Badge tone="danger">{contentieux.length}</Badge>
            </div>
            <p className="px-6 pt-2 text-xs text-gray-500">Contentieux / pré-contentieux</p>
            {contentieux.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle className="h-6 w-6 text-success-600" />}
                title="Aucune alerte"
                description="Aucun dossier en contentieux"
              />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Nom du tiré</Th>
                    <Th>Banque</Th>
                    <Th align="right">Montant</Th>
                    <Th>Statut</Th>
                    <Th>Commercial</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <Tbody>
                  {contentieux.map((d) => (
                    <Tr key={d.id}>
                      <Td className="whitespace-nowrap font-medium text-gray-900">{d.nom_tire}</Td>
                      <Td className="whitespace-nowrap">{d.banque}</Td>
                      <Td align="right" className="whitespace-nowrap font-medium text-gray-900">
                        {formatMontant(d.montant)}
                      </Td>
                      <Td className="whitespace-nowrap"><StatusBadge statut={d.statut} /></Td>
                      <Td className="whitespace-nowrap">{d.commercial_nom}</Td>
                      <Td>
                        <Button variant="secondary" size="sm" onClick={() => navigate(`/dossiers/${d.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                          Voir
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
