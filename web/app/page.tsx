'use client';

import { useState, useEffect } from 'react';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
  discount: number;
  popular: boolean;
  active: boolean;
  priceYooMoney: number | null;
  priceStars: number | null;
  priceCrypto: number | null;
  description: string | null;
}

export default function AdminPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CreditPackage | null>(null);
  const [formData, setFormData] = useState({
    name: '', credits: '', price: '', currency: 'RUB', discount: '0',
    popular: false, active: true, priceYooMoney: '', priceStars: '', priceCrypto: '', description: '',
  });

  useEffect(() => { fetchPackages(); }, []);

  const fetchPackages = async () => {
    try {
      const res = await fetch('/api/packages');
      setPackages(await res.json());
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      priceYooMoney: formData.priceYooMoney || null,
      priceStars: formData.priceStars || null,
      priceCrypto: formData.priceCrypto || null,
      description: formData.description || null,
    };

    try {
      const url = editingPackage ? `/api/packages/${editingPackage.id}` : '/api/packages';
      await fetch(url, {
        method: editingPackage ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      fetchPackages();
      closeModal();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to save package');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this package?')) return;
    try {
      await fetch(`/api/packages/${id}`, { method: 'DELETE' });
      fetchPackages();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const openModal = (pkg?: CreditPackage) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name, credits: String(pkg.credits), price: String(pkg.price),
        currency: pkg.currency, discount: String(pkg.discount),
        popular: pkg.popular, active: pkg.active,
        priceYooMoney: pkg.priceYooMoney ? String(pkg.priceYooMoney) : '',
        priceStars: pkg.priceStars ? String(pkg.priceStars) : '',
        priceCrypto: pkg.priceCrypto ? String(pkg.priceCrypto) : '',
        description: pkg.description || '',
      });
    } else {
      setEditingPackage(null);
      setFormData({
        name: '', credits: '', price: '', currency: 'RUB', discount: '0',
        popular: false, active: true, priceYooMoney: '', priceStars: '', priceCrypto: '', description: '',
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPackage(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">💎 BananaBot Admin</h1>
          <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            + Add Package
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          </div>
        ) : packages.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">No packages found. Create your first one!</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credits</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{pkg.name}</span>
                        {pkg.popular && <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">⭐ Popular</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">{pkg.credits}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-gray-900">{pkg.priceYooMoney || pkg.price} руб.</div>
                      {pkg.priceStars && <div className="text-xs text-gray-500">⭐ {pkg.priceStars} stars</div>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                      {pkg.discount > 0 ? `${pkg.discount}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${pkg.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {pkg.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button onClick={() => openModal(pkg)} className="text-blue-600 hover:text-blue-900">Edit</button>
                      <button onClick={() => handleDelete(pkg.id)} className="text-red-600 hover:text-red-900">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-6">{editingPackage ? 'Edit Package' : 'Create Package'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label><input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Credits *</label><input type="number" step="0.1" value={formData.credits} onChange={(e) => setFormData({ ...formData, credits: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Base Price *</label><input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Currency</label><select value={formData.currency} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"><option value="RUB">RUB</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">YooMoney Price</label><input type="number" step="0.01" value={formData.priceYooMoney} onChange={(e) => setFormData({ ...formData, priceYooMoney: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Telegram Stars</label><input type="number" value={formData.priceStars} onChange={(e) => setFormData({ ...formData, priceStars: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Crypto (USDT)</label><input type="number" step="0.01" value={formData.priceCrypto} onChange={(e) => setFormData({ ...formData, priceCrypto: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                  <div><label className="block text-sm font-medium text-gray-700 mb-1">Discount (%)</label><input type="number" value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Description</label><textarea rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /></div>
                <div className="space-y-2">
                  <label className="flex items-center"><input type="checkbox" checked={formData.popular} onChange={(e) => setFormData({ ...formData, popular: e.target.checked })} className="mr-2" />Mark as Popular</label>
                  <label className="flex items-center"><input type="checkbox" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} className="mr-2" />Active</label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">{editingPackage ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
