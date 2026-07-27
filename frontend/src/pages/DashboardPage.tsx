import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { formatMontant, formatDate, cn } from '../utils';
import { CATEGORICAL, SEQUENTIAL_BLUE, CHART_INK } from '../utils/chartColors';
import type { DashboardStats, Dossier } from '../types';
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  FolderOpen, TrendingUp, AlertTriangle, Clock, Download, Plus,
  FileText, CheckCircle2, Copy, Check, Search, ArrowRight,
  CreditCard, Calendar as CalendarIcon, ShieldCheck, ChevronRight, User,
  ChevronLeft, X, BellRing, Info
} from 'lucide-react';
import {
  Card, Table, Thead, Tbody, Tr, Th, Td, Badge, StatusBadge, Button, Input, PageSpinner, EmptyState, ChartTooltip
} from '../components/ui';

function formatKAxis(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

const axisTick = { fontSize: 11, fill: CHART_INK.secondary };
const valueAxisTick = { fontSize: 12, fill: CHART_INK.muted };

// Mini SVG Circular Gauge Component inspired by Weight Widget in reference UI
function ProgressGauge({ value = 100, label = 'Taux de Régularisation', subtext = 'Total encaissements' }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="text-gray-100"
            strokeWidth="10"
            stroke="currentColor"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="text-brand-600 transition-all duration-1000 ease-out"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold text-gray-900 tracking-tight">{value}%</span>
          <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Objectif OK</span>
        </div>
      </div>
      <div className="text-center mt-3">
        <p className="text-xs font-semibold text-gray-800">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}

// Map of scheduled events by YYYY-MM-DD
const EVENTS_MAP: Record<string, Array<{ title: string; detail: string; amount?: string; type: string }>> = {
  '2026-01-08': [
    { title: 'Saisie Impayé HAJAR BOIS', detail: 'Effet impayé 107 479,13 DH - Action: A voir avec FAHD', amount: '107 479,13 DH', type: 'LCN' },
  ],
  '2026-01-26': [
    { title: 'Réception & Saisie des Impayés', detail: '18 dossiers enregistrés (BMCI, BP, CAM, AWB, BMCE)', amount: '769 686,14 DH', type: 'GLOBAL' },
  ],
  '2026-02-16': [
    { title: 'Virement STE DISAMA', detail: 'Action Lahcen: Vir reçu 50 000 / vir 20k le 16/02', amount: '20 000,00 DH', type: 'CHQ' },
  ],
  '2026-02-18': [
    { title: 'Déplacement & Récupération FAHD', detail: 'AIT LAASRI IDDER - Contre Espèces / Déplacement Fahd', amount: '5 000,00 DH', type: 'LCN' },
  ],
  '2026-02-19': [
    { title: 'Représentation STE MEDIA WOOD', detail: 'Action Faycal: Attente date représentation 19/02/26', amount: '43 557,00 DH', type: 'LCN' },
  ],
  '2026-03-30': [
    { title: 'Chèque FREMBAL à verser', detail: 'Action Fahd: Cheq a verser 30/03/26', amount: '36 115,40 DH', type: 'CHQ' },
  ],
  '2026-04-02': [
    { title: 'Espèces récupérées FAHD', detail: 'AIT LAASRI IDDER - Espèces récupérées par FAHD', amount: '5 000,00 DH', type: 'LCN' },
  ],
  '2026-04-30': [
    { title: 'Virement reçu HAJAR BOIS', detail: 'Action Fahd: Vir reçu le 30/04/26', amount: '107 479,13 DH', type: 'LCN' },
  ],
};

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Interactive Calendar Widget
function RelanceCalendar() {
  const navigate = useNavigate();
  const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // Default month: Janvier 2026 (index 0) or current view
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0); // 0 = Janvier
  const [currentYear, setCurrentYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState<number | null>(26);

  const prevMonth = () => {
    if (currentMonthIndex === 0) {
      setCurrentMonthIndex(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIndex((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (currentMonthIndex === 11) {
      setCurrentMonthIndex(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIndex((m) => m + 1);
    }
    setSelectedDay(null);
  };

  // Get total days in month & starting day offset
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1).getDay();
  const totalDaysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();

  const monthStr = String(currentMonthIndex + 1).padStart(2, '0');

  // Format selected date string YYYY-MM-DD
  const selectedDateStr = selectedDay
    ? `${currentYear}-${monthStr}-${String(selectedDay).padStart(2, '0')}`
    : null;

  const selectedEvents = selectedDateStr ? EVENTS_MAP[selectedDateStr] || [] : [];

  return (
    <div className="p-1 space-y-3">
      {/* Month Header Navigation */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-brand-600" />
          Échéances & Relances
        </span>
        <div className="flex items-center gap-1 bg-brand-50/80 px-2 py-1 rounded-xl border border-brand-100">
          <button
            onClick={prevMonth}
            className="p-0.5 hover:bg-brand-200/50 rounded-md transition text-brand-700 cursor-pointer"
            title="Mois précédent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-bold text-brand-700 min-w-[85px] text-center select-none">
            {MONTH_NAMES[currentMonthIndex]} {currentYear}
          </span>
          <button
            onClick={nextMonth}
            className="p-0.5 hover:bg-brand-200/50 rounded-md transition text-brand-700 cursor-pointer"
            title="Mois suivant"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {daysOfWeek.map((d) => (
          <span key={d} className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            {d}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Empty cells for starting day offset */}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} className="h-7 w-7" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: totalDaysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${currentYear}-${monthStr}-${String(day).padStart(2, '0')}`;
          const events = EVENTS_MAP[dateKey];
          const hasEvents = !!events && events.length > 0;
          const isSelected = selectedDay === day;

          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'h-7 w-7 mx-auto flex items-center justify-center text-xs rounded-full transition-all duration-150 relative cursor-pointer font-medium select-none focus:outline-none',
                isSelected
                  ? 'bg-brand-600 text-white font-bold shadow-md ring-2 ring-brand-300 scale-110'
                  : hasEvents
                  ? 'bg-brand-100 text-brand-800 font-bold ring-2 ring-brand-400/50 hover:bg-brand-200 hover:scale-105'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              {day}
              {hasEvents && !isSelected && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-brand-600 rounded-full animate-pulse ring-1 ring-white" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Details Popover Card */}
      {selectedDay && (
        <div className="mt-3 p-3 bg-slate-900 text-white rounded-xl shadow-lg border border-slate-800 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BellRing className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-xs font-bold text-slate-100">
                {selectedDay} {MONTH_NAMES[currentMonthIndex]} {currentYear}
              </span>
            </div>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="py-2 space-y-2">
            {selectedEvents.length === 0 ? (
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 py-1">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Aucune relance programmée pour ce jour.</span>
              </div>
            ) : (
              selectedEvents.map((evt, idx) => (
                <div key={idx} className="bg-slate-800/80 p-2 rounded-lg border border-slate-700/50 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-300">{evt.title}</span>
                    {evt.amount && (
                      <span className="text-[11px] font-mono font-bold text-emerald-400">{evt.amount}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-tight">{evt.detail}</p>
                </div>
              ))
            )}
          </div>

          <div className="pt-1">
            <button
              onClick={() => navigate(`/dossiers`)}
              className="w-full py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1"
            >
              <span>Voir les dossiers</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDossiers, setRecentDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  useEffect(() => {
    Promise.all([
      api.getStats().catch(() => null),
      api.getDossiers({ limit: '6', sort: 'date_saisie', order: 'DESC' }).catch(() => ({ dossiers: [] })),
    ])
      .then(([statsRes, dossiersRes]) => {
        setStats(statsRes);
        setRecentDossiers(dossiersRes.dossiers || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText('GAD-2026-IMP');
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleExport = async () => {
    try {
      const blob = await api.exportExcel({});
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

  if (loading) {
    return <PageSpinner label="Chargement du tableau de bord..." />;
  }

  if (!stats) {
    return (
      <Card>
        <EmptyState icon={<AlertTriangle className="w-6 h-6" />} title="Erreur de chargement des statistiques" />
      </Card>
    );
  }

  const topBanques = [...stats.parBanque].sort((a, b) => b.total_montant - a.total_montant).slice(0, 6);
  const filteredRecent = recentDossiers.filter((d) =>
    tableSearch ? d.nom_tire.toLowerCase().includes(tableSearch.toLowerCase()) || d.numero_valeur.toLowerCase().includes(tableSearch.toLowerCase()) : true
  );

  const chqData = stats.parType.find((t) => t.type_valeur === 'CHQ') || { count: 0, total_montant: 0 };
  const lcnData = stats.parType.find((t) => t.type_valeur === 'LCN') || { count: 0, total_montant: 0 };

  return (
    <div className="space-y-6">
      {/* Top Banner Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard Recouvrement</h1>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Vue synthétique du portefeuille et suivi analytique des impayés GADIMAT
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} className="rounded-xl">
            <Download className="w-4 h-4" />
            <span>Exporter Rapport</span>
          </Button>
          <Button onClick={() => navigate('/dossiers')} className="rounded-xl shadow-md shadow-brand-600/20">
            <Plus className="w-4 h-4" />
            <span>Nouveau Dossier</span>
          </Button>
        </div>
      </div>

      {/* Main Grid: Left Profile Card + Right Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT SUMMARY PROFILE PANEL */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <Card className="p-6 text-center space-y-5 shadow-sm border-gray-200/90 relative overflow-hidden">
            {/* Ambient Background Blur */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Profile Avatar / Initials Circle */}
            <div className="relative inline-block">
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-600 text-white flex items-center justify-center text-3xl font-extrabold shadow-lg shadow-brand-500/30 ring-4 ring-white">
                GD
              </div>
              <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                ✓
              </span>
            </div>

            {/* Entity Title */}
            <div>
              <h2 className="text-lg font-bold text-gray-900">GADIMAT S.A.</h2>
              <p className="text-xs text-gray-500 font-medium mt-0.5">Portefeuille Impayés 2026</p>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleExport}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Rapport</span>
              </button>
              <button
                onClick={() => navigate('/dossiers')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dossiers</span>
              </button>
            </div>

            {/* General Info Metadata Block */}
            <div className="border-t border-gray-100 pt-4 text-left space-y-3 text-xs">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Informations Générales</h3>

              <div className="flex justify-between items-center py-1 border-b border-gray-50">
                <span className="text-gray-500">Date référence</span>
                <span className="font-semibold text-gray-900">25 Juillet 2026</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-50">
                <span className="text-gray-500">Localisation</span>
                <span className="font-semibold text-gray-900">Maroc (Agadir)</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-gray-50">
                <span className="text-gray-500">ID Portefeuille</span>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-1 font-mono font-bold text-brand-600 hover:text-brand-700 transition cursor-pointer"
                  title="Cliquer pour copier"
                >
                  <span>GAD-2026-IMP</span>
                  {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500">Total Encaissement</span>
                <span className="font-mono font-extrabold text-emerald-700 text-sm">
                  {formatMontant(stats.total.montant)}
                </span>
              </div>
            </div>

            {/* Status / Tags Pills */}
            <div className="border-t border-gray-100 pt-4 text-left space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Répartition Statuts</h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-semibold text-[11px] rounded-lg border border-emerald-200/50">
                  {stats.total.count} Dossiers Régularisés
                </span>
                <span className="px-2.5 py-1 bg-brand-50 text-brand-700 font-semibold text-[11px] rounded-lg border border-brand-200/50">
                  {chqData.count} Chèques
                </span>
                <span className="px-2.5 py-1 bg-violet-50 text-violet-700 font-semibold text-[11px] rounded-lg border border-violet-200/50">
                  {lcnData.count} Effets LCN
                </span>
              </div>
            </div>

            {/* View Detailed Record Link */}
            <div className="pt-2">
              <button
                onClick={() => navigate('/dossiers')}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-xl transition cursor-pointer"
              >
                <span>Voir le registre complet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        </div>

        {/* RIGHT MAIN CONTENT AREA */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">

          {/* Top Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-3.5 bg-white hover:border-brand-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Chèques (CHQ)</p>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">{chqData.count} Dossiers</p>
                <p className="text-xs font-mono font-semibold text-brand-600 truncate">{formatMontant(chqData.total_montant)}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3.5 bg-white hover:border-violet-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Lettres de Change</p>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">{lcnData.count} Dossiers</p>
                <p className="text-xs font-mono font-semibold text-violet-600 truncate">{formatMontant(lcnData.total_montant)}</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3.5 bg-white hover:border-amber-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Dormants (7j+)</p>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">{stats.dossiersDormants} Dossier</p>
                <p className="text-xs font-semibold text-emerald-600 truncate">Suivi actif à jour</p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-3.5 bg-white hover:border-emerald-300 transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Taux Régularisation</p>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">100 % OK</p>
                <p className="text-xs font-semibold text-emerald-600 truncate">Aucun contentieux</p>
              </div>
            </Card>
          </div>

          {/* Row 1: Main Evolution Chart + Progress Gauge Card + Relance Calendar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* Main Area Chart Card */}
            <Card className="lg:col-span-8 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Évolution de la Collecte</h2>
                  <p className="text-xs text-gray-400">Montants régularisés par mois</p>
                </div>
                <Badge tone="brand" pill className="bg-brand-50 text-brand-700 font-semibold px-2.5 py-1">
                  Année 2026
                </Badge>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={stats.evolutionMensuelle} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaColorBrand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SEQUENTIAL_BLUE[450]} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={SEQUENTIAL_BLUE[450]} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={CHART_INK.gridline} strokeDasharray="3 3" />
                  <XAxis dataKey="mois" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatKAxis} tick={valueAxisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={(p: any) => <ChartTooltip {...p} formatter={formatMontant} />} />
                  <Area
                    type="monotone"
                    dataKey="total_montant"
                    name="Montant encaisse"
                    stroke={SEQUENTIAL_BLUE[450]}
                    strokeWidth={3}
                    fill="url(#areaColorBrand)"
                    dot={{ r: 4, fill: SEQUENTIAL_BLUE[450], strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Gauge & Calendar Column */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="p-4">
                <ProgressGauge value={100} label="Objectif Régularisation" subtext="877 165,27 DH encaissés" />
              </Card>

              <Card className="p-4">
                <RelanceCalendar />
              </Card>
            </div>
          </div>

          {/* Row 2: Bank Breakdown Bar Chart + Commercial Portfolio Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Répartition par Banque (DH)</h2>
                <span className="text-xs text-gray-400">Top Banques</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topBanques} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART_INK.gridline} strokeDasharray="3 3" />
                  <XAxis dataKey="banque" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatKAxis} tick={valueAxisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={(p: any) => <ChartTooltip {...p} formatter={formatMontant} />} />
                  <Bar dataKey="total_montant" name="Montant" radius={[6, 6, 0, 0]} maxBarSize={28} fill={SEQUENTIAL_BLUE[450]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Portefeuille par Commercial</h2>
                <span className="text-xs text-gray-400">Montant total</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.parCommercial} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART_INK.gridline} strokeDasharray="3 3" />
                  <XAxis dataKey="commercial_nom" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatKAxis} tick={valueAxisTick} axisLine={false} tickLine={false} />
                  <Tooltip content={(p: any) => <ChartTooltip {...p} formatter={formatMontant} />} />
                  <Bar dataKey="total_montant" name="Montant" radius={[6, 6, 0, 0]} maxBarSize={28} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Row 3: Prescriptions-style Data Table */}
          <Card padding="none" className="overflow-hidden space-y-0">
            {/* Table Card Header with Search Bar */}
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h2 className="text-base font-bold text-gray-900">Dossiers Impayés Récents</h2>
                <p className="text-xs text-gray-500">Aperçu rapide des dernières échéances et valeurs saisies</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Input
                    name="tableSearch"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder="Chercher tiré, N° valeur..."
                    icon={<Search className="w-3.5 h-3.5 text-gray-400" />}
                    className="py-1.5 text-xs rounded-xl"
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => navigate('/dossiers')}
                  className="text-xs rounded-xl whitespace-nowrap cursor-pointer"
                >
                  <span>Tous ({stats.total.count})</span>
                </Button>
              </div>
            </div>

            {/* Table body */}
            <Table>
              <Thead>
                <tr>
                  <Th>Date</Th>
                  <Th>N° Valeur</Th>
                  <Th>Type</Th>
                  <Th>Nom du Tiré</Th>
                  <Th>Commercial</Th>
                  <Th align="right">Montant</Th>
                  <Th>Statut</Th>
                  <Th align="center">Action</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredRecent.length === 0 ? (
                  <Tr>
                    <Td colSpan={8} className="text-center py-6 text-gray-400 text-xs">
                      Aucun dossier trouvé
                    </Td>
                  </Tr>
                ) : (
                  filteredRecent.map((d) => (
                    <Tr key={d.id} className="hover:bg-brand-50/30 transition-colors">
                      <Td className="text-xs text-gray-500">{formatDate(d.date_saisie)}</Td>
                      <Td className="font-mono text-xs font-bold text-gray-800">{d.numero_valeur}</Td>
                      <Td>
                        <Badge
                          tone={d.type_valeur === 'LCN' ? 'info' : 'brand'}
                          pill={false}
                          className={d.type_valeur === 'LCN' ? 'bg-violet-100 text-violet-700 font-bold rounded-md' : 'bg-brand-100 text-brand-700 font-bold rounded-md'}
                        >
                          {d.type_valeur}
                        </Badge>
                      </Td>
                      <Td className="font-semibold text-gray-900 max-w-[200px] truncate text-xs">
                        {d.nom_tire}
                      </Td>
                      <Td className="text-xs text-gray-600">{d.commercial_nom || '-'}</Td>
                      <Td align="right" className="font-mono font-bold text-gray-900 text-xs">
                        {formatMontant(d.montant)}
                      </Td>
                      <Td><StatusBadge statut={d.statut} /></Td>
                      <Td align="center">
                        <button
                          onClick={() => navigate(`/dossiers/${d.id}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                        >
                          <span>Détails</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
