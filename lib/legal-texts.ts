/** Türkçe şablon metinler. Alanlar {{ALAN}} — lib/legal.ts doldurur. Hukuki inceleme AÇIK. */
export interface LegalDoc {
  updated: string;
  sections: { h?: string; p: string[] }[];
}

export const LEGAL_DOCS: Record<"kvkk" | "mesafeli-satis" | "iade-iptal" | "cerez", LegalDoc> = {
  kvkk: {
    updated: "{{TARIH}}",
    sections: [
      { p: ["6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca, veri sorumlusu sıfatıyla {{UNVAN}} ({{MARKA}}, {{ADRES}}) tarafından kişisel verilerinizin işlenmesine ilişkin bu aydınlatma metni hazırlanmıştır."] },
      { h: "1. İşlenen kişisel veriler", p: ["Sipariş sırasında verdiğiniz ad soyad, telefon numarası, teslimat adresi ve mahalle bilgisi, sipariş içeriği ve notlarınız, istediğiniz teslim saati, ödeme tercihi (teslimatta nakit/kart) ve sipariş zamanı işlenir. Ödeme kartı bilgileri sitede toplanmaz; teslimatta ödeme kurye/kasa cihazında gerçekleşir."] },
      { h: "2. İşleme amaçları ve hukuki sebep", p: ["Verileriniz siparişinizi almak, hazırlamak, teslim etmek ve sizinle sipariş hakkında iletişim kurmak amacıyla; KVKK m. 5/2-c (sözleşmenin kurulması ve ifası) ve m. 5/2-ç (hukuki yükümlülük: fatura ve muhasebe kayıtları) kapsamında işlenir. E-posta bültenine kaydolmanız halinde iletişim izniniz (m. 5/1 açık rıza) ile ticari elektronik ileti gönderilir; izninizi her zaman geri alabilirsiniz."] },
      { h: "3. Aktarım", p: ["Verileriniz; teslimatı yapan kurye ile (ad, telefon, adres), barındırma ve veritabanı hizmeti sağlayıcımız (Supabase, AB veri merkezi) ve site altyapı sağlayıcımız (Vercel) ile yalnızca hizmetin gerektirdiği ölçüde paylaşılır. Yasal zorunluluk halinde yetkili kurumlara aktarılabilir. Bunun dışında üçüncü kişilere satılmaz, pazarlama amacıyla paylaşılmaz."] },
      { h: "4. Saklama süresi", p: ["Sipariş kayıtları, vergi ve tüketici mevzuatındaki zorunlu süreler boyunca (ticari defter ve belgeler için 10 yıl; tüketici uyuşmazlıkları için 3 yıl) saklanır, sürenin sonunda silinir veya anonim hale getirilir."] },
      { h: "5. Haklarınız (KVKK m. 11)", p: ["Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok edilmesini isteme, bu işlemlerin aktarılan taraflara bildirilmesini isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zararınızın giderilmesini talep etme haklarına sahipsiniz."] },
      { h: "6. Başvuru", p: ["Taleplerinizi {{EPOSTA}} adresine e-posta ile veya {{ADRES}} adresine yazılı olarak iletebilirsiniz. Başvurular en geç 30 gün içinde ücretsiz sonuçlandırılır."] },
      { h: "7. Çerezler", p: ["Site yalnızca çalışması için gerekli çerezleri kullanır; analitik veya reklam çerezi yoktur. Ayrıntı için Çerez Politikası'na bakın."] },
    ],
  },
  "mesafeli-satis": {
    updated: "{{TARIH}}",
    sections: [
      { h: "1. Taraflar", p: ["SATICI: {{UNVAN}} ({{MARKA}}) — Adres: {{ADRES}} — Tel: {{TEL}} — Vergi Dairesi/No: {{VERGI_DAIRESI}} / {{VERGI_NO}} — MERSİS: {{MERSIS}}.", "ALICI: {{WEB}} üzerinden sipariş formunda ad soyad, telefon ve (kurye için) adres bilgilerini veren tüketici."] },
      { h: "2. Konu", p: ["Bu sözleşme, ALICI'nın {{WEB}} sitesinden elektronik ortamda sipariş verdiği, nitelikleri ve satış fiyatı sipariş sayfasında belirtilen yiyecek ve içeceklerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerini düzenler."] },
      { h: "3. Ürün, fiyat ve teslim", p: ["Ürünlerin adı, adedi ve KDV dahil satış fiyatı sipariş onay ekranında ve sipariş takip sayfasında gösterilir. Kurye teslimatında mahalleye göre minimum sepet tutarı uygulanır; kurye ücreti varsa sepet ekranında ayrıca gösterilir.", "Teslimat, ALICI'nın seçtiği şekilde işletme adresinden teslim alma (gel-al) veya belirttiği adrese kurye ile yapılır. İstenen saat sipariş sırasında seçilir; yoğunluk nedeniyle sapma olursa ALICI telefonla bilgilendirilir. Sipariş, işletmenin çalışma saatleri ({{SAATLER}}) içinde alınır."] },
      { h: "4. Ödeme", p: ["Ödeme, teslimat anında nakit veya banka/kredi kartı ile yapılır. Sitede kart bilgisi alınmaz. (Online ödeme devreye alındığında bu madde güncellenecektir.)"] },
      { h: "5. Cayma hakkı", p: ["Mesafeli Sözleşmeler Yönetmeliği m. 15/1-c ve m. 15/1-ç uyarınca, çabuk bozulabilen veya son kullanma tarihi geçebilecek malların ve tüketicinin istekleri doğrultusunda hazırlanan ürünlerin tesliminde cayma hakkı kullanılamaz. Bu nedenle sipariş edilen yiyecek ve içeceklerde teslimden sonra cayma hakkı bulunmaz. Sipariş, hazırlığa başlanmadan önce iptal edilebilir; ayrıntı için İade ve İptal Koşulları'na bakın."] },
      { h: "6. Ayıplı ürün", p: ["Eksik, yanlış veya ayıplı teslimatta ALICI, teslimden itibaren makul süre içinde {{TEL}} numarasından işletmeye bildirir; ürün yeniden hazırlanır veya bedeli iade edilir."] },
      { h: "7. Uyuşmazlık", p: ["Uyuşmazlıklarda, Ticaret Bakanlığı'nca her yıl belirlenen parasal sınırlar dahilinde ALICI'nın yerleşim yerindeki veya SATICI'nın bulunduğu yerdeki Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir."] },
      { h: "8. Yürürlük", p: ["ALICI, siparişi onaylamakla bu sözleşmenin tüm koşullarını okuduğunu ve kabul ettiğini beyan eder. Sözleşme, siparişin onaylandığı anda kurulur; bir örneği sipariş takip sayfasından erişilebilir."] },
    ],
  },
  "iade-iptal": {
    updated: "{{TARIH}}",
    sections: [
      { h: "Sipariş iptali", p: ["Siparişinizi, hazırlığa başlanmadan önce {{TEL}} numarasını arayarak iptal edebilirsiniz. Sipariş takip sayfasında durum \"Hazırlanıyor\" olduktan sonra ürünler sizin için hazırlanmaya başlamıştır ve iptal kabul edilemez.", "İşletme; stok, çalışma saati veya teslimat bölgesi nedeniyle siparişi iptal etmek zorunda kalırsa sizi telefonla bilgilendirir ve varsa yapılmış ödemeyi iade eder."] },
      { h: "İade", p: ["Yiyecek ve içecekler çabuk bozulan ürünler olduğundan teslimden sonra iade alınmaz (Mesafeli Sözleşmeler Yönetmeliği m. 15). Eksik, yanlış veya bozuk teslimat halinde teslim anında ya da hemen sonrasında bize bildirin; ürünü yeniden hazırlar veya bedelini iade ederiz."] },
      { h: "Ödeme iadesi", p: ["Teslimatta ödeme yapıldığı için iade, teslim anında ödemenin alınmaması veya nakit iade şeklinde olur. Online ödeme devreye girdiğinde iadeler aynı karta yapılır ve bankanıza bağlı olarak 3–10 iş günü içinde hesabınıza yansır."] },
      { h: "İletişim", p: ["{{MARKA}} · {{ADRES}} · {{TEL}} · {{EPOSTA}}"] },
    ],
  },
  cerez: {
    updated: "{{TARIH}}",
    sections: [
      { p: ["{{WEB}} yalnızca sitenin çalışması için zorunlu olan çerezleri ve tarayıcı depolamasını kullanır. Analitik, reklam veya takip çerezi yoktur; bu nedenle çerez onay bandı gösterilmez."] },
      { h: "Kullanılan çerezler ve depolama", p: ["mag_panel (çerez, 30 gün): yalnızca işletme paneline giriş yapan kullanıcıda oturumu tutar. Müşterilerde oluşmaz.", "mag:sound, mag:panel-sound, mag:panel-seen (tarayıcı localStorage): ses tercihi ve panelde görülen siparişler. Sunucuya gönderilmez.", "Supabase oturum bilgisi (localStorage): yalnızca işletme paneli girişinde, giriş yapan kullanıcıda."] },
      { h: "Üçüncü taraflar", p: ["Yazı tipleri sitenin kendi sunucusundan yüklenir; Google Fonts'a bağlantı kurulmaz. Harita bağlantısına tıkladığınızda Google Haritalar'a yönlendirilirsiniz; oradaki işlemler Google'ın politikalarına tabidir."] },
      { h: "Tercihleriniz", p: ["Tarayıcı ayarlarından çerezleri ve site verilerini istediğiniz zaman silebilirsiniz; site bu durumda da çalışmaya devam eder."] },
    ],
  },
};
