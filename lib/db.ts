// lib/db.ts
import { neonConfig, Pool } from '@neondatabase/serverless';
import { Document, Product } from '@/app/types';

export class DatabaseService {
  private client: Pool;

  constructor() {
    neonConfig.fetchConnectionCache = true;
    this.client = new Pool({ connectionString: process.env.POSTGRES_URL! });
  }

  async searchNeonDb(queryEmbedding: number[], tableName: string, topK: number = 3): Promise<Document[]> {
    try {
      const embeddingStr = `[${queryEmbedding.join(',')}]`;
      const query = `
        SELECT id, text, title, url, chunk_id,
               1 - (vector <=> $1::vector) as similarity_score
        FROM ${tableName}
        WHERE vector IS NOT NULL
        ORDER BY vector <=> $1::vector
        LIMIT $2;
      `;
      
      const result = await this.client.query(query, [embeddingStr, topK]);
      return result.rows.map(row => ({
        id: row.id,
        text: row.text,
        title: row.title,
        url: row.url,
        chunk_id: row.chunk_id,
        similarity_score: parseFloat(row.similarity_score) || 0
      }));
    } catch (error) {
      console.error('Database search error:', error);
      throw error;
    }
  }

  async getRelatedProducts(videoTitles: string[]): Promise<Product[]> {
    if (!videoTitles.length) return [];

    try {
      const placeholders = videoTitles.map((_, i) => `$${i + 1}`).join(',');
      const query = `
        SELECT DISTINCT ON (id) id, title, tags, link 
        FROM products 
        WHERE ${videoTitles.map((_, i) => `LOWER(tags) LIKE LOWER($${i + 1})`).join(' OR ')}
      `;
      
      const searchTerms = videoTitles.map(title => `%${title}%`);
      const result = await this.client.query(query, searchTerms);
      
      return result.rows.map(product => ({
        id: product.id,
        title: product.title,
        tags: product.tags?.split(',') || [],
        link: product.link
      }));
    } catch (error) {
      console.error('Error getting related products:', error);
      return [];
    }
  }
}