// server/copilot.js

import express from 'express';
import dotenv from 'dotenv';
dotenv.config();
import tokenManager from './tokenManager.js';


const app = express();
app.use(express.json());


import fetch from 'node-fetch';

app.post('/api/copilot', async (req, res) => {
    // Helper: strip comments from JSON string
    function stripJsonComments(str) {
      // Remove // ... and /* ... */ comments
      return str.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//gm, '');
    }
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided.' });
  try {
    const response = await fetch('https://api.horizon.elevancehealth.com/v2/text/chats?qos=accurate&reasoning=true'
      , {
      method: 'POST',
      headers: {
  'Authorization': `Bearer ${tokenManager.getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { content: message, role: 'user' }
        ],
        stream: false
      })
    });
    const data = await response.json();
    // Adjust this if the response structure is different
    let reply = data.message && data.message.content
      ? data.message.content
      : JSON.stringify(data);

    // Debug: log the raw reply
    console.log('LLM raw reply:', reply);

    // Try to extract a JSON recommendation block from the reply
    let recommendation = null;
    try {
      // If reply is a pure JSON object, parse it directly
      // Always use robust extraction to find first JSON object anywhere in reply
      // First, try to extract and parse a JSON array block from the reply
      let testCases = [];
      function extractJsonArrayBlock(str) {
        // First, look for a markdown code block labeled 'json'
        const codeBlockMatch = str.match(/```json\s*([\s\S]*?)```/i);
        if (codeBlockMatch) {
          const jsonBlock = stripJsonComments(codeBlockMatch[1].trim());
          try {
            const arr = JSON.parse(jsonBlock);
            if (Array.isArray(arr) && arr.length > 0 && arr.every(tc => tc.inputs && tc.expected !== undefined)) {
              return arr;
            }
          } catch (e) {
            // skip invalid
          }
        }
        // Fallback: extract first array block in text
        const start = str.indexOf('[');
        const end = str.lastIndexOf(']');
        if (start !== -1 && end !== -1 && end > start) {
          const arrStr = stripJsonComments(str.slice(start, end + 1));
          try {
            const arr = JSON.parse(arrStr);
            if (Array.isArray(arr) && arr.length > 0 && arr.every(tc => tc.inputs && tc.expected !== undefined)) {
              return arr;
            }
          } catch (e) {
            // skip invalid
          }
        }
        return [];
      }
      testCases = extractJsonArrayBlock(reply);
      if (testCases.length === 0) {
        // Extract all test case objects as an array
        function extractAllJsonObjects(str) {
          const objects = [];
          let i = 0;
          while (i < str.length) {
            let start = str.indexOf('{', i);
            if (start === -1) break;
            let depth = 0;
            for (let j = start; j < str.length; j++) {
              if (str[j] === '{') depth++;
              if (str[j] === '}') depth--;
              if (depth === 0) {
                let objStr = str.slice(start, j + 1);
                objStr = stripJsonComments(objStr);
                try {
                  objects.push(JSON.parse(objStr));
                } catch (e) {
                  // skip invalid
                }
                i = j + 1;
                break;
              }
            }
            if (depth !== 0) break;
          }
          return objects;
        }
        testCases = extractAllJsonObjects(reply);
      }
      if (testCases.length > 0 && testCases.every(tc => tc.inputs && tc.expected !== undefined)) {
        recommendation = testCases;
      } else {
        // fallback to first object extraction for decision table
        function extractFirstJsonObject(str) {
          let start = str.indexOf('{');
          if (start === -1) return null;
          let depth = 0;
          for (let i = start; i < str.length; i++) {
            if (str[i] === '{') depth++;
            if (str[i] === '}') depth--;
            if (depth === 0) {
              let objStr = str.slice(start, i + 1);
              objStr = stripJsonComments(objStr);
              return objStr;
            }
          }
          return null;
        }
        let jsonStr = extractFirstJsonObject(reply);
        if (jsonStr) {
          // Strip comments from JSON block before parsing
          // Remove // ... and /* ... */ comments
          let cleanedJsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//gm, '');
          try {
            let parsed = JSON.parse(cleanedJsonStr);
            if (parsed.decisionTable) parsed = parsed.decisionTable;
            if (parsed.columns && Array.isArray(parsed.columns)) {
              const seen = new Set();
              parsed.columns = parsed.columns.filter(col => {
                if (seen.has(col.name)) return false;
                seen.add(col.name);
                return true;
              });
            }
            recommendation = parsed.recommendation ? parsed.recommendation : parsed;
          } catch (e) {
            console.log('JSON parse error:', e, cleanedJsonStr);
          }
        } else {
          console.log('No valid JSON object found in reply:', reply);
        }
      }
    } catch (e) {
      console.log('Extraction error:', e);
    }

    // Debug: log the extracted recommendation
    console.log('Extracted recommendation:', recommendation);

    res.json({ reply, recommendation });
  } catch (err) {
    res.status(500).json({ error: 'Horizon Hub API error', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Horizon Hub API running on port ${PORT}`));
