import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Loads data from a GET endpoint. Returns { data, error, loading, reload, setData }. */
export function useApi(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(path));

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api.get(path));
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => { reload(); }, [reload]);

  return { data, error, loading, reload, setData };
}
