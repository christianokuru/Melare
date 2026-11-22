import Image from "next/image";

export const metadata = { title: "Offline", robots: { index: false } };

export default function Offline() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src="/logo.svg" alt="Melaré" width={160} height={70} />
      <p className="text-muted-foreground">You’re offline. Reconnect to keep shopping.</p>
    </main>
  );
}
