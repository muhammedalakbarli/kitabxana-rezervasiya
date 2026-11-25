import { redirect } from "next/navigation";

/** Köhnə keçid: /rezerv/[kitabxana] → addım-addım ekran */
export default async function Legacy({ params, searchParams }: { params: Promise<{ library: string }>; searchParams: Promise<{ gun?: string; bolme?: string }> }) {
  const { library } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams({ k: library, ...(sp.gun ? { gun: sp.gun } : {}) });
  redirect(sp.bolme === "avadanliq" ? `/avadanliq?${q}` : `/rezerv?${q}`);
}
