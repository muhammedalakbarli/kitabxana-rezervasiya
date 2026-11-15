import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BellRing, CalendarCheck2, Clock3, Laptop, Mail, QrCode, ShieldCheck, Users } from "lucide-react";
import { BrandPattern } from "@/components/pattern";
import { Badge, LinkButton } from "@/components/ui";
import { db } from "@/lib/db";
import { getRules } from "@/lib/settings";
import { fmtDuration, hhmm } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [libraries, rules, laptopCount, adapterCount] = await Promise.all([
    db.library.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { rooms: { where: { isActive: true }, select: { id: true } } },
    }),
    getRules(),
    db.equipment.count({ where: { type: "LAPTOP", isActive: true } }),
    db.equipment.count({ where: { type: "ADAPTER", isActive: true } }),
  ]);
  const roomCount = libraries.reduce((n, l) => n + l.rooms.length, 0);

  const durations = [
    { who: "1 nəfər", time: fmtDuration(rules.soloMaxMinutes) },
    { who: "2 nəfər", time: fmtDuration(rules.duoMaxMinutes) },
    { who: "3 nəfər", time: fmtDuration(rules.trioMaxMinutes) },
    { who: "4+ nəfər", time: fmtDuration(rules.groupMaxMinutes) },
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-500 text-white">
        <BrandPattern className="absolute inset-0 h-full w-full text-white" opacity={0.16} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <Badge tone="cream" className="mb-5">Qarabağ Universiteti Kitabxanası</Badge>
            <h1 className="text-[34px] leading-[1.15] font-semibold tracking-tight sm:text-5xl">
              Fərdi oxu otaqlarını <span className="text-cream">bir neçə saniyəyə</span> rezerv edin
            </h1>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/85">
              Boş vaxtları canlı görün, qrup yoldaşlarınızı dəvət edin, otaqdakı QR kodu skan edərək gəldiyinizi təsdiqləyin.
              Noutbuk və adapterləri də buradan rezerv edə bilərsiniz.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/giris" variant="light" size="lg">
                <Mail className="size-4.5" /> Universitet e-poçtu ilə daxil ol
              </LinkButton>
              <Link href="/qaydalar" className="inline-flex h-13 items-center gap-2 rounded-xl px-5 text-[15px] font-semibold text-white ring-1 ring-white/40 hover:bg-white/10">
                Qaydalarla tanış ol <ArrowRight className="size-4" />
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-4 gap-3">
              {[
                [libraries.length, "kitabxana"],
                [roomCount, "oxu otağı"],
                [laptopCount, "noutbuk"],
                [adapterCount, "adapter"],
              ].map(([n, l]) => (
                <div key={String(l)} className="rounded-2xl bg-white/10 px-3 py-3 ring-1 ring-white/15">
                  <dt className="sr-only">{l}</dt>
                  <dd className="text-2xl font-semibold">{n}</dd>
                  <div className="text-xs text-white/75">{l}</div>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <div className="relative mt-10 aspect-[3/4] overflow-hidden rounded-3xl shadow-lift ring-4 ring-white/15">
                <Image src="/media/rooms/esas-otaq-2-a.jpg" alt="Əsas bina — Otaq 2" fill sizes="280px" className="object-cover" priority />
              </div>
              <div className="relative aspect-[3/4] overflow-hidden rounded-3xl shadow-lift ring-4 ring-white/15">
                <Image src="/media/rooms/bif-bo203.jpg" alt="BİF — BO203" fill sizes="280px" className="object-cover" priority />
              </div>
            </div>
            <div className="absolute -bottom-4 left-6 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-brand-900 shadow-lift">
              <span className="grid size-10 place-items-center rounded-xl bg-mint"><QrCode className="size-5 text-brand-700" /></span>
              <div className="text-sm">
                <div className="font-semibold">QR ilə təsdiq</div>
                <div className="text-brand-900/60">Başlanğıcdan {rules.checkInAfterMinutes} dəq ərzində</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Necə işləyir */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">Necə işləyir</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900">4 addımda rezervasiya</h2>
        </div>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Mail, title: "Daxil olun", text: "Yalnız @qu.edu.az e-poçtu ilə. İlk girişdə fakültə, ixtisas, qrup və kurs məlumatlarınızı qeyd edin." },
            { icon: CalendarCheck2, title: "Bina və vaxt seçin", text: "Kitabxananı seçin, otaqların boş vaxtlarını canlı görün və sizə uyğun vaxtı rezerv edin." },
            { icon: Users, title: "Dostlarınızı dəvət edin", text: "Qrup halında gəlirsinizsə, yoldaşlarınızı dəvət edin — nəfər sayına görə müddət artır." },
            { icon: QrCode, title: "QR kodu skan edin", text: `Vaxt çatanda otaqdakı QR kodu ${rules.checkInAfterMinutes} dəqiqə ərzində skan edin. Əks halda rezerv ləğv olunur.` },
          ].map((s, i) => (
            <li key={s.title} className="card relative p-5">
              <span className="absolute top-5 right-5 text-4xl font-semibold text-brand-100">{i + 1}</span>
              <span className="grid size-11 place-items-center rounded-xl bg-brand-500 text-white"><s.icon className="size-5" /></span>
              <h3 className="mt-4 font-semibold text-brand-900">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-brand-900/65">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Müddət qaydaları */}
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">Müddət qaydaları</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900">Nə qədər çox nəfər — o qədər uzun müddət</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-brand-900/70">
              Hər otağın maksimum tutumu 8 nəfərdir. Müddət QR kodu skan edən nəfər sayına görə müəyyən olunur: məsələn,
              2 nəfərlik rezervdə yalnız 1 nəfər skan edərsə, rezervasiya avtomatik {fmtDuration(rules.soloMaxMinutes)}-a qısalır və qalan vaxt başqaları üçün açılır.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-brand-900/80">
              <li className="flex gap-3"><BellRing className="size-5 shrink-0 text-brand-500" /> Vaxt doludursa “Boş olarsa məni məlumatlandır” — boşalan kimi bildiriş alırsınız.</li>
              <li className="flex gap-3"><Clock3 className="size-5 shrink-0 text-brand-500" /> Əlavə vaxt lazımdırsa, səbəbini yazıb administratora müraciət edə bilərsiniz.</li>
              <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-brand-500" /> {rules.noShowLimit} dəfə rezerv edib gəlməyən istifadəçinin hesabı avtomatik bloklanır.</li>
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            {durations.map((d, i) => (
              <div key={d.who} className={`rounded-2xl p-5 ${["bg-mint", "bg-sky", "bg-cream", "bg-brand-500 text-white"][i]}`}>
                <Users className={`size-5 ${i === 3 ? "text-cream" : "text-brand-700"}`} />
                <div className="mt-6 text-sm font-medium opacity-80">{d.who}</div>
                <div className="text-2xl font-semibold">{d.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Kitabxanalar */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">Kitabxanalar</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900">Binanızı seçin</h2>
          </div>
          <p className="max-w-md text-sm text-brand-900/60">Yeni fakültə binaları istifadəyə verildikcə onların kitabxanaları da sistemə əlavə olunacaq.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {libraries.map((lib) => (
            <Link key={lib.id} href={`/rezerv/${lib.slug}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="relative h-56 overflow-hidden">
                {lib.coverPhoto && <Image src={lib.coverPhoto} alt={lib.name} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/80 via-brand-900/10 to-transparent" />
                <div className="absolute bottom-4 left-5 text-white">
                  <div className="text-xl font-semibold">{lib.name}</div>
                  <div className="text-sm text-white/80">{lib.building}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success">{lib.rooms.length} oxu otağı</Badge>
                  <Badge tone="neutral">{hhmm(lib.openMinute)}–{hhmm(lib.closeMinute)}</Badge>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 group-hover:gap-2 transition-all">Rezerv et <ArrowRight className="size-4" /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Avadanlıq */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-900 text-white">
          <BrandPattern className="absolute inset-0 h-full w-full text-white" opacity={0.1} />
          <div className="relative grid items-center gap-8 p-8 sm:p-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <Badge tone="cream">Avadanlıq</Badge>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Noutbuk və adapter lazımdır?</h2>
              <p className="mt-3 max-w-lg text-white/75">
                {laptopCount} noutbuk və {adapterCount} adapter öz identifikatorları ilə sistemdə görünür. Noutbuk {fmtDuration(rules.laptopMaxMinutes)} müddətinə yalnız oxu zalında istifadə üçün təqdim olunur
                və başqası rezerv etməyibsə bir dəfə {rules.equipmentExtensionPercent}% uzadıla bilər.
              </p>
              <LinkButton href="/rezerv" variant="light" className="mt-6"><Laptop className="size-4.5" /> Avadanlıq rezerv et</LinkButton>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/15">
                <Image src="/media/equipment/noutbuk-a.jpg" alt="Noutbuk" fill sizes="240px" className="object-cover" />
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/15">
                <Image src="/media/equipment/adapter.svg" alt="Adapter" fill sizes="240px" className="object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
