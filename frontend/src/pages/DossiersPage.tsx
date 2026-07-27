import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatMontant, formatDate, joursDepuis, cn } from '../utils';
import type { Dossier } from '../types';
import {
  Card, Table, Thead, Tbody, Tr, Th, Td, Badge, StatusBadge, Button, Input, Select,
  Textarea, Modal, Pagination, EmptyState, PageSpinner, PageHeader,
} from '../components/ui';
import {
  Search, Plus, Filter, Download, Eye, Pencil, X, ArrowUpDown, FolderOpen, Upload,
} from 'lucide-react';

const EMPTY_FORM = {
  banque: '', montant: '', type_valeur: 'CHQ', numero_valeur: '',
  nom_tire: '', relation: 'CD', observations: '', statut: 'Attente retour du client',
};

export default function DossiersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');

  const [commerciaux, setCommerciaux] = useState<{ id: string; nom: string }[]>([]);
  const [banques, setBanques] = useState<string[]>([]);
  const [statuts, setStatuts] = useState<string[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editDossier, setEditDossier] = useState<Dossier | null>(null);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createLoading, setCreateLoading] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        limit: '15',
        search,
        sort: 'date_saisie',
        order: sortOrder,
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
  }, [page, search, filters, sortOrder]);

  useEffect(() => { loadData(); }, [loadData]);

  const openNewDossier = () => {
    setEditDossier(null);
    setCreateForm({ ...EMPTY_FORM, statut: statuts[0] || EMPTY_FORM.statut });
    setShowForm(true);
  };

  const openEditDossier = (d: Dossier) => {
    setEditDossier(d);
    setCreateForm({
      banque: d.banque,
      montant: String(d.montant),
      type_valeur: d.type_valeur,
      numero_valeur: d.numero_valeur,
      nom_tire: d.nom_tire,
      relation: d.relation,
      observations: d.observations || '',
      statut: d.statut,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditDossier(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      const payload = { ...createForm, montant: parseFloat(createForm.montant) };
      if (editDossier) {
        await api.updateDossier(editDossier.id, payload);
      } else {
        await api.createDossier(payload);
      }
      closeForm();
      setCreateForm(EMPTY_FORM);
      loadData();
    } catch (err: any) {
      alert(err.message || (editDossier ? 'Erreur de modification' : 'Erreur de creation'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportExcel({ ...filters, search });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'impayes_export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Erreur export');
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      setImportLoading(true);
      setImportResult(null);
      const result = await api.importExcel(importFile);
      setImportResult(result);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      loadData();
    } catch (err: any) {
      alert(err.message || "Erreur lors de l'import");
    } finally {
      setImportLoading(false);
    }
  };

  const openImport = () => {
    setImportResult(null);
    setImportFile(null);
    setShowImport(true);
  };

  const closeImport = () => {
    setShowImport(false);
    setImportResult(null);
    setImportFile(null);
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
        title="Dossiers Impayés"
        subtitle={`${total} dossier(s) au total`}
        actions={
          <>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
            {user?.role !== 'lecture_seule' && (
              <>
                <Button variant="outline" onClick={openImport}>
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Importer</span>
                </Button>
                <Button onClick={openNewDossier}>
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nouveau dossier</span>
                </Button>
              </>
            )}
          </>
        }
      />

      <Card padding="sm">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              name="search"
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
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === 'DESC' ? 'ASC' : 'DESC')}
            title="Trier par date"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">Date {sortOrder === 'DESC' ? '↓' : '↑'}</span>
          </Button>
          {hasFilters && (
            <Button variant="danger" onClick={clearFilters}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
            <Select
              label="Commercial"
              value={filters.commercial_id || ''}
              onChange={(e) => setFilter('commercial_id', e.target.value)}
            >
              <option value="">Tous les commerciaux</option>
              {commerciaux.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </Select>
            <Select
              label="Statut"
              value={filters.statut || ''}
              onChange={(e) => setFilter('statut', e.target.value)}
            >
              <option value="">Tous les statuts</option>
              {statuts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Select
              label="Banque"
              value={filters.banque || ''}
              onChange={(e) => setFilter('banque', e.target.value)}
            >
              <option value="">Toutes les banques</option>
              {banques.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
          </div>
        )}

        {hasFilters && (
          <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
            {filters.commercial_id && (
              <Badge tone="brand">
                Commercial: {commerciaux.find((c) => c.id === filters.commercial_id)?.nom}
                <button onClick={() => setFilter('commercial_id', '')} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {filters.statut && (
              <Badge tone="info">
                Statut: {filters.statut}
                <button onClick={() => setFilter('statut', '')} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {filters.banque && (
              <Badge tone="success">
                Banque: {filters.banque}
                <button onClick={() => setFilter('banque', '')} className="hover:opacity-70">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        {loading ? (
          <PageSpinner label="Chargement des dossiers..." />
        ) : dossiers.length === 0 ? (
          <EmptyState icon={<FolderOpen className="w-6 h-6" />} title="Aucun dossier trouvé" />
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
                <Th>Relation</Th>
                <Th>Commercial</Th>
                <Th>Statut</Th>
                <Th align="center">Jours</Th>
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
                    <Badge
                      tone="brand"
                      pill={false}
                      className={d.type_valeur === 'LCN' ? 'bg-violet-100 text-violet-700' : ''}
                    >
                      {d.type_valeur}
                    </Badge>
                  </Td>
                  <Td className="font-mono text-xs">{d.numero_valeur}</Td>
                  <Td className="text-gray-900 font-medium max-w-[200px] truncate">{d.nom_tire}</Td>
                  <Td className="text-gray-600">{d.relation === 'CD' ? 'CD' : 'CDC'}</Td>
                  <Td className="text-gray-600 max-w-[150px] truncate">{d.commercial_nom || '-'}</Td>
                  <Td><StatusBadge statut={d.statut} /></Td>
                  <Td align="center">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        joursDepuis(d.date_derniere_action) > 7 ? 'text-danger-600' : 'text-gray-600'
                      )}
                    >
                      {joursDepuis(d.date_derniere_action || d.date_creation)}
                    </span>
                  </Td>
                  <Td align="center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => navigate(`/dossiers/${d.id}`)}
                        className="p-1.5 hover:bg-brand-50 rounded-lg transition text-brand-600"
                        title="Voir le dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {user?.role !== 'lecture_seule' && (
                        <button
                          onClick={() => openEditDossier(d)}
                          className="p-1.5 hover:bg-brand-50 rounded-lg transition text-brand-600"
                          title="Modifier le dossier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      <Modal open={showForm} onClose={closeForm} title={editDossier ? 'Modifier le dossier' : 'Nouveau dossier'}>
        <form onSubmit={handleSubmitForm} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Banque *"
              value={createForm.banque}
              onChange={(e) => setCreateForm({ ...createForm, banque: e.target.value })}
              required
            >
              <option value="">-- Choisir --</option>
              {banques.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
            <Input
              label="Montant *"
              type="number"
              step="0.01"
              value={createForm.montant}
              onChange={(e) => setCreateForm({ ...createForm, montant: e.target.value })}
              required
            />
            <Select
              label="Type de valeur *"
              value={createForm.type_valeur}
              onChange={(e) => setCreateForm({ ...createForm, type_valeur: e.target.value })}
            >
              <option value="CHQ">Cheque (CHQ)</option>
              <option value="LCN">Lettre de change (LCN)</option>
            </Select>
            <Input
              label="N Valeur *"
              value={createForm.numero_valeur}
              onChange={(e) => setCreateForm({ ...createForm, numero_valeur: e.target.value })}
              required
            />
            <div className="col-span-2">
              <Input
                label="Nom du tiré *"
                value={createForm.nom_tire}
                onChange={(e) => setCreateForm({ ...createForm, nom_tire: e.target.value })}
                required
              />
            </div>
            <Select
              label="Relation"
              value={createForm.relation}
              onChange={(e) => setCreateForm({ ...createForm, relation: e.target.value })}
            >
              <option value="CD">Client Direct (CD)</option>
              <option value="CDC">Client de Client (CDC)</option>
            </Select>
            <Select
              label="Statut"
              value={createForm.statut}
              onChange={(e) => setCreateForm({ ...createForm, statut: e.target.value })}
            >
              {statuts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <div className="col-span-2">
              <Textarea
                label="Observations"
                value={createForm.observations}
                onChange={(e) => setCreateForm({ ...createForm, observations: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeForm}>
              Annuler
            </Button>
            <Button type="submit" loading={createLoading}>
              {createLoading
                ? (editDossier ? 'Enregistrement...' : 'Creation...')
                : (editDossier ? 'Enregistrer' : 'Créer le dossier')}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal open={showImport} onClose={closeImport} title="Importer un fichier Excel">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Sélectionnez un fichier Excel (.xlsx, .xls) contenant les dossiers à importer.
            Les colonnes acceptées: Date, BQ, Mt, Val, N Val, Nom du tire, Relation, Com, Statut, etc.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer"
          />
          {importResult && (
            <div className={cn(
              'rounded-lg p-4 text-sm',
              importResult.errors > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-success-50 border border-success-200'
            )}>
              <p className="font-semibold mb-1">{importResult.message}</p>
              <div className="text-gray-600 space-y-1">
                <p>Total lignes : {importResult.total}</p>
                <p>Importés : {importResult.imported}</p>
                <p>Ignorés (doublons/vides) : {importResult.skipped}</p>
                {importResult.errors > 0 && <p>Erreurs : {importResult.errors}</p>}
              </div>
              {importResult.details?.skipped?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                    Voir les lignes ignorées
                  </summary>
                  <div className="mt-1 max-h-40 overflow-y-auto text-xs text-gray-500">
                    {importResult.details.skipped.map((s: any, i: number) => (
                      <p key={i}>Ligne {s.ligne}: {s.numero_valeur ? `${s.numero_valeur} - ` : ''}{s.raison}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={closeImport}>Fermer</Button>
            <Button onClick={handleImport} loading={importLoading} disabled={!importFile || importLoading}>
              <Upload className="w-4 h-4" />
              {importLoading ? 'Import en cours...' : 'Importer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
