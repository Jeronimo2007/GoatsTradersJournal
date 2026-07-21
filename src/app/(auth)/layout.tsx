import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-[radial-gradient(ellipse_at_top,_#151b24_0%,_var(--background)_55%)]">
      <Link
        href="/login"
        className="mb-8 flex flex-col items-center gap-3 text-foreground"
      >
        <Image
          src="/image.png"
          alt="Goats Traders Journal"
          width={120}
          height={120}
          className="h-[120px] w-[120px] rounded-xl object-cover"
          priority
        />
        <span className="text-xl font-semibold tracking-tight text-center">
          Goats Traders Journal
        </span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
