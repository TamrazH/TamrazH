import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page flex min-h-dvh flex-col items-center justify-center text-center">
      <div className="text-5xl" aria-hidden>🧭</div>
      <h1 className="mt-3 text-xl font-bold">Səhifə tapılmadı</h1>
      <Link href="/" className="btn-primary mt-4">Ana səhifəyə qayıt</Link>
    </div>
  );
}
