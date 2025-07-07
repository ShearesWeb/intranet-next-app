'use client';

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-center min-h-screen bg-orange-500">
      <button
        className="bg-white text-orange-500 font-semibold text-lg py-3 px-6 rounded transition-colors hover:bg-gray-200"
        onClick={() => router.push("/auth/login")}
      >
        Take me to auth
      </button>
    </div>
  );
}
