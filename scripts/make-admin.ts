import '../server/services/config-env.js';
import { tokenmarketDb } from '../server/services/FirebaseAdmin.js';

async function makeAdmin() {
  const email = 'heidlessemail01@gmail.com';
  console.log(`Setting ${email} to admin role...`);
  
  try {
    const usersRef = tokenmarketDb.collection('users');
    const qSnap = await usersRef.where('email', '==', email).get();
    
    if (qSnap.empty) {
      console.log(`❌ No user found with email ${email}`);
      return;
    }
    
    const userDoc = qSnap.docs[0];
    await userDoc.ref.update({ role: 'admin' });
    console.log(`✅ Successfully updated ${email} (UID: ${userDoc.id}) to "role: 'admin'".`);
  } catch (err: any) {
    console.error('❌ Error setting user to admin:', err.message);
  }
}

makeAdmin().catch(console.error);
