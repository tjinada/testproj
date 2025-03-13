import React, { useState } from 'react';
import { Search } from 'lucide-react';

/**
 * TraceSearch component provides a search interface to find traces by ID
 * @param {Object} props
 * @param {Function} props.onSearch - Callback function when search is executed
 * @param {boolean} props.isLoading - Loading state indicator
 */
const TraceSearch = ({ onSearch, isLoading = false }) => {
  const [traceId, setTraceId] = useState('');
  const [error, setError] = useState('');

  // Handle input change
  const handleInputChange = (e) => {
    setTraceId(e.target.value);
    if (error) setError('');
  };

  // Handle search submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!traceId.trim()) {
      setError('Please enter a trace ID');
      return;
    }
    
    // Call the onSearch callback with the trace ID
    onSearch(traceId.trim());
  };

  return (
    <div className="bg-white p-4 border-b border-gray-200 shadow-sm">
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
        <div className="flex items-center">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={traceId}
              onChange={handleInputChange}
              className={`block w-full pl-10 pr-12 py-2 rounded-md border ${
                error ? 'border-red-300' : 'border-gray-300'
              } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm`}
              placeholder="Enter trace ID (e.g. e83189f54acfe9ee51e1098b0d0a132c)"
              disabled={isLoading}
            />
            {isLoading && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
          <button
            type="submit"
            className={`ml-4 px-4 py-2 rounded-md text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isLoading
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            disabled={isLoading}
          >
            Search
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </form>
    </div>
  );
};

export default TraceSearch;
