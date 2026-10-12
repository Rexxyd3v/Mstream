const MODEL = "gemini-3.5-flash-lite";

async function handler(request, response) {
    if (request.method !== "POST") {
        response.status(405).json({ error: "Use POST for movie questions." });
        return;
    }

    const question = typeof request.body?.question === "string"
        ? request.body.question.trim()
        : "";
    const history = Array.isArray(request.body?.history)
        ? request.body.history
            .filter(message => message
                && (message.role === "user" || message.role === "assistant")
                && typeof message.text === "string")
            .slice(-6)
        : [];
    if (!question || question.length > 500) {
        response.status(400).json({ error: "Ask a question between 1 and 500 characters." });
        return;
    }
    if (!process.env.GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not configured in Vercel.");
        response.status(500).json({ error: "The movie assistant is not configured." });
        return;
    }

    const conversation = history
        .map(message => `${message.role === "user" ? "User" : "Assistant"}: ${message.text.slice(0, 300)}`)
        .join("\n");
    const prompt = [
        "You are MStream's movie assistant.",
        "Answer movie and TV questions helpfully and briefly.",
        "Do not claim current availability or streaming rights unless the user provides that context.",
        "If asked for recommendations, explain the taste or genre match.",
        conversation ? `Conversation so far:\n${conversation}` : "",
        `User question: ${question}`,
    ].join("\n");

    try {
        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 180 },
                }),
            },
        );
        const data = await geminiResponse.json();
        if (!geminiResponse.ok) {
            console.error("Gemini request failed.", geminiResponse.status, data.error?.message);
            response.status(502).json({ error: "The movie assistant is temporarily unavailable." });
            return;
        }

        const answer = data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();
        if (!answer) {
            response.status(502).json({ error: "The movie assistant returned no answer." });
            return;
        }
        response.json({ answer });
    } catch (error) {
        console.error("Could not reach Gemini.", error);
        response.status(502).json({ error: "The movie assistant is temporarily unavailable." });
    }
}

module.exports = handler;
