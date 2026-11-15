/** Kitabxanadan istifadə qaydaları — tələb sənədindəki "SAYT ÜÇÜN MƏLUMAT" bölməsindən. */
export const RULES_VERSION = "2026-09";

export type RuleSection = { id: string; number: string; title: string; intro?: string; groups: { title?: string; items: string[] }[]; outro?: string };

export const RULE_SECTIONS: RuleSection[] = [
  {
    id: "komputer-noutbuk",
    number: "6",
    title: "Kompüter və noutbuklardan istifadə",
    intro:
      "Qarabağ Universitetinin Kitabxanasında universitetin akademik heyətinin, təhsilalanların və əməkdaşların tədris, elmi-tədqiqat və peşəkar fəaliyyətini dəstəkləmək məqsədilə kompüter və noutbuklardan istifadə xidməti təqdim olunur.",
    groups: [
      {
        title: "Kompüterlərdən istifadə",
        items: [
          "Kitabxananın oxu zallarında istifadəçilər üçün nəzərdə tutulmuş kompüterlərdən istifadə sərbəstdir və əvvəlcədən rezervasiya tələb etmir.",
          "Kompüter və internetdən yalnız tədris, elmi-tədqiqat və peşəkar fəaliyyət məqsədləri üçün istifadə edilməlidir.",
          "Oyun oynamaq, sosial şəbəkələrdə məqsədsiz vaxt keçirmək və digər qeyri-tədris fəaliyyətləri ilə məşğul olmaq yolverilməzdir.",
          "İstifadəçilər iş saatının bitməsinə ən azı 15 dəqiqə qalmış kompüterdəki işlərini yekunlaşdırmalıdırlar.",
          "İctimai istifadəyə açıq kompüterlərdə şəxsi və məxfi məlumatların saxlanılması tövsiyə edilmir. Məlumatların itirilməsi və ya təhlükəsizliyi ilə bağlı yarana biləcək risklərə görə məsuliyyət istifadəçinin üzərinə düşür.",
        ],
      },
      {
        title: "Noutbuklardan istifadə",
        items: [
          "Noutbuklar kitabxananın rezervasiya sistemi vasitəsilə və ya kitabxana əməkdaşına müraciət etməklə əvvəlcədən bron edilə bilər.",
          "Noutbuklar yalnız kitabxananın oxu zalında istifadə üçün təqdim olunur və kitabxana ərazisindən kənara çıxarıla bilməz.",
          "Noutbuk bir istifadəçiyə 3 saat müddətinə təqdim edilir.",
          "Noutbuk başqa istifadəçi tərəfindən rezervasiya edilmədiyi halda istifadə müddəti istifadəçinin müraciəti əsasında yalnız bir dəfə, maksimum 1 saat 30 dəqiqə uzadıla bilər.",
          "İstifadəçi noutbuku və ona təqdim edilmiş digər avadanlıqları təhvil aldığı vəziyyətdə, tam və saz şəkildə geri qaytarmağa görə məsuliyyət daşıyır.",
          "Noutbuklarda şəxsi məlumatların saxlanılması tövsiyə edilmir. İstifadədən sonra şəxsi hesabların sistemdən çıxarılması və məlumatların silinməsi istifadəçinin məsuliyyətidir.",
          "Kitabxana avadanlıqlarından istifadə qaydalarının pozulması, avadanlığın vaxtında qaytarılmaması və ya təhvil alındığı vəziyyətdə geri təqdim edilməməsi istifadəçinin müvafiq kitabxana xidmətlərindən istifadəsinin müvəqqəti məhdudlaşdırılmasına səbəb ola bilər.",
        ],
      },
    ],
    outro: "Rezervasiya həyata keçirən istifadəçi rezervasiyanı təsdiqləməklə Kitabxanadan istifadə qaydaları ilə tanış olduğunu və həmin qaydaları qəbul etdiyini təsdiq etmiş hesab olunur.",
  },
  {
    id: "oyrenme-otaqlari",
    number: "7",
    title: "Öyrənmə otaqları siyasəti",
    intro:
      "Qarabağ Universitetinin Kitabxanasında yerləşən öyrənmə otaqları universitetin akademik heyətinin, təhsilalanlarının və əməkdaşlarının fərdi təhsil, elmi-tədqiqat, qrup müzakirələri və digər akademik fəaliyyətlərini dəstəkləmək məqsədilə istifadəyə təqdim olunur.",
    groups: [
      {
        items: [
          "Öyrənmə otaqlarından istifadə yalnız əvvəlcədən rezervasiya əsasında mümkündür.",
          "Rezervasiya kitabxananın onlayn rezervasiya sistemi vasitəsilə həyata keçirilir. İstifadəçilərə rezervasiyanı istifadə vaxtından ən azı 30 dəqiqə əvvəl etmələri tövsiyə olunur.",
          "Hər bir öyrənmə otağı bir istifadəçiyə 1 (bir) saat müddətinə təqdim edilir. Qrup halında: 2 nəfər — 2 saat, 3 nəfər — 3 saat, 4 və daha çox nəfər — 4 saat. Otaqların maksimum tutumu 8 nəfərdir.",
          "İstifadəçi otaqdan istifadə etməzdən əvvəl rezervasiya sistemində otağa daxil olduğunu (QR kodu skan etməklə) təsdiqləməlidir. Texniki nasazlıq və ya istifadəçidən asılı olmayan hər hansı problem yarandıqda bu barədə kitabxana əməkdaşına məlumat verməlidir.",
          "İstifadəçi otaqdan yalnız rezervasiya olunmuş tarix və vaxt çərçivəsində istifadə edə bilər.",
          "Rezervasiya edilmiş vaxtın başlanmasından etibarən 5 dəqiqə ərzində istifadəçi otağa daxil olmadıqda, rezervasiya avtomatik olaraq ləğv edilə və otaq digər istifadəçilərin istifadəsinə verilə bilər.",
          "Qrup rezervasiyasında hər bir iştirakçı QR kodu skan etməlidir. Skan edənlərin sayı azdırsa, rezervasiya müddəti avtomatik həmin saya uyğun qısaldılır.",
          "3 dəfə rezerv edib gəlməyən istifadəçinin hesabı avtomatik bloklanır və blok yalnız kitabxana administratoru tərəfindən açıla bilər.",
          "Öyrənmə otaqları yalnız tədris, elmi-tədqiqat, fərdi və qrup şəklində öyrənmə fəaliyyəti, akademik müzakirələr və onlayn dərslər üçün istifadə edilməlidir.",
          "İstifadə başa çatdıqdan sonra otaq və avadanlıqlar təhvil alındığı vəziyyətdə səliqəli şəkildə təhvil verilməlidir.",
          "Otaqlardan istifadə zamanı kitabxananın ümumi davranış qaydalarına riayət edilməli, digər istifadəçilərin fəaliyyətinə mane olacaq səs-küy və davranışlara yol verilməməlidir.",
          "İstifadəçi kitabxana resurslarını vaxtında qaytarmadıqda, öyrənmə otaqları və ya digər rezervasiya olunan resurslardan istifadə qaydalarını pozduqda və ya onları təhvil aldığı vəziyyətdə geri qaytarmadıqda, kitabxana sistemi həmin istifadəçinin rezervasiya və digər xidmətlərdən istifadəsini müvəqqəti məhdudlaşdıra bilər.",
        ],
      },
    ],
    outro: "Rezervasiya prosesini tamamlayan istifadəçi Kitabxanadan İstifadə Qaydaları ilə tanış olduğunu və həmin qaydaları qəbul etdiyini təsdiq etmiş hesab olunur.",
  },
  {
    id: "komputer-muzakire",
    number: "12",
    title: "Kompüter və müzakirə otaqlarından istifadə",
    groups: [
      {
        items: [
          "12.1. Kompüter və noutbuklardan istifadə universitetin akademik heyəti, təhsilalan və əməkdaşlarının istifadəsi üçün nəzərdə tutulmuşdur.",
          "12.2. İstifadəçi bu xidmətlərdən onlayn qaydada və ya kitabxana əməkdaşına müraciət etməklə həyata keçirə bilər.",
          "12.3. Noutbuklar yalnız oxu zalında istifadə olunmaq şərti ilə istifadəçilərə 3 (üç) saat müddətinə təqdim edilir. İstifadə müddəti digər istifadəçi tərəfindən rezervasiya edilmədiyi hallarda istifadəçinin müraciəti əsasında uzadıla bilər. Noutbukların rezervasiyası və istifadə müddətinin uzadılması onlayn qaydada və ya kitabxana əməkdaşına müraciət etməklə həyata keçirilir.",
          "12.4. Noutbukdan istifadə müddətinin uzadılması ilkin istifadə müddətinin yarısı qədər olmaqla yalnız bir dəfə həyata keçirilə bilər. Məsələn, noutbuk ilk dəfə 3 (üç) saat müddətinə təqdim edildikdə, istifadə müddəti əlavə olaraq maksimum 1 saat 30 dəqiqə uzadıla bilər.",
          "12.5. Oxu zallarında istifadəçilər üçün nəzərdə tutulmuş kompüterlərdən istifadə zamanı, istifadəçilər iş saatının bitməsinə ən azı 15 dəqiqə qalmış işləri yekunlaşdırmalıdırlar.",
          "12.6. Kompüter və internetdən yalnız tədris və peşəkar fəaliyyət məqsədləri üçün istifadə etmək (oyunlar oynamaq, sosial şəbəkələrdə məqsədsiz vaxt keçirmək və digər qeyri-tədris fəaliyyətləri ilə məşğul olmaq qadağandır), istifadəçilər üçün nəzərdə tutulmuş kompüter və noutbuklarda şəxsi məlumatları saxlamamaq. Əks halda yaranan hər hansı risk və ya məlumat itkisinə görə məsuliyyət istifadəçinin üzərinə düşür.",
          "12.7. Müzakirə otaqlarından istifadə yalnız rezervasiya əsasında həyata keçirilir. Rezervasiya sistem üzərindən aparılır və istifadə vaxtından ən gec 30 (otuz) dəqiqə əvvəl edilməsi tövsiyə olunur. Müzakirə otağı bir istifadəçiyə 1 (bir) saat müddətinə təqdim edilir.",
          "12.8. İstifadəçi müzakirə otağından istifadə etməzdən əvvəl rezervasiya sistemində otağa daxil olduğunu təsdiqləməlidir. Texniki nasazlıq və ya istifadəçidən asılı olmayan digər hallarda bu barədə kitabxana əməkdaşına məlumat verməlidir. İstifadəçi otaqdan yalnız rezervasiya olunmuş vaxt çərçivəsində istifadə etməli və istifadə başa çatdıqdan sonra onu səliqəli vəziyyətdə təhvil verməlidir. Rezervasiya edilmiş vaxtın başlanmasından etibarən 5 (beş) dəqiqə ərzində otağa daxil olunmadıqda, rezervasiya sistem tərəfindən avtomatik ləğv edilir.",
          "12.9. İstifadəçi kitabxana resurslarını müəyyən edilmiş müddətdə qaytarmadıqda, öyrənmə otaqları və ya digər rezervasiya olunan resurslardan istifadə qaydalarını pozduqda, yaxud onları təhvil aldığı vəziyyətdə geri qaytarmadıqda, kitabxana sistemi həmin istifadəçinin xidmətlərdən istifadəsini müvəqqəti məhdudlaşdıra bilər. Rezervasiya zamanı istifadəçi kitabxanadan istifadə qaydaları ilə tanış olduğunu və onları qəbul etdiyini sistem vasitəsilə təsdiqlədikdən sonra rezervasiya prosesini davam etdirə bilər.",
        ],
      },
    ],
  },
];
