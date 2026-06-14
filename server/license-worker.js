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

    const url = new URL(request.url);

    // ── ENDPOINT 1: Razorpay Webhook ──
    if (url.pathname === '/razorpay-webhook' && request.method === 'POST') {
      try {
        const bodyText = await request.text();
        const signature = request.headers.get('X-Razorpay-Signature');
        
        // 1. Verify Razorpay Webhook Signature using Web Crypto API
        const isValid = await verifyRazorpaySignature(bodyText, signature, env.RAZORPAY_WEBHOOK_SECRET);
        if (!isValid) {
          return new Response(JSON.stringify({ error: 'Invalid Webhook Signature' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const payload = JSON.parse(bodyText);
        
        // Handle captured payments
        if (payload.event === 'payment.captured') {
          const payment = payload.payload.payment.entity;
          const email = payment.email;

          // 2. Generate unique key: IR-PRO-XXXXXX
          const uniqueKey = 'IR-PRO-' + generateRandomKey();

          // Determine device seat limit (1 for Individual, 5 for Lab & Team)
          let maxDevices = 1;
          const planFromNotes = payment.notes?.plan || payment.notes?.tier || '';
          if (
            planFromNotes.toLowerCase().includes('team') || 
            planFromNotes.toLowerCase().includes('lab') || 
            payment.amount > 15000
          ) {
            maxDevices = 5;
          }

          // 3. Save license to Cloudflare KV Namespace
          const licenseData = {
            email: email,
            active_users: [], // Array of client IDs
            max_devices: maxDevices,
            created_at: new Date().toISOString()
          };
          await env.LICENSE_KV.put(uniqueKey, JSON.stringify(licenseData));

          // 4. Send email to user using Resend API
          const emailSent = await sendLicenseEmail(email, uniqueKey, maxDevices, env.RESEND_API_KEY);
          if (!emailSent) {
            console.error(`Failed to send email to ${email}`);
          }
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Webhook processing error: ' + err.message }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // ── ENDPOINT 2: License Validation ──
    if (url.pathname === '/validate' && request.method === 'POST') {
      try {
        const { license_key, client_id } = await request.json();
        if (!license_key || !client_id) {
          return new Response(JSON.stringify({ error: 'License key and client_id are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const keyNormalized = license_key.trim().toUpperCase();

        // Fetch license metadata from KV
        const rawData = await env.LICENSE_KV.get(keyNormalized);
        if (!rawData) {
          return new Response(JSON.stringify({ valid: false, error: 'License key not found.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        const license = JSON.parse(rawData);

        // Check if this client is already activated
        if (license.active_users.includes(client_id)) {
          return new Response(JSON.stringify({ valid: true, email: license.email }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Verify user cap
        const maxDevices = license.max_devices || 3; // default to 3 for legacy keys
        if (license.active_users.length >= maxDevices) {
          const limitText = maxDevices === 1 ? '1 active device' : `${maxDevices} active devices`;
          return new Response(JSON.stringify({ 
            valid: false, 
            error: `Activation limit exceeded. This license key is already in use on ${limitText}.` 
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Add new client to active users
        license.active_users.push(client_id);
        await env.LICENSE_KV.put(keyNormalized, JSON.stringify(license));

        return new Response(JSON.stringify({ valid: true, email: license.email }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), { 
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

// ── Helpers ──
function generateRandomKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const array = new Uint32Array(12);
  crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(array[i] % chars.length);
  }
  return result;
}

async function verifyRazorpaySignature(bodyText, signature, secret) {
  if (!signature || !secret) return false;
  
  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(secret);
  const bodyData = encoder.encode(bodyText);
  
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    bodyData
  );
  
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const generatedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return generatedSignature === signature;
}

async function sendLicenseEmail(email, key, maxDevices, apiKey) {
  // resend.dev default sandbox email is "onboarding@resend.dev"
  // If the user domain is verified, they can use "licensing@instantraman.com"
  const fromEmail = 'onboarding@resend.dev'; 
  
  const deviceCountText = maxDevices === 1 ? '1 active device' : `${maxDevices} active devices`;
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `Instant Raman <${fromEmail}>`,
      to: email,
      subject: 'Your Instant Raman Pro License Key',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 4px;">
          <h2 style="color: #0f172a; margin-top: 0;">Instant Raman Pro Activation</h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">Thank you for purchasing the Instant Raman Pro License. Below is your unique access key:</p>
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 14px; text-align: center; border-radius: 2px; margin: 24px 0;">
            <code style="font-family: monospace; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: 0.05em;">${key}</code>
          </div>
          <p style="color: #475569; font-size: 13px; line-height: 1.5;">This key can be activated on up to <strong>${deviceCountText}</strong>. To activate, launch the workstation and click "Activate Pro License" in the top header.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 11px;">Note: If you have an unverified domain on Resend, make sure to add your target emails to your Resend dashboard recipients first.</p>
        </div>
      `
    })
  });
  return res.ok;
}
