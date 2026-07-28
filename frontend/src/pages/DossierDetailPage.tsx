import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatMontant, formatDate, formatDateTime, joursDepuis } from '../utils';
import type { Dossier, Action } from '../types';
import { Card, Button, Select, Textarea, Input, Modal, StatusBadge, Badge, PageSpinner, EmptyState } from '../components/ui';
import {
  ArrowLeft, Send, Calendar, Building2, Hash, User, FileText,
  Clock, Printer, Trash2, MessageSquare, Pencil,
} from 'lucide-react';

export default function DossierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionContent, setActionContent] = useState('');
  const [actionType, setActionType] = useState('relance');
  const [actionLoading, setActionLoading] = useState(false);
  const [newStatut, setNewStatut] = useState('');
  const [showStatutChange, setShowStatutChange] = useState(false);
  const [statutsRef, setStatutsRef] = useState<string[]>([]);
  const [motifChangement, setMotifChangement] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    banque: '',
    montant: '',
    type_valeur: 'CHQ',
    numero_valeur: '',
    nom_tire: '',
    relation: 'CD',
    observations: '',
    statut: '',
    commercial_id: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [banques, setBanques] = useState<string[]>([]);
  const [commerciaux, setCommerciaux] = useState<{ id: string; nom: string }[]>([]);

  const loadDossier = async () => {
    try {
      const data = await api.getDossier(id!);
      setDossier(data);
      setNewStatut(data.statut);
    } catch (err) {
      console.error(err);
      navigate('/dossiers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDossier();
    api.getStatuts().then((s) => setStatutsRef(s.map((x: any) => x.libelle))).catch(() => {});
    api.getBanques().then((b) => setBanques(b.map((x: any) => x.nom))).catch(() => {});
    api.getUsers().then((u) => setCommerciaux(u.filter((x: any) => x.role === 'commercial' && x.actif))).catch(() => {});
  }, [id]);

  const openEditModal = () => {
    if (!dossier) return;
    setEditForm({
      banque: dossier.banque,
      montant: String(dossier.montant),
      type_valeur: dossier.type_valeur,
      numero_valeur: dossier.numero_valeur,
      nom_tire: dossier.nom_tire,
      relation: dossier.relation,
      observations: dossier.observations || '',
      statut: dossier.statut,
      commercial_id: dossier.commercial_id || '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditLoading(true);
      await api.updateDossier(id!, {
        ...editForm,
        montant: parseFloat(editForm.montant),
        commercial_id: editForm.commercial_id || null,
      });
      setShowEditModal(false);
      await loadDossier();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la modification du dossier');
    } finally {
      setEditLoading(false);
    }
  };

  const handleAddAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionContent.trim()) return;
    try {
      setActionLoading(true);
      await api.addAction(id!, { contenu: actionContent, type_action: actionType });
      setActionContent('');
      setActionType('relance');
      await loadDossier();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeStatut = async () => {
    if (!newStatut || newStatut === dossier?.statut) {
      setShowStatutChange(false);
      return;
    }
    try {
      await api.updateStatut(id!, newStatut);
      const ancien = dossier?.statut || '';
      await api.addAction(id!, {
        contenu: motifChangement.trim()
          ? `[CHANGEMENT STATUT] ${ancien} → ${newStatut}\n${motifChangement.trim()}`
          : `[CHANGEMENT STATUT] ${ancien} → ${newStatut}`,
        type_action: 'modification_statut',
      });
      setShowStatutChange(false);
      setMotifChangement('');
      await loadDossier();
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer ce dossier ? Cette action est irreversible.')) return;
    try {
      await api.deleteDossier(id!);
      navigate('/dossiers');
    } catch (err: any) {
      alert(err.message || 'Erreur');
    }
  };

  const handlePrint = () => window.print();

  if (loading || !dossier) {
    return <PageSpinner label="Chargement du dossier..." />;
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <button
          onClick={() => navigate('/dossiers')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          {user?.role !== 'lecture_seule' && (
            <Button variant="outline" onClick={openEditModal}>
              <Pencil className="w-4 h-4" />
              Modifier
            </Button>
          )}
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
          {(user?.role === 'admin' || user?.role === 'responsable_recouvrement') && (
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="w-4 h-4" />
              Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Fiche dossier */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{dossier.nom_tire}</h1>
              <p className="text-sm text-gray-500 mt-1">N° {dossier.numero_valeur}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge statut={dossier.statut} />
              {user?.role !== 'lecture_seule' && (
                <Button variant="outline" size="sm" onClick={() => setShowStatutChange(!showStatutChange)}>
                  Changer
                </Button>
              )}
            </div>
          </div>
          {showStatutChange && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={newStatut} onChange={(e) => setNewStatut(e.target.value)}>
                    {statutsRef.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </Select>
                </div>
                <Button onClick={handleChangeStatut} disabled={newStatut === dossier?.statut}>
                  Appliquer
                </Button>
              </div>
              <Textarea
                value={motifChangement}
                onChange={(e) => setMotifChangement(e.target.value)}
                rows={2}
                placeholder="Motif du changement de statut (optionnel)"
              />
            </div>
          )}
        </div>

        {/* Infos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
          <InfoField icon={Calendar} label="Date de saisie" value={formatDate(dossier.date_saisie)} />
          <InfoField icon={Building2} label="Banque" value={dossier.banque} />
          <InfoField icon={Hash} label="Montant" value={formatMontant(dossier.montant)} bold />
          <InfoField
            icon={FileText}
            label="Type"
            value={dossier.type_valeur === 'CHQ' ? 'Chèque' : 'Lettre de change'}
          />
          <InfoField
            icon={User}
            label="Relation"
            value={dossier.relation === 'CD' ? 'Client Direct' : 'Client de Client'}
          />
          <InfoField icon={User} label="Commercial" value={dossier.commercial_nom || '-'} />
          <InfoField
            icon={Clock}
            label="Dernière action"
            value={
              dossier.date_derniere_action
                ? `${formatDate(dossier.date_derniere_action)} (${joursDepuis(dossier.date_derniere_action)}j)`
                : 'Aucune'
            }
          />
          <InfoField icon={Clock} label="Créé le" value={formatDate(dossier.date_creation)} />
        </div>

        {dossier.observations && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 mb-1">Observations</p>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{dossier.observations}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      {user?.role !== 'lecture_seule' && (
        <Card className="no-print">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Ajouter une action</h2>
          <form onSubmit={handleAddAction} className="space-y-3">
            <div className="max-w-xs">
              <Select value={actionType} onChange={(e) => setActionType(e.target.value)}>
                <option value="relance">Relance</option>
                <option value="appel">Appel</option>
                <option value="email">Email</option>
                <option value="visite">Visite</option>
                <option value="note">Note interne</option>
                <option value="autre">Autre</option>
              </Select>
            </div>
            <Textarea
              value={actionContent}
              onChange={(e) => setActionContent(e.target.value)}
              rows={3}
              placeholder="Décrivez l'action effectuée..."
              required
            />
            <Button type="submit" loading={actionLoading} disabled={!actionContent.trim()}>
              <Send className="w-4 h-4" />
              {actionLoading ? 'Envoi...' : "Enregistrer l'action"}
            </Button>
          </form>
        </Card>
      )}

      {/* Historique des actions */}
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Historique des actions ({dossier.actions?.length || 0})
          </h2>
        </div>
        {!dossier.actions || dossier.actions.length === 0 ? (
          <EmptyState icon={<MessageSquare className="w-6 h-6" />} title="Aucune action enregistrée" />
        ) : (
          <div className="divide-y divide-gray-100">
            {dossier.actions.map((action: Action) => (
              <div key={action.id} className="p-4 hover:bg-gray-50 transition">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                    {action.auteur_nom?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{action.auteur_nom || 'Inconnu'}</span>
                      <Badge tone="neutral" pill={false}>{action.type_action}</Badge>
                      <span className="text-xs text-gray-400">{formatDateTime(action.date_action)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{action.contenu}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal modification dossier */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier le dossier">
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Banque *"
              value={editForm.banque}
              onChange={(e) => setEditForm({ ...editForm, banque: e.target.value })}
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
              value={editForm.montant}
              onChange={(e) => setEditForm({ ...editForm, montant: e.target.value })}
              required
            />
            <Select
              label="Type de valeur *"
              value={editForm.type_valeur}
              onChange={(e) => setEditForm({ ...editForm, type_valeur: e.target.value })}
            >
              <option value="CHQ">Chèque (CHQ)</option>
              <option value="LCN">Lettre de change (LCN)</option>
            </Select>
            <Input
              label="N° Valeur *"
              value={editForm.numero_valeur}
              onChange={(e) => setEditForm({ ...editForm, numero_valeur: e.target.value })}
              required
            />
            <div className="col-span-2">
              <Input
                label="Nom du tiré *"
                value={editForm.nom_tire}
                onChange={(e) => setEditForm({ ...editForm, nom_tire: e.target.value })}
                required
              />
            </div>
            <Select
              label="Relation"
              value={editForm.relation}
              onChange={(e) => setEditForm({ ...editForm, relation: e.target.value })}
            >
              <option value="CD">Client Direct (CD)</option>
              <option value="CDC">Client de Client (CDC)</option>
            </Select>
            <Select
              label="Commercial"
              value={editForm.commercial_id}
              onChange={(e) => setEditForm({ ...editForm, commercial_id: e.target.value })}
            >
              <option value="">-- Non assigné --</option>
              {commerciaux.map((c) => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </Select>
            <div className="col-span-2">
              <Select
                label="Statut"
                value={editForm.statut}
                onChange={(e) => setEditForm({ ...editForm, statut: e.target.value })}
              >
                {statutsRef.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </div>
            <div className="col-span-2">
              <Textarea
                label="Observations"
                value={editForm.observations}
                onChange={(e) => setEditForm({ ...editForm, observations: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={editLoading}>
              {editLoading ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoField({
  icon: Icon,
  label,
  value,
  bold,
}: {
  icon: typeof Calendar;
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={bold ? 'text-sm font-bold text-gray-900' : 'text-sm font-medium text-gray-900'}>{value}</p>
      </div>
    </div>
  );
}
