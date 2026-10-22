
import { requireAuth } from "@/lib/api/auth";

export default async function LinkTelegramPage() {
  const user = await requireAuth();

  return (
    <main className="mx-auto max-w-lg p-8">
      <div className="rounded-xl border p-6 shadow-sm">
        <h1 className="mb-3 text-2xl font-bold">
          Link Telegram Account
        </h1>

        <p className="mb-6 text-gray-600">
          Connect your Telegram account to your
          Sheares Intranet profile.
        </p>

        <div className="mb-6 rounded-lg bg-gray-100 p-4 text-black">
          <p className="font-semibold">Your Intranet Account</p>
          <p>Name: {user.name}</p>
          <p>Room: {user.room}</p>
          <p>Email: {user.email}</p>
        </div>

        <p className="text-sm text-gray-500">
          Telegram verification is not connected yet.
          Account linking is currently unavailable.
        </p>

        <button
          disabled
          className="mt-6 w-full cursor-not-allowed rounded-lg
                     bg-gray-400 px-4 py-3 text-white"
        >
          Confirm Telegram Account
        </button>
      </div>
    </main>
  );
}
