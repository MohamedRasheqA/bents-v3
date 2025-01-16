// app/api/set-session/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import pool from '@/lib/db';

interface Conversation {
  question: string;
  text: string;
  videoLinks?: Record<string, any>;
  related_products?: any[];
  timestamp: string;
}

interface Session {
  id: string;
  conversations: Conversation[];
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    console.log('SET Session - User ID from header:', userId);

    if (!userId) {
      console.log('SET Session - No user ID found in header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sessions } = body;

    console.log('SET Session - Received sessions:', sessions);

    if (!Array.isArray(sessions)) {
      console.log('SET Session - Invalid sessions data format');
      return NextResponse.json(
        { error: 'Invalid sessions data format' }, 
        { status: 400 }
      );
    }

    // Clean and prepare session data, ensure it's a valid array
    const cleanedSessionData = sessions.map((session: Session) => ({
      id: session.id,
      conversations: session.conversations.map((conv: Conversation) => ({
        question: conv.question,
        text: conv.text,
        videoLinks: conv.videoLinks || {},
        related_products: conv.related_products || [],
        timestamp: conv.timestamp || new Date().toISOString()
      }))
    }));

    // If the cleaned data is empty, initialize with an empty array
    const dataToStore = cleanedSessionData.length > 0 ? cleanedSessionData : [];

    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO session_hist (user_id, session_data) 
         VALUES ($1, $2::jsonb) 
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           session_data = $2::jsonb,
           updated_at = CURRENT_TIMESTAMP 
         RETURNING *`,
        [userId, JSON.stringify(dataToStore)]
      );

      console.log('SET Session - Updated row:', result.rows[0]);

      return NextResponse.json({ 
        success: true,
        sessionCount: dataToStore.length
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('SET Session - Error:', error);
    return NextResponse.json(
      { error: 'Failed to save session data' }, 
      { status: 500 }
    );
  }
}