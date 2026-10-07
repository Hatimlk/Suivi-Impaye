import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';
import { Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(37,99,235,0.11),transparent_34%),radial-gradient(circle_at_20%_90%,rgba(59,130,246,0.06),transparent_28%)]" />

      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="mt-3 text-xl font-black tracking-wide text-slate-950">GADIMAT</p>
          <p className="text-xs font-medium text-slate-500">Suivi des impayés</p>
        </div>

        <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.3)] sm:p-9">
          <header className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Espace sécurisé</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Bienvenue</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Connectez-vous pour accéder à votre espace de gestion.
            </p>
          </header>

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
        </section>

        <p className="mt-5 text-center text-xs text-slate-400">© {new Date().getFullYear()} GADIMAT S.A.</p>
      </div>
    </main>
  );
}
