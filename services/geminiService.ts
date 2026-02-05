import { GoogleGenerativeAI } from "@google/generative-ai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

export const generateInsight = async (
  contextName: string,
  data: any,
  userQuery?: string
): Promise<string> => {
  const genAI = getClient();
  if (!genAI) return "Error: API Key not configured.";

  const systemInstruction = `
    You are a Senior Hospitality Revenue Analyst & UI Forensic Investigator for a high-end resort booking platform.
    Your goal is to move from passive analytics to active intelligence.
    
    When analyzing data:
    1. Identify the "Revenue Leak".
    2. Hypothesize the user behavior cause (e.g., "Rage clicks on mobile due to 60s load time").
    3. Quantify the loss.
    4. Suggest an immediate technical or UX fix.
    
    Keep responses concise, professional, and actionable. Avoid generic advice.
  `;

  const prompt = userQuery 
    ? userQuery 
    : `Analyze this ${contextName} data and find the biggest revenue leak or friction point: ${JSON.stringify(data)}`;

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash-exp",
      systemInstruction: systemInstruction
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
      }
    });

    const response = result.response;
    return response.text() || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights at this time. Please check your API configuration.";
  }
};
