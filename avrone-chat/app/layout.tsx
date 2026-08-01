export const metadata = {
  title: 'Avrone Due\u2019Krey',
  description: 'Living intermediate lattice chat'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0f0f1a', color: '#eee' }}>{children}</body>
    </html>
  );
}
