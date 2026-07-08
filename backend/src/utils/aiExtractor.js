import { GoogleGenerativeAI } from '@google/generative-ai';

// Schema definition for Gemini Structured Outputs
const crmResponseSchema = {
  type: "object",
  properties: {
    leads: {
      type: "array",
      description: "List of mapped and extracted CRM leads. Leads without both email and phone must be skipped.",
      items: {
        type: "object",
        properties: {
          created_at: {
            type: "string",
            description: "Lead creation date. Must be in a format convertible using JS 'new Date()', e.g. YYYY-MM-DD HH:mm:ss. If missing or invalid, set to current date/time."
          },
          name: {
            type: "string",
            description: "Full name of the lead."
          },
          email: {
            type: "string",
            description: "Primary email address. If multiple, use the first one and put the rest in crm_note."
          },
          country_code: {
            type: "string",
            description: "Country code, e.g. +91, +1. Extract from the phone field if present."
          },
          mobile_without_country_code: {
            type: "string",
            description: "Mobile number without country code. Remove spaces, dashes, or brackets."
          },
          company: {
            type: "string",
            description: "Company name."
          },
          city: {
            type: "string",
            description: "City."
          },
          state: {
            type: "string",
            description: "State."
          },
          country: {
            type: "string",
            description: "Country."
          },
          lead_owner: {
            type: "string",
            description: "Lead owner email or username."
          },
          crm_status: {
            type: "string",
            description: "Lead status. MUST be exactly one of: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE. Map any source status/stage to the closest matching option.",
            enum: ["GOOD_LEAD_FOLLOW_UP", "DID_NOT_CONNECT", "BAD_LEAD", "SALE_DONE"]
          },
          crm_note: {
            type: "string",
            description: "Remarks, follow-up notes, extra phone numbers, extra emails, or other metadata that doesn't fit standard fields."
          },
          data_source: {
            type: "string",
            description: "Data source. Must be one of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots. If none match confidently, leave blank.",
            enum: ["leads_on_demand", "meridian_tower", "eden_park", "varah_swamy", "sarjapur_plots", ""]
          },
          possession_time: {
            type: "string",
            description: "Property possession time, if mentioned."
          },
          description: {
            type: "string",
            description: "Additional lead description or details."
          },
          __row_id: {
            type: "integer",
            description: "The original __row_id integer from the input record. You MUST copy this integer exactly as it appeared in the raw record."
          }
        },
        required: ["name"]
      }
    }
  },
  required: ["leads"]
};

const SYSTEM_INSTRUCTION = `
You are an intelligent data extraction assistant for GrowEasy CRM.
Your task is to take a batch of raw records from a CSV file (which might have arbitrary column headers and values) and map them into the GrowEasy CRM schema.

Rules for Extraction:
1. Field Mapping:
   - Identify columns representing lead details (e.g. 'Mail', 'Email Address', 'Contact Email' should map to 'email').
   - Identify columns representing name (e.g. 'Customer', 'Contact Name', 'First Name' + 'Last Name' should map to 'name').
   - Identify columns representing phone numbers (e.g. 'Phone', 'Mobile', 'Tel', 'Contact No').
2. Phone Extraction:
   - Parse phone numbers. Extract the country code (e.g., '+91', '+1') if present and place it in 'country_code'.
   - Save the rest of the digits in 'mobile_without_country_code'. Clean any dashes, spaces, and brackets.
3. Multiple Emails/Mobiles:
   - If there are multiple email addresses, use the first one for the 'email' field. Place the rest in 'crm_note'.
   - If there are multiple phone numbers, use the first one for 'mobile_without_country_code'. Place the rest in 'crm_note'.
4. Allowed Statuses (crm_status):
   - You MUST select exactly one of: GOOD_LEAD_FOLLOW_UP, DID_NOT_CONNECT, BAD_LEAD, SALE_DONE.
   - Map custom status fields (like 'interested', 'no response', 'failed', 'won', 'closed') to these standard statuses.
5. Allowed Data Sources (data_source):
   - You MUST select one of: leads_on_demand, meridian_tower, eden_park, varah_swamy, sarjapur_plots.
   - If none match or you are unsure, set to "".
6. Dates:
   - 'created_at' must be convertible by JavaScript 'new Date(created_at)'. Format as YYYY-MM-DD HH:mm:ss. If missing or invalid, default to the current timestamp.
7. Skip Criterion:
   - If a record has NEITHER an email nor a mobile number, you MUST skip (do not return) that record in your final list.
`;

/**
 * Delay execution for backoff
 * @param {number} ms 
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extracts CRM leads from a batch of raw rows using Gemini AI
 * @param {Array<Object>} rows - Batch of raw CSV rows (key-value pairs)
 * @param {string} apiKey - Gemini API key
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<Array<Object>>}
 */
export async function extractLeadsBatch(rows, apiKey, retries = 3) {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please set it in your environment or provide it in the settings panel.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use gemini-1.5-flash as the standard, robust model for general text tasks
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: crmResponseSchema,
      temperature: 0.1 // Low temperature for high extraction accuracy
    }
  });

  const prompt = `Extract leads from the following JSON array of raw records:\n\n${JSON.stringify(rows, null, 2)}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse response
    const parsed = JSON.parse(responseText);
    return parsed.leads || [];
  } catch (error) {
    console.error(`AI Extraction attempt failed. Retries left: ${retries}. Error:`, error.message);
    
    if (retries > 0) {
      // Exponential backoff: wait 2s, 4s, 8s...
      const waitTime = Math.pow(2, 4 - retries) * 1000;
      await delay(waitTime);
      return extractLeadsBatch(rows, apiKey, retries - 1);
    }
    
    throw error;
  }
}
