// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';

// Flask backend URL - you should move this to .env
const FLASK_BACKEND_URL = 'https://bents-llm-server.vercel.app';

export async function POST(request: Request) {
  try {
    // Parse the incoming request body
    const body = await request.json();

    // Forward the request to Flask backend
    const response = await axios.post(`${FLASK_BACKEND_URL}/chat`, body, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Return the Flask response
    return NextResponse.json(response.data);

  } catch (error) {
    console.error('Error forwarding chat request to Flask:', error);
    return NextResponse.json(
      { message: 'An error occurred while processing your chat request.' },
      { status: 500 }
    );
  }
}

// Add OPTIONS handler for CORS
export async function OPTIONS(request: Request) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}