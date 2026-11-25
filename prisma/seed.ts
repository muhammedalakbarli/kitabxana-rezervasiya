/**
 * Başlanğıc məlumatları (təkrar işə salmaq təhlükəsizdir — mövcud qeydlər yenilənir).
 * 2 kitabxana × 3 fərdi oxu otağı, 5 noutbuk, 4 adapter.
 */
import { PrismaClient } from "@prisma/client";
import { qrToken } from "../src/lib/tokens";
import { hashPassword } from "../src/lib/password";

const db = new PrismaClient();

/** Fakültələrin ilkin siyahısı — super admin paneldən dəyişdirilə bilər */
const FACULTIES = [
  { name: "Mühəndislik fakültəsi", shortName: "MF" },
  { name: "Biznes və iqtisadiyyat fakültəsi", shortName: "BİF" },
  { name: "Pedaqoji fakültə", shortName: "PF" },
  { name: "Humanitar və sosial elmlər fakültəsi", shortName: "HSEF" },
  { name: "İncəsənət fakültəsi", shortName: "İF" },
  { name: "Tibb fakültəsi", shortName: "TF" },
];

const libraries = [
  {
    slug: "esas-bina",
    name: "Əsas bina kitabxanası",
    shortName: "Əsas bina",
    building: "Əsas tədris binası",
    description: "Universitetin əsas binasında yerləşən kitabxana. 3 fərdi oxu otağı fərdi və qrup şəklində öyrənmə üçün təqdim olunur.",
    coverPhoto: "/media/rooms/esas-otaq-2-a.jpg",
    sortOrder: 1,
    rooms: [
      { slug: "otaq-1", name: "Otaq 1", code: null, photos: ["esas-otaq-1-a.jpg", "esas-otaq-1-b.jpg"] },
      { slug: "otaq-2", name: "Otaq 2", code: null, photos: ["esas-otaq-2-a.jpg", "esas-otaq-2-b.jpg"] },
      { slug: "otaq-3", name: "Otaq 3", code: null, photos: ["esas-otaq-3-a.jpg", "esas-otaq-3-b.jpg"] },
    ],
  },
  {
    slug: "iqtisadiyyat",
    name: "İqtisadiyyat fakültəsi kitabxanası",
    shortName: "İqtisadiyyat (BİF)",
    building: "İqtisadiyyat fakültəsinin binası (BİF)",
    description: "İqtisadiyyat fakültəsinin binasında yerləşən kitabxana. 3 qrup otağı eyni qaydalarla rezerv olunur.",
    coverPhoto: "/media/rooms/bif-bo203.jpg",
    sortOrder: 2,
    rooms: [
      { slug: "bo203", name: "Otaq 1", code: "BO203", photos: ["bif-bo203.jpg"] },
      { slug: "bo204", name: "Otaq 2", code: "BO204", photos: ["bif-bo204.jpg"] },
      { slug: "bo205", name: "Otaq 3", code: "BO205", photos: ["bif-bo205.jpg"] },
    ],
  },
];

async function main() {
  // 1) Fakültələr (yalnız cədvəl boşdursa)
  if ((await db.faculty.count()) === 0) {
    for (const [i, f] of FACULTIES.entries()) await db.faculty.create({ data: { ...f, sortOrder: i + 1 } });
    console.log(`${FACULTIES.length} fakültə əlavə edildi`);
  }

  // 2) Kitabxanalar, otaqlar, avadanlıq (--if-empty: baza doludursa toxunma)
  const skipStructure = process.argv.includes("--if-empty") && (await db.library.count()) > 0;
  if (!skipStructure) {
  for (const lib of libraries) {
    const { rooms, ...data } = lib;
    const l = await db.library.upsert({ where: { slug: lib.slug }, create: data, update: {} });
    for (const [i, r] of rooms.entries()) {
      const room = await db.room.upsert({
        where: { libraryId_slug: { libraryId: l.id, slug: r.slug } },
        create: {
          libraryId: l.id,
          slug: r.slug,
          name: r.name,
          code: r.code,
          capacity: 8,
          sortOrder: i + 1,
          qrToken: qrToken(),
          description: "Fərdi və qrup şəklində öyrənmə, akademik müzakirələr və onlayn dərslər üçün sakit otaq.",
          features: ["Dəyirmi iş masası", "Maksimum 8 nəfər", "Saxlama şkafı", "Wi-Fi"].join("\n"),
        },
        update: {},
      });
      const existing = await db.roomPhoto.count({ where: { roomId: room.id } });
      if (!existing) {
        await db.roomPhoto.createMany({
          data: r.photos.map((p, k) => ({ roomId: room.id, url: `/media/rooms/${p}`, alt: `${l.shortName} — ${r.name}`, sortOrder: k })),
        });
      }
    }
  }

  const mainLib = await db.library.findUniqueOrThrow({ where: { slug: "esas-bina" } });
  for (let i = 1; i <= 5; i++) {
    const tag = `NB-0${i}`;
    await db.equipment.upsert({
      where: { assetTag: tag },
      create: {
        libraryId: mainLib.id,
        type: "LAPTOP",
        assetTag: tag,
        name: `Noutbuk ${i}`,
        description: "Tədris və elmi-tədqiqat işləri üçün noutbuk. Yalnız kitabxananın oxu zalında istifadə olunur.",
        photoUrl: i % 2 ? "/media/equipment/noutbuk-a.jpg" : "/media/equipment/noutbuk-b.jpg",
        qrToken: qrToken(),
        sortOrder: i,
      },
      update: {},
    });
  }
  for (let i = 1; i <= 4; i++) {
    const tag = `AD-0${i}`;
    await db.equipment.upsert({
      where: { assetTag: tag },
      create: {
        libraryId: mainLib.id,
        type: "ADAPTER",
        assetTag: tag,
        name: `Adapter ${i}`,
        description: "USB-C çoxportlu adapter (HDMI, USB-A, USB-C). Noutbukdan asılı olmayaraq ayrıca rezerv oluna bilər.",
        photoUrl: "/media/equipment/adapter.svg",
        qrToken: qrToken(),
        sortOrder: 10 + i,
      },
      update: {},
    });
  }

  } else {
    console.log("Struktur buraxıldı: kitabxanalar artıq mövcuddur.");
  }

  // 3) Kitabxananı fakültəyə bağla (boşdursa)
  const bif = await db.faculty.findFirst({ where: { name: "Biznes və iqtisadiyyat fakültəsi" } });
  if (bif) await db.library.updateMany({ where: { slug: "iqtisadiyyat", facultyId: null }, data: { facultyId: bif.id } });

  // 4) Super admin(lər) — şifrə yalnız boşdursa SEED_SUPERADMIN_PASSWORD-dan
  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const saPw = process.env.SEED_SUPERADMIN_PASSWORD;
  for (const email of adminEmails) {
    const u = await db.user.upsert({
      where: { email },
      create: { email, role: "SUPERADMIN", name: "Kitabxana Administratoru", firstName: "Kitabxana", lastName: "Administratoru", userType: "EMPLOYEE", department: "Kitabxana", profileCompletedAt: new Date() },
      update: { role: "SUPERADMIN", libraryId: null },
    });
    if (!u.passwordHash && saPw) {
      await db.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(saPw), passwordSetAt: new Date(), emailVerifiedAt: new Date() } });
      console.log(`Super admin şifrəsi təyin edildi: ${email}`);
    }
  }

  // 5) Demo supervayzerlər (yalnız SEED_SUPERVISOR_PASSWORD verilibsə)
  const svPw = process.env.SEED_SUPERVISOR_PASSWORD;
  if (svPw) {
    const demo = [
      { email: "esas.admin@qu.edu.az", firstName: "Əsas bina", lastName: "Supervayzeri", slug: "esas-bina" },
      { email: "bif.admin@qu.edu.az", firstName: "BİF", lastName: "Supervayzeri", slug: "iqtisadiyyat" },
    ];
    for (const d of demo) {
      const lib = await db.library.findUnique({ where: { slug: d.slug } });
      if (!lib) continue;
      const existing = await db.user.findUnique({ where: { email: d.email } });
      if (existing) continue;
      await db.user.create({
        data: {
          email: d.email, role: "SUPERVISOR", libraryId: lib.id, firstName: d.firstName, lastName: d.lastName, name: `${d.firstName} ${d.lastName}`,
          userType: "EMPLOYEE", department: `${lib.shortName} kitabxanası`, profileCompletedAt: new Date(),
          passwordHash: await hashPassword(svPw), passwordSetAt: new Date(), emailVerifiedAt: new Date(),
        },
      });
      console.log(`Demo supervayzer yaradıldı: ${d.email}`);
    }
  }

  const counts = await Promise.all([db.library.count(), db.room.count(), db.equipment.count(), db.user.count()]);
  console.log(`Seed tamamlandı: ${counts[0]} kitabxana, ${counts[1]} otaq, ${counts[2]} avadanlıq, ${counts[3]} istifadəçi, ${await db.faculty.count()} fakültə`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
