import type { BalanceResponse } from '../api/types';

interface Props {
  walletId: string;
  balance: BalanceResponse | null;
  isLoading: boolean;
  onWalletIdChange: (value: string) => void;
  onRefresh: () => void;
}

export function BalanceCard({ walletId, balance, isLoading, onWalletIdChange, onRefresh }: Props) {
  return (
    <section className="card">
      <div className="card__header">
        <h2>Saldo de wallet</h2>
      </div>

      <div className="wallet-picker">
        <label className="field">
          <span>Wallet ID</span>
          <input value={walletId} onChange={(e) => onWalletIdChange(e.target.value)} placeholder="wal_001" />
        </label>
        <button className="btn btn--secondary" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? 'Cargando...' : 'Consultar'}
        </button>
      </div>

      {balance && (
        <div className="balance-display">
          <div className="balance-display__amount">
            {balance.currency} {balance.availableBalance}
          </div>
          <span className={`badge badge--${balance.status.toLowerCase()}`}>{balance.status}</span>
        </div>
      )}
    </section>
  );
}
