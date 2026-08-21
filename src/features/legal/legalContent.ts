import { LEGAL_ENTITY, LEGAL_VERSIONS } from './legalConfig';
import type { LegalDocumentId } from './legalDomain';

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  version: string;
  sections: LegalSection[];
}

const terms: LegalDocument = {
  id: 'terms',
  title: 'DEVREM KULLANICI SÖZLEŞMESİ',
  version: LEGAL_VERSIONS.terms,
  sections: [
    { title: '1. Taraflar ve Kapsam', paragraphs: [
      `İşbu Kullanıcı Sözleşmesi (“Sözleşme”), Devrem mobil uygulaması ve Devrem’e bağlı hizmetleri (“Devrem” veya “Platform”) işleten ${LEGAL_ENTITY.operatorName} ile Platform’a üye olan kullanıcı (“Kullanıcı”) arasındaki kullanım koşullarını düzenler.`,
      'Kullanıcı, üyelik işlemini tamamlayarak bu Sözleşme’de belirtilen koşullara uygun hareket etmeyi kabul eder.',
    ] },
    { title: '2. Devrem’in Amacı', paragraphs: [
      'Devrem; askerlik hizmetine hazırlanan kullanıcıların kendi askerlik dönemleri ve birlik bilgileri doğrultusunda diğer kullanıcılarla iletişim kurabilmesi, hazırlık sürecini takip edebilmesi, askerî birliklere ilişkin rehber içeriklere erişebilmesi ve Platform tarafından sunulan diğer yardımcı özelliklerden yararlanabilmesi amacıyla sunulan dijital bir platformdur.',
      'Devrem; Millî Savunma Bakanlığı, Türk Silahlı Kuvvetleri, Jandarma Genel Komutanlığı, Sahil Güvenlik Komutanlığı veya herhangi bir kamu kurumunun resmî uygulaması değildir ve bu kurumları temsil etmez.',
      'Kullanıcının e-Devlet, MSB veya yetkili kamu kurumlarından aldığı resmî sevk ve askerlik bilgileri her zaman Platform’da yer alan bilgilerden önceliklidir.',
    ] },
    { title: '3. Üyelik ve Hesap', paragraphs: [
      'Devrem’i kullanabilmek için Kullanıcının üyelik sırasında talep edilen bilgileri doğru ve güncel şekilde sağlaması gerekir.',
      'Platform 18 yaş ve üzeri kullanıcıların kullanımına yöneliktir.',
      'Kullanıcı, hesabının ve telefon doğrulama bilgilerinin güvenliğinden sorumludur.',
      'Başkasına ait kimlik veya profil bilgileriyle hesap oluşturulamaz.',
    ] },
    { title: '4. Profil ve Görünür Bilgiler', paragraphs: [
      'Devrem’in sosyal özelliklerinin çalışabilmesi amacıyla Kullanıcının adı, soyadı, profil fotoğrafı, askerlik dönemi, askerlik türü, askerlik şehri ve seçtiği askerî birlik gibi belirli profil bilgileri Platform’daki diğer yetkili/giriş yapmış kullanıcılara ilgili ekranlarda gösterilebilir.',
      'Telefon numarası, e-posta adresi, kimlik doğrulama bilgileri ve özel hesap verileri diğer kullanıcılara açık şekilde gösterilmez.',
      'Kullanıcı, profilinde gerçeğe aykırı, yanıltıcı veya başka bir kişiye ait bilgiler kullanmamayı kabul eder.',
    ] },
    { title: '5. Devre Grupları', paragraphs: [
      'Devre grupları Kullanıcının Platform’daki güncel askerlik bilgileri kullanılarak otomatik olarak belirlenebilir.',
      'Kullanıcının askerlik dönemi, askerlik şehri, askerî birliği veya askerlik türünü değiştirmesi durumunda önceki Devre grubuna aktif erişimi sona erebilir ve Kullanıcı yeni bilgilerine karşılık gelen gruba aktarılabilir.',
      'Önceki gruplarda gönderilmiş mesajlar, konuşma bütünlüğünün korunması ve uygulanabilir hukuki yükümlülükler çerçevesinde Platform’da tutulabilir; ayrılan kullanıcının aktif grup üyeliği sona erer.',
    ] },
    { title: '6. Mesajlaşma ve Kullanıcı İçerikleri', paragraphs: [
      'Kullanıcı; grup sohbetleri, özel mesajlar, profil içerikleri, fotoğraflar, belgeler ve Platform’a yüklediği diğer içeriklerden sorumludur.',
      'Kullanıcı, yalnızca paylaşmaya yetkili olduğu içerikleri Platform’a yükleyebilir.',
      'Kullanıcı içerik üzerindeki haklarını korur. Kullanıcı, içeriğin Platform hizmetlerinin sunulması kapsamında barındırılması, iletilmesi ve ilgili kullanıcılara gösterilebilmesi için Devrem’e hizmetin gerektirdiği ölçüde sınırlı kullanım yetkisi verir.',
      'Bu yetki içeriklerin Platform dışında bağımsız ticari amaçla satılması anlamına gelmez.',
    ] },
    { title: '7. Yasaklı Kullanımlar', paragraphs: ['Aşağıdaki davranışlara izin verilmez:'], bullets: [
      'başka bir kişiyi taklit etmek', 'tehdit, taciz veya sistematik rahatsız etme', 'nefret söylemi veya hukuka aykırı içerik paylaşmak', 'cinsel veya açıkça uygunsuz içerik paylaşmak', 'spam veya istenmeyen toplu mesaj göndermek', 'diğer kullanıcıların kişisel verilerini hukuka aykırı biçimde toplamak veya paylaşmak', 'Platform verilerini otomatik yöntemlerle izinsiz toplamak/scrape etmek', 'farklı birliklere veya gruplara yetkisiz erişmeye çalışmak', 'güvenlik önlemlerini aşmaya çalışmak', 'zararlı yazılım veya hukuka aykırı dosya paylaşmak', 'Platform’u dolandırıcılık veya hukuka aykırı faaliyetler için kullanmak',
    ] },
    { title: '8. Engelleme, Bildirme ve Moderasyon', paragraphs: [
      'Kullanıcılar diğer kullanıcıları engelleyebilir ve Platform kurallarına aykırı olduğunu düşündükleri kullanıcı veya içerikleri bildirebilir.',
      'Devrem; güvenlik, hukuki yükümlülükler ve Platform kurallarının uygulanması amacıyla bildirilen içerikleri inceleyebilir.',
      'Kurallara aykırı kullanım halinde içerik kaldırma, özellik erişimini sınırlama, hesabı geçici olarak askıya alma veya hesabı kapatma tedbirleri uygulanabilir.',
      'Bu işlemlerde olayın niteliği ve ölçülülük dikkate alınır.',
    ] },
    { title: '9. Askerî Birlik ve Rehber Bilgileri', paragraphs: [
      'Platform’da bulunan birlik adresleri, harita konumları, ulaşım bilgileri, tesis bilgileri ve benzeri rehber içerikleri bilgilendirme amacıyla sunulur.',
      'Doğrulanmış bilgiler uygun bir doğrulama göstergesiyle işaretlenebilir.',
      'Doğrulanmamış içerikler de kullanıcıya yardımcı olmak amacıyla gösterilebilir ancak bunlar resmî bilgi niteliğinde değildir.',
      'Kullanıcı, teslim ve sevk işlemlerinde resmî kaynaklardaki bilgileri esas almalıdır.',
    ] },
    { title: '10. Üçüncü Taraf Hizmetleri ve İş Birlikleri', paragraphs: [
      'Devrem zaman zaman üçüncü taraf hizmetlere, ulaşım sağlayıcılarına, iş ortaklarına veya sponsorlu içeriklere bağlantı verebilir.',
      'Sponsorlu veya ticari içerikler kullanıcı tarafından anlaşılabilecek şekilde belirtilir.',
      'Üçüncü tarafların kendi hizmet, ödeme, teslimat ve gizlilik koşulları ilgili üçüncü taraf tarafından belirlenir.',
    ] },
    { title: '11. Hizmetin Kullanılabilirliği', paragraphs: [
      'Devrem, Platform’un güvenli ve süreklilik arz eden şekilde çalışması için makul teknik tedbirleri alır.',
      'Bakım, güncelleme, teknik arıza, internet bağlantısı veya Devrem’in kontrolü dışındaki nedenlerle hizmette geçici kesintiler yaşanabilir.',
      'İşbu madde, yürürlükteki mevzuat uyarınca sınırlandırılamayacak kullanıcı haklarını ortadan kaldırmaz.',
    ] },
    { title: '12. Hesabın Silinmesi', paragraphs: [
      'Kullanıcı uygulama içinde sunulan yöntemlerle hesabının silinmesini talep edebilir.',
      'Hesap silme sonrasında kişisel veriler; yürürlükteki mevzuat, saklama yükümlülükleri ve geçerli hukuki sebepler çerçevesinde silinir, yok edilir veya anonim hale getirilir.',
      'Geçmiş konuşmaların bütünlüğünün korunması gereken durumlarda kullanıcı kimliği ayrıştırılarak “Silinmiş kullanıcı” gibi anonimleştirilmiş/takma gösterim kullanılabilir.',
    ] },
    { title: '13. Sözleşmenin Değiştirilmesi', paragraphs: [
      'Devrem, Platform’un gelişmesi veya mevzuat değişiklikleri nedeniyle Sözleşme’yi güncelleyebilir.',
      'Kullanıcının hak ve yükümlülüklerini önemli ölçüde etkileyen değişikliklerde yeni sürüm kullanıcıya sunulur ve gerekli olduğu hallerde yeniden kabul alınır.',
    ] },
    { title: '14. Uygulanacak Hukuk', paragraphs: [
      'Bu Sözleşme Türkiye Cumhuriyeti hukukuna tabidir.',
      'Kullanıcının yürürlükteki mevzuattan doğan zorunlu hak ve başvuru yolları saklıdır.',
    ] },
    { title: '15. İletişim', paragraphs: [
      `Platform işletmecisi: ${LEGAL_ENTITY.operatorName}`,
      `Adres: ${LEGAL_ENTITY.address}`,
      `İletişim: ${LEGAL_ENTITY.contactEmail}`,
    ] },
  ],
};

const privacyNotice: LegalDocument = {
  id: 'privacy-notice',
  title: 'DEVREM KİŞİSEL VERİLERİN KORUNMASI AYDINLATMA METNİ',
  version: LEGAL_VERSIONS.privacyNotice,
  sections: [
    { title: '1. Veri Sorumlusu', paragraphs: [
      `6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) kapsamında kişisel verileriniz, veri sorumlusu sıfatıyla ${LEGAL_ENTITY.dataControllerName} tarafından aşağıda açıklanan kapsamda işlenmektedir.`,
      `İletişim: ${LEGAL_ENTITY.address} · ${LEGAL_ENTITY.contactEmail}`,
    ] },
    { title: '2. İşlenen Kişisel Veri Kategorileri', paragraphs: [
      'Devrem’in kullanılan özelliklerine göre aşağıdaki kişisel veriler işlenebilir:',
      'Kimlik ve profil bilgileri: ad, soyad ve profil fotoğrafı.',
      'İletişim ve kimlik doğrulama bilgileri: telefon numarası ve hesap doğrulama kayıtları.',
      'Askerlik ve eşleşme bilgileri: askerlik türü, celp/sevk dönemi, askerlik şehri, askerî birlik, teslim/sevk tarihi ve kullanıcının Platform’a girdiği ilgili hazırlık ve eşleşme bilgileri.',
      'Kullanıcı içerikleri: grup mesajları, özel mesajlar, fotoğraf ve belgeler ile kullanıcı tarafından Platform’a eklenen diğer içerikler.',
      'Güvenlik ve moderasyon bilgileri: engelleme kayıtları, bildirim/şikâyet kayıtları, grup üyelik geçmişi ile hesap ve güvenlik işlem kayıtları.',
      'Cihaz ve teknik bilgiler: push notification cihaz tokenları, uygulama/işletim sistemiyle ilgili gerekli teknik bilgiler ile hata, güvenlik ve işlem logları.',
    ] },
    { title: '3. Kişisel Verilerin İşlenme Amaçları', bullets: [
      'kullanıcı hesabının oluşturulması ve doğrulanması', 'Devrem hizmetlerinin sunulması', 'uygun Devre grubunun belirlenmesi', 'Devreni Bul ve kullanıcı profili özelliklerinin çalıştırılması', 'grup ve özel mesajlaşma hizmetlerinin sunulması', 'hazırlık ve askerî birlik rehberi özelliklerinin kişiselleştirilmesi', 'bildirimlerin gönderilmesi', 'engelleme ve bildirim mekanizmalarının yürütülmesi', 'kötüye kullanım, spam ve güvenlik ihlallerinin önlenmesi', 'teknik sorunların tespit edilmesi', 'kullanıcı taleplerinin karşılanması', 'hukuki yükümlülüklerin yerine getirilmesi', 'bir hakkın tesisi, kullanılması veya korunması',
    ] },
    { title: '4. Profil Bilgilerinin Diğer Kullanıcılara Gösterilmesi', paragraphs: [
      'Devrem’in kullanıcı eşleştirme ve sosyal özelliklerinin çalışabilmesi amacıyla ad, soyad, profil fotoğrafı, askerlik dönemi, askerlik türü, askerlik şehri ve askerî birlik gibi belirli profil bilgileri Platform’daki ilgili giriş yapmış kullanıcılara gösterilebilir.',
      'Özel mesaj içerikleri yalnızca ilgili konuşmanın katılımcıları tarafından erişilebilir olacak şekilde tasarlanır.',
      'Devre grubu mesajları yalnızca ilgili gruba aktif erişim hakkı bulunan kullanıcılarla paylaşılır.',
      'Telefon numarası, e-posta adresi ve kimlik doğrulama bilgileri diğer kullanıcılara açık profil bilgisi olarak sunulmaz.',
    ] },
    { title: '5. Hukuki Sebepler', paragraphs: [
      'Kişisel veriler, somut işleme faaliyetine göre KVKK’nın 5’inci maddesinde belirtilen hukuki sebeplere dayanılarak işlenebilir:',
    ], bullets: [
      'bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması',
      'veri sorumlusunun hukuki yükümlülüğünü yerine getirmesi için zorunlu olması',
      'bir hakkın tesisi, kullanılması veya korunması için veri işlemenin zorunlu olması',
      'ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla veri sorumlusunun meşru menfaatleri için veri işlenmesinin zorunlu olması',
    ] },
    { title: '5.1. Ayrı Açık Rıza Gerektiren Haller', paragraphs: [
      'Bir veri işleme faaliyetinin ayrıca açık rıza gerektirdiği hallerde, söz konusu açık rıza bu Aydınlatma Metni’nden ayrı olarak talep edilir.',
    ] },
    { title: '6. Kişisel Verilerin Toplanma Yöntemi', paragraphs: ['Kişisel veriler aşağıdaki kanallarla elektronik ortamda otomatik veya kısmen otomatik yöntemlerle toplanabilir:'], bullets: ['kullanıcı tarafından mobil uygulamaya girilen bilgiler', 'telefon doğrulama ve hesap oluşturma işlemleri', 'uygulama içerisindeki mesajlaşma ve etkileşimler', 'cihaz ve uygulamanın teknik işleyişi', 'güvenlik, bildirim ve destek süreçleri'] },
    { title: '7. Kişisel Verilerin Aktarılması', paragraphs: [
      'Kişisel verileriniz, hizmetin sunulması ve teknik altyapının işletilmesi için gerekli olduğu ölçüde aşağıdaki alıcı grupları ile paylaşılabilir:',
    ], bullets: [
      'barındırma, veri tabanı, kimlik doğrulama, bildirim, depolama ve bulut altyapısı sağlayıcıları',
      'Devrem adına teknik hizmet sunan veri işleyen hizmet sağlayıcıları',
      'hukuken yetkili kamu kurum ve kuruluşları',
      'kanunen yetkili merciler',
    ] },
    { title: '7.1. Altyapı ve Yurt Dışı Aktarım', paragraphs: [
      'Devrem’in mevcut teknik altyapısında Firebase / Google Cloud hizmetlerinden yararlanılabilir.',
      'Kişisel verilerin yurt dışına aktarılmasının söz konusu olduğu durumlarda KVKK’nın 9’uncu maddesindeki şartlar ve uygulanabilir uygun güvence mekanizmaları dikkate alınır.',
      'Üçüncü taraf reklamverenlere kullanıcı adı, telefon numarası, e-posta adresi, özel mesajlar veya doğrudan kullanıcı kimliğini belirleyen kişisel veriler kampanya hedefleme amacıyla verilmez.',
    ] },
    { title: '8. Reklam ve İş Birliği Bağlamı', paragraphs: [
      'Devrem ileride bağlamsal sponsorlu içerikler veya iş birlikleri sunabilir.',
      'Bu tür içeriklerin seçimi askerlik şehri, askerî birlik, askerlik dönemi veya hazırlık kategorisi gibi Platform içindeki bağlamsal bilgiler kullanılarak gerçekleştirilebilir.',
      'Reklamverenlere kullanıcıların özel mesaj içerikleri, grup mesaj içerikleri, telefon numaraları, e-posta adresleri veya doğrudan kimlik bilgileri aktarılmaz.',
      'Pazarlama amacıyla elektronik ileti gönderilmesinin ayrıca izin gerektirdiği hallerde gerekli izin ayrı olarak talep edilir.',
    ] },
    { title: '9. Saklama ve Silme', paragraphs: [
      'Kişisel veriler, işlenme amaçlarının gerektirdiği süre boyunca ve ilgili mevzuatta öngörülen saklama süreleri çerçevesinde muhafaza edilir.',
      'İşleme sebebinin ortadan kalkması halinde kişisel veriler yürürlükteki mevzuata uygun olarak silinir, yok edilir veya anonim hale getirilir.',
    ] },
    { title: '10. KVKK Kapsamındaki Haklarınız', paragraphs: [
      `KVKK’nın 11’inci maddesi kapsamındaki haklarınıza ilişkin taleplerinizi ${LEGAL_ENTITY.contactEmail} iletişim kanalından veri sorumlusuna iletebilirsiniz.`,
      'Başvurular yürürlükteki mevzuat kapsamında değerlendirilir.',
    ] },
    { title: '11. Aydınlatma Metninin Güncellenmesi', paragraphs: [
      'Kişisel veri işleme faaliyetlerinin veya mevzuatın değişmesi halinde bu Aydınlatma Metni güncellenebilir.',
      'Kişisel veri işleme amaçlarında değişiklik olması halinde gerekli bilgilendirme yeni işleme faaliyetinden önce yapılır.',
    ] },
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentId, LegalDocument> = {
  terms,
  'privacy-notice': privacyNotice,
};
