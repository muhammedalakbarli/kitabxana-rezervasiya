import { redirect } from "next/navigation";

export default async function Legacy({ params, searchParams }: { params: Promise<{ library: string; item: string }>; searchParams: Promise<{ gun?: string }> }) {
  const { library, item } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams({ k: library, item, ...(sp.gun ? { gun: sp.gun } : {}) });
  redirect(`/avadanliq?${q}`);
}
