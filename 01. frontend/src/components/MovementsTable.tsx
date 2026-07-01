import type { MovementsResponse, MovementTypeFilter, TransactionStatusFilter } from '../api/types';

interface Props {
  data: MovementsResponse | null;
  isLoading: boolean;
  typeFilter: MovementTypeFilter;
  statusFilter: TransactionStatusFilter;
  onTypeFilterChange: (value: MovementTypeFilter) => void;
  onStatusFilterChange: (value: TransactionStatusFilter) => void;
  onPageChange: (page: number) => void;
}

export function MovementsTable({
  data,
  isLoading,
  typeFilter,
  statusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
  onPageChange,
}: Props) {
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <section className="card">
      <div className="card__header">
        <h2>Movimientos</h2>
        <div className="filters">
          <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value as MovementTypeFilter)}>
            <option value="ALL">Todos los tipos</option>
            <option value="DEBIT">Debito</option>
            <option value="CREDIT">Credito</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as TransactionStatusFilter)}
          >
            <option value="ALL">Todos los estados</option>
            <option value="COMPLETED">Completado</option>
            <option value="PENDING">Pendiente</option>
            <option value="FAILED">Fallido</option>
            <option value="REVERSED">Reversado</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Transaccion</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Descripcion</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Cargando movimientos...
                </td>
              </tr>
            )}
            {!isLoading && (!data || data.movements.length === 0) && (
              <tr>
                <td colSpan={6} className="empty-row">
                  Sin movimientos para los filtros seleccionados.
                </td>
              </tr>
            )}
            {!isLoading &&
              data?.movements.map((movement, index) => (
                <tr key={`${movement.transactionId}-${index}`}>
                  <td className="mono">{movement.transactionId}</td>
                  <td>
                    <span className={`badge badge--${movement.type.toLowerCase()}`}>{movement.type}</span>
                  </td>
                  <td>{movement.amount}</td>
                  <td>
                    <span className={`badge badge--${movement.status.toLowerCase()}`}>{movement.status}</span>
                  </td>
                  <td>{movement.description ?? '-'}</td>
                  <td>{new Date(movement.createdAt).toLocaleString()}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="pagination">
          <button className="btn btn--ghost" disabled={data.page <= 1} onClick={() => onPageChange(data.page - 1)}>
            Anterior
          </button>
          <span>
            Pagina {data.page} de {totalPages} &middot; {data.total} movimiento(s)
          </span>
          <button
            className="btn btn--ghost"
            disabled={data.page >= totalPages}
            onClick={() => onPageChange(data.page + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </section>
  );
}
