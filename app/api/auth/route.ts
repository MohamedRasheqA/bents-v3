import { WebhookEvent } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // Get the body
  const payload: WebhookEvent = await req.json();
  
  // Handle different events
  switch (payload.type) {
    case 'user.created':
      console.log('New user signed up:', payload.data);
      // Add your logging logic here
      break;
    case 'user.updated':
      console.log('User updated:', payload.data);
      // Add your logging logic here
      break;
    // Add more cases as needed
  }

  return NextResponse.json({ message: "Webhook received" }, { status: 200 });
} 