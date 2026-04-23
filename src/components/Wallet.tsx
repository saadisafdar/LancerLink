import React, { useState } from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, History, PlusCircle } from 'lucide-react';
import { User, Transaction } from '../types';

interface WalletProps {
  user: User;
  transactions: Transaction[];
  onAction: (type: 'add' | 'withdraw', amount: number) => void;
}

export const Wallet: React.FC<WalletProps> = ({ user, transactions, onAction }) => {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    
    if (user.role === 'client') {
      onAction('add', Number(amount));
    } else {
      if (Number(amount) > user.balance) {
        alert("Insufficient balance!");
        return;
      }
      onAction('withdraw', Number(amount));
    }
    setAmount('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 wallet-gradient glass-card p-8 border-green-500/20 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-green-700 mb-2">
              <WalletIcon className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">Available Balance</span>
            </div>
            <h2 className="text-5xl font-bold font-mono tracking-tighter text-gray-900">
              ${user.balance.toLocaleString()}
            </h2>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-1/4 translate-y-1/4">
            <WalletIcon className="w-64 h-64 text-green-900" />
          </div>
        </div>

        <div className="glass-card p-6 flex flex-col justify-center">
          <h3 className="font-bold text-gray-800 mb-4">
            {user.role === 'client' ? 'Add Funds' : 'Withdraw Earnings'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount ($)" 
              className="input-field w-full font-mono"
              required
            />
            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
              {user.role === 'client' ? (
                <><PlusCircle className="w-4 h-4" /> Add Balance</>
              ) : (
                <><ArrowUpRight className="w-4 h-4" /> Request Withdrawal</>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-900">
          <History className="w-5 h-5 text-gray-400" />
          Transaction History
        </h3>
        <div className="space-y-4">
          {transactions.filter(t => t.userId === user.id).length === 0 ? (
            <p className="text-center py-8 text-gray-500 text-sm">No transactions yet.</p>
          ) : (
            transactions
              .filter(t => t.userId === user.id)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                      {t.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-gray-900">{t.description}</p>
                      <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className={`font-mono font-bold ${t.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'credit' ? '+' : '-'}${t.amount}
                  </p>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
};
