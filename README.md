# Ambisius Wiki Agent

🤖 AI-powered Wiki Agent untuk Ambisius Lab Challenge - Mengakses dan menganalisis informasi dari Ambisius Wiki menggunakan Gemini Flash 2.0

## 📋 Deskripsi

Wiki Agent ini dirancang untuk memenuhi tantangan dari Ambisius Lab yang memerlukan implementasi **Agentic AI** menggunakan TypeScript dan Google Gemini Flash 2.0. Agent dapat memproses berbagai jenis query mulai dari pencarian sederhana hingga analisis kompleks multi-langkah.

## 🎯 Fitur Utama

- ✅ **Pencarian Pintar**: Multi-strategy search (endpoint + direct URL + variations)
- ✅ **Analisis Query**: AI-powered query analysis untuk menentukan complexity
- ✅ **Response Generation**: Menggunakan Gemini Flash 2.0 dengan prompts yang disesuaikan
- ✅ **Multi-Step Analysis**: Handling query kompleks yang memerlukan inferensi
- ✅ **Test Suite**: Comprehensive testing untuk semua test cases
- ✅ **Error Handling**: Robust error handling dan fallback mechanisms

## 🛠️ Tech Stack

- **Language**: TypeScript
- **AI Model**: Google Gemini Flash 2.0
- **Libraries**: 
  - `@google/generative-ai` - Gemini integration
  - `cheerio` - HTML parsing
  - `node-fetch` - HTTP requests
  - `dotenv` - Environment variables

## 📦 Instalasi

1. **Clone repository**:
   ```bash
   git clone https://github.com/HawkinsKaban/ambisius-wiki-agent.git
   cd ambisius-wiki-agent
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Setup environment variables**:
   ```bash
   # Buat file .env di root directory
   echo "GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE" > .env
   ```
   
   **Note**: Pastikan Anda memiliki Google AI Studio API key yang valid.

4. **Build project**:
   ```bash
   npm run build
   ```

## 🚀 Cara Penggunaan

### 1. Running Individual Test Cases

```bash
# Test Case 1 - Easy
npm run test:tc1

# Test Case 2 - Easy  
npm run test:tc2

# Test Case 3 - Medium
npm run test:tc3

# Test Case 4 - Medium
npm run test:tc4

# Test Case 5 - Hard
npm run test:tc5
```

### 2. Running All Test Cases

```bash
npm test
```

### 3. Custom Query

```bash
npm run dev "Your custom query here"
```

### 4. Production Mode

```bash
npm start "Your query here"
```

## 🧪 Test Cases

Sesuai dengan requirements challenge, agent dapat menangani 5 test cases:

### Easy Level

1. **TC001**: `"Gunung Agung lokasinya ada dimana"`
   - **Expected**: Menemukan info di `wiki.ambisius.com/gunung/gunung-agung`
   - **Output**: Informasi lokasi Gunung Agung

2. **TC002**: `"Gunung Sahari lokasi nya dimana?"`
   - **Expected**: Tidak menemukan info (tidak ada Gunung Sahari)
   - **Output**: Pesan bahwa informasi tidak ditemukan

### Medium Level

3. **TC003**: `"Perbedaan gunung agung dan gunung tambora apa?"`
   - **Expected**: Perbandingan kedua gunung
   - **Output**: Tabel markdown dengan perbandingan

4. **TC004**: `"Buatkan laporan tentang sejarah gunung agung, tambora dan sahari"`
   - **Expected**: Laporan untuk Agung & Tambora, Sahari tidak ditemukan
   - **Output**: Laporan sejarah dengan format terstruktur

### Hard Level

5. **TC005**: `"Buatkan laporan tentang sejarah provinsi dimana Gunung Agung berlokasi"`
   - **Expected**: Multi-step: Cari provinsi Agung → Cari info Bali
   - **Output**: Laporan sejarah Provinsi Bali

## 📊 Arsitektur Agent

```
User Query
    ↓
Query Analysis (AI-powered)
    ↓
Multi-Strategy Search
    ├── Search Endpoint
    ├── Direct URL Guessing  
    └── Query Variations
    ↓
Content Extraction
    ↓
Complex Analysis (if needed)
    ├── Additional Searches
    └── Multi-step Inference
    ↓
Response Generation (Gemini)
    ├── Simple Query Prompt
    ├── Comparison Prompt
    ├── Report Prompt
    └── Complex Analysis Prompt
    ↓
Formatted Response (Markdown)
```

## 🔍 Strategii Pencarian

Agent menggunakan 3 strategi pencarian:

1. **Search Endpoint**: `wiki.ambisius.com/find/{query}`
2. **Direct URL Guessing**: Berdasarkan pola URL yang diketahui
3. **Query Variations**: Mencoba variasi query jika strategi utama gagal

## 🤖 AI Integration

### Query Analysis
- Menganalisis intent dan complexity query
- Menentukan apakah perlu multiple pages
- Extract entities yang relevan

### Response Generation
- **Temperature 0.1**: Untuk konsistensi response
- **Custom Prompts**: Disesuaikan dengan complexity level
- **Fallback Mechanism**: Jika AI generation gagal

## 📁 Struktur Proyek

```
ambisius-wiki-agent/
├── src/
│   ├── WikiAgent.ts      # Main agent class
│   ├── index.ts          # Entry point
│   ├── test.ts           # Test runner
│   └── types.ts          # Type definitions
├── dist/                 # Built files
├── .env                  # Environment variables
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
└── README.md             # Documentation
```

## 🎯 Expected Results

Setelah menjalankan test suite, Anda harus mendapatkan:

```
📈 TEST SUMMARY
================
📊 Total Tests: 5
✅ Passed: 5
❌ Failed: 0
📈 Success Rate: 100.0%
⏱️ Average Response Time: 3500ms
```

## 📸 Screenshots untuk Submission

Untuk submission challenge, ambil screenshot dari:

1. **Test Suite Results**: Output dari `npm test`
2. **Individual Test Cases**: Output dari setiap test case
3. **Terminal Commands**: Bukti bahwa semua commands berhasil dijalankan

## 🐛 Troubleshooting

### Common Issues

1. **API Key Error**:
   ```
   ❌ Error: GOOGLE_API_KEY not found
   ```
   **Solution**: Pastikan file `.env` ada dan berisi API key yang valid

2. **Network Timeout**:
   ```
   ⚠️ Search endpoint failed: timeout
   ```
   **Solution**: Cek koneksi internet dan akses ke `wiki.ambisius.com`

3. **No Search Results**:
   ```
   🔎 Found 0 search results
   ```
   **Solution**: Agent akan otomatis mencoba strategi pencarian alternatif

### Debug Mode

Untuk debugging lebih detail:

```bash
DEBUG=true npm test
```

## 📝 Code Quality

### Best Practices Applied

- ✅ **TypeScript Strict Mode**: Full type safety
- ✅ **Error Handling**: Comprehensive try-catch blocks
- ✅ **Logging**: Detailed console logging untuk debugging
- ✅ **Modular Design**: Separation of concerns
- ✅ **Async/Await**: Modern async programming
- ✅ **Type Definitions**: Comprehensive type system

### Performance Optimizations

- ✅ **Content Limiting**: Prevent memory overflow
- ✅ **Timeout Configuration**: Prevent hanging requests
- ✅ **Result Caching**: Avoid duplicate fetches
- ✅ **Strategic Fallbacks**: Multiple search strategies

## 🚀 Deployment

### Production Build

```bash
npm run build
npm start "Your query here"
```

### Environment Variables

```bash
# .env file
GOOGLE_API_KEY=your_api_key_here
NODE_ENV=production
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/new-feature`
5. Submit pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Ray Hawkins Kaban**
- GitHub: [@HawkinsKaban](https://github.com/HawkinsKaban)
- Project: [Ambisius Wiki Agent](https://github.com/HawkinsKaban/ambisius-wiki-agent)

## 🙏 Acknowledgments

- **Ambisius Lab** - untuk challenge yang menarik
- **Google AI Studio** - untuk Gemini Flash 2.0 API
- **Community** - untuk inspiration dan support

---

**🎯 Challenge Status**: Ready for Submission ✅  
**📅 Deadline**: Selasa, 5 Agustus 2025  
**🏆 Goal**: Membuktikan kemampuan Agentic AI dengan TypeScript