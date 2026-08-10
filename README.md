# Devrem

Devrem, zorunlu askerlik hizmetine hazırlanan kişiler için geliştirilen Türkçe bir mobil uygulamadır. Ürün vizyonu; hazırlık, geri sayım, eşleşme ve iletişim ihtiyaçlarını tek bir güvenilir mobil deneyimde toplamaktır.

> Askere hazırlanmanın tek uygulaması.

## Mevcut durum

Phase 2C tamamlandı: Phase 2B telefon doğrulama akışına ek olarak Firestore kullanıcı profili, dört adımlı askerlik onboarding'i, profil durumuna bağlı merkezi rota koruması ve salt okunur profil özeti hazırlandı.

Storage, sohbet, eşleşme, hazırlık listesi ve Cloud Functions henüz uygulanmamıştır.

## Teknoloji yığını

- React Native ve Expo SDK 57
- TypeScript (strict)
- Expo Router
- React Native Firebase App/Auth/Firestore (modular API)
- React Native Community DateTimePicker (native sistem takvimi)
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
pnpm test:profile
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
    firestore.ts             # Kullanıcı profili okuma/yazma sınırı
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

Firestore yalnızca `src/services/firebase/firestore.ts` sınırı üzerinden kullanılır. UI bileşenleri native Firebase paketlerini doğrudan import etmez.

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

## Phase 2C: Firestore profil ve onboarding

Her doğrulanmış kullanıcı için `users/{firebaseUid}` yolunda tek profil belgesi bulunur. Firebase UID aynı zamanda belge kimliğidir; telefon numarası, OTP kodu, verification ID veya token profil belgesine yazılmaz.

Profil alanları:

```text
uid
firstName
lastName
birthYear
residenceCity          # 1-81 arasında sabit il/plaka kodu
departureCity          # 1-81 arasında sabit il/plaka kodu
militaryCity           # 1-81 arasında sabit il/plaka kodu
militaryType           # standard | paid | reserveOfficer | reserveNco
militaryPeriodYear     # Sayısal, sorgulanabilir celp yılı
militaryPeriodMonth    # 1-12 arasında sayısal celp ayı
militaryUnit           # Bilinmiyorsa null; biliniyorsa normalize edilmiş serbest metin
reportingDate          # Yerel takvimden üretilen YYYY-MM-DD tarih değeri
onboardingCompleted
createdAt              # server timestamp
updatedAt              # server timestamp
```

Onboarding dört adımdır:

1. Kişisel bilgiler: ad, soyad ve doğum yılı.
2. Nereye gidiyorsun: yaşanılan şehir, yola çıkılacak şehir ve askerlik şehri.
3. Askerlik bilgileri: askerlik türü ile ayrı yıl/ay celp seçimi. Yeni kullanıcıya geçmiş dönem gösterilmez.
4. Birlik ve teslim: birlik bilinmiyorsa `null`, biliniyorsa geçici serbest metin; teslim tarihi native takvimden seçilir.

Teslim tarihi kullanıcının yerel takvim gününden `YYYY-MM-DD` biçimine çevrilir. Bugünden veya seçilen celp ayının ilk gününden önceki bir tarih seçilemez. Profil yazısı Firestore tarafından onaylanmadan onboarding tamamlanmış kabul edilmez.

İleride resmî/kontrollü birlik verisi bulunduğunda `militaryUnit` alanı, `militaryCity` ile filtrelenen `militaryUnitId` ve `militaryUnitName` alanlarına taşınacaktır. Bu fazda sahte birlik listesi tutulmaz ve bilinmeyen birlik değeri üretilmez.

Önceki Phase 2C deneme belgelerindeki `militaryPeriod: { year, month }` alanı güvenli biçimde okunup uygulama içinde yeni düz modele normalize edilir. Zorunlu alanı eksik veya biçimsiz tamamlanmış belgeler hata üretmek yerine eksik kabul edilerek onboarding'e döner. Eski belgelere sessizce şehir, dönem veya birlik değeri uydurulmaz; yeni kayıt tamamlandığında belge güncel şemayla değiştirilir.

Rota kararı kök layout'ta merkezî olarak verilir:

```text
auth yükleniyor                         → yükleme
oturum yok                              → telefon doğrulama
oturum var + profil yükleniyor          → yükleme
profil yok veya tamamlanmamış           → onboarding
tamamlanmış profil                      → ana sekmeler
```

### Firestore Console kurulumu

1. Firebase Console → **Build → Firestore Database → Create database** yolunu açın.
2. Başlangıç modu olarak **Production mode** seçin. Uygulama, repodaki sahiplik kuralları deploy edilene kadar veri okuyup yazmamalıdır.
3. Konum kalıcı bir karardır. Türkiye ağırlıklı ve bölgesel gecikme öncelikli bir uygulama için `europe-west8` (Milan) uygun başlangıç tercihidir. Daha yüksek coğrafi dayanıklılık öncelikliyse maliyet/gecikme farkı değerlendirilerek `eur3` Avrupa multi-region seçilebilir. Diğer Google Cloud kaynakları eklenmeden önce konum stratejisini birlikte doğrulayın.
4. Firestore oluşturulduktan sonra kuralları proje kökünden deploy edin:

```bash
pnpm dlx firebase-tools login
pnpm dlx firebase-tools deploy --only firestore:rules --project <firebase-project-id>
```

`firestore.rules`, yalnızca giriş yapmış kullanıcının kendi `users/{uid}` belgesini okumasına, oluşturmasına ve güncellemesine izin verir. Diğer tüm belge yolları varsayılan olarak kapalıdır.

### Native development build

`@react-native-firebase/firestore` ve native sistem takvimini kullanan `@react-native-community/datetimepicker` development client içine derlenmelidir. Bu bağımlılıkları içermeyen eski build yeterli değildir. Firebase dosya environment variable'ları EAS üzerinde tanımlı kalacak şekilde yeni Android development build oluşturun:

```bash
pnpm dlx eas-cli@latest build --profile development --platform android
```

Yeni APK kurulduktan sonra Metro'yu development client modunda başlatın:

```bash
pnpm exec expo start --dev-client --lan
```

Daha önce doğrulanmış ve oturumu cihazda kalan kullanıcı, yeni build'i ilk açtığında profil belgesi yoksa logout/login gerekmeksizin onboarding'e yönlendirilir.

### Güvenlik sınırı

Firebase client configuration değerleri mobil uygulama paketine dahil olur ve backend sırrı değildir. Erişim güvenliği daha sonra Firebase Security Rules, App Check ve güvenilir backend yetkilendirmesiyle sağlanmalıdır.

Mobil uygulama ve bu repo hiçbir zaman şunları içermemelidir:

- Firebase Admin SDK credential dosyaları
- service account JSON dosyaları
- private key veya backend-only secret değerleri
- mağaza imzalama anahtarları ve sertifikaları

Firebase Admin SDK yalnızca Cloud Functions veya ayrı bir güvenilir backend ortamında çalışmalıdır.

## Phase 4B: Discovery bildirimleri

Discovery bildirimlerinde recipient seçimini yalnızca Cloud Functions yapar. Client yalnızca kendi
`users/{uid}/notificationPreferences/main` tercih belgesini ve
`users/{uid}/devices/{installationId}` cihaz kaydını yönetebilir. Membership, delivery, rate-limit
ve rollout control belgeleri client erişimine kapalıdır.

Canlıya alma sırası:

1. Firebase Console → **Project settings → Cloud Messaging** altında iOS uygulaması için APNs authentication key'in yüklü olduğunu doğrulayın. Android ve iOS Firebase app tanımları mevcut native config dosyalarıyla aynı projeyi göstermelidir.
2. Functions ve Firestore Rules'u deploy edin. Control belgesi yokken bildirim gate'i kapalı kabul edilir; deploy tek başına mevcut kullanıcılara bildirim göndermez.
3. Application Default Credentials ile hedef projeyi açıkça onaylayıp mevcut public profilleri baseline edin:

```powershell
$env:GCLOUD_PROJECT = '<firebase-project-id>'
$env:DEVREM_NOTIFICATION_BASELINE_CONFIRM = $env:GCLOUD_PROJECT
pnpm baseline:discovery-notifications
```

Baseline önce gate'i kapatır, mevcut üyelikleri transaction ile sessizce yazar, development seed UID'lerini dışarıda bırakır ve yalnızca tüm sayfalar başarıyla tamamlanınca gate'i açar. Komut hata verirse delivery kapalı kalır ve aynı komut güvenle yeniden çalıştırılabilir.

4. Firestore TTL policy'lerini `_notificationDeliveries.expiresAt` ve `_notificationRateLimits.expiresAt` alanları için etkinleştirin. Bu retention temizliği içindir; delivery doğruluğu TTL çalışmasına bağlı değildir.
5. `@react-native-firebase/messaging` native modülü nedeniyle Android ve iOS için yeni EAS development build oluşturun. JavaScript update veya eski development client yeterli değildir.

```bash
pnpm dlx eas-cli@latest build --profile development --platform android
pnpm dlx eas-cli@latest build --profile development --platform ios
```

Gerçek push akışı fiziksel Android ve iOS cihazlarda; foreground banner, background notification tap,
terminated-app tap, token refresh, master kapatma ve logout senaryolarıyla doğrulanmalıdır. iOS Simulator
gerçek APNs token testi için yeterli değildir.

Development projesinde tek bir kullanıcının Android cihazlarına güvenilir Admin SDK ile push smoke testi:

```powershell
$env:GCLOUD_PROJECT = 'devrem-d985b'
pnpm test:push --uid <firebaseUid>
```

Komut yalnızca `devrem-d985b` projesini kabul eder; açık UID verilmesini zorunlu tutar ve kullanıcının
`notificationPreferences/main` belgesiyle aktif Android `devices` belgelerini okur. Master veya yeni-Devre
tercihi kapalıysa gönderim yapmaz. Her benzersiz aktif Android token'ına tek bir `testDiscovery` bildirimi
gönderir ve dokunulduğunda Devreni Bul sekmesini açar. Token'lar loglanmaz. Discovery matching,
membership, delivery, dedup ve rate-limit koleksiyonlarına dokunulmaz; temizlenecek test belgesi oluşmaz.

## Phase 4C: Devre grupları

Her exact Devre kimliği `@devrem/devre-domain` tarafından tek bir canonical identity key'e dönüştürülür.
Backend bu anahtarın SHA-256 özetiyle `devre-v1-<hash>` biçiminde deterministik grup ID'si üretir.
İkamet ve hareket şehirleri grup kimliğine dahil değildir. Stable `militaryUnitId` varsa birlik adı yerine o
kullanılır; mevcut veride ID yoksa normalize edilmiş birlik adı geçici fallback'tir.

Firestore modeli:

```text
devreGroups/{groupId}
devreGroups/{groupId}/members/{uid}
_devreGroupMemberships/{uid}                 # owner-readable trusted pointer
users/{uid}/devreGroupState/main             # one-time bilgi durumu
users/{uid}/communicationPreferences/main    # allowDirectMessages
```

`syncPublicProfile` aynı retry-safe akışta grup ve üyeliği ensure eder. Canonical kimlik değişirse eski
membership silinir ve yenisi oluşturulur; profil exact kimliğini kaybederse membership kaldırılır. Üye sayacı
tutulmaz. Boş deterministic gruplar audit/reconciliation kolaylığı için korunur. Client grup veya membership
yazamaz ve yalnızca gerçekten üyesi olduğu grubun metadata/member belgelerini okuyabilir.

Mevcut kullanıcı ve development seed üyeliklerini notification üretmeden, tekrar çalıştırılabilir şekilde
backfill etmek için:

```powershell
$env:GCLOUD_PROJECT = 'devrem-d985b'
$env:DEVREM_GROUP_BACKFILL_CONFIRM = 'devrem-d985b'
pnpm backfill:devre-groups
```

Backfill yalnızca `devrem-d985b` projesini kabul eder. Discovery delivery, dedup ve rate-limit belgelerine
dokunmaz. Phase 4C yeni native dependency/config eklemediği için yeni EAS development build gerekmez.

## Phase 4D: Devre grup sohbeti

Her deterministik Devre grubunun metin mesajları `devreGroups/{groupId}/messages/{messageId}` altında tutulur.
Mesajda `id`, `senderUid`, `text`, server `createdAt`, `clientCreatedAt` ve `schemaVersion` alanları bulunur.
İstemci document ID'yi yazmadan önce üretir; başarısız gönderim aynı ID ile tekrarlandığı için optimistic UI ve
retry yeni bir mesaj oluşturmaz. Son 40 mesaj realtime dinlenir, daha eski mesajlar `createdAt desc` cursor ile
sayfalanır. Bu sorgu yalnızca otomatik tek-alan indeksini kullanır; yeni composite index gerekmez.

Firestore Rules yalnızca `devreGroups/{groupId}/members/{request.auth.uid}` belgesi bulunan kullanıcılara mesaj
okuma ve oluşturma izni verir. Gönderen UID'si Auth UID ile aynı olmalı, metin boş olmamalı ve en fazla 1500
karakter olmalıdır. Mesaj update/delete işlemleri kapalıdır. Exact Devre kimliği değiştiğinde eski membership
silindiği anda eski sohbet erişimi de kapanır.

`notifyDevreGroupMessage` tek bir Firestore trigger'ıdır; alıcı başına Function oluşturmaz. Gönderen hariç grup
üyelerini işler, master bildirim tercihiyle `groupMessagesEnabled` tercihini uygular ve mevcut owner-private cihaz
kayıtlarını kullanır. Dedup anahtarı `groupId + messageId + recipientUid` olup
`_groupMessageNotificationDeliveries` altında tutulur. Bu akış keşif günlük limit/dedup sayaçlarına dokunmaz.
Bildirim deep link'i yalnızca doğrulanmış exact grup ID'siyle Devre Grubum sekmesine gider; kullanıcı artık o
grubun üyesi değilse eski içerik gösterilmez. Aynı sohbet foreground'da açıksa banner bastırılır.

Geliştirme projesinde mevcut bir gruba 10 veya 60 pagination mesajı eklemek için:

```powershell
$env:GCLOUD_PROJECT = 'devrem-d985b'
pnpm seed:chat --group <devre-v1-group-id> --count 10
pnpm seed:chat --group <devre-v1-group-id> --count 60
pnpm seed:chat:clear --group <devre-v1-group-id>
```

Araç yalnızca `devrem-d985b` projesinde, açıkça verilen mevcut grubun gerçek üyelerini sender olarak kullanır.
Fake üyelik/join event üretmez. Seed mesajları `developmentSeed: true` işaretlidir ve notification Function
tarafından sessizce atlanır. Cleanup sadece deterministik `dev-chat-seed-*` ID'li ve bu işareti taşıyan belgeleri
siler.

Hesap silme ortak grup mesajlarını silmez; gönderenin public profili kaldırıldığında UI adı `Devre` olarak
gösterir. Owner-private profil, tercih, cihaz ve kullanıcıya bağlı notification delivery verileri silinir.

Deploy otomatik çalıştırılmaz. İnceleme ve doğrulama sonrasında gereken backend deploy:

```powershell
pnpm exec firebase deploy --only firestore:rules,functions:notifyDevreGroupMessage,functions:deleteAccount --project devrem-d985b
```

`_groupMessageNotificationDeliveries.expiresAt` için Firebase Console'dan TTL policy etkinleştirilmelidir.
İlk metin sohbeti sürümü native değişiklik gerektirmiyordu; aşağıdaki tam sohbet deneyimi medya desteğiyle bu
durumu değiştirmiştir.

### Phase 4D tam sohbet deneyimi

Sohbet artık tab içindeki bir panel değil, `group-chat/[groupId]` kök rotasında açılan tam ekran bir deneyimdir.
Kompakt başlık grup bilgisine, üye listesine ve son paylaşılan fotoğraflara erişir. Bildirim deep link'leri de
üyeliği yeniden doğrulayan bu rotayı kullanır. Üyelik kaybolmuşsa geçmiş içerik gösterilmez.

Mesaj şeması `schemaVersion: 2` ile `text`, `image` ve `audio` tiplerini destekler. Fotoğraflar gönderilmeden
önce en uzun kenarı 1600 piksele küçültülür ve JPEG olarak sıkıştırılır; Storage üst sınırı 5 MB'dir. Sesli
mesajlar en fazla 3 dakika ve 10 MB olabilir. Medya yalnızca deterministic, private yollarda tutulur:

```text
devreGroups/{groupId}/media/{messageId}/image.jpg
devreGroups/{groupId}/media/{messageId}/audio.m4a
```

Kalıcı public download URL mesaj belgesine yazılmaz. Uygulama dosyayı authenticated Storage isteğiyle yerel
cache'e indirir. Storage Rules hem aktif grup üyeliğini Firestore'dan doğrular hem MIME, boyut, mesaj ID'si ve
gönderen metadata'sını sınırlar. Hesap silme ortak sohbet geçmişini ve paylaşılan medyayı korur; kullanıcının grup
üyeliği silindiğinde bu medyaya erişimi de kapanır. Grup yaşam döngüsü/retention politikası ayrıca tasarlanana kadar
yetim medya otomatik silinmez.

Backend deploy inceleme sonrasında şu kapsamla yapılmalıdır:

```powershell
pnpm exec firebase deploy --only firestore:rules,firestore:indexes,storage,functions:notifyDevreGroupMessage,functions:deleteAccount --project devrem-d985b
```

Storage Rules ilk kez Firestore cross-service kontrolü kullanırken Firebase CLI gerekli IAM rolünü etkinleştirmek
için onay isteyebilir. Bu işlem deploy sırasında bilinçli olarak onaylanmalıdır.

`expo-audio`, kamera/mikrofon izinleri ve Android `adjustResize` native yapılandırmayı değiştirdiği için mevcut
development client yeterli değildir. Android ve iOS için yeni development build gerekir:

```bash
pnpm dlx eas-cli@latest build --profile development --platform android
pnpm dlx eas-cli@latest build --profile development --platform ios
```

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
- EAS development projesi bağlıdır; production mağaza hesapları ve yayın imzalama stratejisi ayrıca doğrulanmalıdır.
- Crashlytics ve Analytics bağlandığında uygulama-geneli hata sınırı gerçek raporlamaya bağlanmalıdır.

## Sonraki faz önerisi

Bir sonraki faz, mevcut profil verisini değiştirmeden ana sayfadaki teslim tarihi geri sayımı ve salt okunur kişisel özeti ele alabilir. Sohbet, eşleşme ve hazırlık listesi ayrı kapsamlar olarak kalmalıdır.
