import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, RefreshCw, Eye, CalendarClock } from 'lucide-react';
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
  const { rappels, dormants, contentieux, loading, refresh } = useAlerts();
  const navigate = useNavigate();

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Alertes"
        actions={
          <Button onClick={() => refresh()} loading={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      {!loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AlertSummary icon={CalendarClock} label="Délais dépassés" value={rappels.length} tone="danger" />
          <AlertSummary icon={Clock} label="Dossiers dormants" value={dormants.length} tone="warning" />
          <AlertSummary icon={AlertTriangle} label="Contentieux" value={contentieux.length} tone="danger" />
        </div>
      )}

      {loading && <PageSpinner label="Chargement des alertes..." />}

      {!loading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card padding="none" className="overflow-hidden border-gray-200/80 shadow-sm lg:col-span-2">
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50/50 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-danger-600 shadow-xs"><CalendarClock className="h-5 w-5" /></div>
              <h2 className="text-lg font-semibold text-gray-900">Délais d’action dépassés</h2>
              <Badge tone="danger">{rappels.length}</Badge>
            </div>
            <p className="px-6 pt-2 text-xs text-gray-500">Actions dont la date limite est dépassée</p>
            {rappels.length === 0 ? (
              <EmptyState icon={<CalendarClock className="h-6 w-6 text-success-600" />} title="Aucun délai dépassé" />
            ) : (
              <Table>
                <Thead className="sticky top-0 z-10"><tr><Th>Partenaire</Th><Th>Action</Th><Th>Date limite</Th><Th align="center">Retard</Th><Th>Commercial</Th><Th></Th></tr></Thead>
                <Tbody>
                  {rappels.map((d) => (
                    <Tr key={d.action_id} className="cursor-pointer hover:bg-red-50/30" onClick={() => navigate(`/dossiers/${d.id}`)}>
                      <Td className="font-semibold text-gray-950">{d.nom_tire}</Td>
                      <Td className="max-w-[320px] truncate" title={d.action_contenu}>{d.action_contenu}</Td>
                      <Td className="whitespace-nowrap">{new Date(d.date_rappel).toLocaleDateString('fr-FR')}</Td>
                      <Td align="center"><Badge tone="danger">{d.jours_retard}j</Badge></Td>
                      <Td>{d.commercial_nom || '-'}</Td>
                      <Td><Button variant="secondary" size="sm" onClick={() => navigate(`/dossiers/${d.id}`)}><Eye className="h-3.5 w-3.5" />Voir</Button></Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>
          <Card padding="none" className="overflow-hidden border-gray-200/80 shadow-sm">
            <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50/50 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-warning-600 shadow-xs"><Clock className="h-5 w-5" /></div>
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
                    <Th>Partenaire</Th>
                    <Th>Banque</Th>
                    <Th align="right">Montant</Th>
                    <Th align="center">Jours</Th>
                    <Th>Commercial</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <Tbody>
                  {dormants.map((d) => (
                    <Tr key={d.id} className="cursor-pointer hover:bg-amber-50/30" onClick={() => navigate(`/dossiers/${d.id}`)}>
                      <Td className="whitespace-nowrap font-semibold text-gray-950">{d.nom_tire}</Td>
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

          <Card padding="none" className="overflow-hidden border-gray-200/80 shadow-sm">
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50/50 px-6 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-danger-600 shadow-xs"><AlertTriangle className="h-5 w-5" /></div>
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
                    <Th>Partenaire</Th>
                    <Th>Banque</Th>
                    <Th align="right">Montant</Th>
                    <Th>Statut</Th>
                    <Th>Commercial</Th>
                    <Th></Th>
                  </tr>
                </Thead>
                <Tbody>
                  {contentieux.map((d) => (
                    <Tr key={d.id} className="cursor-pointer hover:bg-red-50/30" onClick={() => navigate(`/dossiers/${d.id}`)}>
                      <Td className="whitespace-nowrap font-semibold text-gray-950">{d.nom_tire}</Td>
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

function AlertSummary({ icon: Icon, label, value, tone }: {
  icon: typeof AlertTriangle;
  label: string;
  value: number;
  tone: 'danger' | 'warning';
}) {
  const style = tone === 'danger'
    ? 'bg-red-50 text-red-600 ring-red-100'
    : 'bg-amber-50 text-amber-600 ring-amber-100';
  return (
    <Card className="flex items-center gap-3 border-gray-200/80 py-4 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${style}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-950">{value}</p>
      </div>
    </Card>
  );
}
