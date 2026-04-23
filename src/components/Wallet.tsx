import React from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, History } from 'lucide-react';
import { User, Transaction } from '../types';

interface WalletProps {
  user: User;
  transactions: Transaction[];
}

export const Wallet: React.FC<WalletProps> = ({ user, transactions }) => {
  return (
    <div className="space-y-6">
      <div className="wallet-gradient glass-card p-8 border-blue-500/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-blue-400 mb-2">
            <WalletIcon className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Available Balance</span>
          </div>
          <h2 className="text-5xl font-bold font-mono tracking-tighter">
            ${user.balance.toLocaleString()}
          </h2>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-1/4 translate-y-1/4">
          <WalletIcon className="w-64 h-64" />
        </div>
      </div>

      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
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
                <div key={t.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${t.type === 'credit' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {t.type === 'credit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.description}</p>
                      <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className={`font-mono font-bold ${t.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
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
