import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin, getAdminAuth, getAdminFirestore } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

// Ensure Firebase Admin is initialized
initializeFirebaseAdmin();

export async function GET(req: NextRequest) {
  try {
    // 1. Verify Authorization Token
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await getAdminAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error('[API /admin/users] Error verifying auth token:', error);
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 403 });
    }
    const requesterUid = decodedToken.uid;

    // 2. Verify Requester is an Admin
    const db = getAdminFirestore();
    const requesterRef = db.collection('users').doc(requesterUid);
    const requesterSnap = await requesterRef.get();

    if (!requesterSnap.exists || !requesterSnap.data()?.isAdmin) {
      console.warn(`[API /admin/users] Unauthorized access attempt by user: ${requesterUid}`);
      return NextResponse.json({ error: 'Forbidden: Administrator access required' }, { status: 403 });
    }

    // 3. Fetch All User Documents
    console.log(`[API /admin/users] Admin user ${requesterUid} fetching all users.`);
    const usersCollection = db.collection('users');
    const usersSnapshot = await usersCollection.get();

    // 4. Format User Data
    const usersList = usersSnapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Timestamp to ISO string or ms for client
      const lastLogin = data.lastLogin instanceof Timestamp 
                        ? data.lastLogin.toDate().toISOString() 
                        : null;
      const createdAt = data.createdAt instanceof Timestamp 
                        ? data.createdAt.toDate().toISOString() 
                        : null;
                        
      return {
        uid: doc.id,
        email: data.email || null,
        displayName: data.displayName || 'N/A',
        phoneNumber: data.phoneNumber || null,
        photoURL: data.photoURL || null,
        isAdmin: data.isAdmin || false,
        balance: typeof data.balance === 'number' ? data.balance : 0, // Default balance to 0 if missing/invalid
        lastLogin: lastLogin,
        createdAt: createdAt,
      };
    });

    console.log(`[API /admin/users] Successfully fetched ${usersList.length} users.`);
    
    // 5. Return User List
    return NextResponse.json(usersList);

  } catch (error: unknown) {
    console.error('Error in admin/users API:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 