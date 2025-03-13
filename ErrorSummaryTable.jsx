import React, { useState, useEffect } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import _ from 'lodash';

const ErrorSummaryTable = ({ traceData, onSelectComponent }) => {
  const [errors, setErrors] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (traceData && traceData.result && traceData.result.records) {
      try {
        const extractedErrors = [];
        const records = traceData.result.records || [];

        // Process each record to find errors
        records.forEach(record => {
          // Only process records with events
          if (record && record["span.events"] && Array.isArray(record["span.events"])) {
            // Find exception events
            const exceptionEvents = record["span.events"].filter(
              event => event && event["span_event.name"] === "exception"
            );

            if (exceptionEvents.length > 0) {
              // For each exception, create an error entry
              exceptionEvents.forEach(exception => {
                extractedErrors.push({
                  spanId: record["span.id"],
                  component: record["k8s.container.name"] || record["span.name"] || "Unknown",
                  endpoint: record["endpoint.name"] || record["span.name"] || "Unknown",
                  httpResponse: record["http.response.status_code"] || "Unknown",
                  exceptionType: exception["exception.type"] || "Unknown",
                  exceptionMessage: exception["exception.message"] || "Unknown error",
                  fileName: exception["exception.file.path"] || "Unknown",
                  lineNumber: exception["exception.line_number"] || "N/A",
                  stackTrace: exception["exception.stack_trace"] || "Not available",
                  record: record // Store the full record for reference
                });
              });
            }
          }
        });

        // Group errors by component for better organization
        const groupedErrors = _.groupBy(extractedErrors, 'component');
        
        // Convert to array format for rendering
        const formattedErrors = Object.entries(groupedErrors).map(([component, errors]) => ({
          component,
          errors
        }));

        setErrors(formattedErrors);
        setIsLoading(false);
      } catch (error) {
        console.error("Error processing error data:", error);
        setErrors([]);
        setIsLoading(false);
      }
    }
  }, [traceData]);

  // Toggle row expansion
  const toggleRowExpansion = (componentName) => {
    setExpandedRows({
      ...expandedRows,
      [componentName]: !expandedRows[componentName]
    });
  };

  // Find the matching component in the visualization
  const handleSelectErrorComponent = (errorItem) => {
    if (onSelectComponent && errorItem.record) {
      // Construct a node-like object that the visualizer can use
      const containerName = errorItem.component;
      
      // Create a simplified component object that matches what the visualizer expects
      const componentInfo = {
        id: containerName,
        name: containerName,
        status: "error",
        events: errorItem.record["span.events"] || [],
        spanIds: [errorItem.spanId],
        hasErrors: true
      };
      
      onSelectComponent(componentInfo);
    }
  };

  // Format stack trace for display
  const formatStackTrace = (stackTrace) => {
    if (!stackTrace || stackTrace === "Not available") return "Not available";
    
    // Split by newlines for better formatting
    return stackTrace.split('\n').map((line, index) => (
      <div key={index} className="font-mono text-xs whitespace-pre-wrap">
        {line}
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="text-center py-8 text-gray-500">Loading error data...</div>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="text-center py-8 flex flex-col items-center">
          <div className="text-green-500 mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          <div className="text-lg font-medium text-gray-900">No errors detected</div>
          <p className="text-gray-500 mt-1">All transactions completed successfully</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 overflow-hidden">
      <div className="p-4 bg-red-50 border-b border-red-200 flex items-center">
        <AlertTriangle className="text-red-600 mr-2" size={20} />
        <h2 className="text-lg font-semibold text-gray-900">Error Summary</h2>
        <div className="ml-3 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
          {errors.reduce((total, group) => total + group.errors.length, 0)} Errors
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-6"></th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Component</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">HTTP Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exception Type</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Line</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {errors.map((group) => (
              <React.Fragment key={group.component}>
                {/* Group header row */}
                <tr 
                  className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => toggleRowExpansion(group.component)}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    {expandedRows[group.component] ? (
                      <ChevronDown size={16} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500" />
                    )}
                  </td>
                  <td colSpan="7" className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {group.component} <span className="ml-2 text-sm text-gray-500">({group.errors.length} {group.errors.length === 1 ? 'error' : 'errors'})</span>
                  </td>
                </tr>

                {/* Expanded error details */}
                {expandedRows[group.component] && group.errors.map((error, errorIndex) => (
                  <React.Fragment key={`${group.component}-${errorIndex}`}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap"></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {error.component}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {error.endpoint}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          error.httpResponse === "500" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {error.httpResponse}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {error.exceptionType}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {error.fileName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {error.lineNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleSelectErrorComponent(error)}
                          className="text-blue-600 hover:text-blue-900 flex items-center"
                        >
                          <ExternalLink size={14} className="mr-1" />
                          View
                        </button>
                      </td>
                    </tr>
                    
                    {/* Error message and stack trace row */}
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap"></td>
                      <td colSpan="7" className="px-4 py-3">
                        <div className="mb-2">
                          <span className="text-xs font-medium text-gray-500 uppercase">Message:</span>
                          <span className="ml-2 text-sm text-red-600">{error.exceptionMessage}</span>
                        </div>
                        
                        {error.stackTrace !== "Not available" && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 uppercase mb-1">Stack Trace:</div>
                            <div className="bg-gray-100 p-2 rounded text-xs overflow-x-auto max-h-32 border border-gray-200">
                              {formatStackTrace(error.stackTrace)}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ErrorSummaryTable;
