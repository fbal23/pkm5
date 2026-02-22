import './globals.css';
import { DimensionIconsProvider } from '@/context/DimensionIconsContext';

export const metadata = {
  title: 'PKM5 Open Source',
  description: 'Local-first research workspace with a BYO-key AI orchestrator',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <DimensionIconsProvider>
          {children}
        </DimensionIconsProvider>
      </body>
    </html>
  );
}
