import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FAKER — Um de vocês não sabe.',
  description: 'Todo mundo sabe. Um só disfarça. FAKER é o jogo de palavras e blefe para jogar com amigos em um único celular.',
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      {/* Browser extensions may inject body attributes (e.g. cz-shortcut-listen).
          Suppress only this element's mismatch; child hydration checks stay enabled. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
