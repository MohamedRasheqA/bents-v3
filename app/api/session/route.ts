import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Types
interface Conversation {
  id: string;
  question: string;
  text: string;
  timestamp: string;
  videoLinks?: any;
  related_products?: any[];
}

interface Session {
  id: string;
  conversations: Conversation[];
}

// GET handler to retrieve all sessions
export async function GET() {
  try {
    // Get all sessions from KV store
    const sessions = await kv.get<Session[]>('sessions');
    
    if (!sessions) {
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(sessions, { status: 200 });
  } catch (error) {
    console.error('Error retrieving sessions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve sessions' },
      { status: 500 }
    );
  }
}

// POST handler to save sessions
export async function POST(request: Request) {
  try {
    const { sessionData } = await request.json();

    if (!Array.isArray(sessionData)) {
      return NextResponse.json(
        { error: 'Invalid session data format' },
        { status: 400 }
      );
    }

    // Save sessions to KV store
    await kv.set('sessions', sessionData);

    return NextResponse.json(
      { message: 'Sessions saved successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error saving sessions:', error);
    return NextResponse.json(
      { error: 'Failed to save sessions' },
      { status: 500 }
    );
  }
}