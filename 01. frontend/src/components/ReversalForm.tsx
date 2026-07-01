import { useState, type FormEvent } from 'react';
import { apiRequest, newIdempotencyKey } from '../api/client';
import { ApiError, type TransactionResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Props {
  onCompleted: () => void;
}

export function ReversalForm({ onCompleted }: Props) {
  const { token } = useAuth();
  const { notify } = useToast();
  const [transactionId, setTransactionId] = useState('');
  const [reason, setReason] = useState('Merchant refund / reversal');
  const [externalReference, setExternalReference] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await apiRequest<TransactionResponse>(`/transactions/${transactionId}/reversal`, {
        method: 'POST',
        token,
        idempotencyKey,
        body: { reason, externalReference: externalReference || undefined },
      });
      notify('success', `Reversa ${result.transactionId} completada`);
      setIdempotencyKey(newIdempotencyKey());
      onCompleted();
    } catch (error) {
      notify('error', error instanceof ApiError ? error.message : 'No se pudo reversar la transaccion');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="operation-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field field--wide">
          <span>Transaction ID a reversar</span>
          <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="txn_..." required />
        </label>
        <label className="field field--wide">
          <span>Motivo</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} required />
        </label>
        <label className="field field--wide">
          <span>Referencia externa</span>
          <input value={externalReference} onChange={(e) => setExternalReference(e.target.value)} placeholder="rev_123456" />
        </label>
        <label className="field field--wide">
          <span>Idempotency-Key</span>
          <input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className="btn btn--danger" disabled={isSubmitting}>
        {isSubmitting ? 'Procesando...' : 'Reversar transaccion'}
      </button>
    </form>
  );
}
