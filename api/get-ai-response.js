export default async function handler(request, response) {
    console.log('Backend function invoked.');

    if (request.method !== 'POST') {
        console.log(`Request method was ${request.method}, only POST is allowed.`);
        return response.status(405).json({ message: 'Only POST requests are allowed' });
    }

    console.log('Request method is POST.');

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('GEMINI_API_KEY environment variable not found.');
            return response.status(500).json({ message: 'Server configuration error: API key not found.' });
        }
        console.log('API key found.');

        const requestBodyFromFrontend = request.body;
        console.log('Received request body from frontend:', JSON.stringify(requestBodyFromFrontend, null, 2));

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        console.log('Calling Gemini API at:', geminiUrl.replace(apiKey, 'REDACTED_API_KEY'));

        const apiResponse = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBodyFromFrontend)
        });

        console.log(`Gemini API response status: ${apiResponse.status}`);

        if (!apiResponse.ok) {
            const errorData = await apiResponse.json();
            console.error('Error from Gemini API:', errorData);
            return response.status(apiResponse.status).json({ message: errorData.error.message });
        }

        const apiResponseData = await apiResponse.json();
        console.log('Successfully received data from Gemini API.');
        return response.status(200).json(apiResponseData);

    } catch (error) {
        console.error('Error in backend function:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }
}
