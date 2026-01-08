#!/usr/bin/env node
/**
 * Nano Banana Pro - Image Generator
 * Utilise l'API Gemini 3 Pro pour générer des images
 *
 * Usage: node generate-image.js "prompt" [output-path] [filename]
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const https = require('https');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const prompt = process.argv[2];
const outputDir = process.argv[3] || './public/images/generated';
const filename = process.argv[4] || `image_${Date.now()}.png`;

// Validation
if (!GEMINI_API_KEY || GEMINI_API_KEY === 'REMPLACE_PAR_TA_CLE') {
    console.error('❌ Erreur: GEMINI_API_KEY non configurée');
    console.error('');
    console.error('1. Ouvre le fichier .env');
    console.error('2. Remplace REMPLACE_PAR_TA_CLE par ta vraie clé');
    console.error('3. Obtiens une clé sur: https://aistudio.google.com/apikey');
    process.exit(1);
}

if (!prompt) {
    console.error('❌ Erreur: Pas de prompt fourni');
    console.error('Usage: node generate-image.js "description de l\'image"');
    process.exit(1);
}

// Créer le dossier de sortie si nécessaire
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Dossier créé: ${outputDir}`);
}

console.log(`🎨 Génération en cours: "${prompt}"`);
console.log(`📍 Destination: ${path.join(outputDir, filename)}`);

// Requête API Gemini
const requestBody = JSON.stringify({
    contents: [{
        parts: [{ text: `Generate an image: ${prompt}` }]
    }],
    generationConfig: {
        responseModalities: ["image", "text"]
    }
});

// Modèle à utiliser (gemini-2.5-flash-image, gemini-3-pro-image-preview, imagen-4.0-generate-001)
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';

const options = {
    hostname: 'generativelanguage.googleapis.com',
    path: `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const response = JSON.parse(data);

            if (response.error) {
                console.error('❌ Erreur API:', response.error.message);
                if (response.error.code === 400) {
                    console.error('💡 Astuce: Vérifie que ton prompt est approprié');
                }
                if (response.error.code === 403) {
                    console.error('💡 Astuce: Vérifie que ta clé API est valide');
                }
                process.exit(1);
            }

            const parts = response.candidates?.[0]?.content?.parts || [];
            const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
            const textPart = parts.find(p => p.text);

            if (imagePart) {
                const imageData = Buffer.from(imagePart.inlineData.data, 'base64');
                const outputPath = path.join(outputDir, filename);
                fs.writeFileSync(outputPath, imageData);
                console.log(`✅ Image générée: ${outputPath}`);

                if (textPart) {
                    console.log(`💬 Note: ${textPart.text}`);
                }
            } else {
                console.error('❌ Pas d\'image dans la réponse');
                if (textPart) {
                    console.log('Réponse texte:', textPart.text);
                }
                process.exit(1);
            }
        } catch (e) {
            console.error('❌ Erreur parsing:', e.message);
            console.error('Réponse brute:', data.substring(0, 500));
            process.exit(1);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ Erreur réseau:', e.message);
    process.exit(1);
});

req.write(requestBody);
req.end();
