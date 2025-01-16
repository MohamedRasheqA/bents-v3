// app/api/get-session/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import pool from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    console.log('GET Session - User ID from header:', userId);

    if (!userId) {
      console.log('GET Session - No user ID found in header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT session_data::json FROM session_hist WHERE user_id = $1',
        [userId]
      );

      console.log('GET Session - Query executed');

      if (result.rows.length > 0 && result.rows[0].session_data) {
        console.log('GET Session - Data found for user');
        return NextResponse.json(result.rows[0].session_data);
      }

      console.log('GET Session - No data found, returning empty array');
      return NextResponse.json([]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('GET Session - Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session data' }, 
      { status: 500 }
    );
  }
}