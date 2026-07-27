import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatMontant, formatDate } from '../utils';
import type { Dossier } from '../types';
import {
  Gavel, Search, Filter, X, Eye, Scale, CheckCircle2,
} from 'lucide-react';
import {
  Card, Table, Thead, Tbody, Tr, Th, Td, Badge, StatusBadge, Button, Input, Select,
  Textarea, Modal, Pagination, EmptyState, PageSpinner, PageHeader,
} from '../components/ui';

const STATUTS_DECISION = [
  'Régularisé - OK',
  'Sans suite',
  'Représenté',
  'Règlement à recevoir',
  'Règlement à récupérer',
  'Règlement partiel',
  'Valeur à remplacer',
  "Valeur envoyée à l'encaissement",
  'A rendre au client',
  'Contentieux',
];

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
    setPage(1);
  };

  const hasFilters = Object.keys(filters).length > 0 || search.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-brand-600" />
            Dérogation des dossiers
          </span>
        }
        subtitle="Décision finale sur les dossiers — la charge reste chez le commercial"
      />

      <Card padding="sm">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
          </Button>
          {hasFilters && (
            <Button variant="danger" onClick={clearFilters}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-100">
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

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <PageSpinner label="Chargement des dossiers..." />
        ) : dossiers.length === 0 ? (
          <EmptyState title="Aucun dossier trouvé" />
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>Date</Th>
                <Th>Banque</Th>
                <Th align="right">Montant</Th>
                <Th>Val</Th>
                <Th>N Valeur</Th>
                <Th>Nom du tiré</Th>
                <Th>Commercial</Th>
                <Th>Statut</Th>
                <Th align="center">Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {dossiers.map((d) => (
                <Tr key={d.id}>
                  <Td>{formatDate(d.date_saisie)}</Td>
                  <Td className="font-medium">{d.banque}</Td>
                  <Td align="right" className="font-mono">{formatMontant(d.montant)}</Td>
                  <Td>
                    <Badge tone="brand" pill={false} className={d.type_valeur === 'LCN' ? 'bg-violet-100 text-violet-700' : ''}>
                      {d.type_valeur}
                    </Badge>
                  </Td>
                  <Td className="font-mono text-xs">{d.numero_valeur}</Td>
                  <Td className="text-gray-900 font-medium max-w-[180px] truncate">{d.nom_tire}</Td>
                  <Td className="text-gray-600 max-w-[120px] truncate">{d.commercial_nom || '-'}</Td>
                  <Td><StatusBadge statut={d.statut} /></Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigate(`/dossiers/${d.id}`)}
                        className="p-1.5 hover:bg-brand-50 rounded-lg transition text-brand-600"
                        title="Voir le dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDecision(d)}
                        className="p-1.5 hover:bg-brand-50 rounded-lg transition text-brand-600"
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
            <div className="bg-gray-50 rounded-lg p-3">
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
