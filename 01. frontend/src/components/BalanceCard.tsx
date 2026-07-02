import type { BalanceResponse, WalletSummary } from '../api/types';

interface Props {
  walletId: string;
  balance: BalanceResponse | null;
  isLoading: boolean;
  isAdmin: boolean;
  walletOptions: WalletSummary[];
  onWalletIdChange: (value: string) => void;
  onRefresh: () => void;
}

function formatWalletOption(wallet: WalletSummary): string {
  const owner = wallet.ownerName ?? 'Sin titular';
  return `${wallet.id} — ${owner} (${wallet.currency})`;
}

export function BalanceCard({
  walletId,
  balance,
  isLoading,
  isAdmin,
  walletOptions,
  onWalletIdChange,
  onRefresh,
}: Props) {
  const assignedWallet = walletOptions.find((wallet) => wallet.id === walletId);

  return (
    <section className="card">
      <div className="card__header">
        <h2>Saldo de wallet</h2>
      </div>

      <div className="wallet-picker">
        <label className="field">
          <span>{isAdmin ? 'Seleccionar wallet' : 'Wallet asignado'}</span>
          {isAdmin ? (
            <select
              value={walletId}
              onChange={(event) => onWalletIdChange(event.target.value)}
              disabled={walletOptions.length === 0}
            >
              {walletOptions.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {formatWalletOption(wallet)} — {wallet.status}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={assignedWallet ? formatWalletOption(assignedWallet) : walletId}
              readOnly
              aria-readonly="true"
            />
          )}
        </label>
        <button className="btn btn--secondary" onClick={onRefresh} disabled={isLoading || !walletId}>
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
