# Devrem

Devrem, zorunlu askerlik hizmetine hazırlanan kişiler için geliştirilen Türkçe bir mobil uygulamadır. Ürün vizyonu; hazırlık, geri sayım, eşleşme ve iletişim ihtiyaçlarını tek bir güvenilir mobil deneyimde toplamaktır.

> Askere hazırlanmanın tek uygulaması.

## Mevcut durum

Phase 1 tamamlandı: üretime yönelik uygulama temeli, Expo Router navigasyonu, tema sistemi, ortak UI bileşenleri ve gelecekteki Firebase entegrasyonu için sınırlar hazırlandı. Kimlik doğrulama, gerçek veri, sohbet, eşleşme ve hazırlık özellikleri henüz uygulanmadı.

## Teknoloji yığını

- React Native ve Expo SDK 57
- TypeScript (strict)
- Expo Router
- React Native Safe Area Context
- ESLint

Firebase, Zustand ve TanStack Query yalnızca ihtiyaç doğduğu fazlarda eklenecektir.

## Başlangıç

Gereksinimler: desteklenen bir Node.js LTS sürümü ve npm/pnpm/yarn.

```bash
npm install
npm run start
```

Diğer komutlar:

```bash
npm run android
npm run ios
npm run web
npm run typecheck
npm run lint
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
  features/                  # Özellik ekranları ve gelecekteki iş mantığı
    auth/ onboarding/ home/ preparation/ matching/ chat/ profile/
  hooks/                     # Paylaşılan hook'lar
  services/firebase/         # Gelecekteki Firebase adaptör sınırı
  store/                     # Gelecekteki global istemci durumu
  theme/                     # Renkler, token'lar ve tema sağlayıcısı
  types/                     # Paylaşılan alan tipleri
  utils/                     # Saf yardımcı fonksiyonlar
```

`app/` kökte tutulur çünkü Expo Router dosya tabanlı rotaları buradan üretir. Rota dosyaları yalnızca özellik ekranlarını bağlar; iş mantığı `src/features` içinde kalır.

## Tema ve UI kuralları

- Renk, boşluk, radius ve tipografi değerleri `src/theme` üzerinden alınır.
- Ekranlar safe area ve klavye davranışı için `ScreenContainer` kullanır.
- Yeniden kullanılabilir metin, buton ve kartlar `src/components/ui` altındadır.
- Sistem açık/koyu mod tercihi otomatik izlenir.
- Erişilebilir rol, durum ve okunabilir dokunma hedefleri korunur.

## Ortam değişkenleri

`.env.example` dosyasını ileride `.env.local` olarak kopyalayın. `EXPO_PUBLIC_` değişkenlerinin uygulama paketine dahil edildiğini ve sır olmadığını unutmayın. Sunucu sırları istemci ortamına konulmamalıdır.

Firebase değerleri Phase 2'de gerçek proje oluşturulduktan sonra yapılandırılacaktır. `.env` dosyaları Git tarafından yok sayılır.

## Geliştirme kuralları

- UI metinleri Türkçe; dosya, tip ve değişken adları İngilizce olmalıdır.
- Rota bileşenleri yalın kalmalı, özellik mantığı `src/features` altında bulunmalıdır.
- `any`, gizli üretim bilgileri ve doğrudan UI-Firebase bağımlılığı kullanılmamalıdır.
- Yeni kütüphane yalnızca somut bir ihtiyacı çözüyorsa eklenmelidir.

## Üretim öncesi manuel ayarlar

- `com.devrem.app` iOS/Android tanımlayıcıları yayın öncesi sahiplik ve isim uygunluğu açısından doğrulanmalıdır.
- Uygulama ikonu, adaptive icon, splash ekranı, gizlilik metinleri ve mağaza metadata'sı marka varlıkları hazır olduğunda eklenmelidir.
- EAS proje kimliği, imzalama sertifikaları ve mağaza hesapları henüz yapılandırılmamıştır.
- Crashlytics ve Analytics bağlandıktan sonra hata sınırındaki yakalama noktası gerçek raporlamaya bağlanmalıdır.

## Sonraki faz önerisi

Phase 2; Firebase proje ortamlarının (development/staging/production) kurulması, tip güvenli yapılandırma doğrulaması ve telefon numarasıyla kimlik doğrulama akışının erişilebilir ekranlarla uygulanması olmalıdır. Firestore veri modeli, sohbet veya eşleşme bu faza dahil edilmemelidir.
