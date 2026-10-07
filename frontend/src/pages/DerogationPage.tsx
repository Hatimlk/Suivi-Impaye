import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatMontant, formatDate } from '../utils';
import type { Dossier } from '../types';
import {
  Gavel, Search, Filter, X, Eye, Scale, CheckCircle2, WalletCards, CircleDollarSign,
} from 'lucide-react';
import {
  Card, Table, Thead, Tbody, Tr, Th, Td, Badge, StatusBadge, Button, Input, Select,
  Textarea, Modal, Pagination, EmptyState, PageSpinner, PageHeader,
} from '../components/ui';
import { STATUTS_SUIVI } from '../constants/statuts';

const STATUTS_DECISION = [...STATUTS_SUIVI];

export default function DerogationPage() {
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [commerciaux, setCommerciaux] = useState<{ id: string; nom: string }[]>([]);
  const [banques, setBanques] = useState<string[]>([]);
  const [statuts, setStatuts] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  const [decisionDossier, setDecisionDossier] = useState<Dossier | null>(null);
  const [newStatut, setNewStatut] = useState('');
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getUsers().catch(() => []),
      api.getBanques().catch(() => []),
      api.getStatuts().catch(() => []),
    ]).then(([users, b, s]) => {
      setCommerciaux(users.filter((u: any) => u.role === 'commercial' && u.actif));
      setBanques(b.map((x: any) => x.nom));
      setStatuts(s.map((x: any) => x.libelle));
    });
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        page: String(page),
        limit: '20',
        search,
        ...filters,
      };
      const res = await api.getDossiers(params);
      setDossiers(res.dossiers);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const openDecision = (d: Dossier) => {
    setDecisionDossier(d);
    setNewStatut(d.statut);
    setDecisionNote('');
  };

  const handleDecision = async () => {
    if (!decisionDossier || !newStatut || !decisionNote.trim()) return;
    try {
      setDecisionLoading(true);

      if (newStatut !== decisionDossier.statut) {
        await api.updateStatut(decisionDossier.id, newStatut);
      }

      await api.addAction(decisionDossier.id, {
        contenu: `[DEROGATION] ${decisionNote.trim()}`,
        type_action: 'derogation',
      });

      setDecisionDossier(null);
      setNewStatut('');
      setDecisionNote('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la decision');
    } finally {
      setDecisionLoading(false);
    }
  };

  const setFilter = (key: string, value: string) => {
    const next = { ...filters };
    if (value) next[key] = value;
    else delete next[key];
    setFilters(next);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({});
    setSearch('');
    setSearchInput('');
    setPage(1);
  };

  const hasFilters = Object.keys(filters).length > 0 || search.length > 0;
  const activeFilterCount = Object.keys(filters).length + (search ? 1 : 0);
  const visibleAmount = dossiers.reduce((sum, dossier) => sum + Number(dossier.montant || 0), 0);

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-600" />
            Dérogation des dossiers
          </span>
        }
        subtitle="Décision finale sur les dossiers — la charge reste chez le commercial"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DecisionSummary icon={WalletCards} label="Dossiers à examiner" value={String(total)} tone="brand" />
        <DecisionSummary icon={CircleDollarSign} label="Montant sur cette page" value={formatMontant(visibleAmount)} tone="success" />
        <DecisionSummary icon={Filter} label="Filtres actifs" value={String(activeFilterCount)} tone="warning" />
      </div>

      <Card padding="sm" className="border-gray-200/80 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher par nom, numero, banque..."
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button
            variant={showFilters ? 'secondary' : 'outline'}
            className={showFilters ? 'bg-brand-50 text-brand-700' : ''}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 && <Badge tone="brand">{activeFilterCount}</Badge>}
          </Button>
          {hasFilters && (
            <Button variant="danger" onClick={clearFilters}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
            <Select label="Banque" value={filters.banque || ''} onChange={(e) => setFilter('banque', e.target.value)}>
              <option value="">Toutes les banques</option>
              {banques.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Select label="Statut" value={filters.statut || ''} onChange={(e) => setFilter('statut', e.target.value)}>
              <option value="">Tous les statuts</option>
              {statuts.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Select label="Type" value={filters.type_valeur || ''} onChange={(e) => setFilter('type_valeur', e.target.value)}>
              <option value="">Tous</option>
              <option value="CHQ">Cheque</option>
              <option value="LCN">Lettre de change</option>
            </Select>
            <Select
              label="Commercial"
              value={filters.commercial_id || ''}
              onChange={(e) => setFilter('commercial_id', e.target.value)}
            >
              <option value="">Tous les commerciaux</option>
              {commerciaux.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </Select>
          </div>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/70 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-950">Dossiers soumis à décision</h2>
            <p className="text-xs text-gray-500">{total} dossier(s)</p>
          </div>
          {hasFilters && <button onClick={clearFilters} className="text-xs font-medium text-brand-600">Réinitialiser</button>}
        </div>
        {loading ? (
          <PageSpinner label="Chargement des dossiers..." />
        ) : dossiers.length === 0 ? (
          <EmptyState title="Aucun dossier trouvé" />
        ) : (
          <Table>
            <Thead className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur">
              <tr>
                <Th>Date de facture</Th>
                <Th>Banque</Th>
                <Th align="right">Montant</Th>
                <Th>Val</Th>
                <Th>N Valeur</Th>
                <Th>Partenaire</Th>
                <Th>Commercial</Th>
                <Th>Statut</Th>
                <Th align="center">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {dossiers.map((d) => (
                <Tr
                  key={d.id}
                  role="link"
                  tabIndex={0}
                  aria-label={`Ouvrir le dossier ${d.numero_valeur}`}
                  className="group cursor-pointer focus:outline-none hover:bg-brand-50/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                  onClick={() => navigate(`/dossiers/${d.id}`)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/dossiers/${d.id}`);
                    }
                  }}
                >
                  <Td>{d.date_facture ? formatDate(d.date_facture) : '-'}</Td>
                  <Td className="font-medium">{d.banque}</Td>
                  <Td align="right" className="font-mono">{formatMontant(d.montant)}</Td>
                  <Td>
                    <Badge tone="brand" pill={false} className={d.type_valeur === 'LCN' ? 'bg-violet-100 text-violet-700' : ''}>
                      {d.type_valeur}
                    </Badge>
                  </Td>
                  <Td className="font-mono text-xs">{d.numero_valeur}</Td>
                  <Td className="max-w-[200px] truncate font-semibold text-gray-950 group-hover:text-brand-700">{d.nom_tire}</Td>
                  <Td className="text-gray-600 max-w-[120px] truncate">{d.commercial_nom || '-'}</Td>
                  <Td><StatusBadge statut={d.statut} /></Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          navigate(`/dossiers/${d.id}`);
                        }}
                        className="rounded-lg border border-transparent p-1.5 text-brand-600 transition hover:border-brand-100 hover:bg-white hover:shadow-xs"
                        title="Voir le dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openDecision(d);
                        }}
                        className="rounded-lg border border-transparent p-1.5 text-brand-600 transition hover:border-brand-100 hover:bg-white hover:shadow-xs"
                        title="Prendre une décision (dérogation)"
                      >
                        <Gavel className="w-4 h-4" />
                      </button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      <Modal
        open={!!decisionDossier}
        onClose={() => setDecisionDossier(null)}
        title="Décision dérogation"
      >
        {decisionDossier && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Dossier:</span>
                  <p className="font-medium text-gray-900">{decisionDossier.numero_valeur}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tiré:</span>
                  <p className="font-medium text-gray-900">{decisionDossier.nom_tire}</p>
                </div>
                <div>
                  <span className="text-gray-500">Banque:</span>
                  <p className="font-medium text-gray-900">{decisionDossier.banque}</p>
                </div>
                <div>
                  <span className="text-gray-500">Montant:</span>
                  <p className="font-bold text-gray-900">{formatMontant(decisionDossier.montant)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Commercial:</span>
                  <p className="font-medium text-gray-900">{decisionDossier.commercial_nom || '-'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Statut actuel:</span>
                  <p className="font-medium text-gray-900">{decisionDossier.statut}</p>
                </div>
              </div>
            </div>

            <Select
              label="Nouveau statut (décision finale)"
              value={newStatut}
              onChange={(e) => setNewStatut(e.target.value)}
            >
              {STATUTS_DECISION.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>

            <div>
              <Textarea
                label="Motif de la dérogation *"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                rows={4}
                placeholder="Décrivez la raison de cette décision finale..."
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Cette action sera enregistrée comme action de type "dérogation" sur le dossier
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDecisionDossier(null)}>
                Annuler
              </Button>
              <Button onClick={handleDecision} loading={decisionLoading} disabled={!decisionNote.trim()}>
                <CheckCircle2 className="w-4 h-4" />
                {decisionLoading ? 'Enregistrement...' : 'Valider la décision'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DecisionSummary({ icon: Icon, label, value, tone }: {
  icon: typeof Scale;
  label: string;
  value: string;
  tone: 'brand' | 'success' | 'warning';
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-100',
    success: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    warning: 'bg-amber-50 text-amber-600 ring-amber-100',
  };
  return (
    <Card className="flex items-center gap-3 border-gray-200/80 py-4 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-gray-950">{value}</p>
      </div>
    </Card>
  );
}
