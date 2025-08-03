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

      // Step 4: Generate intelligent response using Gemini
      const response = await this.generateResponse(processedQuery, pageContents);
      
      return {
        query,
        found: true,
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
   * Analyze user query to understand intent and complexity
   */
  private async analyzeQuery(query: string): Promise<ProcessedQuery> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    
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
- "complex_analysis": multi-step analysis requiring inference
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
   * Fallback query analysis when AI analysis fails
   */
  private fallbackQueryAnalysis(query: string): ProcessedQuery {
    const lowerQuery = query.toLowerCase();
    
    let complexity: QueryComplexity = 'simple';
    let requiresMultiplePages = false;
    
    if (lowerQuery.includes('perbedaan') || lowerQuery.includes('vs') || lowerQuery.includes('dan')) {
      complexity = 'comparison';
      requiresMultiplePages = true;
    } else if (lowerQuery.includes('laporan') || lowerQuery.includes('sejarah')) {
      complexity = 'report';
      requiresMultiplePages = true;
    } else if (lowerQuery.includes('provinsi') && lowerQuery.includes('dimana')) {
      complexity = 'complex_analysis';
      requiresMultiplePages = true;
    }

    // Extract potential entities (simplified)
    const entities = [];
    const commonEntities = ['gunung agung', 'gunung tambora', 'gunung sahari', 'bali'];
    for (const entity of commonEntities) {
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
   * Search the Ambisius Wiki for relevant pages
   */
  private async searchWiki(query: string): Promise<SearchToolResponse> {
    const searchUrl = `${this.config.searchEndpoint}${encodeURIComponent(query)}`;
    console.log(`🌐 Searching: ${searchUrl}`);
    
    try {
      const response = await fetch(searchUrl, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Ambisius-Wiki-Agent/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return this.parseSearchResults(html);
    } catch (error) {
      console.error('❌ Search error:', error);
      return { results: [], totalResults: 0 };
    }
  }

  /**
   * Parse search results from HTML response
   */
  private parseSearchResults(html: string): SearchToolResponse {
    const $ = cheerio.load(html);
    const results: WikiSearchResult[] = [];

    // Look for search results in various possible formats
    $('a[href*="/gunung/"], a[href*="/provinsi/"], a[href*="wiki.ambisius.com"]').each((i, element) => {
      const $link = $(element);
      const href = $link.attr('href');
      const text = $link.text().trim();
      
      if (href && text && href.includes('wiki.ambisius.com')) {
        const url = href.startsWith('http') ? href : `https://wiki.ambisius.com${href}`;
        
        results.push({
          title: text,
          url: url,
          snippet: $link.parent().text().slice(0, 200) + '...'
        });
      }
    });

    // If no results found in links, try to find them in other elements
    if (results.length === 0) {
      $('.result, .search-result, article').each((i, element) => {
        const $el = $(element);
        const link = $el.find('a').first();
        const href = link.attr('href');
        const title = link.text().trim() || $el.find('h1, h2, h3').first().text().trim();
        
        if (href && title) {
          const url = href.startsWith('http') ? href : `https://wiki.ambisius.com${href}`;
          results.push({
            title,
            url,
            snippet: $el.text().slice(0, 200) + '...'
          });
        }
      });
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
   * Fetch and parse a single wiki page
   */
  private async fetchSinglePage(url: string): Promise<WikiPageContent | null> {
    try {
      const response = await fetch(url, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Ambisius-Wiki-Agent/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract title
      const title = $('h1').first().text().trim() || 
                   $('title').text().trim() || 
                   'Untitled';

      // Extract main content
      const contentSelectors = [
        'main', 
        '.content', 
        '.article-content',
        '#content',
        'article',
        '.post-content'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const content = $(selector).text().trim();
        if (content && content.length > mainContent.length) {
          mainContent = content;
        }
      }

      // If no main content found, get body text
      if (!mainContent) {
        mainContent = $('body').text().trim();
      }

      // Extract sections
      const sections: Record<string, string> = {};
      $('h1, h2, h3, h4').each((i, element) => {
        const $heading = $(element);
        const sectionTitle = $heading.text().trim();
        const sectionContent = $heading.nextUntil('h1, h2, h3, h4').text().trim();
        if (sectionTitle && sectionContent) {
          sections[sectionTitle] = sectionContent;
        }
      });

      return {
        url,
        title,
        content: mainContent.slice(0, 5000), // Limit content length
        sections
      };
    } catch (error) {
      console.error(`❌ Error fetching ${url}:`, error);
      return null;
    }
  }

  /**
   * Generate intelligent response using Gemini
   */
  private async generateResponse(processedQuery: ProcessedQuery, pageContents: WikiPageContent[]): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const contextData = pageContents.map(page => ({
      url: page.url,
      title: page.title,
      content: page.content.slice(0, 2000) // Limit context per page
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
Berikan jawaban yang akurat dan informatif untuk pertanyaan berikut dalam bahasa Indonesia:

Pertanyaan: ${query.originalQuery}

Gunakan informasi dari sumber-sumber berikut:
${context.map(c => `
Sumber: ${c.url}
Judul: ${c.title}  
Isi: ${c.content}
`).join('\n')}

Berikan jawaban dalam format markdown yang mudah dibaca. Sertakan informasi sumber di akhir.
Jika informasi tidak ditemukan, jelaskan dengan jelas bahwa informasi tersebut tidak tersedia.
`;
  }

  private createComparisonPrompt(query: ProcessedQuery, context: any[]): string {
    return `
Buat perbandingan yang detail dan terstruktur untuk pertanyaan berikut:

Pertanyaan: ${query.originalQuery}

Sumber informasi:
${context.map(c => `
Sumber: ${c.url}
Judul: ${c.title}
Isi: ${c.content}
`).join('\n')}

Format jawaban:
1. Berikan perbandingan dalam bentuk tabel markdown
2. Jelaskan perbedaan utama dalam paragraf
3. Sertakan sumber informasi
4. Jika ada informasi yang tidak ditemukan, sebutkan dengan jelas

Gunakan bahasa Indonesia yang baik dan benar.
`;
  }

  private createReportPrompt(query: ProcessedQuery, context: any[]): string {
    return `
Buat laporan yang komprehensif untuk permintaan berikut:

Permintaan: ${query.originalQuery}

Data yang tersedia:
${context.map(c => `
Sumber: ${c.url}
Judul: ${c.title}
Isi: ${c.content}
`).join('\n')}

Format laporan:
# Laporan [Topik]

## Ringkasan Eksekutif
[Ringkasan singkat]

## [Bagian-bagian sesuai topik]
[Detail informasi]

## Sumber
[Daftar sumber yang digunakan]

Catatan: Jika ada informasi yang tidak ditemukan, nyatakan dengan jelas di bagian yang relevan.
Gunakan bahasa Indonesia formal dan struktur yang mudah dibaca.
`;
  }

  private createComplexAnalysisPrompt(query: ProcessedQuery, context: any[]): string {
    return `
Lakukan analisis kompleks untuk menjawab pertanyaan berikut:

Pertanyaan: ${query.originalQuery}

Sumber informasi:
${context.map(c => `
Sumber: ${c.url}
Judul: ${c.title}
Isi: ${c.content}
`).join('\n')}

Langkah analisis:
1. Identifikasi informasi yang diminta
2. Cari data dari multiple sumber jika diperlukan
3. Lakukan inferensi berdasarkan informasi yang tersedia
4. Berikan jawaban yang komprehensif

Format jawaban dalam markdown dengan struktur yang jelas.
Sertakan reasoning/alasan di balik setiap kesimpulan.
Jika perlu informasi tambahan yang tidak tersedia, sebutkan dengan jelas.
`;
  }

  private createFallbackResponse(query: ProcessedQuery, context: any[]): string {
    return `
# Jawaban untuk: ${query.originalQuery}

Berdasarkan pencarian di Ambisius Wiki, berikut informasi yang ditemukan:

${context.map(c => `
## ${c.title}
${c.content.slice(0, 500)}...

**Sumber:** ${c.url}
`).join('\n')}

${context.length === 0 ? 
  '**Maaf, informasi yang diminta tidak ditemukan di Ambisius Wiki.**' : 
  ''}
`;
  }

  private createNotFoundResponse(query: string): AgentResponse {
    return {
      query,
      found: false,
      sources: [],
      answer: `# Informasi Tidak Ditemukan

Maaf, saya tidak dapat menemukan informasi tentang "${query}" di Ambisius Wiki.

Kemungkinan penyebab:
- Topik tersebut belum tersedia di wiki
- Istilah pencarian perlu disesuaikan
- Informasi mungkin tersedia dengan nama yang berbeda

Silakan coba dengan kata kunci yang berbeda atau periksa ejaan.`,
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

Silakan coba lagi atau hubungi administrator jika masalah berlanjut.`,
      format: 'markdown',
      timestamp: new Date().toISOString()
    };
  }
}