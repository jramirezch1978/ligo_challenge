import { useState, type FormEvent } from 'react';
import { apiRequest, newIdempotencyKey } from '../api/client';
import { ApiError, type TransactionResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Props {
  defaultSourceWalletId: string;
  onCompleted: () => void;
}

export function TransferForm({ defaultSourceWalletId, onCompleted }: Props) {
  const { token } = useAuth();
  const { notify } = useToast();
  const [sourceWalletId, setSourceWalletId] = useState(defaultSourceWalletId);
  const [targetWalletId, setTargetWalletId] = useState('wal_002');
  const [amount, setAmount] = useState('50.00');
  const [currency, setCurrency] = useState('PEN');
  const [description, setDescription] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await apiRequest<TransactionResponse>('/transactions/transfer', {
        method: 'POST',
        token,
        idempotencyKey,
        body: {
          sourceWalletId,
          targetWalletId,
          amount,
          currency,
          description: description || undefined,
          externalReference: externalReference || undefined,
        },
      });
      notify('success', `Transferencia ${result.transactionId} completada`);
      setIdempotencyKey(newIdempotencyKey());
      onCompleted();
    } catch (error) {
      notify('error', error instanceof ApiError ? error.message : 'No se pudo procesar la transferencia');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="operation-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Wallet origen</span>
          <input value={sourceWalletId} onChange={(e) => setSourceWalletId(e.target.value)} required />
        </label>
        <label className="field">
          <span>Wallet destino</span>
          <input value={targetWalletId} onChange={(e) => setTargetWalletId(e.target.value)} required />
        </label>
        <label className="field">
          <span>Monto</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label className="field">
          <span>Moneda</span>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required />
        </label>
        <label className="field field--wide">
          <span>Descripcion</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Transferencia entre usuarios"
          />
        </label>
        <label className="field field--wide">
          <span>Referencia externa</span>
          <input value={externalReference} onChange={(e) => setExternalReference(e.target.value)} />
        </label>
        <label className="field field--wide">
          <span>Idempotency-Key</span>
          <input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? 'Procesando...' : 'Transferir'}
      </button>
    </form>
  );
}
