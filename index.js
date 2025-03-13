import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

// Mock the window.fs.readFile API for demo purposes
// In a real application, this would be provided by your framework
if (!window.fs) {
  window.fs = {
    readFile: async (path, options) => {
      // This is just for demo purposes
      if (path === 'Dynatrace_api.json with Correct Property Names.txt') {
        // Return the content of the JSON file
        return JSON.stringify({
          "state": "SUCCEEDED",
          "progress": 100,
          "result": {
            "records": [
              // Your JSON data would be here - using the data from the file provided
              // For brevity, we're not including the full dataset here
            ]
          }
        });
      }
      throw new Error(`File not found: ${path}`);
    }
  };
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
