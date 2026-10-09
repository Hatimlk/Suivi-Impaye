import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { formatMontant, formatDate, formatDateTime, joursDepuis, getPorteur } from '../utils';
import type { Dossier, Action } from '../types';
import { Card, Button, Select, Textarea, Input, Modal, StatusBadge, Badge, PageSpinner } from '../components/ui';
import {
  ArrowLeft, Send, Calendar, Building2, Hash, User, FileText,
  Clock, Printer, Trash2, MessageSquare, Pencil,
} from 'lucide-react';
import { STATUTS_SUIVI } from '../constants/statuts';

export default function DossierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionContent, setActionContent] = useState('');
  const [actionType, setActionType] = useState('relance');
  const [actionDeadline, setActionDeadline] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [newStatut, setNewStatut] = useState('');
  const [showStatutChange, setShowStatutChange] = useState(false);
  const [statutsRef, setStatutsRef] = useState<string[]>([...STATUTS_SUIVI]);
  const [motifChangement, setMotifChangement] = useState('');

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    banque: '',
    montant: '',
    type_valeur: 'CHQ',
    numero_valeur: '',
    nom_tire: '',
    porteur: '',
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
      porteur: dossier.porteur || getPorteur(dossier.nom_tire, dossier.relation).replace('-', ''),
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
      await api.addAction(id!, { contenu: actionContent, type_action: actionType, date_rappel: actionDeadline || null });
      setActionContent('');
      setActionType('relance');
      setActionDeadline('');
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

  const canDeleteAction = user?.role === 'admin' || user?.email === 'franck.guillet@gadimat.com';

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Supprimer cette action ? Elle sera aussi retirée du journal d\'audit.')) return;
    try {
      await api.deleteAction(id!, actionId);
      await loadDossier();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la suppression de l\'action');
    }
  };

  const handlePrint = () => window.print();

  if (loading || !dossier) {
    return <PageSpinner label="Chargement du dossier..." />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between no-print">
        <button
          onClick={() => navigate('/dossiers')}
          className="group inline-flex w-fit items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-white hover:text-gray-950"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Retour à la liste
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            Imprimer
          </Button>
        </div>
      </div>

      {/* Fiche dossier */}
      <Card padding="none" className="overflow-hidden border-gray-200/80 shadow-sm">
        <div className="border-b border-gray-200 bg-gradient-to-r from-slate-50 via-white to-brand-50/40 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600">Dossier impayé</p>
              <h1 className="break-words text-xl font-bold tracking-tight text-gray-950 sm:truncate sm:text-2xl">{dossier.nom_tire}</h1>
              <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 shadow-xs">
                <Hash className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate font-mono">{dossier.numero_valeur}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
              <StatusBadge statut={dossier.statut} />
              {user?.role !== 'lecture_seule' && (
                <Button variant="outline" size="sm" onClick={() => setShowStatutChange(!showStatutChange)}>
                  Changer
                </Button>
              )}
            </div>
          </div>
          {showStatutChange && (
            <div className="mt-4 space-y-3 rounded-xl border border-brand-100 bg-white/90 p-3 shadow-xs">
              <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center">
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
        <div className="grid grid-cols-1 gap-3 p-4 min-[420px]:grid-cols-2 sm:p-5 lg:grid-cols-5">
          <InfoField icon={Calendar} label="Date facture" value={dossier.date_facture ? formatDate(dossier.date_facture) : '-'} />
          <InfoField icon={Calendar} label="Échéance" value={dossier.date_echeance ? formatDate(dossier.date_echeance) : '-'} />
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
          <InfoField icon={User} label="Porteur" value={dossier.porteur || getPorteur(dossier.nom_tire, dossier.relation)} />
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
          <InfoField icon={Clock} label="Date d'impayé dans ERP" value={formatDate(dossier.date_saisie)} />
        </div>

        {dossier.observations && (
          <div className="px-4 pb-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Observation</p>
            <p className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 text-sm leading-6 text-gray-700">{dossier.observations}</p>
          </div>
        )}
      </Card>

      {/* Actions */}
      {user?.role !== 'lecture_seule' && (
        <Card className="no-print border-gray-200/80 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-950">Ajouter une action</h2>
              <p className="mt-0.5 text-sm text-gray-500">Consignez le suivi et programmez une date de rappel si nécessaire.</p>
            </div>
          </div>
          <form onSubmit={handleAddAction} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Type d'action" value={actionType} onChange={(e) => setActionType(e.target.value)}>
                <option value="relance">Relance</option>
                <option value="appel">Appel</option>
                <option value="email">Email</option>
                <option value="visite">Visite</option>
                <option value="note">Note interne</option>
                <option value="autre">Autre</option>
              </Select>
              <Input
                label="Date limite (optionnelle)"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={actionDeadline}
                onChange={(e) => setActionDeadline(e.target.value)}
              />
            </div>
            <Textarea
              label="Compte rendu"
              value={actionContent}
              onChange={(e) => setActionContent(e.target.value)}
              rows={4}
              placeholder="Décrivez l'action effectuée..."
              required
            />
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <Button type="submit" loading={actionLoading} disabled={!actionContent.trim()}>
                <Send className="w-4 h-4" />
                {actionLoading ? 'Envoi...' : "Enregistrer l'action"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Historique des actions */}
      <Card padding="none" className="overflow-hidden border-gray-200/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/70 px-5 py-4">
          <h2 className="font-semibold text-gray-950">
            Historique des actions
          </h2>
          <Badge tone="neutral">{dossier.actions?.length || 0}</Badge>
        </div>
        {!dossier.actions || dossier.actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <p className="font-medium text-gray-800">Aucune action enregistrée</p>
            <p className="mt-1 text-sm text-gray-500">La première action apparaîtra ici.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dossier.actions.map((action: Action) => (
              <div key={action.id} className="p-5 transition hover:bg-slate-50/70">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xs font-bold text-brand-700">
                    {action.auteur_nom?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{action.auteur_nom || 'Inconnu'}</span>
                      <Badge tone="neutral" pill={false}>{action.type_action}</Badge>
                      <span className="text-xs text-gray-400">{formatDateTime(action.date_action)}</span>
                      {action.date_rappel && (
                        <Badge tone={new Date(action.date_rappel) < new Date(new Date().toISOString().slice(0, 10)) ? 'danger' : 'warning'} pill={false}>
                          Rappel : {formatDate(action.date_rappel)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">{action.contenu}</p>
                  </div>
                  {canDeleteAction && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAction(action.id)}
                      className="flex-shrink-0 rounded-md p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Supprimer cette action"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal modification dossier */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier le dossier">
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="sm:col-span-2">
              <Input
                label="Partenaire *"
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
            <Input
              label="Porteur"
              value={editForm.porteur}
              onChange={(e) => setEditForm({ ...editForm, porteur: e.target.value })}
              placeholder="Ex. LAABIDI"
            />
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
            <div className="sm:col-span-2">
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
            <div className="sm:col-span-2">
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
    <div className="flex min-h-[72px] items-start gap-3 rounded-xl border border-gray-100 bg-slate-50/60 p-3 transition-colors hover:border-gray-200 hover:bg-white">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-400 shadow-xs ring-1 ring-gray-100">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className={bold ? 'mt-0.5 break-words text-sm font-bold text-gray-950' : 'mt-0.5 break-words text-sm font-semibold text-gray-800'}>{value}</p>
      </div>
    </div>
  );
}
