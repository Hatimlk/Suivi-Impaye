import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatMontant, formatDate, joursDepuis, cn } from '../utils';
import type { Dossier, DashboardStats } from '../types';
import { CHART_INK, CATEGORICAL } from '../utils/chartColors';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Eye, Clock, TrendingUp, AlertTriangle, FileText, RefreshCw,
} from 'lucide-react';
import {
  Card, KpiCard, Table, Thead, Tbody, Tr, Th, Td, StatusBadge, Pagination,
  EmptyState, PageSpinner, PageHeader, ChartTooltip,
} from '../components/ui';

const formatAxis = (value: number) => value >= 1_000_000
  ? `${(value / 1_000_000).toFixed(1)}M`
  : value >= 1_000 ? `${Math.round(value / 1_000)}k` : String(value);

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
        sort: 'date_facture',
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

      {!statsLoading && stats && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Évolution mensuelle de mes impayés</h2>
              <p className="text-xs text-gray-500 mt-1">Montant total par mois</p>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={stats.evolutionMensuelle || []} margin={{ left: -5, right: 12, top: 8 }}>
                <defs>
                  <linearGradient id="commercialAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CATEGORICAL[0]} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={CATEGORICAL[0]} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_INK.gridline} />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: CHART_INK.secondary }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11, fill: CHART_INK.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={(props: any) => <ChartTooltip {...props} formatter={formatMontant} />} />
                <Area type="monotone" dataKey="total_montant" name="Montant" stroke={CATEGORICAL[0]} strokeWidth={2.5} fill="url(#commercialAmount)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Mes impayés par banque</h2>
              <p className="text-xs text-gray-500 mt-1">Répartition des montants</p>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={(stats.parBanque || []).slice(0, 8)} margin={{ left: -5, right: 12, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_INK.gridline} />
                <XAxis dataKey="banque" tick={{ fontSize: 11, fill: CHART_INK.secondary }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatAxis} tick={{ fontSize: 11, fill: CHART_INK.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={(props: any) => <ChartTooltip {...props} formatter={formatMontant} />} />
                <Bar dataKey="total_montant" name="Montant" fill={CATEGORICAL[1]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
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
                <Th>Date de facture</Th>
                <Th>Banque</Th>
                <Th align="right">Montant</Th>
                <Th>N Valeur</Th>
                <Th>Partenaire</Th>
                <Th>Observation</Th>
                <Th>Statut</Th>
                <Th align="center">Jours</Th>
                <Th></Th>
              </tr>
            </Thead>
            <Tbody>
              {dossiers.map((d) => (
                <Tr key={d.id} className="cursor-pointer" onClick={() => navigate(`/dossiers/${d.id}`)}>
                  <Td>{d.date_facture ? formatDate(d.date_facture) : '-'}</Td>
                  <Td className="font-medium">{d.banque}</Td>
                  <Td align="right" className="font-mono">{formatMontant(d.montant)}</Td>
                  <Td className="font-mono text-xs">{d.numero_valeur}</Td>
                  <Td className="text-gray-900 font-medium max-w-[200px] truncate">{d.nom_tire}</Td>
                  <Td className="text-gray-600 max-w-[260px] truncate" title={d.observations || ''}>
                    {d.observations?.split(' | Date facture :')[0] || '-'}
                  </Td>
                  <Td><StatusBadge statut={d.statut} /></Td>
                  <Td align="center">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-md inline-block',
                        joursDepuis(d.date_echeance || d.date_saisie) >= 30
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : joursDepuis(d.date_echeance || d.date_saisie) >= 7
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {joursDepuis(d.date_echeance || d.date_saisie)}j
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
