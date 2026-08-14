'use client';


import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// O dashboard depende fortemente de localStorage/window já na inicialização
// dos estados (useState(() => localStorage.getItem(...))), então ele é
// carregado apenas no cliente (ssr: false) para evitar erros de
// "localStorage is not defined" durante o server-side rendering do Next.js.
const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  ssr: false,
});

export default function Page() {
  return <Dashboard />;
}
