export default async function handler(request, response){

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Only POST requests are allowed' });
    }

    try{

        const apiKey= process.env.GEMINI_API_KEY;

        const requestBodyFromFrontend = request.body;

        //4. Call the Gemini API
        const apiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(requestBodyFromFrontend)
    });

    if( !apiResponse.ok) {
            const errorData = await apiResponse.json();
            return response.status(apiResponse.status).json({ message: errorData.error.message });
        }

    
    const apiResponseData = await apiResponse.json();
    return response.status(200).json(apiResponseData);
        
    }catch(error) {
        console.error('Error calling Gemini API:', error);
        return response.status(500).json({ message: 'Internal Server Error' });
    }

    


}