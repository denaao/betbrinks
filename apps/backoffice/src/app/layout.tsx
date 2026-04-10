import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'betbrinks Backoffice',
  description: 'Painel administrativo do betbrinks',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
