import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatDate, formatDateTime, ROLE_LABELS, cn } from '../utils';
import type { User, UserRole, BanqueRef, StatutRef, RelationRef, AuditLog } from '../types';
import { Users, Building2, Tag, BookOpen, FileText, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Card, Table, Thead, Tbody, Tr, Th, Td, Badge, Button, Input, Select, Modal,
  EmptyState, PageSpinner, PageHeader,
} from '../components/ui';

type Tab = 'users' | 'banques' | 'statuts' | 'relations' | 'audit';

const TABS: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'users', label: 'Utilisateurs', icon: Users },
  { key: 'banques', label: 'Banques', icon: Building2 },
  { key: 'statuts', label: 'Statuts', icon: Tag },
  { key: 'relations', label: 'Relations', icon: BookOpen },
  { key: 'audit', label: "Journal d'audit", icon: FileText },
];

const ROLES: UserRole[] = ['admin', 'responsable_recouvrement', 'commercial', 'lecture_seule'];

function ActifBadge({ actif }: { actif: boolean }) {
  return (
    <Badge tone={actif ? 'success' : 'neutral'} pill={false}>
      {actif ? 'Oui' : 'Non'}
    </Badge>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ nom: '', email: '', mot_de_passe: '', role: 'lecture_seule' as UserRole });
  const [userSubmitting, setUserSubmitting] = useState(false);

  const [banques, setBanques] = useState<BanqueRef[]>([]);
  const [banquesLoading, setBanquesLoading] = useState(false);
  const [banqueNom, setBanqueNom] = useState('');
  const [banqueSubmitting, setBanqueSubmitting] = useState(false);

  const [statuts, setStatuts] = useState<StatutRef[]>([]);
  const [statutsLoading, setStatutsLoading] = useState(false);
  const [showStatutForm, setShowStatutForm] = useState(false);
  const [statutForm, setStatutForm] = useState({ libelle: '', ordre: 0, couleur: '#3b82f6' });
  const [statutSubmitting, setStatutSubmitting] = useState(false);

  const [relations, setRelations] = useState<RelationRef[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationForm, setRelationForm] = useState({ code: '', libelle: '' });
  const [relationSubmitting, setRelationSubmitting] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditDateDebut, setAuditDateDebut] = useState('');
  const [auditDateFin, setAuditDateFin] = useState('');

  const loadUsers = async () => {
    try {
      setUsersLoading(true);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des utilisateurs');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadBanques = async () => {
    try {
      setBanquesLoading(true);
      const data = await api.getBanques();
      setBanques(data);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des banques');
    } finally {
      setBanquesLoading(false);
    }
  };

  const loadStatuts = async () => {
    try {
      setStatutsLoading(true);
      const data = await api.getStatuts();
      setStatuts(data);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des statuts');
    } finally {
      setStatutsLoading(false);
    }
  };

  const loadRelations = async () => {
    try {
      setRelationsLoading(true);
      const data = await api.getRelations();
      setRelations(data);
    } catch (err: any) {
      alert(err.message || 'Erreur lors du chargement des relations');
    } finally {
      setRelationsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const params: Record<string, string> = { page: String(auditPage), limit: '20' };
      if (auditDateDebut) params.date_debut = auditDateDebut;
      if (auditDateFin) params.date_fin = auditDateFin;
      const data = await api.getAuditLogs(params);
      setAuditLogs(data.logs || data);
      setAuditTotalPages(data.totalPages || 1);
    } catch (err: any) {
      alert(err.message || "Erreur lors du chargement du journal d'audit");
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'banques') loadBanques();
    if (activeTab === 'statuts') loadStatuts();
    if (activeTab === 'relations') loadRelations();
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
  }, [auditPage, auditDateDebut, auditDateFin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUserSubmitting(true);
      await api.createUser(userForm);
      setShowUserForm(false);
      setUserForm({ nom: '', email: '', mot_de_passe: '', role: 'lecture_seule' });
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la creation');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      setUserSubmitting(true);
      const payload: Record<string, unknown> = { nom: userForm.nom, email: userForm.email, role: userForm.role };
      if (userForm.mot_de_passe) payload.mot_de_passe = userForm.mot_de_passe;
      await api.updateUser(editUser.id, payload);
      setEditUser(null);
      setShowUserForm(false);
      setUserForm({ nom: '', email: '', mot_de_passe: '', role: 'lecture_seule' });
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la mise a jour');
    } finally {
      setUserSubmitting(false);
    }
  };

  const handleToggleUser = async (id: string) => {
    try {
      await api.toggleUser(id);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du basculement');
    }
  };

  const handleCreateBanque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banqueNom.trim()) return;
    try {
      setBanqueSubmitting(true);
      await api.createBanque(banqueNom.trim());
      setBanqueNom('');
      loadBanques();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la creation');
    } finally {
      setBanqueSubmitting(false);
    }
  };

  const handleDeleteBanque = async (id: number) => {
    if (!confirm('Supprimer cette banque ?')) return;
    try {
      await api.deleteBanque(id);
      loadBanques();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleCreateStatut = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setStatutSubmitting(true);
      await api.createStatut(statutForm);
      setShowStatutForm(false);
      setStatutForm({ libelle: '', ordre: 0, couleur: '#3b82f6' });
      loadStatuts();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la creation');
    } finally {
      setStatutSubmitting(false);
    }
  };

  const handleDeleteStatut = async (id: number) => {
    if (!confirm('Supprimer ce statut ?')) return;
    try {
      await api.deleteStatut(id);
      loadStatuts();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleCreateRelation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setRelationSubmitting(true);
      await api.createRelation(relationForm);
      setRelationForm({ code: '', libelle: '' });
      loadRelations();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la creation');
    } finally {
      setRelationSubmitting(false);
    }
  };

  const handleDeleteRelation = async (id: number) => {
    if (!confirm('Supprimer cette relation ?')) return;
    try {
      await api.deleteRelation(id);
      loadRelations();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression');
    }
  };

  const openEditUser = (u: User) => {
    setEditUser(u);
    setUserForm({ nom: u.nom, email: u.email, mot_de_passe: '', role: u.role });
    setShowUserForm(true);
  };

  const openNewUser = () => {
    setEditUser(null);
    setUserForm({ nom: '', email: '', mot_de_passe: '', role: 'lecture_seule' });
    setShowUserForm(true);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Administration" subtitle="Gestion des utilisateurs, référentiels et journal d'audit" />

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition',
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openNewUser}>
              <Plus className="w-4 h-4" />
              Nouvel utilisateur
            </Button>
          </div>
          <Card padding="none" className="overflow-hidden">
            {usersLoading ? (
              <PageSpinner label="Chargement..." />
            ) : users.length === 0 ? (
              <EmptyState icon={<Users className="w-6 h-6" />} title="Aucun utilisateur" />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Nom</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th align="center">Actif</Th>
                    <Th>Date</Th>
                    <Th align="center">Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {users.map((u) => (
                    <Tr key={u.id}>
                      <Td className="text-gray-900 font-medium">{u.nom}</Td>
                      <Td className="text-gray-600">{u.email}</Td>
                      <Td><Badge tone="neutral" pill={false}>{ROLE_LABELS[u.role] || u.role}</Badge></Td>
                      <Td align="center">
                        <button
                          onClick={() => handleToggleUser(u.id)}
                          className="p-1 rounded-lg transition hover:bg-gray-100"
                          title={u.actif ? 'Désactiver' : 'Activer'}
                        >
                          {u.actif ? (
                            <ToggleRight className="w-5 h-5 text-success-600" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                      </Td>
                      <Td className="text-gray-600">{formatDate(u.date_creation)}</Td>
                      <Td align="center">
                        <Button variant="secondary" size="sm" onClick={() => openEditUser(u)}>
                          Modifier
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

      {activeTab === 'banques' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateBanque} className="flex gap-2 items-start">
            <div className="flex-1">
              <Input value={banqueNom} onChange={(e) => setBanqueNom(e.target.value)} placeholder="Nom de la banque" required />
            </div>
            <Button type="submit" loading={banqueSubmitting}>
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </form>
          <Card padding="none" className="overflow-hidden">
            {banquesLoading ? (
              <PageSpinner label="Chargement..." />
            ) : banques.length === 0 ? (
              <EmptyState icon={<Building2 className="w-6 h-6" />} title="Aucune banque" />
            ) : (
              <ul className="divide-y divide-gray-100">
                {banques.map((b) => (
                  <li key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-900 font-medium">{b.nom}</span>
                      {!b.actif && <span className="text-xs text-gray-400">(inactif)</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteBanque(b.id)}
                      className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'statuts' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowStatutForm(!showStatutForm)}>
              <Plus className="w-4 h-4" />
              Nouveau statut
            </Button>
          </div>
          {showStatutForm && (
            <Card>
              <form onSubmit={handleCreateStatut} className="flex gap-3 items-end">
                <div className="flex-1">
                  <Input
                    label="Libellé"
                    value={statutForm.libelle}
                    onChange={(e) => setStatutForm({ ...statutForm, libelle: e.target.value })}
                    required
                  />
                </div>
                <div className="w-24">
                  <Input
                    label="Ordre"
                    type="number"
                    value={statutForm.ordre}
                    onChange={(e) => setStatutForm({ ...statutForm, ordre: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-24">
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Couleur</label>
                  <input
                    type="color"
                    value={statutForm.couleur}
                    onChange={(e) => setStatutForm({ ...statutForm, couleur: e.target.value })}
                    className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg cursor-pointer"
                  />
                </div>
                <Button type="submit" loading={statutSubmitting}>Ajouter</Button>
                <Button type="button" variant="ghost" onClick={() => setShowStatutForm(false)}>Annuler</Button>
              </form>
            </Card>
          )}
          <Card padding="none" className="overflow-hidden">
            {statutsLoading ? (
              <PageSpinner label="Chargement..." />
            ) : statuts.length === 0 ? (
              <EmptyState icon={<Tag className="w-6 h-6" />} title="Aucun statut" />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Libellé</Th>
                    <Th align="center">Ordre</Th>
                    <Th align="center">Couleur</Th>
                    <Th align="center">Actif</Th>
                    <Th align="center">Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {statuts.map((s) => (
                    <Tr key={s.id}>
                      <Td className="text-gray-900 font-medium">{s.libelle}</Td>
                      <Td align="center" className="text-gray-600">{s.ordre}</Td>
                      <Td align="center">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: s.couleur }} />
                          <span className="text-xs text-gray-500 font-mono">{s.couleur}</span>
                        </span>
                      </Td>
                      <Td align="center"><ActifBadge actif={s.actif} /></Td>
                      <Td align="center">
                        <button
                          onClick={() => handleDeleteStatut(s.id)}
                          className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'relations' && (
        <div className="space-y-4">
          <form onSubmit={handleCreateRelation} className="flex gap-2 items-start">
            <div className="w-32">
              <Input value={relationForm.code} onChange={(e) => setRelationForm({ ...relationForm, code: e.target.value })} placeholder="Code" required />
            </div>
            <div className="flex-1">
              <Input value={relationForm.libelle} onChange={(e) => setRelationForm({ ...relationForm, libelle: e.target.value })} placeholder="Libellé" required />
            </div>
            <Button type="submit" loading={relationSubmitting}>
              <Plus className="w-4 h-4" />
              Ajouter
            </Button>
          </form>
          <Card padding="none" className="overflow-hidden">
            {relationsLoading ? (
              <PageSpinner label="Chargement..." />
            ) : relations.length === 0 ? (
              <EmptyState icon={<BookOpen className="w-6 h-6" />} title="Aucune relation" />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Libellé</Th>
                    <Th align="center">Actif</Th>
                    <Th align="center">Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {relations.map((r) => (
                    <Tr key={r.id}>
                      <Td className="text-gray-900 font-mono font-medium">{r.code}</Td>
                      <Td className="text-gray-700">{r.libelle}</Td>
                      <Td align="center"><ActifBadge actif={r.actif} /></Td>
                      <Td align="center">
                        <button
                          onClick={() => handleDeleteRelation(r.id)}
                          className="p-1.5 text-danger-600 hover:bg-danger-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <Input
              type="date"
              label="Date debut"
              value={auditDateDebut}
              onChange={(e) => { setAuditDateDebut(e.target.value); setAuditPage(1); }}
            />
            <Input
              type="date"
              label="Date fin"
              value={auditDateFin}
              onChange={(e) => { setAuditDateFin(e.target.value); setAuditPage(1); }}
            />
            <Button
              variant="outline"
              onClick={() => { setAuditDateDebut(''); setAuditDateFin(''); setAuditPage(1); }}
            >
              Réinitialiser
            </Button>
          </div>
          <Card padding="none" className="overflow-hidden">
            {auditLoading ? (
              <PageSpinner label="Chargement..." />
            ) : auditLogs.length === 0 ? (
              <EmptyState icon={<FileText className="w-6 h-6" />} title="Aucune entrée" />
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Utilisateur</Th>
                    <Th>Action</Th>
                    <Th>Détails</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {auditLogs.map((log) => (
                    <Tr key={log.id}>
                      <Td className="text-gray-600 whitespace-nowrap">{formatDateTime(log.date_action)}</Td>
                      <Td className="text-gray-900 font-medium">{log.utilisateur_nom || '-'}</Td>
                      <Td><Badge tone="neutral" pill={false}>{log.action_type}</Badge></Td>
                      <Td className="text-gray-600 max-w-xs truncate">
                        {Object.keys(log.details_json).length > 0 ? JSON.stringify(log.details_json) : '-'}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
            {auditTotalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <p className="text-sm text-gray-500">Page {auditPage} sur {auditTotalPages}</p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                    disabled={auditPage <= 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAuditPage(Math.min(auditTotalPages, auditPage + 1))}
                    disabled={auditPage >= auditTotalPages}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      <Modal
        open={showUserForm}
        onClose={() => { setShowUserForm(false); setEditUser(null); }}
        title={editUser ? 'Modifier utilisateur' : 'Nouvel utilisateur'}
      >
        <form onSubmit={editUser ? handleUpdateUser : handleCreateUser} className="space-y-3">
          <Input
            label="Nom"
            value={userForm.nom}
            onChange={(e) => setUserForm({ ...userForm, nom: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            required
          />
          <Input
            label={`Mot de passe ${editUser ? '(laisser vide pour conserver)' : ''}`}
            type="password"
            value={userForm.mot_de_passe}
            onChange={(e) => setUserForm({ ...userForm, mot_de_passe: e.target.value })}
            {...(!editUser ? { required: true } : {})}
          />
          <Select
            label="Role"
            value={userForm.role}
            onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setShowUserForm(false); setEditUser(null); }}
            >
              Annuler
            </Button>
            <Button type="submit" loading={userSubmitting}>
              {userSubmitting ? 'Enregistrement...' : editUser ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
