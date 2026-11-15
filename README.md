# QU Kitabxana — Rezervasiya sistemi

Qarabağ Universiteti Kitabxanasının **fərdi oxu otaqları**, **noutbuk** və **adapterləri** üçün tam avtomatlaşdırılmış onlayn rezervasiya sistemi. Sistem gündəlik iş üçün kənar müdaxilə tələb etmir. Əl ilə yalnız bunlar edilir: əlavə vaxt müraciətlərinə admin baxır, blokları admin açır, avadanlığı əməkdaş təhvil verib qəbul edir.

- **Brend:** rənglər və şrift Qarabağ Universiteti brendbukuna (Sentyabr 2024) uyğundur. Rənglər: `#44766C`, `#16423C`, `#231F20`, `#F0F3BF`, `#D3E8BF`, `#CAEAF1`. Şrift Poppins-dir, ehtiyat şrift Tahoma. Loqo brendbukdan vektor şəklində götürülüb.
- **Dil:** Azərbaycan dili. Saat qurşağı Asia/Baku-dur.

---

## Funksionallıq

| Tələb | Həll |
|---|---|
| Yalnız `@qu.edu.az` ilə giriş | E-poçta birdəfəlik 6 rəqəmli kod göndərilir. **Microsoft 365 (Entra ID)** ilə giriş də hazırdır, açarlar əlavə olunduqda aktivləşir |
| Fakültə, ixtisas, qrup, kurs | İlk girişdə tələbə özü doldurur. `User.externalId` sahəsi universitet kataloqu ilə sinxronizasiya üçün ayrılıb |
| 2 kitabxana × 3 otaq, gələcəkdə yeni binalar | Admin paneldən istənilən sayda kitabxana, otaq və avadanlıq əlavə edilir |
| Müddət: 1 nəfər 1 saat, 2 nəfər 2 saat, 3 nəfər 3 saat, 4+ nəfər 4 saat; tutum 8 | Bütün limitlər admin tərəfindən dəyişdirilir. Tək nəfər üçün limit 1, 1.5 və ya 2 saat seçilə bilər |
| Dəvət sistemi | Rezerv edən qrup yoldaşlarını dəvət edir, onlar qəbul edir. 4 və daha çox nəfər üçün 3 nəfəri dəvət etmək kifayətdir |
| QR ilə təsdiq | Hər otağın unikal QR kodu var. Təsdiq başlanğıcdan **5 dəq əvvəl** açılır, **5 dəq sonra** bağlanır |
| Qrupda hər kəs skan etməlidir | Pəncərə bağlananda müddət skan edənlərin sayına görə yenidən hesablanır. Məsələn, 2 nəfərlik 2 saatlıq rezervdə 1 nəfər skan edibsə, rezerv 1 saata qısalır və qalan saat boşalır |
| Gəlməyən tələbə | Rezerv avtomatik ləğv olunur və tələbəyə xəbərdarlıq yazılır. **3 xəbərdarlıqdan sonra hesab avtomatik bloklanır**, bloku yalnız admin açır |
| "Boş olarsa məni məlumatlandır" | Vaxt boşalanda (ləğv, gəlməmə, qısaltma) növbədəki ilk istifadəçiyə bildiriş gedir. Vaxt 10 dəqiqə onun üçün saxlanılır, rezerv etməsə növbəti istifadəçiyə keçir |
| Əlavə vaxt üçün adminə mesaj | Tələbə səbəbini yazır. Admin vaxtın boş olub-olmadığını görür və bir kliklə təsdiqləyir və ya rədd edir |
| Noutbuk (5) və adapter (4) | Hər biri öz ID-si ilə görünür. Müddət 3 saatdır, yalnız iş saatları daxilində. Başqası rezerv etməyibsə **bir dəfə 50%-ə qədər** uzadılır və uzatma avtomatik təsdiqlənir |
| Gecikmə və ya qaytarılmama | Hesab avtomatik bloklanır. Zədəli qaytarılan avadanlığı əməkdaş qeyd edib istifadəçini bloklaya bilər |
| İş saatları B.e.–Cümə 09:00–18:00 | Saatlar hər kitabxana üçün ayrıca tənzimlənir. Bayram günləri admin paneldən əlavə edilir |
| Outlook və təqvim | Hər rezervasiya üçün e-poçtla **iCalendar dəvəti** göndərilir və Outlook-da avtomatik təqvimə düşür. Dəyişiklik və ləğv də təqvimə ötürülür. Hadisədən 15 dəq əvvəl xatırlatma gəlir |
| Fotoşəkillər | Hər otağın fotoları var, admin paneldən yeni foto yüklənə bilər. Noutbuk və adapter üçün vizuallar var |
| Qaydalar | "İstifadə qaydaları" səhifəsi var. Rezervasiyadan əvvəl qaydalar qəbul edilməlidir |

**Admin paneli (`/admin`):** canlı cədvəl, rezervasiyalar (əl ilə təsdiq və ləğv), əlavə vaxt müraciətləri, avadanlıq masası (təhvil və qəbul, istifadəçi adına rezerv), istifadəçilər (blok açma, rol), kitabxanalar, otaqlar, avadanlıq və fotolar, QR çapı (və kodun yenilənməsi), qaydalar, bayram günləri, audit və e-poçt jurnalı.

**Rollar:**
- **İstifadəçi:** rezerv edir.
- **Kitabxana əməkdaşı:** rezervasiyalar, müraciətlər, avadanlıq masası, bloklar.
- **Administrator:** əlavə olaraq qaydaları, kitabxanaları və rolları idarə edir.

---

## Texnologiyalar

- **Next.js 15** (App Router, Server Actions), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **PostgreSQL** + **Prisma ORM**. Üst-üstə düşən rezervlər baza səviyyəsində `EXCLUDE` constraint ilə qadağandır, əlavə olaraq Serializable tranzaksiya istifadə olunur
- **Nodemailer** ilə SMTP: Office 365 dəstəklənir. Outbox modeli var, göndərilməyən məktublar avtomatik təkrar cəhd edilir
- Fon prosesi (`worker`): QR pəncərələri, gəlməmə, növbə, avadanlıq və məktub təkrarı

---

## Lokal işə salma

```bash
npm install
cp .env.example .env           # AUTH_SECRET, CRON_SECRET, ADMIN_EMAILS doldurun
npm run db:start               # istifadəçi səviyyəsində PostgreSQL (port 5434), root tələb etmir
npx prisma migrate deploy
npm run db:seed                # 2 kitabxana, 6 otaq, 5 noutbuk, 4 adapter
npm run dev                    # http://localhost:3000
npm run worker:dev             # ayrıca terminalda — fon tapşırıqları
```

Test rejimində (`MAIL_MODE=log`, `DEV_MAILBOX=true`) məktublar göndərilmir. Giriş kodu və bütün məktublar **`/dev/poct`** səhifəsində görünür. `ADMIN_EMAILS` siyahısındakı ünvan ilk girişdə avtomatik administrator olur.

### Testlər

```bash
npm test                       # qayda məntiqi (unit, 20 test)
npm run test:integration       # real PostgreSQL üzərində domen ssenariləri (18 test)
```

İnteqrasiya testləri bunları yoxlayır:
- müddət limitləri və adminin dəyişdirdiyi limit;
- üst-üstə düşmə, o cümlədən eyni anda gələn iki sorğu;
- dəvət, iş saatları, gündəlik limit və blok;
- gəlməmə nəticəsində 3-cü dəfədən avtomatik blok;
- qrupun qısaldılması;
- növbədə vaxtın saxlanması və növbətiyə keçməsi;
- əlavə vaxt müraciəti;
- noutbukun uzadılması və qaytarılmayanda blok.

---

## Serverə yerləşdirmə (Docker)

```bash
cp .env.example .env            # dəyərləri doldurun (aşağıya baxın)
docker compose up -d --build    # db + app + worker
docker compose run --rm app seed    # yalnız ilk dəfə
```

Konteyner işə düşəndə miqrasiyalar avtomatik tətbiq olunur. Sağlamlıq yoxlaması: `GET /api/health`.

Docker-siz də işləmək olar:
1. `npm run build && npm run build:scripts`
2. `.next/standalone/server.js`-i işə salın.
3. Yanına `.next/static` və `public` qovluqlarını kopyalayın.
4. Fon prosesi üçün: `node dist/scripts/worker.js`.

> **Vacib:** reverse proxy (nginx və s.) arxasında işləyin, HTTPS istifadə edin və `APP_URL`-i `https://...` kimi yazın. Real istifadədə `DEV_MAILBOX=false` olmalıdır.

---

## Rəqəmsal şöbə üçün inteqrasiya təlimatı

### 1. Baza
- Sxem `prisma/schema.prisma`-dadır, miqrasiyalar `prisma/migrations/` qovluğundadır.
- `DATABASE_URL` mövcud PostgreSQL serverinə yönləndirilə bilər.
- JSON sahələri və massivlər istifadə olunmayıb. Lazım olarsa provider `sqlserver` və ya `mysql`-ə dəyişdirilə bilər. Bu halda yalnız `EXCLUDE` constraint-i silinir, tətbiq səviyyəsindəki yoxlama qalır.
- Universitet sistemlərinin oxuması üçün əsas cədvəllər: `User`, `Reservation`, `ReservationParticipant`, `EquipmentReservation`, `AuditLog`.

### 2. Outlook bildirişləri və təqvim (SMTP)
- Göndərmə üçün bir poçt qutusu yaradın, məsələn `kitabxana@qu.edu.az`.
- Exchange Online-da bu qutu üçün **Authenticated SMTP** aktiv olmalıdır.
- `.env` dəyərləri:
  ```
  MAIL_MODE=smtp
  SMTP_HOST=smtp.office365.com
  SMTP_PORT=587
  SMTP_USER=kitabxana@qu.edu.az
  SMTP_PASS=...
  MAIL_FROM="QU Kitabxana <kitabxana@qu.edu.az>"
  ```
- Hər rezerv, dəyişiklik, qısaltma, uzatma və ləğv `METHOD:REQUEST` və ya `CANCEL` iCalendar dəvəti kimi göndərilir. Outlook bunları avtomatik təqvimə əlavə edir və yeniləyir.

### 3. Microsoft 365 ilə giriş (Entra ID SSO)
1. Entra ID → App registrations → New registration.
2. Hesab növü: *Single tenant*.
3. Redirect URI (Web): `{APP_URL}/auth/microsoft/callback`.
4. API permissions: Microsoft Graph → Delegated → `User.Read`, `openid`, `profile`, `email`, `offline_access`.
5. Certificates & secrets bölməsində yeni client secret yaradın.
6. `.env`-ə yazın:
   ```
   MS_TENANT_ID=...
   MS_CLIENT_ID=...
   MS_CLIENT_SECRET=...
   ```

Bundan sonra giriş səhifəsində "Microsoft 365 ilə daxil ol" düyməsi görünəcək. İstifadəçinin `id`, `displayName` və `department` məlumatları Graph-dan avtomatik götürülür (`src/lib/microsoft.ts`).

### 4. Tələbə məlumatları (fakültə, ixtisas, qrup, kurs)
- Hazırda bu məlumatları tələbə ilk girişdə özü doldurur.
- Universitet sistemi ilə inteqrasiya üçün `User` cədvəlindəki bu sahələri sinxronizasiya etmək kifayətdir: `faculty`, `specialty`, `groupName`, `course`, `studentNumber`, `externalId`.
- Sinxronizasiya edilmiş istifadəçi üçün `profileCompletedAt` dolu olarsa, profil formu göstərilmir.
- Sinxronizasiya üç yolla qurula bilər:
  - gecəlik SQL `UPSERT`;
  - SIS-dən API;
  - Graph `department` sahəsi.

### 5. Fon tapşırıqları
İki variantdan biri kifayətdir:
- **Variant 1:** `worker` prosesi (docker-compose-da hazırdır, hər 30 saniyədə bir işləyir).
- **Variant 2:** xarici cron hər dəqiqə bu sorğunu göndərir:
  ```
  GET /api/cron
  Authorization: Bearer <CRON_SECRET>
  ```

Ehtiyat olaraq bu tapşırıqlar səhifələr açılarkən də işləyir, ona görə vəziyyət heç vaxt köhnəlmir.

### 6. QR kodlar
- Kodlar `/admin/qr` səhifəsindən çap olunur, qapılara yapışdırmaq üçün brendli kart şəklindədir.
- Hər kartda əl ilə daxil etmək üçün qısa kod da var.
- Kod paylaşılıbsa, "Kodu yenilə" ilə köhnə kod dərhal etibarsız olur.
- QR-ın şəkli çəkilib otaqdan kənarda istifadə olunmasının qarşısını almaq üçün `CHECKIN_ALLOWED_CIDRS` ilə təsdiqi yalnız universitet Wi-Fi şəbəkəsinə məhdudlaşdırmaq olar. Bu halda proxy `X-Forwarded-For` başlığını düzgün ötürməlidir.

---

## Qəbul edilmiş qərarlar (dəyişdirilə bilər)

| Mövzu | Standart dəyər | Harada dəyişir |
|---|---|---|
| QR pəncərəsi | başlanğıcdan 5 dəq əvvəl – 5 dəq sonra | Admin → Qaydalar |
| Gündəlik otaq limiti | 1 rezerv (sahib və ya iştirakçı kimi) | Admin → Qaydalar |
| Nə qədər əvvəldən rezerv etmək olar | 7 gün | Admin → Qaydalar |
| Növbədə saxlanma müddəti | 10 dəq | Admin → Qaydalar |
| Avadanlığın götürülməsi | başlanğıcdan 15 dəq ərzində, əks halda ləğv olunur | Admin → Qaydalar |
| Qaytarma gecikməsinə güzəşt | 10 dəq, sonra avtomatik blok | Admin → Qaydalar |
| Adapter müddəti | 3 saat (noutbukla eyni) | Admin → Qaydalar |
| Noutbuk və adapterlərin yeri | Əsas bina kitabxanası | Admin → Kitabxanalar → avadanlıq |
| Blok açılanda xəbərdarlıq sayı | sıfırlanır | — |

---

## Qovluq quruluşu

```
prisma/              sxem, miqrasiyalar (+ EXCLUDE constraint), seed
src/lib/             domen məntiqi
  rules.ts           təmiz qayda funksiyaları (unit testli)
  reservations.ts    rezerv, dəvət, QR, yekunlaşdırma, əlavə vaxt
  waitlist.ts        növbə
  equipment.ts       noutbuk və adapter
  sweep.ts           fon tapşırıqları
  auth.ts            giriş və sessiya
  microsoft.ts       Entra ID
  mail.ts, ics.ts    e-poçt və təqvim
src/app/(public)     ana səhifə, qaydalar, giriş
src/app/(app)        tələbə interfeysi (panel, rezerv, rezervasiyalarım, QR skan)
src/app/admin        idarəetmə paneli
scripts/worker.ts    fon prosesi
tests/               unit və inteqrasiya testləri
```
