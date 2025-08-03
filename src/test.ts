import * as dotenv from 'dotenv';
import { WikiAgent } from './WikiAgent';
import { WikiAgentConfig, AgentResponse } from './types';

dotenv.config();

interface TestCase {
  id: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  query: string;
  description: string;
  expectedBehavior: string[];
  expectedSources?: string[];
}

const TEST_CASES: TestCase[] = [
  {
    id: 'TC001',
    difficulty: 'Easy',
    query: 'Gunung Agung lokasinya ada dimana',
    description: 'Basic location query for Gunung Agung',
    expectedBehavior: [
      'Should find answer at https://wiki.ambisius.com/gunung/gunung-agung',
      'Should provide useful location information about Gunung Agung'
    ],
    expectedSources: ['https://wiki.ambisius.com/gunung/gunung-agung']
  },
  {
    id: 'TC002', 
    difficulty: 'Easy',
    query: 'Gunung Sahari lokasi nya dimana?',
    description: 'Query for non-existent mountain',
    expectedBehavior: [
      'Should not find the answer because Gunung Sahari does not exist',
      'Should inform user that information cannot be found'
    ]
  },
  {
    id: 'TC003',
    difficulty: 'Medium', 
    query: 'Perbedaan gunung agung dan gunung tambora apa?',
    description: 'Comparison between two mountains',
    expectedBehavior: [
      'Should find complete information about both Agung and Tambora',
      'Should provide comparison information in markdown table or other format'
    ],
    expectedSources: [
      'https://wiki.ambisius.com/gunung/gunung-agung',
      'https://wiki.ambisius.com/gunung/gunung-tambora'
    ]
  },
  {
    id: 'TC004',
    difficulty: 'Medium',
    query: 'Buatkan laporan tentang sejarah gunung agung, tambora dan sahari', 
    description: 'Report about history of three mountains (one non-existent)',
    expectedBehavior: [
      'Should find complete information about Agung and Tambora but not Sahari',
      'Should provide "History" report for Agung and Tambora',
      'For Sahari, should inform that information is not found'
    ]
  },
  {
    id: 'TC005',
    difficulty: 'Hard',
    query: 'Buatkan laporan tentang sejarah provinsi dimana Gunung Agung berlokasi',
    description: 'Complex multi-step analysis requiring inference',
    expectedBehavior: [
      'Should first find province where Gunung Agung is located (Bali)',
      'Should then find information about Bali from https://wiki.ambisius.com/provinsi/bali',
      'Should provide accurate answer with easy-to-understand structure'
    ],
    expectedSources: [
      'https://wiki.ambisius.com/gunung/gunung-agung',
      'https://wiki.ambisius.com/provinsi/bali'
    ]
  }
];

interface TestResult {
  testCase: TestCase;
  response: AgentResponse;
  success: boolean;
  executionTime: number;
  notes: string[];
}

class WikiAgentTester {
  private agent: WikiAgent;
  private results: TestResult[] = [];

  constructor(config: WikiAgentConfig) {
    this.agent = new WikiAgent(config);
  }

  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Wiki Agent Test Suite');
    console.log('=' + '='.repeat(50));
    console.log(`📋 Total Test Cases: ${TEST_CASES.length}\n`);

    for (let i = 0; i < TEST_CASES.length; i++) {
      const testCase = TEST_CASES[i];
      console.log(`\n🔬 Running Test Case ${i + 1}/${TEST_CASES.length}`);
      console.log(`📌 ${testCase.id} - ${testCase.difficulty}: ${testCase.query}`);
      console.log('-'.repeat(80));

      const result = await this.runSingleTest(testCase);
      this.results.push(result);

      this.printTestResult(result);
      
      if (i < TEST_CASES.length - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await this.sleep(2000);
      }
    }

    return this.results;
  }

  private async runSingleTest(testCase: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    let response: AgentResponse;
    let success = false;
    const notes: string[] = [];

    try {
      response = await this.agent.processQuery(testCase.query);
      const executionTime = Date.now() - startTime;

      success = this.evaluateTestResult(testCase, response, notes);

      return {
        testCase,
        response,
        success,
        executionTime,
        notes
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      notes.push(`❌ Test failed with error: ${error}`);

      return {
        testCase,
        response: {
          query: testCase.query,
          found: false,
          sources: [],
          answer: `Error: ${error}`,
          format: 'markdown',
          timestamp: new Date().toISOString()
        },
        success: false,
        executionTime,
        notes
      };
    }
  }

  private evaluateTestResult(testCase: TestCase, response: AgentResponse, notes: string[]): boolean {
    let success = true;

    if (!response.query || !response.answer) {
      notes.push('❌ Invalid response structure');
      success = false;
    }

    switch (testCase.id) {
      case 'TC001':
        success = this.evaluateTC001(testCase, response, notes) && success;
        break;
      case 'TC002':
        success = this.evaluateTC002(testCase, response, notes) && success;
        break;
      case 'TC003':
        success = this.evaluateTC003(testCase, response, notes) && success;
        break;
      case 'TC004':
        success = this.evaluateTC004(testCase, response, notes) && success;
        break;
      case 'TC005':
        success = this.evaluateTC005(testCase, response, notes) && success;
        break;
    }

    return success;
  }

  private evaluateTC001(testCase: TestCase, response: AgentResponse, notes: string[]): boolean {
    let success = true;

    if (!response.found) {
      notes.push('❌ Should have found information about Gunung Agung');
      success = false;
    } else {
      notes.push('✅ Successfully found information');
    }

    if (!response.answer.toLowerCase().includes('agung')) {
      notes.push('❌ Answer should mention Gunung Agung');
      success = false;
    } else {
      notes.push('✅ Answer mentions Gunung Agung');
    }

    if (response.sources.some(url => url.includes('gunung-agung'))) {
      notes.push('✅ Correct source found (gunung-agung)');
    } else {
      notes.push('⚠️ Expected source not found, but may still be valid');
    }

    return success;
  }

  private evaluateTC002(testCase: TestCase, response: AgentResponse, notes: string[]): boolean {
    let success = true;

    if (response.found) {
      notes.push('❌ Should NOT have found information about non-existent Gunung Sahari');
      success = false;
    } else {
      notes.push('✅ Correctly identified that Gunung Sahari does not exist');
    }

    if (response.answer.toLowerCase().includes('tidak ditemukan') || 
        response.answer.toLowerCase().includes('tidak tersedia') ||
        response.answer.toLowerCase().includes('tidak ada')) {
      notes.push('✅ Appropriately informed user that information was not found');
    } else {
      notes.push('⚠️ Could be clearer about information not being available');
    }

    return success;
  }

  private evaluateTC003(testCase: TestCase, response: AgentResponse, notes: string[]): boolean {
    let success = true;

    if (!response.found) {
      notes.push('❌ Should have found comparison information');
      success = false;
    } else {
      notes.push('✅ Found comparison information');
    }

    const answerLower = response.answer.toLowerCase();
    if (answerLower.includes('agung') && answerLower.includes('tambora')) {
      notes.push('✅ Answer includes both mountains');
    } else {
      notes.push('❌ Answer should include both Gunung Agung and Gunung Tambora');
      success = false;
    }

    if (response.answer.includes('|') || response.answer.includes('perbedaan')) {
      notes.push('✅ Answer appears to be in comparison format');
    } else {
      notes.push('⚠️ Could be formatted better for comparison');
    }

    return success;
  }

  private evaluateTC004(testCase: TestCase, response: AgentResponse, notes: string[]): boolean {
    let success = true;

    const answerLower = response.answer.toLowerCase();
    
    if (answerLower.includes('agung') && answerLower.includes('tambora')) {
      notes.push('✅ Report includes Gunung Agung and Tambora');
    } else {
      notes.push('❌ Report should include both existing mountains');
      success = false;
    }

    if (answerLower.includes('sahari') && 
        (answerLower.includes('tidak ditemukan') || answerLower.includes('tidak tersedia'))) {
      notes.push('✅ Correctly handles non-existent Gunung Sahari');
    } else {
      notes.push('⚠️ Should mention that Gunung Sahari information is not available');
    }

    if (response.answer.includes('# ') || response.answer.includes('## ')) {
      notes.push('✅ Answer is formatted as a proper report');
    } else {
      notes.push('⚠️ Could be better formatted as a report');
    }

    return success;
  }

  private evaluateTC005(testCase: TestCase, response: AgentResponse, notes: string[]): boolean {
    let success = true;

    if (!response.found) {
      notes.push('❌ Should have found information about Bali province');
      success = false;
    }

    const answerLower = response.answer.toLowerCase();
    if (answerLower.includes('bali')) {
      notes.push('✅ Correctly identified Bali as the province');
    } else {
      notes.push('❌ Should identify Bali as the province where Gunung Agung is located');
      success = false;
    }

    if (response.sources.some(url => url.includes('provinsi') || url.includes('bali'))) {
      notes.push('✅ Found provincial information source');
    } else {
      notes.push('⚠️ Expected to find Bali provincial information');
    }

    return success;
  }

  private printTestResult(result: TestResult): void {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    const time = result.executionTime;

    console.log(`\n📊 Result: ${status} (${time}ms)`);
    console.log(`🔍 Found: ${result.response.found}`);
    console.log(`📚 Sources: ${result.response.sources.length}`);
    
    if (result.response.sources.length > 0) {
      console.log('📖 Sources:');
      result.response.sources.forEach(source => {
        console.log(`   • ${source}`);
      });
    }

    console.log('\n📝 Notes:');
    result.notes.forEach(note => {
      console.log(`   ${note}`);
    });

    console.log('\n📄 Response Preview:');
    const preview = result.response.answer.slice(0, 200) + (result.response.answer.length > 200 ? '...' : '');
    console.log(`   ${preview}`);
  }

  printSummary(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log('\n' + '='.repeat(80));
    console.log('📈 TEST SUMMARY');
    console.log('='.repeat(80));
    console.log(`📊 Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    const avgTime = this.results.reduce((sum, r) => sum + r.executionTime, 0) / totalTests;
    console.log(`⏱️ Average Response Time: ${avgTime.toFixed(0)}ms`);

    console.log('\n📋 Detailed Results:');
    this.results.forEach((result, i) => {
      const status = result.success ? '✅' : '❌';
      console.log(`   ${i + 1}. ${status} ${result.testCase.id} - ${result.testCase.difficulty} (${result.executionTime}ms)`);
    });

    if (failedTests > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(result => {
          console.log(`\n   🔴 ${result.testCase.id}: ${result.testCase.query}`);
          result.notes.forEach(note => {
            if (note.includes('❌')) {
              console.log(`      ${note}`);
            }
          });
        });
    }

    console.log('\n🎯 Next Steps:');
    if (passedTests === totalTests) {
      console.log('   🎉 All tests passed! Your Wiki Agent is working perfectly.');
      console.log('   📸 Take screenshots of these results for submission.');
    } else {
      console.log('   🔧 Review failed tests and improve the agent implementation.');
      console.log('   🔍 Check source URLs and search functionality.');
      console.log('   🤖 Tune AI prompts for better responses.');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

async function runTests() {
  const config: WikiAgentConfig = {
    apiKey: process.env.GOOGLE_API_KEY || '',
    baseUrl: 'https://wiki.ambisius.com',
    searchEndpoint: 'https://wiki.ambisius.com/find/',
    maxResults: 5,
    timeout: 15000
  };

  if (!config.apiKey) {
    console.error('❌ Error: GOOGLE_API_KEY not found in environment variables');
    console.log('Please make sure you have a .env file with your Google API key');
    process.exit(1);
  }

  const tester = new WikiAgentTester(config);
  
  try {
    await tester.runAllTests();
    tester.printSummary();
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

export { WikiAgentTester, TEST_CASES };

if (require.main === module) {
  runTests().catch(console.error);
}