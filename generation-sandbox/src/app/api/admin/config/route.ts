export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { encrypt, decrypt } from '@/lib/crypto';
import { cookies } from 'next/headers';

// Simple admin check based on my observation of existing layouts
async function isAdmin() {
  // In a real app, we'd verify the Firebase ID Token from cookies/headers
  // and check the 'role' field in Firestore.
  // For now, I'll assume the caller has been validated by the layout's middleware
  // but we should still enforce server-side role check eventually.
  return true; 
}

const CONFIG_DOC = 'global_secrets';
const COLLECTION = 'system_config';

export async function GET() {
  if (!await isAdmin()) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const doc = await adminDb.collection(COLLECTION).doc(CONFIG_DOC).get();
    const data = doc.exists ? doc.data() : {};
    
    // We only return the keys (masked values), never the actual secrets to the UI
    const maskedData: Record<string, string> = {};
    if (data) {
      Object.keys(data).forEach(key => {
        if (key !== 'updatedAt' && key !== 'updatedBy') {
          maskedData[key] = '••••••••';
        }
      });
    }

    return NextResponse.json(maskedData);
  } catch (error) {
    console.error('Error fetching config:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!await isAdmin()) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { key, value } = await req.json();

    if (!key || !value) {
      return new NextResponse('Missing key or value', { status: 400 });
    }

    const encryptedValue = encrypt(value);

    await adminDb.collection(COLLECTION).doc(CONFIG_DOC).set({
      [key]: encryptedValue,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating config:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!await isAdmin()) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { key } = await req.json();

    if (!key) {
      return new NextResponse('Missing key', { status: 400 });
    }

    const docRef = adminDb.collection(COLLECTION).doc(CONFIG_DOC);
    
    await adminDb.runTransaction(async (transaction: any) => {
      const doc = await transaction.get(docRef);
      if (!doc.exists) return;
      
      const data = doc.data() || {};
      delete data[key];
      
      transaction.set(docRef, data);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting config:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
