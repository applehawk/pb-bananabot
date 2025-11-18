'use client';

import { useState, useEffect } from 'react';

interface Analytics {
  id: string;
  date: string;
  newUsers: number;
  activeUsers: number;
  totalGenerations: number;
  textToImage: number;
  imageToImage: number;
  multiImage: number;
  totalRevenue: number;
  totalCreditsUsed: number;
  totalCreditsPurchased: number;
  paymentsYooMoney: number;
  paymentsStars: number;
  paymentsCrypto: number;
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTextToImage, setShowTextToImage] = useState(true);
  const [showImageToImage, setShowImageToImage] = useState(true);
  const [showMultiImage, setShowMultiImage] = useState(true);
  const [sortBy, setSortBy] = useState<keyof Analytics>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minGenerations, setMinGenerations] = useState('');
  const [minRevenue, setMinRevenue] = useState('');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      setAnalytics(await res.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: keyof Analytics) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedAnalytics = analytics
    .filter((day) => {
      if (dateFrom && new Date(day.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(day.date) > new Date(dateTo)) return false;
      if (minGenerations && day.totalGenerations < parseInt(minGenerations)) return false;
      if (minRevenue && day.totalRevenue < parseFloat(minRevenue)) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });

  const totals = filteredAndSortedAnalytics.reduce((acc, day) => ({
    revenue: acc.revenue + day.totalRevenue,
    generations: acc.generations + day.totalGenerations,
    users: acc.users + day.newUsers,
    textToImage: acc.textToImage + day.textToImage,
    imageToImage: acc.imageToImage + day.imageToImage,
    multiImage: acc.multiImage + day.multiImage,
    creditsUsed: acc.creditsUsed + day.totalCreditsUsed,
    creditsPurchased: acc.creditsPurchased + day.totalCreditsPurchased,
  }), { revenue: 0, generations: 0, users: 0, textToImage: 0, imageToImage: 0, multiImage: 0, creditsUsed: 0, creditsPurchased: 0 });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">📊 Analytics</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total Revenue</div>
            <div className="text-2xl font-bold text-gray-900">{totals.revenue.toFixed(2)} руб.</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total Generations</div>
            <div className="text-2xl font-bold text-gray-900">{totals.generations}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">New Users</div>
            <div className="text-2xl font-bold text-gray-900">{totals.users}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-sm text-gray-500">Credits Used</div>
            <div className="text-2xl font-bold text-gray-900">{totals.creditsUsed.toFixed(1)}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Generations</label>
              <input
                type="number"
                value={minGenerations}
                onChange={(e) => setMinGenerations(e.target.value)}
                placeholder="0"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-32"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Revenue</label>
              <input
                type="number"
                value={minRevenue}
                onChange={(e) => setMinRevenue(e.target.value)}
                placeholder="0"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-32"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setMinGenerations('');
                  setMinRevenue('');
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              >
                Clear Filters
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Generation Types:</div>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input type="checkbox" checked={showTextToImage} onChange={(e) => setShowTextToImage(e.target.checked)} className="mr-2" />
                Text-to-Image ({totals.textToImage})
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={showImageToImage} onChange={(e) => setShowImageToImage(e.target.checked)} className="mr-2" />
                Image-to-Image ({totals.imageToImage})
              </label>
              <label className="flex items-center">
                <input type="checkbox" checked={showMultiImage} onChange={(e) => setShowMultiImage(e.target.checked)} className="mr-2" />
                Multi-Image ({totals.multiImage})
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          </div>
        ) : (
          <>
            <div className="mb-2 text-sm text-gray-600">
              Showing {filteredAndSortedAnalytics.length} of {analytics.length} days
            </div>
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleSort('date')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Date {sortBy === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('newUsers')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      New Users {sortBy === 'newUsers' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('activeUsers')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Active {sortBy === 'activeUsers' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('totalGenerations')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Total Gen {sortBy === 'totalGenerations' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    {showTextToImage && (
                      <th
                        onClick={() => handleSort('textToImage')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      >
                        Text2Img {sortBy === 'textToImage' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {showImageToImage && (
                      <th
                        onClick={() => handleSort('imageToImage')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      >
                        Img2Img {sortBy === 'imageToImage' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    {showMultiImage && (
                      <th
                        onClick={() => handleSort('multiImage')}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                      >
                        Multi {sortBy === 'multiImage' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                    )}
                    <th
                      onClick={() => handleSort('totalRevenue')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Revenue {sortBy === 'totalRevenue' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      onClick={() => handleSort('totalCreditsUsed')}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                    >
                      Credits Used {sortBy === 'totalCreditsUsed' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedAnalytics.map((day) => (
                    <tr key={day.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{new Date(day.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{day.newUsers}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{day.activeUsers}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{day.totalGenerations}</td>
                      {showTextToImage && <td className="px-6 py-4 whitespace-nowrap text-sm">{day.textToImage}</td>}
                      {showImageToImage && <td className="px-6 py-4 whitespace-nowrap text-sm">{day.imageToImage}</td>}
                      {showMultiImage && <td className="px-6 py-4 whitespace-nowrap text-sm">{day.multiImage}</td>}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">{day.totalRevenue.toFixed(2)} руб.</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{day.totalCreditsUsed.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
