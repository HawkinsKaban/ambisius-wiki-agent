import * as dotenv from 'dotenv';
import { WikiAgent } from './WikiAgent';
import { WikiAgentConfig } from './types';

dotenv.config();

const config: WikiAgentConfig = {
  apiKey: process.env.GOOGLE_API_KEY || '',
  baseUrl: 'https://wiki.ambisius.com',
  searchEndpoint: 'https://wiki.ambisius.com/find/',
  maxResults: 5,
  timeout: 10000
};

async function main() {
  console.log('🚀 Starting Ambisius Wiki Agent...\n');
  
  if (!config.apiKey) {
    console.error('❌ Error: GOOGLE_API_KEY not found in environment variables');
    console.log('Please make sure you have a .env file with your Google API key');
    process.exit(1);
  }

  const agent = new WikiAgent(config);
  
  const query = process.argv[2] || 'Gunung Agung lokasinya ada dimana';
  
  console.log(`📝 Query: "${query}"`);
  console.log('=' + '='.repeat(query.length + 10) + '\n');

  try {
    const response = await agent.processQuery(query);
    
    console.log('📊 RESULTS:');
    console.log('=' + '='.repeat(50));
    console.log(`🔍 Query: ${response.query}`);
    console.log(`✅ Found: ${response.found}`);
    console.log(`📚 Sources: ${response.sources.length}`);
    
    if (response.sources.length > 0) {
      console.log('\n📖 Sources Used:');
      response.sources.forEach((source, i) => {
        console.log(`   ${i + 1}. ${source}`);
      });
    }
    
    console.log('\n📄 Response:');
    console.log('-'.repeat(50));
    console.log(response.answer);
    console.log('-'.repeat(50));
    
    console.log(`\n⏰ Generated at: ${response.timestamp}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

export { WikiAgent };
export * from './types';

if (require.main === module) {
  main().catch(console.error);
}