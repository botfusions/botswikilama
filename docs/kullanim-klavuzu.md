# Lemma + Wiki — Kullanma Kılavuzu

> Yeni başlayanlar için adım adım rehber.

---

## Nedir?

Lemma senin AI asistanının **hafızası**. Normalde AI her konuşmada her şeyi unutur. Lemma ile konuşmalar arasında önemli bilgileri hatırlar.

Wiki ise Lemma'nın içinde bir **bilgi arşivi**. Makale, not, doküman okuduğunda bunları düzenli bir şekilde saklar. Obsidian ile açıp görsel olarak gezebilirsin.

```
Lemma = AI'ın beyin hafızası (kısa notlar, hatırlamalar)
Wiki  = AI'ın kütüphanesi  (uzun dokümanlar, araştırmalar, sentezler)
```

---

## Kurulum

### 1. Node.js Kontrolü

Bilgisayarında Node.js yüklü olmalı. Kontrol etmek için terminalde:

```bash
node --version
```

v18 veya üstü yazıyorsa tamamsın. Yazmıyorsa https://nodejs.org adresinden indir.

### 2. Lemma'yı İndir

```bash
git clone https://github.com/botfusions/lemma
cd lemma
npm install
npm run build
```

### 3. MCP Config'e Ekle

**Claude Desktop** için:

Dosya yolu: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["D:\\lemma\\dist\\index.js"],
      "env": {
        "LEMMA_DIR": "C:\\Users\\SENIN_ADIN\\.lemma"
      }
    }
  }
}
```

**Claude Code** (terminal) için:

Dosya yolu: `~/.claude/settings.local.json`

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["D:\\lemma\\dist\\index.js"],
      "env": {
        "LEMMA_DIR": "C:\\Users\\SENIN_ADIN\\.lemma"
      }
    }
  }
}
```

> `SENIN_ADIN` kısmını kendi Windows kullanıcı adınla değiştir.

### 4. Yeniden Başlat

Claude Desktop veya Claude Code'u kapatıp tekrar aç. Lemma otomatik başlayacak.

---

## Bölüm 1: Hafıza (Memory)

### Nasıl Çalışır?

Lemma her proje için ayrı hafıza tutar. Bir projede öğrendiklerini diğer projede karıştırmaz.

```
Sen bir şey söylersin → AI hatırlar → Bir hafta sonra geri geldiğinde hâlâ bilir
```

### Kullanılmayan Bilgiler Unutulur

İnsan beyni gibi çalışır:
- Sık kullanılan bilgiler **güçlenir** (confidence artar)
- Uzun süre dokunulmayan bilgiler **zayıflar** (confidence düşer)
- Çok zayıflayan bilgiler **otomatik silinir** (confidence < 0.1)

### Ne Kaydedilir?

| Kaydedilir | Kaydedilmez |
|---|---|
| Proje teknoloji stack'i | Geçici sorular |
| Öğrenilen dersler | Ham konuşma içeriği |
| Tercihler ("kısa cevap ver") | Tek seferlik bilgiler |
| Çözüm yaklaşımları | Kişisel/hassas veriler |

### Yapman Gereken Şey

**Hiçbir şey.** AI otomatik kaydeder. Sen sadece çalışmaya devam et.

İstersen şunu söyleyebilirsin:
- "Bunu hatırla: projemiz React + TypeScript kullanıyor"
- "Bu yaklaşımı kaydet: debug için önce log ekliyoruz"

AI geri geldiğinde:
- "Geçen sefer hangi teknolojileri kullanıyorduk?" → hatırlar
- "Negatif kelimeleri güncellemiştik, nelerdi?" → hatırlar

---

## Bölüm 2: Wiki (Bilgi Arşivi)

### Wiki Ne İşe Yarar?

Makaleler, PDF'ler, araştırma notları, toplantı tutanakları okuyorsan, Wiki bunları düzenli bir arşive dönüştürür.

**Önce:** 50 tane PDF dosyan var, içindekileri bulmak imkansız.

**Sonra:** Her PDF'in özeti var, kavramlar birbirine bağlı, arama yapabilirsin.

### 3 Katman

```
raw/          → Orijinal dosyalar (DOKUNULMAZ - asla değiştirilmez)
Wiki sayfaları → AI'ın yazdığı özetler, kavramlar, kararlar
CLAUDE.md     → Wiki'nin kuralları (anayasa)
```

### Adım 1: Vault Oluştur (Tek Seferlik)

AI'a de ki:

> "Wiki vault oluştur: D:\projeler\araştırma"

AI `wiki_setup` aracını çağırır ve şu yapıyı oluşturur:

```
D:\projeler\araştırma\
├── CLAUDE.md       → Wiki kuralları
├── index.md        → İçerik kataloğu
├── log.md          → İşlem kaydı
├── raw/            → Ham kaynakların gideceği yer
│   ├── articles/
│   ├── papers/
│   └── assets/
├── sources/        → Her kaynak için özet sayfası
├── entities/       → Kişiler, ürünler, organizasyonlar
├── concepts/       → Soyut kavramlar, terimler
├── decisions/      → Alınan kararlar
├── syntheses/      → Üst düzey analizler
└── archive/        → Eskimiş sayfalar (silinmez)
```

### Adım 2: Kaynak Ekle

`raw/` klasörüne dosya koy:

```bash
# Örnek: bir makale PDF'i kopyala
copy makale.pdf "D:\projeler\araştırma\raw\articles\"
```

Sonra AI'a de ki:

> "D:\projeler\araştırma vault'undaki yeni dosyayı işle"

AI `wiki_ingest` ile:
1. Dosyayı okur
2. Özet sayfası yazar (`sources/2026-04-19-makale-ozeti.md`)
3. Bahsedilen kişileri `entities/` altına ekler
4. Kavramları `concepts/` altına ekler
5. Kararları `decisions/` altına ekler
6. `index.md` ve `log.md`'yi günceller

### Adım 3: Soru Sor

> "Bu vault'ta React Server Components hakkında ne biliyoruz?"

AI `wiki_query` ile ilgili sayfaları bulur, sentezler, kaynaklı cevap verir.

### Adım 4: Sağlık Kontrolü

Periyodik olarak (haftada bir):

> "Vault'ta sağlık kontrolü yap"

AI `wiki_lint` ile:
- Yetim sayfaları bulur (hiçbir yerden link almayanlar)
- Kırık linkleri tespit eder
- Kaynak referansı eksik sayfaları gösterir
- `lint-report.md` yazar

---

## Tüm Araçlar

### Hafıza Araçları

| Araç | Ne Yapar | Ne Zaman |
|---|---|---|
| `memory_read` | Kayıtlı anıları okur | Session başında otomatik |
| `memory_add` | Yeni anı ekler | Bir şey öğrenince otomatik |
| `memory_update` | Anıyı günceller | Bilgi değişince |
| `memory_forget` | Anıyı siler | Yanlış bilgi silinecekse |
| `memory_check` | Konu daha önce biliniyor mu | Araştırma öncesi |
| `memory_stats` | Hafıza istatistikleri | Merak ettiğinde |
| `memory_audit` | Hafıza sağlık kontrolü | Ara sıra |

### Rehber Araçları

| Araç | Ne Yapar | Ne Zaman |
|---|---|---|
| `guide_get` | Rehberleri listeler | Bir teknoloji hakkında bilgi istediğinde |
| `guide_practice` | Rehber kullandığını kaydeder | Bir teknoloji kullandığında otomatik |
| `guide_create` | Yeni rehber oluşturur | Yeni bir yöntem öğrenince |
| `guide_suggest` | Göreve uygun rehber önerir | Yeni göreve başlarken |

### Wiki Araçları

| Araç | Ne Yapar | Ne Zaman |
|---|---|---|
| `wiki_setup` | Vault oluşturur | İlk kurulumda (bir kere) |
| `wiki_ingest` | Kaynağı işler | raw/'a dosya eklediğinde |
| `wiki_query` | Wiki'de arama yapar | Soru sormak istediğinde |
| `wiki_lint` | Sağlık kontrolü yapar | Haftada bir |

---

## Pratik Örnek Senaryolar

### Senaryo 1: Araştırma Projesi

```
1. "D:\araştırma\ai-trends vault oluştur"
   → AI klasörleri oluşturur

2. raw/articles/ altına 5 makale PDF'i kopyala

3. "Tüm yeni makaleleri işle"
   → AI her makale için özet yazar, entity'leri çıkarır

4. "AI ajanlarında son trendler ne?"
   → AI wiki'den sentezler, kaynaklı cevap verir

5. "Sağlık kontrolü yap"
   → AI eksik linkleri, yetim sayfaları raporlar
```

### Senaryo 2: Kitap Okuma

```
1. "D:\kitaplar\sapiens vault oluştur, proje adı: Sapiens Kitap Notları"

2. Her bölümü okuduktan sonra:
   "Bölüm 3'ü işle: [bölüm özeti]"
   → AI sources/ altına yazar, karakterleri entities/'e ekler

3. "Harari'nin 'hayali gerçekler' kavramı neydi?"
   → AI wiki'den bulur ve açıklar
```

### Senaryo 3: Proje Dokümantasyonu

```
1. "D:\projeler\myapp vault oluştur"

2. raw/'a toplantı notlarını, teknik dokümanları koy

3. "Bu haftaki toplantı notunu işle"
   → AI kararları decisions/'a, teknik terimleri concepts/'e ekler

4. "API tasarımında hangi kararları aldık?"
   → AI wiki'den tüm ilgili kararları listeler
```

---

## Obsidian ile Kullanma

Wiki vault'u Obsidian ile açarak görsel olarak gezebilirsin:

1. Obsidian'ı aç
2. "Open folder as vault" → vault klasörünü seç
3. Graph view ile sayfalar arası bağlantıları gör
4. Search ile wiki içinde arama yap

> Wiki sayfaları standart Markdown formatında. Obsidian'ın `[[link]]` sözdizimi kullanır.

---

## Sık Sorulan Sorular

**S: Bilgilerim güvende mi?**
Evet. Tüm veriler senin bilgisayarında (`~/.lemma/` ve vault klasöründe). Hiçbir şey buluta gönderilmez.

**S: Yanlış bilgi kaydederse?**
AI'a söyle: "Bunu sil" veya "Bunu güncelle: doğru bilgi şudur..."

**S: Wiki klasörü çok büyürse?**
`wiki_lint` ile kontrol et. Gereksiz sayfaları `archive/` altına taşıyabilirsin. Hiçbir sayfa silinmez.

**S: Birden fazla vault olabilir mi?**
Evet. Her proje için ayrı vault oluşturabilirsin. Birbirinden bağımsız çalışır.

**S: Lemma ve Wiki aynı anda kullanılır mı?**
Evet. Lemma kısa anıları (tercihler, geçmiş notlar), Wiki uzun dokümanları tutar. Birlikte çalışırlar.

**S: Arkadaşımla paylaşabilir miyim?**
Repo: https://github.com/botfusions/lemma
```bash
git clone https://github.com/botfusions/lemma
cd lemma && npm install && npm run build
```

---

## İpuçları

1. **raw/ klasörüne dokunma.** Orijinal dosyalar orada kalır, asla değiştirilmez.

2. **Her ingest'ten önce özet oku.** AI sana 5 maddelik özet sunar, onaylamadan yazmaz.

3. **Graph view kullan.** Obsidian ile wiki'yi aç, bağlantı ağını görselleştir.

4. **Düzenli lint yap.** Haftada bir `wiki_lint` çalıştır, wiki'nin sağlıklı kalmasını sağla.

5. **Kaynakları koru.** Her iddianın bir kaynağı olmalı. Kaynaksız iddia yasaktır.
