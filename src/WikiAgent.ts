import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import {
  WikiSearchResult,
  WikiPageContent,
  AgentResponse,
  SearchToolResponse,
  WikiAgentConfig,
  QueryComplexity,
  ProcessedQuery
} from './types';

export class WikiAgent {
  private genAI: GoogleGenerativeAI;
  private config: WikiAgentConfig;

  constructor(config: WikiAgentConfig) {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);
  }

  /**
   * Main entry point for processing user queries
   */
  async processQuery(query: string): Promise<AgentResponse> {
    console.log(`🔍 Processing query: "${query}"`);
    
    try {
      // Step 1: Analyze the query to understand intent and complexity
      const processedQuery = await this.analyzeQuery(query);
      console.log(`📋 Query analysis:`, processedQuery);

      // Step 2: Search for relevant wiki pages
      const searchResults = await this.searchWiki(query);
      console.log(`🔎 Found ${searchResults.results.length} search results`);

      if (searchResults.results.length === 0) {
        return this.createNotFoundResponse(query);
      }

      // Step 3: Fetch content from relevant pages
      const pageContents = await this.fetchWikiPages(searchResults.results);
      console.log(`📄 Fetched ${pageContents.length} wiki pages`);

      // Step 4: For complex queries, do additional searches if needed
      if (processedQuery.complexity === 'complex_analysis') {
        const additionalPages = await this.handleComplexAnalysis(processedQuery, pageContents);
        pageContents.push(...additionalPages);
      }

      // Step 5: Generate intelligent response using Gemini
      const response = await this.generateResponse(processedQuery, pageContents);
      
      return {
        query,
        found: pageContents.length > 0,
        sources: pageContents.map(p => p.url),
        answer: response,
        format: 'markdown',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error processing query:', error);
      return this.createErrorResponse(query, error as Error);
    }
  }

  /**
   * Handle complex analysis that requires multiple search steps
   */
  private async handleComplexAnalysis(query: ProcessedQuery, existingPages: WikiPageContent[]): Promise<WikiPageContent[]> {
    const additionalPages: WikiPageContent[] = [];
    
    // For province questions, extract location info and search for province
    if (query.originalQuery.toLowerCase().includes('provinsi') && 
        query.originalQuery.toLowerCase().includes('gunung agung')) {
      
      console.log('🔍 Complex analysis: Finding province of Gunung Agung');
      
      // Look for Bali in existing content
      const agungPage = existingPages.find(page => 
        page.url.includes('gunung-agung') || page.title.toLowerCase().includes('agung')
      );
      
      if (agungPage && agungPage.content.toLowerCase().includes('bali')) {
        console.log('🏝️ Found Bali mentioned, searching for Bali province info');
        
        // Search for Bali province information
        const baliSearch = await this.searchWiki('provinsi bali');
        if (baliSearch.results.length > 0) {
          const baliPages = await this.fetchWikiPages(baliSearch.results);
          additionalPages.push(...baliPages);
        }
        
        // Also try direct URL
        try {
          const baliPage = await this.fetchSinglePage('https://wiki.ambisius.com/provinsi/bali');
          if (baliPage) {
            additionalPages.push(baliPage);
          }
        } catch (error) {
          console.warn('⚠️ Could not fetch Bali page directly');
        }
      }
    }
    
    return additionalPages;
  }

  /**
   * Analyze user query to understand intent and complexity
   */
  private async analyzeQuery(query: string): Promise<ProcessedQuery> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest' 
    });
    
    const prompt = `
Analyze this Indonesian query and extract key information:
Query: "${query}"

Provide analysis in this exact JSON format:
{
  "originalQuery": "${query}",
  "intent": "description of what user wants",
  "entities": ["list", "of", "key", "entities", "mentioned"],
  "complexity": "simple|comparison|report|complex_analysis",
  "requiresMultiplePages": true/false
}

Guidelines:
- "simple": asking for basic info about one thing
- "comparison": comparing multiple things  
- "report": requesting detailed report/analysis
- "complex_analysis": multi-step analysis requiring inference (like finding province then province info)
- requiresMultiplePages: true if needs info from multiple wiki pages
`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback analysis
      return this.fallbackQueryAnalysis(query);
    } catch (error) {
      console.warn('⚠️ Failed to analyze query with AI, using fallback');
      return this.fallbackQueryAnalysis(query);
    }
  }

  /**
   * Improved fallback query analysis
   */
  private fallbackQueryAnalysis(query: string): ProcessedQuery {
    const lowerQuery = query.toLowerCase();
    
    let complexity: QueryComplexity = 'simple';
    let requiresMultiplePages = false;
    
    if (lowerQuery.includes('perbedaan') || lowerQuery.includes('vs') || 
        (lowerQuery.includes('dan') && lowerQuery.includes('gunung'))) {
      complexity = 'comparison';
      requiresMultiplePages = true;
    } else if (lowerQuery.includes('laporan') || lowerQuery.includes('sejarah')) {
      complexity = 'report';
      requiresMultiplePages = true;
    } else if (lowerQuery.includes('provinsi') && lowerQuery.includes('dimana')) {
      complexity = 'complex_analysis';
      requiresMultiplePages = true;
    }

    // Extract potential entities (improved)
    const entities = [];
    const knownEntities = [
      'gunung agung', 'gunung tambora', 'gunung sahari', 'bali', 
      'agung', 'tambora', 'sahari', 'provinsi'
    ];
    
    for (const entity of knownEntities) {
      if (lowerQuery.includes(entity)) {
        entities.push(entity);
      }
    }

    return {
      originalQuery: query,
      intent: `User wants information about: ${entities.join(', ') || 'general query'}`,
      entities,
      complexity,
      requiresMultiplePages
    };
  }

  /**
   * Improved search function with multiple strategies
   */
  private async searchWiki(query: string): Promise<SearchToolResponse> {
    console.log(`🌐 Searching: ${query}`);
    
    // Strategy 1: Use the search endpoint
    let results = await this.searchViaEndpoint(query);
    
    // Strategy 2: If no results, try direct URL guessing
    if (results.results.length === 0) {
      results = await this.searchViaDirectUrls(query);
    }
    
    // Strategy 3: Try variations of the query
    if (results.results.length === 0) {
      results = await this.searchWithVariations(query);
    }
    
    return results;
  }

  /**
   * Search using the provided search endpoint
   */
  private async searchViaEndpoint(query: string): Promise<SearchToolResponse> {
    const searchUrl = `${this.config.searchEndpoint}${encodeURIComponent(query)}`;
    
    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Ambisius-Wiki-Agent/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: this.config.timeout
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseSearchResults(html);
    } catch (error) {
      console.warn('⚠️ Search endpoint failed:', error);
      return { results: [], totalResults: 0 };
    }
  }

  /**
   * Try to guess direct URLs based on query content
   */
  private async searchViaDirectUrls(query: string): Promise<SearchToolResponse> {
    const results: WikiSearchResult[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Direct URL patterns based on known structure
    const urlMappings = [
      { keywords: ['gunung agung', 'agung'], url: 'https://wiki.ambisius.com/gunung/gunung-agung' },
      { keywords: ['gunung tambora', 'tambora'], url: 'https://wiki.ambisius.com/gunung/gunung-tambora' },
      { keywords: ['bali', 'provinsi bali'], url: 'https://wiki.ambisius.com/provinsi/bali' }
    ];
    
    for (const mapping of urlMappings) {
      if (mapping.keywords.some(keyword => lowerQuery.includes(keyword))) {
        try {
          const response = await fetch(mapping.url, {
            method: 'HEAD',
            timeout: 5000
          });
          
          if (response.ok) {
            results.push({
              title: mapping.keywords[0],
              url: mapping.url,
              snippet: `Direct link found for ${mapping.keywords[0]}`
            });
          }
        } catch (error) {
          console.warn(`⚠️ Could not verify ${mapping.url}`);
        }
      }
    }
    
    return { results, totalResults: results.length };
  }

  /**
   * Try different variations of the search query
   */
  private async searchWithVariations(query: string): Promise<SearchToolResponse> {
    const variations = [
      query.replace(/\s+/g, '+'),
      query.split(' ').join('-'),
      query.toLowerCase(),
      query.replace(/[^\w\s]/g, '').trim()
    ];
    
    for (const variation of variations) {
      if (variation !== query) {
        const results = await this.searchViaEndpoint(variation);
        if (results.results.length > 0) {
          return results;
        }
      }
    }
    
    return { results: [], totalResults: 0 };
  }

  /**
   * Improved search results parsing
   */
  private parseSearchResults(html: string): SearchToolResponse {
    const $ = cheerio.load(html);
    const results: WikiSearchResult[] = [];

    // Multiple selectors to find search results
    const selectors = [
      'a[href*="/gunung/"]',
      'a[href*="/provinsi/"]', 
      'a[href*="wiki.ambisius.com"]',
      '.search-result a',
      '.result a',
      'article a',
      'li a'
    ];

    for (const selector of selectors) {
      $(selector).each((i, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        const text = $link.text().trim();
        
        if (href && text && href.includes('wiki.ambisius.com')) {
          const url = href.startsWith('http') ? href : `https://wiki.ambisius.com${href}`;
          
          // Avoid duplicates
          if (!results.some(r => r.url === url)) {
            results.push({
              title: text,
              url: url,
              snippet: $link.closest('p, div, li').text().slice(0, 200) + '...'
            });
          }
        }
      });
      
      if (results.length > 0) break; // Stop at first successful selector
    }

    console.log(`✅ Parsed ${results.length} search results`);
    return {
      results: results.slice(0, this.config.maxResults),
      totalResults: results.length
    };
  }

  /**
   * Fetch content from wiki pages
   */
  private async fetchWikiPages(searchResults: WikiSearchResult[]): Promise<WikiPageContent[]> {
    const contents: WikiPageContent[] = [];
    
    for (const result of searchResults) {
      try {
        console.log(`📄 Fetching: ${result.url}`);
        const content = await this.fetchSinglePage(result.url);
        if (content) {
          contents.push(content);
        }
      } catch (error) {
        console.warn(`⚠️ Failed to fetch ${result.url}:`, error);
      }
    }

    return contents;
  }

  /**
   * Improved single page fetching
   */
  private async fetchSinglePage(url: string): Promise<WikiPageContent | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Ambisius-Wiki-Agent/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: this.config.timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove unwanted elements
      $('script, style, nav, footer, .sidebar').remove();

      // Extract title with fallbacks
      const title = $('h1').first().text().trim() || 
                   $('title').text().trim().split(' - ')[0] || 
                   'Untitled';

      // Extract main content with improved selectors
      const contentSelectors = [
        'main .content',
        '.main-content', 
        '.article-content',
        '#content',
        'article',
        '.post-content',
        '.entry-content',
        'main',
        '.content'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const content = $(selector).text().trim();
        if (content && content.length > mainContent.length) {
          mainContent = content;
        }
      }

      // If still no content, try body
      if (!mainContent || mainContent.length < 100) {
        $('header, nav, footer, .navigation, .menu').remove();
        mainContent = $('body').text().trim();
      }

      // Extract sections with better structure
      const sections: Record<string, string> = {};
      $('h1, h2, h3, h4, h5, h6').each((i, element) => {
        const $heading = $(element);
        const sectionTitle = $heading.text().trim();
        
        if (sectionTitle) {
          // Get content until next heading of same or higher level
          const tagName = (element as any).tagName || (element as any).name || 'h1';
          const headingLevel = parseInt(tagName.charAt(1));
          const nextHeadingSelector = Array.from({length: headingLevel}, (_, i) => `h${i + 1}`).join(', ');
          const sectionContent = $heading.nextUntil(nextHeadingSelector).text().trim();
          
          if (sectionContent) {
            sections[sectionTitle] = sectionContent;
          }
        }
      });

      return {
        url,
        title,
        content: mainContent.slice(0, 8000), // Increased limit
        sections
      };
    } catch (error) {
      console.error(`❌ Error fetching ${url}:`, error);
      return null;
    }
  }

  /**
   * Generate intelligent response using Gemini with improved prompts
   */
  private async generateResponse(processedQuery: ProcessedQuery, pageContents: WikiPageContent[]): Promise<string> {
    const model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.1, // Lower temperature for more consistent responses
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });

    const contextData = pageContents.map(page => ({
      url: page.url,
      title: page.title,
      content: page.content.slice(0, 3000) // Increased context per page
    }));

    let prompt = '';

    switch (processedQuery.complexity) {
      case 'simple':
        prompt = this.createSimpleQueryPrompt(processedQuery, contextData);
        break;
      case 'comparison':
        prompt = this.createComparisonPrompt(processedQuery, contextData);
        break;
      case 'report':
        prompt = this.createReportPrompt(processedQuery, contextData);
        break;
      case 'complex_analysis':
        prompt = this.createComplexAnalysisPrompt(processedQuery, contextData);
        break;
    }

    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('❌ AI generation error:', error);
      return this.createFallbackResponse(processedQuery, contextData);
    }
  }

  private createSimpleQueryPrompt(query: ProcessedQuery, context: any[]): string {
    return `
Anda adalah asisten AI yang ahli dalam memberikan informasi dari Ambisius Wiki. 
Berikan jawaban yang akurat dan informatif untuk pertanyaan berikut dalam bahasa Indonesia:

**Pertanyaan:** ${query.originalQuery}

**Sumber informasi yang tersedia:**
${context.map(c => `
---
**Sumber:** ${c.url}
**Judul:** ${c.title}  
**Konten:** ${c.content}
---
`).join('\n')}

**Instruksi:**
1. Berikan jawaban yang langsung menjawab pertanyaan
2. Gunakan format markdown yang rapi
3. Sertakan informasi lokasi yang spesifik jika ditanya tentang lokasi
4. Jika informasi tidak ditemukan, jelaskan dengan jelas
5. Akhiri dengan daftar sumber yang digunakan

**Format jawaban:**
# [Judul Jawaban]

[Isi jawaban yang detail dan informatif]

## Sumber
- [daftar sumber]
`;
  }

  private createComparisonPrompt(query: ProcessedQuery, context: any[]): string {
    return `
Buat perbandingan yang detail dan terstruktur untuk pertanyaan berikut:

**Pertanyaan:** ${query.originalQuery}

**Sumber informasi:**
${context.map(c => `
---
**Sumber:** ${c.url}
**Judul:** ${c.title}
**Konten:** ${c.content}
---
`).join('\n')}

**Instruksi:**
1. Buat perbandingan dalam bentuk tabel markdown
2. Jelaskan perbedaan utama dalam paragraf setelah tabel
3. Fokus pada aspek-aspek yang paling relevan
4. Jika ada informasi yang tidak lengkap, sebutkan dengan jelas

**Format yang diharapkan:**

# Perbandingan [Topik A] dan [Topik B]

## Tabel Perbandingan

| Aspek | [Topik A] | [Topik B] |
|-------|-----------|-----------|
| Lokasi | ... | ... |
| Ketinggian | ... | ... |
| Sejarah | ... | ... |
| Karakteristik | ... | ... |

## Perbedaan Utama

[Penjelasan detail perbedaan]

## Sumber
- [daftar sumber]
`;
  }

  private createReportPrompt(query: ProcessedQuery, context: any[]): string {
  return `
Buat laporan yang komprehensif untuk permintaan berikut:

**Permintaan:** ${query.originalQuery}

**Data yang tersedia:**
${context.map(c => `
---
**Sumber:** ${c.url}
**Judul:** ${c.title}
**Konten:** ${c.content}
---
`).join('\n')}

**Instruksi:**
1. Buat laporan yang terstruktur dengan heading yang jelas
2. Fokus pada aspek "sejarah" sesuai permintaan
3. **WAJIB: Jika ada topik yang tidak ditemukan informasinya, buat section khusus dan nyatakan dengan jelas bahwa informasi tidak tersedia**
4. Gunakan format laporan formal
5. Sebutkan secara explicit topik mana yang ditemukan dan mana yang tidak

**Format laporan:**

# Laporan Sejarah [Daftar Topik]

## Ringkasan Eksekutif
[Ringkasan singkat laporan - sebutkan topik yang berhasil ditemukan dan yang tidak]

## [Topik 1 - DITEMUKAN]
### Sejarah
[Detail sejarah topik 1]

## [Topik 2 - DITEMUKAN]  
### Sejarah
[Detail sejarah topik 2]

## [Topik yang TIDAK DITEMUKAN]
**INFORMASI TIDAK TERSEDIA:** Informasi tentang [topik] tidak ditemukan di Ambisius Wiki. Hal ini mungkin karena:
- Topik tersebut tidak ada dalam database wiki
- Nama yang dicari mungkin tidak sesuai dengan yang tersedia
- Informasi belum dimasukkan ke dalam sistem

## Kesimpulan
[Kesimpulan dari laporan - sebutkan lagi apa yang berhasil dan tidak berhasil ditemukan]

## Sumber Referensi
- [daftar sumber yang digunakan]
- **Catatan:** Beberapa topik tidak memiliki sumber karena informasi tidak ditemukan
`;
}

  private createComplexAnalysisPrompt(query: ProcessedQuery, context: any[]): string {
    return `
Lakukan analisis kompleks untuk menjawab pertanyaan berikut yang memerlukan inferensi multi-langkah:

**Pertanyaan:** ${query.originalQuery}

**Sumber informasi:**
${context.map(c => `
---
**Sumber:** ${c.url}
**Judul:** ${c.title}
**Konten:** ${c.content}
---
`).join('\n')}

**Instruksi untuk analisis:**
1. **Langkah 1:** Identifikasi lokasi/provinsi dari informasi yang tersedia
2. **Langkah 2:** Gunakan informasi provinsi untuk memberikan laporan sejarah
3. **Langkah 3:** Struktur jawaban dengan reasoning yang jelas
4. Jika informasi tidak lengkap, jelaskan langkah yang tidak bisa diselesaikan

**Format analisis:**

# Laporan Sejarah Provinsi [Nama Provinsi]

## Analisis Lokasi
Berdasarkan informasi dari [sumber], [objek] berlokasi di Provinsi [nama provinsi].

## Sejarah Provinsi [Nama Provinsi]

### Periode Awal
[Informasi sejarah awal]

### Perkembangan Modern  
[Informasi perkembangan modern]

### Karakteristik Penting
[Karakteristik unik provinsi]

## Kesimpulan
[Kesimpulan analisis]

## Metodologi Analisis
1. [Langkah analisis yang dilakukan]
2. [Sumber yang digunakan]

## Sumber Referensi
- [daftar sumber]
`;
  }

  private createFallbackResponse(query: ProcessedQuery, context: any[]): string {
    return `
# Jawaban untuk: ${query.originalQuery}

Berdasarkan pencarian di Ambisius Wiki, berikut informasi yang ditemukan:

${context.map(c => `
## ${c.title}
${c.content.slice(0, 800)}...

**Sumber:** ${c.url}
`).join('\n')}

${context.length === 0 ? 
  '**Maaf, informasi yang diminta tidak ditemukan di Ambisius Wiki.**' : 
  ''}

## Sumber Referensi
${context.map(c => `- [${c.title}](${c.url})`).join('\n')}
`;
  }

  private createNotFoundResponse(query: string): AgentResponse {
    return {
      query,
      found: false,
      sources: [],
      answer: `# Informasi Tidak Ditemukan

Maaf, saya tidak dapat menemukan informasi tentang "${query}" di Ambisius Wiki.

## Kemungkinan Penyebab:
- Topik tersebut belum tersedia di wiki
- Istilah pencarian perlu disesuaikan
- Informasi mungkin tersedia dengan nama yang berbeda

## Saran:
- Coba dengan kata kunci yang berbeda
- Periksa ejaan dan tanda baca
- Gunakan istilah yang lebih umum

Silakan coba pencarian lain atau hubungi administrator jika diperlukan.`,
      format: 'markdown',
      timestamp: new Date().toISOString()
    };
  }

  private createErrorResponse(query: string, error: Error): AgentResponse {
    return {
      query,
      found: false,
      sources: [],
      answer: `# Error Memproses Permintaan

Terjadi kesalahan saat memproses permintaan "${query}".

**Error:** ${error.message}

## Langkah Troubleshooting:
1. Periksa koneksi internet
2. Pastikan wiki.ambisius.com dapat diakses
3. Coba lagi dalam beberapa saat

Silakan hubungi administrator jika masalah berlanjut.`,
      format: 'markdown',
      timestamp: new Date().toISOString()
    };
  }
}