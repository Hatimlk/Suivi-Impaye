import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useAlerts() {
  const [rappels, setRappels] = useState<any[]>([]);
  const [dormants, setDormants] = useState<any[]>([]);
  const [contentieux, setContentieux] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getAlerts();
      setRappels(data.rappels || []);
      setDormants(data.dormants || []);
      setContentieux(data.contentieux || []);
    } catch (err) {
      console.error('Erreur chargement alertes:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  return { rappels, dormants, contentieux, loading, refresh };
}
