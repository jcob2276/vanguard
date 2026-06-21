import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 text-center p-8">
      <p className="text-7xl font-black text-primary">404</p>
      <p className="text-lg font-semibold">Nie znaleziono strony</p>
      <p className="text-sm text-text-muted">Ten adres URL nie istnieje w aplikacji.</p>
      <Link to="/" replace className="mt-4 text-sm text-primary hover:underline">← Wróć do Vanguard</Link>
    </div>
  );
}
