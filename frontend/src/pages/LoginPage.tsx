import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Input, Button } from '../components/ui';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email, password);
      if (loggedUser?.role === 'commercial') {
        navigate('/mes-dossiers');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-brand-700">Suivi Impayés</h1>
            <p className="text-gray-500 mt-1">GADIMAT - Connexion</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-danger-50 border border-danger-100 rounded-lg text-danger-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              name="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              placeholder="votre@email.com"
              required
            />

            <Input
              type="password"
              name="password"
              label="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              placeholder="••••••••"
              required
            />

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Connexion...' : 'Se connecter'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
