'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Credit Packages', href: '/', icon: '💎' },
  { name: 'Users', href: '/users', icon: '👥' },
  { name: 'Transactions', href: '/transactions', icon: '💳' },
  { name: 'Generations', href: '/generations', icon: '🎨' },
  { name: 'Analytics', href: '/analytics', icon: '📊' },
  { name: 'Admin Users', href: '/admin-users', icon: '🔐' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-gray-900 min-h-screen text-white">
      <div className="p-6">
        <h1 className="text-2xl font-bold">💎 BananaBot</h1>
        <p className="text-sm text-gray-400">Admin Panel</p>
      </div>

      <nav className="px-3 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
