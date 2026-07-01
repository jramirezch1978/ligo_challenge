import { useState } from 'react';
import { DebitCreditForm } from './DebitCreditForm';
import { TransferForm } from './TransferForm';
import { ReversalForm } from './ReversalForm';
import { StatusLookup } from './StatusLookup';

type Tab = 'debit-credit' | 'transfer' | 'reversal' | 'status';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'debit-credit', label: 'Debito / Credito' },
  { id: 'transfer', label: 'Transferencia' },
  { id: 'reversal', label: 'Reversa' },
  { id: 'status', label: 'Consultar estado' },
];

interface Props {
  walletId: string;
  onOperationCompleted: () => void;
}

export function OperationsPanel({ walletId, onOperationCompleted }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('debit-credit');

  return (
    <section className="card">
      <div className="card__header">
        <h2>Operaciones</h2>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab ${activeTab === tab.id ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'debit-credit' && (
          <DebitCreditForm defaultWalletId={walletId} onCompleted={onOperationCompleted} />
        )}
        {activeTab === 'transfer' && (
          <TransferForm defaultSourceWalletId={walletId} onCompleted={onOperationCompleted} />
        )}
        {activeTab === 'reversal' && <ReversalForm onCompleted={onOperationCompleted} />}
        {activeTab === 'status' && <StatusLookup />}
      </div>
    </section>
  );
}
