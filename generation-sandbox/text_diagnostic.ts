
import fetch from 'node-fetch';

async function diagnostic() {
    const apiKey = 'AIzaSyCJH2pvMZMuIS3e2mdp3VuIDnVdjS83TYw';
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    console.log('🔍 [Diagnostic] Testing AI Studio Text Pipe...');
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'Hello, are you online?' }] }]
            })
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log('✅ [SUCCESS] AI Studio Text Pipe is ONLINE.');
            console.log('Response:', data.candidates[0].content.parts[0].text);
        } else {
            console.error('❌ [FAILED] AI Studio Text Pipe Error:', response.status, JSON.stringify(data.error));
        }
    } catch (err) {
        console.error('💥 [CRASH] Diagnostic failed:', err.message);
    }
}

diagnostic();
