# Devrem

Devrem, zorunlu askerlik hizmetine hazırlanan kişiler için geliştirilen Türkçe bir mobil uygulamadır. Ürün vizyonu; hazırlık, geri sayım, eşleşme ve iletişim ihtiyaçlarını tek bir güvenilir mobil deneyimde toplamaktır.

> Askere hazırlanmanın tek uygulaması.

## Mevcut durum

Phase 2B tamamlandı: Türkiye telefon numarası girişi, SMS/OTP doğrulaması, kalıcı native Firebase Auth oturumu, korumalı rotalar ve çıkış akışı hazırlandı.

Firestore profilleri, askerlik onboarding'i, Storage, sohbet, eşleşme ve Cloud Functions henüz uygulanmamıştır.

## Teknoloji yığını

- React Native ve Expo SDK 57
- TypeScript (strict)
- Expo Router
- React Native Firebase App/Auth (modular API)
- Expo development build
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

Telefon doğrulama native Firebase SDK gerektirdiği için Expo Go desteklenmez. Firebase dosyaları hazırlandıktan ve bir development build kurulduktan sonra Metro'yu şu şekilde başlatın:

```bash
npx expo start --dev-client
```

Windows üzerinde iOS simülatörü çalışmaz; iOS için macOS/Xcode veya fiziksel cihaz gerekir.

## Mimari

```text
app/                         # Yalın Expo Router rota girişleri
  (auth)/                    # Telefon ve OTP rotaları
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
    app.ts                   # Native Firebase app ve environment eşleşmesi
    auth.ts                  # Firebase Auth servis sınırı
    index.ts                 # Firebase servis sınırının public API'si
  store/                     # Gelecekteki global istemci durumu
  theme/                     # Renkler, token'lar ve tema sağlayıcısı
  types/                     # Paylaşılan alan tipleri
  utils/                     # Saf yardımcı fonksiyonlar
```

`app/` kökte tutulur çünkü Expo Router dosya tabanlı rotaları buradan üretir. Rota dosyaları yalnızca özellik ekranlarını bağlar; iş mantığı `src/features` içinde kalır.

## Firebase altyapısı

Phase 2A'da kurulan merkezi environment doğrulaması korunur. Telefon doğrulaması, Firebase JS SDK'nin React Native üzerinde kendi `ApplicationVerifier` uygulamasını sağlamaması nedeniyle native React Native Firebase Auth'a taşınmıştır. Bu yaklaşım Play Integrity, Android reCAPTCHA fallback'i ve iOS APNs/reCAPTCHA app verification akışlarını native Firebase SDK'ya bırakır.

Firebase varsayılan app'i Android ve iOS client configuration dosyalarından native olarak başlatılır. `src/services/firebase/app.ts`, native projenin `projectId` değeriyle `.env.local` değerini karşılaştırarak yanlış environment dosyasının kullanılmasını engeller. UI bileşenleri Firebase paketlerini doğrudan import etmez.

Auth dışındaki Firebase servisleri henüz başlatılmaz.

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
FIREBASE_ANDROID_CONFIG_FILE=./config/firebase/development/google-services.json
FIREBASE_IOS_CONFIG_FILE=./config/firebase/development/GoogleService-Info.plist
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

## Phase 2B: telefon doğrulaması

### Native Firebase uygulamalarını ekleme

Firebase Console → **Project settings → General → Your apps** bölümünde iki uygulama kaydedin:

- Android package: `com.devrem.app`
- iOS bundle identifier: `com.devrem.app`

Android için `google-services.json`, iOS için `GoogleService-Info.plist` dosyasını indirin ve varsayılan olarak şu ignore edilen yollara koyun:

```text
config/firebase/development/google-services.json
config/firebase/development/GoogleService-Info.plist
```

Farklı yerler kullanılıyorsa `.env.local` içindeki `FIREBASE_ANDROID_CONFIG_FILE` ve `FIREBASE_IOS_CONFIG_FILE` değerlerini değiştirin. Bu dosyalar Firebase client config içerir; service account değildir, ancak environment ayrımı nedeniyle bu repoda local tutulur. EAS Build için aynı değerler EAS file environment variables olarak sağlanmalıdır.

### Firebase Authentication ayarları

1. Firebase Console → **Authentication → Sign-in method** altında **Phone** provider'ını etkinleştirin.
2. **Authentication → Settings → SMS region policy** altında yalnızca hizmet verilen bölgeleri, bu faz için Türkiye'yi, açık bırakın.
3. SMS kota ve kullanım metriklerini izleyin; client cooldown gerçek rate limiting yerine geçmez.

Android app verification için Firebase Console'daki Android uygulamasına development build imza sertifikasının **SHA-256** fingerprint'ini ekleyin. Play Integrity kullanılamadığında reCAPTCHA fallback'i için **SHA-1** de gereklidir. Fingerprint, local debug keystore kullanılıyorsa `keytool`, EAS credential kullanılıyorsa `eas credentials -p android`, mağaza build'i için Google Play Console → **Setup → App integrity** üzerinden alınır. Her farklı imzalama anahtarının fingerprint'i ayrı eklenmelidir; değer uydurulmamalıdır.

iOS telefon auth önce silent APNs notification ile app verification yapar, başarısız olursa reCAPTCHA kullanır. Firebase Console → **Project settings → Cloud Messaging** altında Apple Developer hesabından alınan APNs authentication key yüklenmelidir. `@react-native-firebase/auth` config plugin'i reCAPTCHA dönüş URL scheme'ini `GoogleService-Info.plist` üzerinden prebuild sırasında ekler. Fiziksel cihazda Background App Refresh açık ve kapalı senaryolar test edilmelidir.

### Development build

React Native Firebase custom native code içerdiğinden Expo Go kullanılamaz. Native dosyaları yerleştirdikten sonra development build oluşturun:

```bash
npx eas-cli@latest build --profile development --platform android
```

macOS ve Xcode bulunan bir ortamda local build alternatifi:

```bash
npx expo prebuild --clean
npx expo run:ios
```

Prebuild ile üretilen `android/` ve `ios/` klasörleri kaynak gerçekliği değildir; app config değiştiğinde tekrar üretilebilir.

### Test telefonları

Firebase Console → **Authentication → Sign-in method → Phone → Phone numbers for testing** bölümünde E.164 biçiminde bir test numarası ve altı haneli sabit kod tanımlayın. Değerleri source code'a veya `.env.example` dosyasına eklemeyin. Uygulama test numarası ile gerçek numara arasında ayrım yapmaz ve Firebase Console'da tanımlanan kod normal OTP ekranından girilir.

### Auth state ve kalıcılık

`AuthProvider`, native `onAuthStateChanged` listener'ının ilk sonucunu beklerken uygulamayı `initializing` durumunda tutar. Native Firebase SDK oturumu platform storage'ında kendisi kalıcı tutar; token'lar elle saklanmaz. İlk sonuçtan sonra kullanıcı yalnızca `userId` içeren minimal uygulama session'ı üzerinden `authenticated` veya `unauthenticated` olur.

Expo Router protected routes, oturum geri yüklenmeden auth veya tab ekranı göstermez. Çıkış yalnızca Firebase Auth oturumunu sonlandırır; hesap silmez.

Telefon numarası yalnızca SMS isteği ve doğrulama ekranındaki maskeli gösterim için bellekte tutulur; bu fazda Firestore'a veya başka local storage'a yazılmaz. Resend için 60 saniyelik client cooldown ve eşzamanlı SMS isteği engeli vardır. Firebase kota, SMS region policy, Play Integrity ve production abuse monitoring yine zorunludur.

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

Phase 2C, yalnızca doğrulanmış kullanıcı için askerlik onboarding alanlarının veri modelini ve ekran akışını tasarlamalıdır. Sohbet, eşleşme ve hazırlık özellikleri ayrı fazlarda kalmalıdır.
