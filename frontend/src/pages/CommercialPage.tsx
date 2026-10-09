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
  Eye, Clock, TrendingUp, AlertTriangle, FileText, RefreshCw, Search, Filter, X,
} from 'lucide-react';
import {
  Card, KpiCard, Table, Thead, Tbody, Tr, Th, Td, StatusBadge, Pagination,
  EmptyState, PageSpinner, PageHeader, ChartTooltip, Input, Select, Button, Badge,
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
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [filterOptions, setFilterOptions] = useState<{
    partenaires: string[];
    banques: string[];
    statuts: string[];
  }>({ partenaires: [], banques: [], statuts: [] });

  const loadDossiers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDossiers({
        page: String(page),
        limit: '10',
        sort: 'date_facture',
        order: 'DESC',
        search,
        ...filters,
      });
      setDossiers(res.dossiers);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

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

  useEffect(() => {
    api.getErpFilters()
      .then((result) => setFilterOptions({
        partenaires: result.partenaires || [],
        banques: result.banques || [],
        statuts: result.statuts || [],
      }))
      .catch(console.error);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const setFilter = (key: string, value: string) => {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      return next;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const activeFilterCount = Object.keys(filters).length + (search ? 1 : 0);

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
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Mes dossiers récents ({total})</h2>
            <p className="mt-0.5 text-xs text-gray-500">Recherche et filtres limités à vos dossiers affectés</p>
          </div>
          <button
            onClick={() => { loadDossiers(); }}
            disabled={loading}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500"
            aria-label="Actualiser"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="border-b border-gray-200 bg-gray-50/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <Input
                name="commercial-search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Rechercher par partenaire, numéro ou banque..."
                icon={<Search className="h-4 w-4" />}
              />
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              onClick={() => setShowFilters((current) => !current)}
              className={showFilters ? 'bg-brand-50 text-brand-700' : ''}
            >
              <Filter className="h-4 w-4" />
              Filtres
              {activeFilterCount > 0 && <Badge tone="brand">{activeFilterCount}</Badge>}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="danger" onClick={clearFilters} title="Effacer les filtres">
                <X className="h-4 w-4" />
                <span className="sm:hidden">Effacer</span>
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="mt-3 grid grid-cols-1 gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2 xl:grid-cols-4">
              <Select label="Partenaire" value={filters.nom_tire || ''} onChange={(event) => setFilter('nom_tire', event.target.value)}>
                <option value="">Tous les partenaires</option>
                {filterOptions.partenaires.map((partner) => <option key={partner} value={partner}>{partner}</option>)}
              </Select>
              <Select label="Banque" value={filters.banque || ''} onChange={(event) => setFilter('banque', event.target.value)}>
                <option value="">Toutes les banques</option>
                {filterOptions.banques.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
              </Select>
              <Select label="Statut" value={filters.statut || ''} onChange={(event) => setFilter('statut', event.target.value)}>
                <option value="">Tous les statuts</option>
                {filterOptions.statuts.map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
              <Select label="Type" value={filters.type_valeur || ''} onChange={(event) => setFilter('type_valeur', event.target.value)}>
                <option value="">Tous les types</option>
                <option value="CHQ">Chèque</option>
                <option value="LCN">Lettre de change</option>
              </Select>
            </div>
          )}
        </div>

        {loading ? (
          <PageSpinner label="Chargement..." />
        ) : dossiers.length === 0 ? (
          <EmptyState icon={<FileText className="w-6 h-6" />} title="Aucun dossier assigné" />
        ) : (
          <>
          <div className="divide-y divide-gray-100 md:hidden">
            {dossiers.map((d) => {
              const days = joursDepuis(d.date_echeance || d.date_saisie);
              return (
                <button key={d.id} type="button" onClick={() => navigate(`/dossiers/${d.id}`)} className="block w-full px-4 py-4 text-left transition active:bg-brand-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-950">{d.nom_tire}</p>
                      <p className="mt-1 truncate font-mono text-[11px] text-gray-500">{d.numero_valeur}</p>
                    </div>
                    <StatusBadge statut={d.statut} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div><span className="block text-gray-400">Montant</span><span className="font-mono font-bold text-gray-900">{formatMontant(d.montant)}</span></div>
                    <div><span className="block text-gray-400">Banque</span><span className="font-medium text-gray-700">{d.banque}</span></div>
                    <div><span className="block text-gray-400">Date facture</span><span className="font-medium text-gray-700">{d.date_facture ? formatDate(d.date_facture) : '-'}</span></div>
                    <div><span className="block text-gray-400">Retard</span><span className={cn('font-semibold', days >= 30 ? 'text-red-600' : days >= 7 ? 'text-amber-600' : 'text-gray-700')}>{days}j</span></div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="hidden md:block">
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
          </div>
          </>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>
    </div>
  );
}
