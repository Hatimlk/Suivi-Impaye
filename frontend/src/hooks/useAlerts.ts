import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useAlerts() {
  const [dormants, setDormants] = useState<any[]>([]);
  const [contentieux, setContentieux] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getAlerts();
      setDormants(data.dormants || []);
      setContentieux(data.contentieux || []);
    } catch (err) {
      console.error('Erreur chargement alertes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { dormants, contentieux, loading, refresh };
}
