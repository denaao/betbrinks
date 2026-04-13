'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      router.replace('/login');
      return;
    }

    // Check role to decide destination
    try {
      const roleStr = localStorage.getItem('admin_role');
      if (roleStr) {
        const role = JSON.parse(roleStr);
        if (role.isAffiliate && !role.isAdmin && !role.isOwner) {
          router.replace('/affiliate');
          return;
        }
        if (role.isOwner && !role.isAdmin) {
          router.replace('/dashboard/owner');
          return;
        }
      }
    } catch {}

    router.replace('/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Redirecionando...</p>
    </div>
  );
}
