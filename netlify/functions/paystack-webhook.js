const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Initialize Supabase using the Netlify Extension variables
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

exports.handler = async (event) => {
  // Webhooks must always be POST requests from Paystack
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. SECURITY CHECK: Verify the request actually came from Paystack, not a hacker
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(event.body)
      .digest('hex');

    // If the signatures don't match, block the request immediately
    if (hash !== event.headers['x-paystack-signature']) {
      return { statusCode: 401, body: 'Invalid Signature' };
    }

    const paystackData = JSON.parse(event.body);

    // 2. Listen only for successful payment events
    if (paystackData.event === 'charge.success') {
      const reference = paystackData.data.reference;

      // 3. Update the transaction status to 'success' in your Supabase 'payments' table
      const { error } = await supabase
        .from('payments')
        .update({ status: 'success' })
        .eq('reference', reference);

      if (error) throw new Error('Supabase update failed: ' + error.message);
    }

    // 4. Always tell Paystack "Message received!" with a 200 status code
    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'success' }),
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
