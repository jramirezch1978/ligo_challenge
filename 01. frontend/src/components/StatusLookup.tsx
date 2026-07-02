import { useState, type FormEvent } from 'react';
import { apiRequest } from '../api/client';
import { ApiError, type TransactionStatusResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function StatusLookup() {
  const { token } = useAuth();
  const { notify } = useToast();
  const [transactionId, setTransactionId] = useState('');
  const [result, setResult] = useState<TransactionStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    try {
      const response = await apiRequest<TransactionStatusResponse>(
        `/transactions/status?transactionId=${encodeURIComponent(transactionId)}`,
        { token },
      );
      setResult(response);
    } catch (error) {
      setResult(null);
      notify('error', error instanceof ApiError ? error.message : 'No se pudo consultar la transaccion');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form className="operation-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field--wide">
          <span>Transaction ID</span>
          <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="txn_..." required />
        </label>
      </div>
      <button type="submit" className="btn btn--secondary" disabled={isLoading}>
        {isLoading ? 'Consultando...' : 'Consultar estado'}
      </button>

      {result && (
        <div className="status-result">
          <div>
            <strong>Estado:</strong> <span className={`badge badge--${result.status.toLowerCase()}`}>{result.status}</span>
          </div>
          <div>
            <strong>Referencia externa:</strong> {result.externalReference ?? '-'}
          </div>
        </div>
      )}
    </form>
  );
}
