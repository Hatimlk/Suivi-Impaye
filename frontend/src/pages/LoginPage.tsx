import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';
import {
  Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck,
  BarChart3, BellRing, ArrowRight, CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      navigate(loggedUser?.role === 'commercial' ? '/mes-dossiers' : '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(37,99,235,0.10),transparent_28%),radial-gradient(circle_at_15%_90%,rgba(59,130,246,0.08),transparent_30%)]" />

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(400px,0.9fr)_1.1fr]">
        <section className="relative hidden overflow-hidden bg-[#0f172a] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
          <div className="absolute -right-28 -top-28 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:42px_42px]" />

          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/30">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-wide">GADIMAT</p>
              <p className="text-sm text-slate-400">Suivi des impayés</p>
            </div>
          </div>

          <div className="relative max-w-xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Plateforme de recouvrement
            </span>
            <h1 className="text-4xl font-black leading-tight tracking-tight xl:text-5xl">
              Pilotez vos impayés avec clarté.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-300">
              Centralisez les dossiers, les relances et les alertes dans un espace sécurisé connecté aux données OpenPROD.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <LoginFeature icon={BarChart3} label="Indicateurs actualisés" />
              <LoginFeature icon={BellRing} label="Alertes et échéances" />
              <LoginFeature icon={CheckCircle2} label="Suivi des actions" />
              <LoginFeature icon={ShieldCheck} label="Accès sécurisé" />
            </div>
          </div>

          <p className="relative text-xs text-slate-500">© {new Date().getFullYear()} GADIMAT S.A.</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-16">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-extrabold tracking-wide text-slate-950">GADIMAT</p>
                <p className="text-xs text-slate-500">Suivi des impayés</p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.3)] sm:p-9">
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Espace sécurisé</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Bienvenue</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Connectez-vous pour accéder à votre espace de gestion.</p>
              </div>

              {error && (
                <div role="alert" aria-live="polite" className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger-100 bg-danger-50 p-3.5 text-sm text-danger-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  type="email"
                  name="email"
                  label="Adresse e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon={<Mail className="h-4 w-4" />}
                  placeholder="prenom.nom@gadimat.com"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="h-12 rounded-xl border-slate-300 bg-slate-50/70 text-base focus:bg-white"
                  required
                />

                <div>
                  <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2 pl-10 pr-12 text-base outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" loading={loading} className="group h-12 w-full rounded-xl text-base shadow-lg shadow-brand-600/20">
                  {loading ? 'Connexion en cours...' : (
                    <>
                      Se connecter
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
                <Lock className="h-3.5 w-3.5" />
                Connexion réservée aux utilisateurs autorisés
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 lg:hidden">© {new Date().getFullYear()} GADIMAT S.A.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function LoginFeature({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-slate-200 backdrop-blur-sm">
      <Icon className="h-4 w-4 shrink-0 text-blue-400" />
      {label}
    </div>
  );
}
