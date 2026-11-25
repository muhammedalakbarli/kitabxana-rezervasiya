import { redirect } from "next/navigation";

/** Köhnə keçid (bildirişlərdə ola bilər): otaq səhifəsi → addım-addım ekran, otaq və vaxt seçilmiş halda */
export default async function Legacy({ params, searchParams }: { params: Promise<{ library: string; room: string }>; searchParams: Promise<{ gun?: string; bas?: string }> }) {
  const { library, room } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams({ k: library, otaq: room, ...(sp.gun ? { gun: sp.gun } : {}), ...(sp.bas ? { bas: sp.bas } : {}) });
  redirect(`/rezerv?${q}`);
}
