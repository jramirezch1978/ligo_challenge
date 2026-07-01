import { useState, type FormEvent } from 'react';
import { apiRequest, newIdempotencyKey } from '../api/client';
import { ApiError, type TransactionResponse } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface Props {
  defaultWalletId: string;
  onCompleted: () => void;
}

export function DebitCreditForm({ defaultWalletId, onCompleted }: Props) {
  const { token } = useAuth();
  const { notify } = useToast();
  const [walletId, setWalletId] = useState(defaultWalletId);
  const [type, setType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [amount, setAmount] = useState('10.00');
  const [currency, setCurrency] = useState('PEN');
  const [description, setDescription] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const result = await apiRequest<TransactionResponse>('/transactions', {
        method: 'POST',
        token,
        idempotencyKey,
        body: {
          walletId,
          type,
          amount,
          currency,
          description: description || undefined,
          externalReference: externalReference || undefined,
        },
      });
      notify('success', `Transaccion ${result.transactionId} completada (${result.status})`);
      setIdempotencyKey(newIdempotencyKey());
      onCompleted();
    } catch (error) {
      notify('error', error instanceof ApiError ? error.message : 'No se pudo procesar la operacion');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="operation-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="field">
          <span>Wallet ID</span>
          <input value={walletId} onChange={(e) => setWalletId(e.target.value)} required />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={type} onChange={(e) => setType(e.target.value as 'DEBIT' | 'CREDIT')}>
            <option value="DEBIT">Debito</option>
            <option value="CREDIT">Credito</option>
          </select>
        </label>
        <label className="field">
          <span>Monto</span>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25.50" required />
        </label>
        <label className="field">
          <span>Moneda</span>
          <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} required />
        </label>
        <label className="field field--wide">
          <span>Descripcion</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pago QR comercio" />
        </label>
        <label className="field field--wide">
          <span>Referencia externa</span>
          <input value={externalReference} onChange={(e) => setExternalReference(e.target.value)} placeholder="qr_789456" />
        </label>
        <label className="field field--wide">
          <span>Idempotency-Key</span>
          <input value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} required />
        </label>
      </div>
      <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
        {isSubmitting ? 'Procesando...' : 'Ejecutar operacion'}
      </button>
    </form>
  );
}
