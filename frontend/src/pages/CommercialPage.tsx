import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatMontant, formatDate, joursDepuis, cn } from '../utils';
import type { Dossier, DashboardStats } from '../types';
import {
  Eye, Clock, TrendingUp, AlertTriangle, FileText, RefreshCw,
} from 'lucide-react';
import {
  Card, KpiCard, Table, Thead, Tbody, Tr, Th, Td, StatusBadge, Pagination,
  EmptyState, PageSpinner, PageHeader,
} from '../components/ui';

export default function CommercialPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadDossiers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDossiers({
        page: String(page),
        limit: '10',
        sort: 'date_saisie',
        order: 'DESC',
      });
      setDossiers(res.dossiers);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadDossiers();
  }, [loadDossiers]);

  useEffect(() => {
    setStatsLoading(true);
    api.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setStatsLoading(false));
  }, []);

  const dormantsCount = stats?.dossiersDormants || 0;
  const contentieuxCount = stats?.parStatut?.find((s) => s.statut === 'Contentieux')?.count || 0;
  const enCoursCount = stats?.total?.count || 0;
  const montantTotal = stats?.total?.montant || 0;

  const statutCounts = stats?.parStatut || [];

  return (
    <div className="space-y-6">
      <PageHeader title={`Bonjour, ${user?.nom}`} subtitle="Voici le résumé de vos dossiers impayés" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Mes dossiers"
          value={statsLoading ? '-' : String(enCoursCount)}
          icon={<FileText className="w-5 h-5" />}
          tone="brand"
        />
        <KpiCard
          label="Montant total"
          value={statsLoading ? '-' : formatMontant(montantTotal)}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="success"
        />
        <KpiCard
          label="Dormants (7j+)"
          value={statsLoading ? '-' : String(dormantsCount)}
          icon={<Clock className="w-5 h-5" />}
          tone="warning"
        />
        <KpiCard
          label="Contentieux"
          value={statsLoading ? '-' : String(contentieuxCount)}
          icon={<AlertTriangle className="w-5 h-5" />}
          tone="danger"
        />
      </div>

      {!statsLoading && statutCounts.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Répartition par statut</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {statutCounts.map((s) => (
              <div key={s.statut} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-600 truncate max-w-[140px]">{s.statut}</span>
                <span className="text-sm font-bold text-gray-900 ml-2">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Mes dossiers récents ({total})</h2>
          <button
            onClick={() => { loadDossiers(); }}
            disabled={loading}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"
            aria-label="Actualiser"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <PageSpinner label="Chargement..." />
        ) : dossiers.length === 0 ? (
          <EmptyState icon={<FileText className="w-6 h-6" />} title="Aucun dossier assigné" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Banque</Th>
                <Th align="right">Montant</Th>
                <Th>N Valeur</Th>
                <Th>Nom du tiré</Th>
                <Th>Statut</Th>
                <Th align="center">Jours</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {dossiers.map((d) => (
                <Tr key={d.id} className="cursor-pointer" onClick={() => navigate(`/dossiers/${d.id}`)}>
                  <Td>{formatDate(d.date_saisie)}</Td>
                  <Td className="font-medium">{d.banque}</Td>
                  <Td align="right" className="font-mono">{formatMontant(d.montant)}</Td>
                  <Td className="font-mono text-xs">{d.numero_valeur}</Td>
                  <Td className="text-gray-900 font-medium max-w-[200px] truncate">{d.nom_tire}</Td>
                  <Td><StatusBadge statut={d.statut} /></Td>
                  <Td align="center">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-md inline-block',
                        joursDepuis(d.date_saisie) >= 30
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : joursDepuis(d.date_saisie) >= 7
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {joursDepuis(d.date_saisie)}j
                    </span>
                  </Td>
                  <Td align="center">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/dossiers/${d.id}`); }}
                      className="p-1.5 hover:bg-brand-50 rounded-lg transition text-brand-600"
                      title="Voir le dossier"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>
    </div>
  );
}
