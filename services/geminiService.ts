export const generateInsight = async (
  contextName: string,
  data: any,
  userQuery?: string
): Promise<string> => {
  try {
    const response = await fetch('http://localhost:8000/api/ai/insight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_name: contextName,
        data,
        user_query: userQuery,
      }),
    });

    if (!response.ok) {
      console.error('AI insight API error:', response.status, await response.text());
      return 'Unable to generate insights at this time. (AI API error)';
    }

    const result = await response.json();
    return result.insight || 'No insights generated.';
  } catch (error) {
    console.error("AI Insight Error:", error);
    return "Unable to generate insights at this time. Please check your API configuration.";
  }
};

export const fetchSuggestedQuestions = async (
  contextName: string,
  data: any
): Promise<string[]> => {
  try {
    const response = await fetch('http://localhost:8000/api/ai/suggest-questions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context_name: contextName,
        data,
      }),
    });

    if (!response.ok) {
      console.error('AI suggest-questions API error:', response.status, await response.text());
      return [];
    }

    const result = await response.json();
    return result.questions || [];
  } catch (error) {
    console.error("AI Suggested Questions Error:", error);
    return [];
  }
};
