import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../api/client';
import { ApiError, type BalanceResponse, type MovementsResponse, type MovementTypeFilter, type TransactionStatusFilter } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BalanceCard } from './BalanceCard';
import { MovementsTable } from './MovementsTable';
import { OperationsPanel } from './OperationsPanel';

const PAGE_SIZE = 10;

export function DashboardPage() {
  const { token, username, logout } = useAuth();
  const { notify } = useToast();

  const [walletId, setWalletId] = useState('wal_001');
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  const [movements, setMovements] = useState<MovementsResponse | null>(null);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<TransactionStatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const loadBalance = useCallback(
    async (targetWalletId: string) => {
      setIsLoadingBalance(true);
      try {
        const response = await apiRequest<BalanceResponse>(`/wallets/${targetWalletId}/balance`, { token });
        setBalance(response);
      } catch (error) {
        setBalance(null);
        notify('error', error instanceof ApiError ? error.message : 'No se pudo consultar el saldo');
      } finally {
        setIsLoadingBalance(false);
      }
    },
    [token, notify],
  );

  const loadMovements = useCallback(
    async (targetWalletId: string) => {
      setIsLoadingMovements(true);
      try {
        const query = new URLSearchParams({
          type: typeFilter,
          status: statusFilter,
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        const response = await apiRequest<MovementsResponse>(`/wallets/${targetWalletId}/movements?${query}`, {
          token,
        });
        setMovements(response);
      } catch (error) {
        setMovements(null);
        notify('error', error instanceof ApiError ? error.message : 'No se pudieron consultar los movimientos');
      } finally {
        setIsLoadingMovements(false);
      }
    },
    [token, notify, typeFilter, statusFilter, page],
  );

  useEffect(() => {
    loadBalance(walletId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMovements(walletId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter, page]);

  function handleRefreshWallet() {
    setPage(1);
    loadBalance(walletId);
    loadMovements(walletId);
  }

  function handleOperationCompleted() {
    loadBalance(walletId);
    loadMovements(walletId);
  }

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="brand-mark">L</span>
          <span>Ligo Wallet Transaction Service</span>
        </div>
        <div className="topbar__user">
          <span>{username}</span>
          <button className="btn btn--ghost" onClick={logout}>
            Cerrar sesion
          </button>
        </div>
      </header>

      <main className="dashboard__content">
        <div className="dashboard__grid">
          <BalanceCard
            walletId={walletId}
            balance={balance}
            isLoading={isLoadingBalance}
            onWalletIdChange={setWalletId}
            onRefresh={handleRefreshWallet}
          />
          <OperationsPanel walletId={walletId} onOperationCompleted={handleOperationCompleted} />
        </div>

        <MovementsTable
          data={movements}
          isLoading={isLoadingMovements}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          onTypeFilterChange={(value) => {
            setPage(1);
            setTypeFilter(value);
          }}
          onStatusFilterChange={(value) => {
            setPage(1);
            setStatusFilter(value);
          }}
          onPageChange={setPage}
        />
      </main>
    </div>
  );
}
