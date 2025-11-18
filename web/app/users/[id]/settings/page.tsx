'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface UserSettings {
  id: string;
  userId: string;
  aspectRatio: string;
  numberOfImages: number;
  safetyLevel: string;
  language: string;
  hdQuality: boolean;
  autoEnhance: boolean;
  useNegativePrompt: boolean;
  notifyOnComplete: boolean;
  notifyOnBonus: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    username: string | null;
    firstName: string | null;
    telegramId: string;
  };
}

export default function UserSettingsPage() {
  const params = useParams();
  const userId = params?.id as string;
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    aspectRatio: '1:1',
    numberOfImages: 1,
    safetyLevel: 'BLOCK_MEDIUM_AND_ABOVE',
    language: 'en',
    hdQuality: false,
    autoEnhance: true,
    useNegativePrompt: true,
    notifyOnComplete: true,
    notifyOnBonus: true,
  });

  useEffect(() => {
    if (userId) {
      fetchSettings();
    }
  }, [userId]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/users/${userId}/settings`);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setFormData({
          aspectRatio: data.aspectRatio,
          numberOfImages: data.numberOfImages,
          safetyLevel: data.safetyLevel,
          language: data.language,
          hdQuality: data.hdQuality,
          autoEnhance: data.autoEnhance,
          useNegativePrompt: data.useNegativePrompt,
          notifyOnComplete: data.notifyOnComplete,
          notifyOnBonus: data.notifyOnBonus,
        });
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`/api/users/${userId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      alert('Settings updated successfully');
      fetchSettings();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Settings Not Found</h1>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/users" className="text-blue-600 hover:text-blue-800">
              ← Back to Users
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              ⚙️ User Settings: {settings.user.firstName || settings.user.username || settings.user.telegramId}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Generation Settings */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Generation Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Aspect Ratio
                  </label>
                  <select
                    value={formData.aspectRatio}
                    onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="1:1">1:1 (Square)</option>
                    <option value="16:9">16:9 (Landscape)</option>
                    <option value="9:16">9:16 (Portrait)</option>
                    <option value="3:4">3:4</option>
                    <option value="4:3">4:3</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Images
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={formData.numberOfImages}
                    onChange={(e) => setFormData({ ...formData, numberOfImages: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Safety Level
                  </label>
                  <select
                    value={formData.safetyLevel}
                    onChange={(e) => setFormData({ ...formData, safetyLevel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="BLOCK_NONE">Block None</option>
                    <option value="BLOCK_ONLY_HIGH">Block Only High</option>
                    <option value="BLOCK_MEDIUM_AND_ABOVE">Block Medium and Above</option>
                    <option value="BLOCK_LOW_AND_ABOVE">Block Low and Above</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language
                  </label>
                  <select
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="ru">Russian</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                    <option value="fr">French</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quality Settings */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Quality Settings</h2>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.hdQuality}
                    onChange={(e) => setFormData({ ...formData, hdQuality: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">HD Quality</span>
                </label>
              </div>
            </div>

            {/* Prompt Enhancement */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Prompt Enhancement</h2>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.autoEnhance}
                    onChange={(e) => setFormData({ ...formData, autoEnhance: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Auto Enhance Prompts</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.useNegativePrompt}
                    onChange={(e) => setFormData({ ...formData, useNegativePrompt: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Use Negative Prompts</span>
                </label>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Notifications</h2>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnComplete}
                    onChange={(e) => setFormData({ ...formData, notifyOnComplete: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Notify on Generation Complete</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notifyOnBonus}
                    onChange={(e) => setFormData({ ...formData, notifyOnBonus: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm">Notify on Bonus</span>
                </label>
              </div>
            </div>

            {/* Metadata */}
            <div className="border-t pt-4">
              <div className="text-sm text-gray-500">
                <p>Created: {new Date(settings.createdAt).toLocaleString()}</p>
                <p>Updated: {new Date(settings.updatedAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-4">
              <Link
                href="/users"
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
