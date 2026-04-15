import { createClient } from '@base44/sdk';

//Create a client with authentication required
export const base44 = createClient({
  appId: '69b849e8d5f86924955e7fae',
  requiresAuth: false,
});