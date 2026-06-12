export default {
  async fetch(request, env, ctx) {
    // Enable CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    try {
      const { license_key } = await request.json();
      if (!license_key) {
        return new Response(JSON.stringify({ error: 'License key is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Forward request to Lemon Squeezy
      const lsResponse = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: license_key
        }),
      });

      const data = await lsResponse.json();

      // Return validation status sanitized for the client
      return new Response(JSON.stringify({
        valid: data.valid,
        error: data.error || null,
        license_key: data.license_key,
        status: data.license_key?.status || 'inactive',
        product_name: data.meta?.product_name || 'Instant Raman Pro'
      }), {
        status: lsResponse.status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal validation error: ' + err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }
};
