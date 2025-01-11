// Required imports
import { neonConfig, Pool } from '@neondatabase/serverless';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { openai } from '@ai-sdk/openai';
import { streamText, embed } from 'ai';
import OpenAI from 'openai';
// import * as Papa from 'papaparse';
// import * as _ from 'lodash';

// Initialize OpenAI client
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Types
interface ChatHistory {
  role: 'user' | 'assistant';
  content: string;
}

interface Document {
  id: string;
  text: string;
  title: string;
  url: string;
  chunk_id: string;
  similarity_score: number;
}

interface VideoReference {
  description: string;
  timestamp: string;
  urls: string[];
  video_title: string;
}

interface Product {
  id: string;
  link: string;
  tags: string[];
  title: string;
}

interface ChatResponse {
  raw_response: string;
  response: string;
  related_products: Product[];
  related_videos: Record<string, VideoReference>;
  video_links: Record<string, VideoReference>;
  urls: string[];
  contexts?: string[];
}

// Custom Error Classes
class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseError';
  }
}

class LLMResponseCutOff extends LLMResponseError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseCutOff';
  }
}

class LLMNoResponseError extends LLMResponseError {
  constructor(message: string) {
    super(message);
    this.name = 'LLMNoResponseError';
  }
}

// Utility functions
function cn(...inputs: ClassValue[]) {
  console.log('🎨 cn utility called with:', inputs);
  return twMerge(clsx(inputs));
}

// System Instructions
const SYSTEM_INSTRUCTIONS = `You are an AI assistant representing Jason Bent's woodworking expertise. Your role is to:
1. Analyze woodworking documents and provide clear, natural responses.
2. Format sections with markdown:
   ### 1. **Section Title**
   - Detailed explanation with examples

Example:
### 1. **Using a Table Saw**
- First explain the concept in detail.
- Continue with more details...`;

// Enhanced DatabaseService
class DatabaseService {
  private client: Pool;
  
  constructor() {
    console.log('🔧 Initializing DatabaseService');
    neonConfig.fetchConnectionCache = true;
    this.client = new Pool({ connectionString: process.env.POSTGRES_URL! });
  }

  async searchNeonDb(queryEmbedding: number[], tableName: string, topK: number = 5): Promise<Document[]> {
    console.log('🔎 searchNeonDb called with:', { tableName, topK });
    console.log('🔎 Searching database with topK:', topK);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const query = `
      SELECT id, text, title, url, chunk_id,
             1 - (vector <=> $1::vector) as similarity_score
      FROM ${tableName}
      WHERE vector IS NOT NULL
      ORDER BY vector <=> $1::vector
      LIMIT $2;
    `;
    
    try {
      const result = await this.client.query(query, [embeddingStr, topK]);
      console.log('📚 Found documents:', result.rows.length);
      return result.rows.map(row => ({
        id: row.id,
        text: row.text,
        title: row.title,
        url: row.url,
        chunk_id: row.chunk_id,
        similarity_score: parseFloat(row.similarity_score)
      }));
    } catch (error) {
      console.error('Error in searchNeonDb:', error);
      throw error;
    }
  }

  async getRelatedProducts(videoTitles: string[]): Promise<Product[]> {
    console.log('🛍️ getRelatedProducts called with:', videoTitles);
    console.log('🛍️ Input video titles:', videoTitles);
    if (!videoTitles.length) return [];

    try {
      const conn = await this.client.connect();
      
      // Query products with partial tag matches using LIKE
      const query = `
        SELECT DISTINCT ON (p.id) 
          p.id, 
          p.title, 
          p.tags, 
          p.link
        FROM products p
        WHERE ${videoTitles.map((_, i) => 
          `LOWER(p.tags) LIKE LOWER($${i + 1})`
        ).join(' OR ')}
        ORDER BY p.id
      `;
      
      // Create search terms with wildcards for partial matching
      const searchTerms = videoTitles.map(title => `%${title.toLowerCase().trim()}%`);
      console.log('🔍 Search query:', query);
      console.log('🔑 Search terms:', searchTerms);
      
      const result = await conn.query(query, searchTerms);
      console.log('🎯 Raw query result:', result.rows);
      
      // Format and log products
      const products = result.rows.map(product => ({
        id: product.id,
        title: product.title,
        link: product.link,
        tags: product.tags?.split(',').map((tag: string) => tag.trim()) || [],
      }));
      console.log('📦 Formatted products:', products);
      
      return products;

    } catch (error) {
      console.error('❌ Error getting related products:', error);
      return [];
    }
  }
}

// Message relevance checking
type RelevanceResult = 'GREETING' | 'RELEVANT' | 'INAPPROPRIATE' | 'NOT_RELEVANT';

async function checkRelevance(query: string, chatHistory: ChatHistory[]) {
  console.log('🔍 checkRelevance called with:', { query, historyLength: chatHistory.length });
  console.log('🔍 Starting relevance check for query:', query);
  const relevancePrompt = `Given this question and chat history, determine if it is:
1. A greeting/send-off (GREETING)
2. Related to woodworking/tools/company (RELEVANT)
3. Inappropriate content (INAPPROPRIATE)
4. Unrelated (NOT RELEVANT)

Chat History: ${JSON.stringify(chatHistory.slice(-5))}
Current Question: ${query}

Response (GREETING, RELEVANT, INAPPROPRIATE, or NOT_RELEVANT):`;

  const result = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: relevancePrompt }],
    temperature: 0
  });
  console.log('✅ Relevance check result:', result.choices[0].message.content);
  return result.choices[0].message.content?.trim().toUpperCase() || 'NOT_RELEVANT';
}

// Query rewriting
async function rewriteQuery(query: string, chatHistory: ChatHistory[] = []) {
  console.log('📝 rewriteQuery called with:', { query, historyLength: chatHistory.length });
  console.log('📝 Rewriting query:', query);
  const rewritePrompt = `You are bent's woodworks assistant so question will be related to wood shop. 
Rewrites user query to make them more specific and searchable, taking into account 
the chat history if provided. Only return the rewritten query without any explanations.

Original query: ${query}
Chat history: ${JSON.stringify(chatHistory)}

Rewritten query:`;

  try {
    const result = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: rewritePrompt }],
      temperature: 0
    });
    const cleanedResponse = result.choices[0].message.content?.replace("Rewritten query:", "").trim();
    console.log('✏️ Rewritten query:', cleanedResponse || query);
    return cleanedResponse || query;
  } catch (error) {
    console.error('❌ Query rewrite failed:', error);
    return query;
  }
}




function combineUrlAndTimestamp(url: string, timestamp: string): string {
  console.log('🔗 combineUrlAndTimestamp called with:', { url, timestamp });
  try {
    const parts = timestamp.split(':');
    const totalSeconds = parts.length === 2 
      ? parseInt(parts[0]) * 60 + parseInt(parts[1])
      : parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);

    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${totalSeconds}`;
  } catch {
    return url;
  }
}

async function processVideoReferences(content: string): Promise<{
  processedAnswer: string;
  videoDict: Record<string, VideoReference>;
}> {
  console.log('🎥 processVideoReferences called with content length:', content.length);
  console.log('🎥 Starting video reference processing');
  const videoPattern = /\{\{timestamp:(\d{2}:\d{2})\}\}\{\{title:([^}]+)\}\}\{\{url:([^}]+)\}\}/g;
  let processedAnswer = content;
  
  const matches = Array.from(content.matchAll(videoPattern));
  console.log('📼 Found video matches:', matches.length);
  
  const videoDict = Object.fromEntries(
    matches.map((match, i) => {
      const [_, timestamp, title, url] = match;
      console.log(`🎬 Processing video ${i + 1}:`, { timestamp, title, url });
      const separator = url.includes('?') ? '&' : '?';
      const seconds = timestamp.split(':').reduce((acc, time) => (60 * acc) + +time, 0);
      
      return [
        i.toString(),
        {
          urls: [`${url}${separator}t=${seconds}`],
          timestamp: timestamp,
          video_title: title,
          description: ''
        }
      ];
    })
  );
  
  console.log('🎥 Final video dictionary:', videoDict);
  return {
    processedAnswer,
    videoDict
  };
}

// Main API handler
export const maxDuration = 30;
export const runtime = 'edge';

const VIDEO_EXTRACTION_PROMPT = `Based on the provided context and question, identify relevant video references.
For each relevant point, you must provide all three pieces in this exact format:
{{timestamp:MM:SS}}{{title:EXACT Video Title}}{{url:EXACT YouTube URL}}

Rules:
1. Only include videos that are directly relevant to the question
2. Each video reference must be on its own line
3. Must include all three pieces (timestamp, title, URL) for each reference
4. Only extract videos mentioned in the provided context
5. Format must be exact - no spaces between the three parts
6. Each reference should look like: {{timestamp:05:30}}{{title:Workshop Tour}}{{url:https://youtube.com/...}}

Context:
`;

// Add at the top with other interfaces
declare module 'ai' {
  interface StreamData {
    data?: {
      videoReferences?: Record<string, VideoReference>;
      relatedProducts?: Product[];
      contexts?: string[];
    }
  }
}

export async function POST(req: Request) {
  console.log('📨 POST handler started');
  try {
    console.log('🚀 Starting new chat request');
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const chatHistory = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content
    }));
    const lastUserMessage = messages.findLast(
      (msg: { role: string; content: string }) => msg.role === 'user'
    )?.content || '';

    console.log('📨 Processing message:', lastUserMessage);
    const relevanceResult = await checkRelevance(lastUserMessage, messages);
    console.log('🎯 Message relevance:', relevanceResult);

    if (relevanceResult === 'GREETING' || relevanceResult === 'INAPPROPRIATE' || relevanceResult === 'NOT_RELEVANT') {
      if (relevanceResult === 'GREETING') {
        const result = await streamText({
          model: openai('gpt-4o-mini'),
          messages: [
            { 
              role: 'user', 
              content: `The following message is a greeting or casual message. Please provide a friendly and engaging response: ${lastUserMessage}` 
            }
          ],
        });
        return result.toDataStreamResponse();
      }

      if (relevanceResult === 'INAPPROPRIATE') {
        const result = await streamText({
          model: openai('gpt-4o-mini'),
          messages: [
            {
              role: 'user',
              content: 'Please provide a polite response indicating that inappropriate content or language is not allowed.'
            }
          ],
        });
        return result.toDataStreamResponse();
      }

      if (relevanceResult === 'NOT_RELEVANT') {
        const result = await streamText({
          model: openai('gpt-4o-mini'),
          messages: [
            {
              role: 'user',
              content: `The following message is not related to woodworking or our services. Please politely redirect the conversation: ${lastUserMessage}`
            }
          ],
        });
        return result.toDataStreamResponse();
      }
    }

    // Query rewriting and embedding
    
    console.log('✍️ Rewriting query');
    const rewrittenQuery = await rewriteQuery(lastUserMessage, messages);
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-ada-002'),
      value: rewrittenQuery,
      maxRetries: 2,
      abortSignal: AbortSignal.timeout(5000)
    });
    console.log('🔄 Getting embeddings');
    // Database search and context preparation remain the same
    const dbService = new DatabaseService();
    console.log('🔍 Searching database');
    const similarDocs = await dbService.searchNeonDb(embedding, "bents", 5);
    const contextTexts = similarDocs.map(doc => 
      `Source: ${doc.title}\nContent: ${doc.text}`
    ).join('\n\n');

    // Start video processing LLM call
    console.log('\n=== Starting Video Processing ===');
    const videoResponse = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: VIDEO_EXTRACTION_PROMPT
        },
        {
          role: 'user',
          content: `Context:\n${contextTexts}\n\nChat History:\n${JSON.stringify(chatHistory.slice(-5))}\n\nQuestion: ${rewrittenQuery}\n\nExtract relevant video references:`
        }
      ],
      temperature: 0.1,
      stream: false
    });

    // Process the video references
    const { videoDict } = await processVideoReferences(videoResponse.choices[0].message.content || '');
    
    // Get related products based on video titles
    const videoTitles = Object.values(videoDict).map(v => v.video_title);
    console.log('🏷️ Getting related products');
    const relatedProducts = await dbService.getRelatedProducts(videoTitles);

    // Return the response with all the data
    const response = {
      videoReferences: videoDict,
      relatedProducts: relatedProducts
    };

    console.log('✅ Request completed successfully');
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('❌ Error in POST handler:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An error occurred', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}