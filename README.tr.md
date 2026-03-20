<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - LLM'ler için Kalıcı Bellek (MCP)

[English](README.md) | [Türkçe](README.tr.md)

Lemma, Büyük Dil Modelleri (LLM) için kalıcı bir bellek katmanı sağlayan bir Model Bağlam Protokolü (MCP) sunucusudur. LLM'lerin oturumlar arasında gerçekleri, tercihleri ve bağlamı hatırlamasını sağlar; otomatik bellek çürümesi ve öğrenme ile şık bir arayüz sunar.

## Lemma Nedir?

Lemma, AI asistanları için harici bir hipokampüs görevi görür. İnsan beyni her şeyi kaydetmez — sentezler, damıtır ve fragmanlar bırakır. Sık erişilen bilgiler güçlenir; kullanılmayan bilgiler solar ve unutulur.

Lemma aynı prensiple çalışır:

- **Ham konuşmalar asla saklanmaz** — sadece sentezlenmiş fragmanlar
- **Fragmanlar zamanla çürür** — sık erişilenler güçlenir
- **Kullanılan bilgi bağlam kazanır** — etiketler ve ilişkiler otomatik oluşturulur
- **LLM her oturumda fragmanları okur** ve kim olduğunu hatırlar

## Nasıl Çalışır?

### Dinamik Sistem İstemi

Lemma, ilgili bağlamı LLM'nin sistem istemine çalışma zamanında otomatik enjekte eder:

- **Küresel Bağlam**: Projeler arası öğrenimler ve tercihler (maksimum 10 fragman)
- **Proje Bağlamı**: Projeye özel fragmanlar, güven görselleştirmesi ile (maksimum 20 fragman)
- **Görsel Formatlama**: Güven çubukları (`███░░`) ve kaynak ikonları (🤖/👤)
- **İstem Değiştiricileri**: Özel istem dönüşümleri için genişletilebilir sistem

### Bellek Yapısı

Her bellek fragmanı şu alanlara sahiptir:

| Alan | Tip | Açıklama |
|-------|------|-------------|
| `id` | string | Benzersiz kimlik (format: `m` + 6 hex karakter) |
| `title` | string | Hızlı tarama için kısa başlık |
| `fragment` | string | Sentezlenmiş bellek metni |
| `project` | string | Proje kapsamı (küresel için `null`) |
| `confidence` | float | Güvenilirlik 0.0-1.0 (zamanla çürür ve güçlenir) |
| `source` | string | `"user"` veya `"ai"` |
| `created` | string | Oluşturulma tarihi (YYYY-MM-DD) |
| `lastAccessed` | string | Son okuma zamanı (ISO timestamp) |
| `accessed` | int | Mevcut çürüme döngüsündeki erişim sayısı |
| `tags` | string[] | Kullanımdan elde edilen bağlam etiketleri (örn. "debugging", "refactoring") |
| `associatedWith` | string[] | Aynı oturumda erişilen fragman ID'leri |
| `negativeHits` | int | Bu belleğin yardımcı olmadığı işaretlenme sayısı (oturum başına sıfırlanır) |

### Öğrenme Sistemi

Statik belleğin aksine, Lemma bilginin kullanım yoluyla evrildiği biyolojik bir model kullanır:

**Güçlendirme (erişimde):**
```
confidence = min(1.0, confidence + 0.1)
tags += context_tag  (örn. "debugging")
associatedWith += co_accessed_fragment_ids
```

**Çürüme (oturum başına):**
```
decay = max(0.005, 0.05 - (accessed * 0.005))
confidence = confidence - decay
```

- **Sıklık**: Sık erişilen öğeler daha yavaş çürür (minimum oturum başına 0.005)
- **Kullanılmayan öğeler** temel oran olan oturum başına 0.05 çürür
- **İlişkiler**: Birlikte kullanılan fragmanlar gelecekteki hatırlama için çapraz referanslar oluşturur

### Bellek Dosyası Konumu

Bellekler JSONL formatında şu konumda saklanır:

| İşletim Sistemi | Yol |
|---|---|
| **Windows** | `C:\Users\{kullanıcı}\.lemma\memory.jsonl` |
| **macOS** | `/Users/{kullanıcı}/.lemma/memory.jsonl` |
| **Linux** | `/home/{kullanıcı}/.lemma/memory.jsonl` |

## Hızlı Başlangıç

Lemma'yı kullanmanın önerilen yolu **JSR** üzerindendir. MCP istemci konfigürasyonunuza ekleyin:

**Claude Desktop (Windows):** `%APPDATA%\Claude\claude_desktop_config.json`
**Claude Desktop (macOS):** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "lemma": {
      "command": "npx",
      "args": ["-y", "jsr", "@lemma/lemma"]
    }
  }
}
```

### Alternatif: Doğrudan GitHub'dan çalıştır

```json
{
  "mcpServers": {
    "lemma": {
      "command": "npx",
      "args": ["-y", "github:xenitV1/lemma"]
    }
  }
}
```

---

## Hook Sistemi

Lemma, sunucu davranışını genişletmek için eklenti tabanlı bir hook sistemi sağlar:

### Yaşam Döngüsü Hook'ları

```javascript
import { registerHook, HookTypes } from "@lemma/lemma/server";

// Sunucu başlangıcında callback kaydet
registerHook(HookTypes.ON_START, async (context) => {
  console.log("Sunucu başladı!", context);
});

// Proje bağlamı değişikliğinde callback kaydet
registerHook(HookTypes.ON_PROJECT_CHANGE, async (context) => {
  console.log(`Proje değişti: ${context.project}`);
});
```

### İstem Değiştiricileri

Sistem istemi oluşturmayı özel dönüşümlerle genişletin:

```javascript
import { registerPromptModifier } from "@lemma/lemma/server";

registerPromptModifier(async (prompt, context) => {
  // İsteme özel bağlam ekle
  if (context.project === "uygulamam") {
    return prompt + "\n\n<custom>Not: Deneysel özellikler kullanılıyor.</custom>";
  }
  return prompt;
});
```

---

## Manuel Kurulum (Geliştiriciler İçin)

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

**Gereksinimler:** Node.js 18.0.0 veya üzeri

### Yerel Konfigürasyon

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["C:\\yol\\to\\Lemma\\src\\index.js"]
    }
  }
}
```

---

## Mevcut Araçlar

### Bellek Araçları

#### `memory_read`

Bellek fragmanlarını okur. ÖZET MODU sadece başlık + açıklama gösterir; tam detay için `id` kullanın.

**Parametreler:**
- `project` (string, opsiyonel): Filtrelenecek proje adı
- `query` (string, opsiyonel): Semantik arama anahtar kelimesi
- `id` (string, opsiyonel): Belirli bir fragmanın tam detayını al
- `context` (string, opsiyonel): Bu erişimi bir bağlamla etiketle (örn. "debugging") — güveni artırır
- `all` (boolean, opsiyonel): Tüm projelerden fragmanları göster (varsayılan: false)

**Dönüş:** Güven çubuklarıyla formatlanmış string:

```
=== LEMMA BELLEK FRAGMANLARI (project: myapp) ===
[m1a2b3] ████░ (🤖) [myapp] React Hooks
    useState ve useEffect pattern'leri
==============================
```

#### `memory_add`

**ZORUNLU:** Analizi tamamladıktan SONRA bulguları kaydetmek için çağır.

**Parametreler:**
- `fragment` (string, zorunlu): Saklanacak bellek metni
- `title` (string, opsiyonel): Kısa başlık
- `description` (string, opsiyonel): Kısa özet
- `project` (string, opsiyonel): Proje kapsamı (null = küresel)
- `source` (string, opsiyonel): "user" veya "ai", varsayılan "ai"

#### `memory_update`

Mevcut bir fragmanı ID ile güncelle.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si
- `title` (string, opsiyonel): Yeni başlık
- `fragment` (string, opsiyonel): Yeni metin
- `confidence` (number, opsiyonel): Yeni güven değeri 0-1

#### `memory_feedback`

Kullanımdan sonra bir bellek fragmanı hakkında geri bildirim ver. Pozitif geri bildirim güveni artırır; negatif geri bildirim doğrudan düşürür (-0.1).

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si
- `useful` (boolean, zorunlu): Yardımcı olduysa `true`, olmadıysa `false`

#### `memory_forget`

Bir bellek fragmanını ID ile sil.

**Parametreler:**
- `id` (string, zorunlu): Fragman ID'si

#### `memory_merge`

Birden fazla fragmanı birleştir. Yeni ID oluşturur, orijinalleri siler.

**Parametreler:**
- `ids` (string[], zorunlu): Birleştirilecek fragman ID'leri
- `title` (string, zorunlu): Birleştirilmiş fragmanın başlığı
- `fragment` (string, zorunlu): Birleştirilmiş içerik
- `project` (string, opsiyonel): Proje kapsamı

### Rehber Araçları

#### `guide_get`

Kullanım istatistikleriyle takip edilen rehberleri getir. Kullanım sayısına göre sıralı (en çok kullanılan önce).

**Parametreler:**
- `category` (string, opsiyonel): Kategoriye göre filtrele
- `guide` (string, opsiyonel): Belirli rehber detayı al
- `task` (string, opsiyonel): İlgili rehber önerileri almak için görev açıklaması

#### `guide_practice`

**ZORUNLU:** Çalışma sırasında bir rehber kullandığınızda kullanımını kaydedin.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı
- `category` (string, zorunlu): Kategori
- `description` (string, opsiyonel): Detaylı kılavuz/protokoller
- `contexts` (string[], zorunlu): Kullanıldığı bağlamlar
- `learnings` (string[], zorunlu): Keşfedilen yeni öğrenimler

#### `guide_create`

Detaylı bir kılavuzla rehber oluştur.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı
- `category` (string, zorunlu): Kategori
- `description` (string, zorunlu): Tam kılavuz/protokoller
- `contexts` (string[], opsiyonel): İlk bağlamlar
- `learnings` (string[], opsiyonel): İlk öğrenimler

#### `guide_distill`

Bir bellek fragmanını rehber öğrenimine dönüştür.

**Parametreler:**
- `memory_id` (string, zorunlu): Bellek fragmanı ID'si
- `guide` (string, zorunlu): Hedef rehber adı
- `category` (string, opsiyonel): Kategori (yeni rehber oluşturuluyorsa gerekli)

#### `guide_update`

Mevcut bir rehberin özelliklerini güncelle.

**Parametreler:**
- `guide` (string, zorunlu): Mevcut rehber adı
- `new_name` (string, opsiyonel): Yeni ad
- `category` (string, opsiyonel): Yeni kategori
- `description` (string, opsiyonel): Yeni açıklama/kılavuz

#### `guide_forget`

Bir rehberi sil.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı

#### `guide_merge`

Birden fazla rehberi birleştir. Kullanım sayıları toplanır.

**Parametreler:**
- `guides` (string[], zorunlu): Birleştirilecek rehber adları
- `guide` (string, zorunlu): Birleştirilmiş rehberin adı
- `category` (string, zorunlu): Kategori
- `description` (string, opsiyonel): Birleştirilmiş açıklama
- `contexts` (string[], opsiyonel): Birleştirilmiş bağlamlar
- `learnings` (string[], opsiyonel): Birleştirilmiş öğrenimler

## Felsefe

### Saklanması Gerekenler

**Kullanıcı Katmanı:**
- Kullanıcı tercihleri (iletişim tarzı, format, dil)
- Proje bağlamı (teknoloji yığını, klasör yapısı, konvansiyonlar)
- Açıkça istenen anılar

**Yetenek Katmanı:**
- Kullanılan başarılı çözümler ve yaklaşımlar
- Tekrar eden görevler için keşfedilen kısayollar
- Denenen ve başarısız olan yaklaşımlar

### Saklanmaması Gerekenler

- Ham konuşma içeriği
- Tekrar etmeyecek tek seferlik sorular
- Geçici veya yüksek bağlama özgü bilgiler
- Kişisel veya hassas veriler

## Geliştirme

### Testleri Çalıştırma

```bash
npm test
```

Kapsamlı test paketi: bellek çekirdeği, rehber çekirdeği, işleyiciler, öğrenme yaşam döngüsü, hook sistemi ve dinamik istem oluşturma. Tüm I/O geçici dizinlere izole edilir — gerçek verilere dokunulmaz.

### Proje Yapısı

```
Lemma/
├── src/
│   ├── index.js          # MCP sunucu giriş noktası
│   ├── memory/
│   │   ├── index.js      # Bellek modülü yeniden dışa aktarmalar
│   │   └── core.js       # Temel bellek mantığı
│   ├── guides/
│   │   ├── index.js      # Rehber modülü yeniden dışa aktarmalar
│   │   ├── core.js       # Temel rehber mantığı
│   │   └── task-map.js   # Görev-rehber eşlemesi
│   └── server/
│       ├── index.js      # Sunucu kurulumu
│       ├── handlers.js   # Araç işleyicileri
│       ├── tools.js      # Araç tanımları
│       ├── hooks.js      # Hook sistemi ve istem değiştiriciler
│       └── system-prompt.js
├── tests/
│   └── test.js           # Test paketi
├── package.json
├── jsr.json
├── CHANGELOG.md
└── README.md
```

## Güvenlik

`memory.jsonl` ve `guides.jsonl` yerel dosyalardır ve asla hiçbir yere gönderilmez. Kullanıcılar içeriklerini inceleyebilir veya MCP araçları üzerinden istedikleri zaman temizleyebilirler.

## Lisans

MIT License
