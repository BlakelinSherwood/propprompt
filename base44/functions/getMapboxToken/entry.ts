import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const token = Deno.env.get('MAPBOX_ACCESS_TOKEN');
    
    if (!token) {
      console.error('MAPBOX_ACCESS_TOKEN not configured');
      return Response.json(
        { error: 'Mapbox token not configured' },
        { status: 500 }
      );
    }

    return Response.json({ token });
  } catch (error) {
    console.error('Failed to get Mapbox token:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});