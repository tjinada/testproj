import React, { useState, useEffect } from 'react';
import HorizontalFlowVisualizer from './HorizontalFlowVisualizer';
import ErrorSummaryTable from './ErrorSummaryTable';
import { ArrowDownUp } from 'lucide-react';

const App = () => {
  const [traceData, setTraceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Load data from the JSON file
    const loadData = async () => {
      try {
        // In a real app, you might fetch this from an API
        // For now, we'll use the window.fs to read the file
        const response = await window.fs.readFile('Dynatrace_api.json with Correct Property Names.txt', {
          encoding: 'utf8'
        });
        
        // Parse the JSON data
        const data = JSON.parse(response);
        setTraceData(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading trace data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle component selection from error summary
  const handleSelectComponentFromError = (component) => {
    setSelectedComponent(component);
    setShowDetails(true);
    
    // Scroll down to the visualization
    document.getElementById('flow-visualizer').scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Loading trace data...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Distributed Trace Analysis</h1>
          <p className="text-gray-600 mt-1">
            Analyzing trace data from {traceData?.result?.records?.length || 0} spans
          </p>
        </header>

        {/* Error Summary Section */}
        <section className="mb-6">
          <ErrorSummaryTable 
            traceData={traceData} 
            onSelectComponent={handleSelectComponentFromError} 
          />
        </section>

        {/* Navigation link to connect the sections */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-blue-800">Trace Visualization</h3>
            <p className="text-xs text-blue-600 mt-1">
              Explore how components interact throughout the transaction
            </p>
          </div>
          <ArrowDownUp className="text-blue-500" size={20} />
        </div>

        {/* Flow Visualizer Section */}
        <section id="flow-visualizer" className="mb-6">
          <HorizontalFlowVisualizer 
            traceData={traceData}
            selectedComponent={selectedComponent}
            showDetails={showDetails}
          />
        </section>
      </div>
    </div>
  );
};

export default App;
