export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Wardly</h1>
      <p className="text-gray-600">B2B procurement marketplace — MVP under construction.</p>
      <div className="flex gap-4">
        <a href="/login" className="rounded bg-gray-900 px-4 py-2 text-white">
          Log in
        </a>
        <a href="/register" className="rounded border border-gray-300 px-4 py-2">
          Register
        </a>
      </div>
    </main>
  );
}
