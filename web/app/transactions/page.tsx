'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface Transaction {
  id: string;
  type: string;
  amount: number | null;
  creditsAdded: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  user: { username: string | null; firstName: string | null; telegramId: string };
  package: { name: string } | null;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const searchParams = useSearchParams();
  const userId = searchParams?.get('userId');

  useEffect(() => {
    fetchTransactions();
  }, [userId, sortBy, order]);

  const fetchTransactions = async () => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('sortBy', sortBy);
      params.append('order', order);

      const res = await fetch(`/api/transactions?${params}`);
      setTransactions(await res.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">💳 Transactions {userId && '(Filtered)'}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4 flex gap-2">
          <button onClick={() => handleSort('createdAt')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Sort by Date {sortBy === 'createdAt' && (order === 'asc' ? '↑' : '↓')}</button>
          <button onClick={() => handleSort('amount')} className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm">Sort by Amount {sortBy === 'amount' && (order === 'asc' ? '↑' : '↓')}</button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Method</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.user.firstName || tx.user.username || tx.user.telegramId}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">{tx.type}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{color: tx.creditsAdded > 0 ? 'green' : 'red'}}>{tx.creditsAdded > 0 ? '+' : ''}{tx.creditsAdded.toFixed(1)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.amount ? `${tx.amount} руб.` : '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.paymentMethod}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{tx.status}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(tx.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
