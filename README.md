# Devrem

Devrem, zorunlu askerlik hizmetine hazırlanan kişiler için geliştirilen Türkçe bir mobil uygulamadır. Ürün vizyonu; hazırlık, geri sayım, eşleşme ve iletişim ihtiyaçlarını tek bir güvenilir mobil deneyimde toplamaktır.

> Askere hazırlanmanın tek uygulaması.

## Mevcut durum

Phase 2A tamamlandı: Phase 1 uygulama temeline Firebase JavaScript SDK, tip güvenli environment doğrulaması ve güvenli, tekil Firebase başlatma katmanı eklendi.

Henüz kimlik doğrulama, Firestore, Storage, sohbet, eşleşme, kullanıcı profili veya Cloud Functions işlevi uygulanmamıştır.

## Teknoloji yığını

- React Native ve Expo SDK 57
- TypeScript (strict)
- Expo Router
- Firebase JavaScript SDK (modular API)
- React Native Safe Area Context
- ESLint

Zustand ve TanStack Query yalnızca somut bir özellik ihtiyacı oluştuğunda eklenecektir.

## Başlangıç

Gereksinimler: desteklenen bir Node.js LTS sürümü ve npm veya pnpm.

```bash
pnpm install
pnpm start
```

Diğer komutlar:

```bash
pnpm android
pnpm ios
pnpm web
pnpm typecheck
pnpm lint
```

Windows üzerinde iOS simülatörü çalışmaz; iOS için macOS/Xcode veya fiziksel cihaz gerekir.

## Mimari

```text
app/                         # Yalın Expo Router rota girişleri
  (tabs)/                    # Beş ana uygulama sekmesi
src/
  components/
    common/                  # Ekran kabı ve uygulama-geneli durumlar
    ui/                      # Tasarım sistemi bileşenleri
  config/
    env.ts                   # Merkezi environment okuma ve doğrulama
  features/                  # Özellik ekranları ve gelecekteki iş mantığı
    auth/ onboarding/ home/ preparation/ matching/ chat/ profile/
  hooks/                     # Paylaşılan hook'lar
  services/firebase/
    app.ts                   # Tekil ve lazy Firebase uygulama başlatma
    index.ts                 # Firebase servis sınırının public API'si
  store/                     # Gelecekteki global istemci durumu
  theme/                     # Renkler, token'lar ve tema sağlayıcısı
  types/                     # Paylaşılan alan tipleri
  utils/                     # Saf yardımcı fonksiyonlar
```

`app/` kökte tutulur çünkü Expo Router dosya tabanlı rotaları buradan üretir. Rota dosyaları yalnızca özellik ekranlarını bağlar; iş mantığı `src/features` içinde kalır.

## Phase 2A: Firebase altyapısı

Expo managed architecture ile uyumlu resmi Firebase JavaScript SDK kullanılır. Native React Native Firebase paketleri bu fazda gerekli değildir ve proje prebuild/eject edilmemiştir.

Firebase uygulaması `src/services/firebase/app.ts` içindeki `getFirebaseApp()` üzerinden ihtiyaç anında başlatılır. `getApps()` kontrolü Fast Refresh sırasında ikinci bir Firebase app oluşturulmasını engeller. Rota ve UI bileşenleri `firebase/app` veya başlatma ayrıntılarını doğrudan import etmemelidir; gelecek özellik adaptörleri `src/services/firebase` sınırının arkasında kalmalıdır.

Auth, Firestore ve Storage servisleri henüz başlatılmaz. Bunlar ilgili fazlarda ayrı adaptörler olarak eklenecektir.

### Yerel environment kurulumu

Örnek dosyayı yerel ve Git tarafından yok sayılan bir dosyaya kopyalayın:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Firebase Console'da development projesini açın ve **Project settings → General → Your apps** altında bir web uygulaması kaydedin. Verilen client configuration değerlerini `.env.local` içine yerleştirin:

```dotenv
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

`EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` Analytics eklenene kadar opsiyoneldir. Diğer değerler Firebase ilk kez kullanıldığında `src/config/env.ts` tarafından doğrulanır. Eksik veya biçimsiz değerler geliştirme sırasında hangi değişkenin düzeltilmesi gerektiğini belirten açık bir hata üretir.

Expo yalnızca kaynakta doğrudan kullanılan `process.env.EXPO_PUBLIC_*` alanlarını bundle içine yerleştirir. Bu nedenle environment erişimleri merkezi modül dışında tekrarlanmamalıdır. `.env.local` değiştiğinde Metro yeniden başlatılmalıdır.

### Environment stratejisi

`EXPO_PUBLIC_APP_ENV` yalnızca şu değerleri kabul eder:

- `development`
- `staging`
- `production`

Her ortam ayrı bir Firebase projesi ve ayrı deployment profile kullanmalıdır. İleride EAS Build profilleri, ilgili ortamın environment değişkenlerini sağlamalıdır. Proje seçimi branch adı, bundle identifier içinde metin arama veya `__DEV__` gibi kırılgan kontrollerden çıkarılmamalıdır.

Şimdilik yalnızca development Firebase projesinin bağlanması beklenir. Staging ve production projeleri oluşturulmaz.

### Güvenlik sınırı

Firebase client configuration değerleri mobil uygulama paketine dahil olur ve backend sırrı değildir. Erişim güvenliği daha sonra Firebase Security Rules, App Check ve güvenilir backend yetkilendirmesiyle sağlanmalıdır.

Mobil uygulama ve bu repo hiçbir zaman şunları içermemelidir:

- Firebase Admin SDK credential dosyaları
- service account JSON dosyaları
- private key veya backend-only secret değerleri
- mağaza imzalama anahtarları ve sertifikaları

Firebase Admin SDK yalnızca Cloud Functions veya ayrı bir güvenilir backend ortamında çalışmalıdır.

## Tema ve UI kuralları

- Renk, boşluk, radius ve tipografi değerleri `src/theme` üzerinden alınır.
- Ekranlar safe area ve klavye davranışı için `ScreenContainer` kullanır.
- Yeniden kullanılabilir metin, buton ve kartlar `src/components/ui` altındadır.
- Sistem açık/koyu mod tercihi otomatik izlenir.
- Erişilebilir rol, durum ve okunabilir dokunma hedefleri korunur.

## Git güvenliği

`.env`, `.env.local`, ortama özel local dosyalar, Expo cache, build çıktıları, service account dosyaları ve signing credential dosyaları `.gitignore` ile korunur. Yalnızca boş placeholder değerler içeren `.env.example` commit edilir.

Commit öncesinde staged dosyalar credential desenlerine karşı taranmalıdır.

## Geliştirme kuralları

- UI metinleri Türkçe; dosya, tip ve değişken adları İngilizce olmalıdır.
- Rota bileşenleri yalın kalmalı, özellik mantığı `src/features` altında bulunmalıdır.
- `any`, gizli üretim bilgileri ve doğrudan UI-Firebase bağımlılığı kullanılmamalıdır.
- Yeni kütüphane yalnızca somut bir ihtiyacı çözüyorsa eklenmelidir.

## Üretim öncesi manuel ayarlar

- `com.devrem.app` iOS/Android tanımlayıcıları yayın öncesinde doğrulanmalıdır.
- Uygulama ikonu, splash ekranı, gizlilik metinleri ve mağaza metadata'sı marka varlıkları hazır olduğunda eklenmelidir.
- EAS proje kimliği, imzalama sertifikaları ve mağaza hesapları henüz yapılandırılmamıştır.
- Crashlytics ve Analytics bağlandığında uygulama-geneli hata sınırı gerçek raporlamaya bağlanmalıdır.

## Sonraki faz önerisi

Phase 2B yalnızca development Firebase projesinin bağlanması ve telefon numarası kimlik doğrulaması için teknik tasarım/uygulama kapsamını ele almalıdır. Firestore veri modeli, sohbet, eşleşme ve Cloud Functions ayrı fazlarda kalmalıdır.
