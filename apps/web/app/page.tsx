import Link from "next/link";

export default function Home() {
  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">AI Assistant</h1>
      <p className="text-gray-600 mt-2">
        Asystent dla firm — odpowiedzi na podstawie podłączonych źródeł (CRM, dokumenty, arkusze).
      </p>
      <div className="mt-6 flex gap-4">
        <Link
          href="/login"
          className="text-blue-600 hover:underline"
        >
          Zaloguj się
        </Link>
        <Link
          href="/chat"
          className="text-blue-600 hover:underline"
        >
          Chat
        </Link>
        <Link
          href="/admin"
          className="text-blue-600 hover:underline"
        >
          Admin
        </Link>
      </div>
    </main>
  );
}
