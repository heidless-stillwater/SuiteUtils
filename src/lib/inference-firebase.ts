import { getFirestore } from 'firebase/firestore';
import app from './firebase';

// Initialize a secondary Firestore instance pointing specifically to the InferenceGateway database
export const inferenceDb = getFirestore(app, 'inferencegateway-db-0');
