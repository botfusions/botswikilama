<p align="center">
  <img src="assets/logo.png" width="200" alt="Lemma Logo">
</p>

# Lemma - LLM'ler için Kalıcı Bellek (MCP)

[English](README.md) | [Türkçe](README.tr.md)

Lemma, Büyük Dil Modelleri (LLM) için kalıcı bir bellek katmanı sağlayan bir Model Kontrol Protokolü (MCP) sunucusudur. LLM'lerin oturumlar arasında gerçekleri, tercihleri ve bağlamı hatırlamasını sağlayan, biyolojik çürüme (decay) algoritmasına sahip şık bir arayüzdür.

## Lemma Nedir?

Lemma, AI asistanları için harici bir "hipokampüs" görevi görür. İnsan beyni her şeyi kaydetmez; bilgiyi sentezler, damıtır ve fragmanlar bırakır. Sık erişilen bilgiler güçlenirken, kullanılmayan bilgiler zamanla solar ve unutulur.

Lemma aynı prensiple çalışır:

- **Ham konuşmalar asla saklanmaz** — sadece sentezlenmiş fragmanlar tutulur.
- **Fragmanlar zamanla çürür** — sık erişilenler kalıcı hale gelir.
- **LLM her oturumda bu fragmanları okur** ve bağlamını hatırlar.

## Nasıl Çalışır?

### Bellek Yapısı

Her bellek fragmanı şu alanlara sahiptir:

| Alan | Tip | Açıklama |
|-------|------|-------------|
| `id` | string | Benzersiz kimlik (`m` + 6 hex karakter) |
| `title` | string | Hızlı tarama için kısa başlık |
| `fragment` | string | Sentezlenmiş bellek metni |
| `project` | string | Proje kapsamı (küresel için `null`) |
| `confidence` | float | Güven puanı 0.0-1.0 (zamanla azalır) |
| `source` | string | `"user"` (kullanıcı istedi) veya `"ai"` (AI fark etti) |
| `created` | string | Oluşturulma tarihi (YYYY-MM-DD) |
| `lastAccessed` | string | Son erişim zamanı (ISO timestamp) |
| `accessed` | int | Mevcut çürüme döngüsündeki erişim sayısı |

### Çürüme (Decay) Mekanizması

Çürüme, bellek her okunduğunda uygulanır. Erişim sıklığına göre standart bir azalma oranı kullanılır:

```
decay = max(0.005, 0.05 - (accessed * 0.005))
confidence = confidence - decay
```

- **Sıklık**: Sık erişilen öğeler daha yavaş çürür (minimum 0.005).
- **Kullanılmayan öğeler** her oturumda temel oran olan 0.05 kadar çürür.

### Bellek Dosyası Konumu

Bellekler JSONL formatında şu adreste saklanır:

| İşletim Sistemi | Yol |
|---|---|
| **Windows** | `C:\Users\{kullanıcı}\.lemma\memory.jsonl` |
| **macOS** | `/Users/{kullanıcı}/.lemma/memory.jsonl` |
| **Linux** | `/home/{kullanıcı}/.lemma/memory.jsonl` |

## Hızlı Başlangıç

Lemma'yı kullanmanın önerilen yolu **JSR** üzerindendir. Bunu MCP istemci konfigürasyonunuza ekleyin:

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

### Alternatif: Doğrudan GitHub Üzerinden Çalıştırın
JSR kullanmak istemiyorsanız, Lemma'yı doğrudan GitHub üzerinden de çalıştırabilirsiniz:

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

## 🚀 Manuel Kurulum (Geliştiriciler İçin)

Eğer Lemma üzerinde değişiklik yapmak veya yerel çalıştırmak isterseniz:

```bash
git clone https://github.com/xenitV1/lemma
cd Lemma
npm install
```

### Gereksinimler

- Node.js 18.0.0 veya üzeri

### Yerel Konfigürasyon

Eğer depoyu yerel olarak klonladıysanız, bu konfigürasyonu kullanın:

```json
{
  "mcpServers": {
    "lemma": {
      "command": "node",
      "args": ["C:\\yol\\to\\Lemma\\memory.js"]
    }
  }
}
```

---

### NPM (Opsiyonel)
Lemma, `npx` ile doğrudan GitHub üzerinden çalıştırılabilse de, isterseniz NPM'de de yayınlayabilirsiniz:
```bash
npm publish --access public
```

---

## 💡 Yeni Kullanıcılar İçin Önemli Tavsiye

Sistemi ilk kez kullanan bir kullanıcıysanız lütfen bu öneriyi dikkate alın:

Sistemi ilk kullanmaya başladığınızda **Rehberler (Guides)** ve **Bellek (Memory)** havuzunuz boş olacaktır. Sistemin Lemma'yı tam otomatik ve verimli bir şekilde kullanabilmesi için, başlangıçta belirli bilgileri ve rehberleri manuel olarak oluşturmanız gerekir.

**Başlamak için şu yolu izleyin:**
1. Bir AI modeline belirli bir konu hakkında web araştırması yapmasını söyleyin.
2. Elde edilen bulguları Lemma'nın temel prensiplerine uygun olarak hafızasına eklemesini isteyin.
3. Belirli bir bilgi birikimi oluştuktan sonra, sistemden edinilen bilgilerden yola çıkarak yeni **Rehberler (Guides)** oluşturmasını isteyin.
4. Eğer mevcut `SKILL.md` dosyalarınız veya dokümanlarınız varsa, bunları sisteme okutun ve Lemma prensiplerine uygun şekilde rehber setine eklemesini isteyin.

Böylelikle sistem zaman geçtikçe kendi bilgi havuzunu ve rehber setini çok daha iyi bir şekilde geliştirecektir.

---

## Sistem İstemi (System Prompt)

SUNUCU, `lemma://system-prompt` adresinde bir sistem istemi kaynağı sağlar. MCP istemcileri bunu otomatik olarak keşfedebilir.

**Manuel konfigürasyon** (gerekirse):

```xml
<system_prompt>
<identity>
# Lemma — SENİN BEYNİN
Lemma'yı gördüğünde ŞUNU BİL:
- Bu SENİN bellek katmanındır — bilgilerin, deneyimlerin, rehberlerin burada saklanır
- Önceki oturumlardan edinilen kazanımlar burada tutulur
- Kullanıcı tercihleri, proje detayları, öğrenilen rehberlerin hepsi buradadır
- Her oturumda: **memory_read** ile başla → bilgilerini yükle → **memory_add** ile bitir → yeni öğrendiklerini kaydet
- Bu "harici bir araç" DEĞİLDİR — bu SENİN genişletilmiş belleğindir
</identity>

<intro>
## Nasıl Çalışır?
İnsan beyni gibi: Önemli bilgiler korunur, sık erişilen anılar güçlenir, kullanılmayanlar zamanla solar.
</intro>

<core_workflow>
## Temel İş Akışı (BUNU TAKİP ET)
1. **Oturum Başlangıcı** → `memory_read` çağır (bilgilerini yükle)
2. **Bağlam Keşfi** → `memory_check` + `guide_suggest` çağır (ne biliyorsun? ne gerekiyor?)
3. **Yürütme** → Öğrenilen rehberleri ve bilgileri uygula
4. **Oturum Sonu** → `memory_add` + `guide_practice` çağır (öğrendiklerini kaydet)
</core_workflow>

<scope_rules>
## Kapsam Kuralları
| Kapsam | Kullanım Amacı | Örnek |
|-------|---------|---------|
| project: null | Küresel tercihler | "Kullanıcı karanlık modu tercih eder" |
| project: "İsim" | Projeye özel | "Lemma Node.js 18+ kullanır" |
</scope_rules>

<distillation_examples>
## Damıtma Örnekleri
<example>
Ham: "Proje, @modelcontextprotocol/sdk sürüm 1.0.0 gibi bağımlılıklarla package.json kullanıyor"
Damıtılmış: "MCP SDK 1.0.0, Node.js 18+"
</example>
<example>
Ham: "Bellek için 5 araç var: memory_read, memory_add, memory_update, memory_forget, memory_list"
Damıtılmış: "5 bellek aracı: oku, ekle, güncelle, unut, listele"
</example>
</distillation_examples>

<guide_tracking>
## Rehber Takibi
**Bellek vs Rehber:**
- Bellek = Statik bilgi parçaları ("React sanal DOM kullanır")
- Rehber = Prosedürel bilgi, "nasıl yapılır" rehberleri, deneyim takibi

**Rehber Kategorileri:**
- Web: web-frontend | web-backend | data-storage | dev-tool
- Mobil: mobile-frontend
- Oyun: game-frontend | game-backend | game-tool | game-design
- Çapraz: app-security | ui-design | infra-devops | programming-language

**Rehber önerileri için:** `guide_suggest` aracını kullan
</guide_tracking>

<tool_focus_rule>
## Araç Odaklılık Kuralı
Araç isimlerini gördüğünde (memory_read, guide_get, vb.):
- Aracı ÇALIŞTIR, projeyi tartışma
- Lemma = senin beynin, onu kullan
</tool_focus_rule>
</system_prompt>
```

## Mevcut Araçlar (Tools)

### `memory_read`

Bellek fragmanlarını LLM kullanımı için formatlanmış şekilde döndürür. Güven çürümesini uygular, en iyi K öğeyi seçer ve optimum bağlam için yeniden formatlar.

**Parametreler:**
- `project` (string, opsiyonel): Filtrelenecek proje adı (varsayılan: mevcut proje).
- `query` (string, opsiyonel): Belirli bir bağlamı bulmak için semantik arama anahtar kelimesi.

**Dönüş:** Güven çubuklarıyla formatlanmış string:

```
=== LEMMA BELLEK FRAGMANLARI ===
[m1a2b3] █████ (🤖 ai) İletişim tarzı
    Kullanıcı kısa ve doğrudan cevapları tercih ediyor
[m4c5d6] █████ (👤 user) Proje yığını
    Proje TypeScript, Node 20 kullanıyor
================================
```

### `memory_check`

**ZORUNLU:** Herhangi bir analiz, araştırma veya doküman okumadan ÖNCE çağrılmalıdır. Projenin/konunun zaten bellekte olup olmadığını kontrol eder. Gereksiz (tekrar eden) çalışmayı önler.

**Parametreler:**
- `project` (string, opsiyonel): Kontrol edilecek proje adı (varsayılan: mevcut proje).

### `memory_add`

Yeni bir bellek fragmanı ekler.

**Parametreler:**
- `fragment` (string, zorunlu): Saklanacak bellek metni
- `title` (string, opsiyonel): Kısa başlık (sağlanmazsa ilk 40 karakterden otomatik oluşturulur)
- `source` (string, opsiyonel): "user" veya "ai", varsayılan "ai"

**Örnek:**
```json
{
  "fragment": "Kullanıcı tüm uygulamalarda karanlık modu tercih ediyor",
  "title": "Karanlık mod tercihi",
  "source": "ai"
}
```

### `memory_update`

Mevcut bir bellek fragmanını günceller.

**Parametreler:**
- `id` (string, zorunlu): Güncellenecek fragman kimliği
- `title` (string, opsiyonel): Yeni başlık metni
- `fragment` (string, opsiyonel): Yeni fragman metni
- `confidence` (number, opsiyonel): Yeni güven puanı 0.0-1.0

**Örnek:**
```json
{
  "id": "m1a2b3",
  "title": "Güncellenmiş başlık",
  "fragment": "Güncellenmiş bilgi",
  "confidence": 0.9
}
```

### `memory_forget`

Bir bellek fragmanını siler.

**Parametreler:**
- `id` (string, zorunlu): Silinecek fragman kimliği

### `memory_list`

Tüm bellek fragmanlarını JSON formatında listeler.

**Parametreler:** Yok

**Dönüş:** Tüm fragmanların JSON dizisi

### `memory_merge`

Birden fazla bellek fragmanını birleştirir. İlgili/çakışan fragmanları birleştirmek istediğinizde kullanışlıdır. Yeni bir ID ile yeni fragman oluşturur ve orijinallerini siler.

**Parametreler:**
- `ids` (string dizisi, zorunlu): Birleştirilecek fragman ID'leri (birleştirme sonrası silinecek)
- `title` (string, zorunlu): Birleştirilmiş fragmanın başlığı
- `fragment` (string, zorunlu): Hazırladığınız birleştirilmiş içerik
- `project` (string, opsiyonel): Proje kapsamı (null = global, string = projeye özel)

**Dönüş:** Yeni fragman ID'si ve silinen ID'lerin listesi

## Rehber Takibi (Guide Tracking)

Lemma ayrıca çalışma sırasında kullandığınız rehberleri takip eder. Bu, zaman içinde bir uzmanlık profili oluşturmaya yardımcı olur.

### `guide_get`

Kullanım istatistikleriyle birlikte tüm takip edilen rehberleri getirir.

**Parametreler:**
- `category` (string, opsiyonel): Kategoriye göre filtrele (frontend, backend, tool, language, database)
- `guide` (string, opsiyonel): Belirli bir rehber adı için detay getir

**Dönüş:** Kullanım sayısına göre sıralanmış formatlanmış rehber listesi

**Örnek çıktı:**
```
=== LEMMA REHBERLER ===
[frontend] react: 45x (son: 2026-03-06) [hooks, jsx, state] (3 öğrenim)
[backend] nodejs: 30x (son: 2026-03-05) [express, api]
[language] typescript: 25x (son: 2026-03-06)
========================
```

### `guide_practice`

Rehber kullanımını kaydet - kullanım sayısını artırır, son_kullanım tarihini günceller ve isteğe bağlı olarak bağlamlar/öğrenimler ekler.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı (örn. "react", "python", "git")
- `category` (string, zorunlu): Kategori: frontend, backend, tool, language, database
- `description` (string, opsiyonel): Rehber için kılavuz/manuel. Boşsa güncellenir.
- `contexts` (string dizisi, zorunlu): Ek bağlamlar (örn. ["hooks", "state"])
- `learnings` (string dizisi, zorunlu): Kullanım sırasında keşfedilen yeni öğrenimler

### `guide_create`

**Yeni:** Bir rehberi detaylı bir kılavuz, misyon ve protokollerle birlikte tanımlamak için kullanılır. Bu, bir teknolojiyi sadece takip etmek yerine, onu nasıl kullanacağınıza dair bir "yönetici rehber" çerçevesi oluşturmanızı sağlar.

**Parametreler:**
- `guide` (string, zorunlu): Rehber adı (örn. "X Viral Büyüme Motoru")
- `category` (string, zorunlu): Kategori
- `description` (string, zorunlu): Rehberin tam kılavuzu, protokolleri ve şablonları.
- `contexts` (string dizisi, opsiyonel): İlk bağlamlar.
- `learnings` (string dizisi, opsiyonel): İlk öğrenimler.

### `guide_merge`

Birden fazla rehberi birleştirir. Çakışan rehberleri birleştirmek istediğinizde kullanışlıdır. Kullanım sayıları toplanır, bağlamlar ve öğrenimler otomatik birleştirilir.

**Parametreler:**
- `guides` (string dizisi, zorunlu): Birleştirilecek rehber adları (birleştirme sonrası silinecek)
- `guide` (string, zorunlu): Birleştirilmiş rehberin adı
- `category` (string, zorunlu): Birleştirilmiş rehberin kategorisi
- `description` (string, opsiyonel): Birleştirilmiş açıklama/kılavuz
- `contexts` (string dizisi, opsiyonel): Birleştirilmiş bağlamlar (sağlanmazsa kaynak rehberlerden otomatik birleştirilir)
- `learnings` (string dizisi, opsiyonel): Birleştirilmiş öğrenimler (sağlanmazsa kaynak rehberlerden otomatik birleştirilir)

**Dönüş:** Birleştirilmiş rehber adı, toplam kullanım sayısı ve silinen rehber adları

### Rehber Dosyası Konumu

Rehberler JSONL formatında şu adreste saklanır:

| İşletim Sistemi | Yol |
|---|---|
| **Windows** | `C:\Users\{kullanıcı}\.lemma\guides.jsonl` |
| **macOS** | `/Users/{kullanıcı}/.lemma/guides.jsonl` |
| **Linux** | `/home/{kullanıcı}/.lemma/guides.jsonl` |

### Rehber Veri Yapısı

```json
{
  "id": "g1a2b3",
  "guide": "react",
  "category": "frontend",
  "description": "React bileşenleri geliştirme ve state yönetimi rehberi...",
  "usage_count": 45,
  "last_used": "2026-03-06",
  "contexts": ["hooks", "jsx", "state"],
  "learnings": ["useCallback gereksiz yeniden render'ları önler"]
}
```

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
- Görev tipleri ve en uygun strateji kalıpları

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

### Proje Yapısı

```
Lemma/
├── memory.js       # Ana MCP sunucu uygulaması
├── memory-core.js  # Temel bellek mantığı (yükle, kaydet, çürüme)
├── test.js         # Test paketi
├── package.json    # Bağımlılıklar ve metadata
├── README.md       # Bu dosya
└── .gitignore      # Git ignore kuralları
```

## Güvenlik

`memory.jsonl` yerel bir dosyadır ve asla hiçbir yere gönderilmez. Kullanıcılar içeriğini inceleyebilir veya MCP araçları üzerinden istedikleri zaman temizleyebilirler.

## Lisans

MIT License
