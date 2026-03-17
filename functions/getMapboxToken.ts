import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const token = Deno.env.get("MAPBOX_ACCESS_TOKEN");
    
    if (!token) {
      return Response.json(
        { error: "Mapbox token not configured" },
        { status: 500 }
      );
    }

    return Response.json({ token });
  } catch (error) {
    console.error("Error fetching mapbox token:", error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});