import React, { useState, useEffect } from 'react';
import _ from 'lodash';
import { Camera, Download, Search, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

const ComponentFlowVisualizer = () => {
  // ========== STATE MANAGEMENT ==========
  // Main data state
  const [flowData, setFlowData] = useState(null);
  const [processedData, setProcessedData] = useState(null);
  
  // View modes - 'tree', 'sequence', or 'network'
  const [viewMode, setViewMode] = useState('tree');
  
  // UI state
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100);
  
  // Filter states
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [filterService, setFilterService] = useState('');
  
  // ========== DATA PROCESSING ==========
  // Process raw data when it changes
  useEffect(() => {
    if (flowData) {
      // Build the component hierarchy
      const hierarchy = buildComponentHierarchy(flowData);
      // Extract unique services
      const services = extractServices(flowData);
      // Calculate timing data
      const timingData = calculateTimingData(flowData);
      
      setProcessedData({
        hierarchy,
        services,
        timingData
      });
    }
  }, [flowData]);
  
  // Build hierarchical structure from flat component data
  const buildComponentHierarchy = (data) => {
    if (!data || !data.result || !data.result.records) return [];
    
    const records = data.result.records;
    const recordsMap = {};
    
    // First pass: create map of records by ID
    records.forEach(record => {
      const spanId = record["span.id"];
      if (spanId) {
        recordsMap[spanId] = { ...record, children: [] };
      }
    });
    
    // Second pass: build parent-child relationships
    const rootNodes = [];
    records.forEach(record => {
      const spanId = record["span.id"];
      const parentId = record["span.parent_id"];
      
      if (spanId) {
        const node = recordsMap[spanId];
        if (parentId && recordsMap[parentId]) {
          recordsMap[parentId].children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    });
    
    return rootNodes;
  };
  
  // Extract all unique services from the data
  const extractServices = (data) => {
    if (!data || !data.result || !data.result.records) return [];
    
    const serviceSet = new Set();
    data.result.records.forEach(record => {
      const service = record["dt.entity.service"];
      if (service) {
        serviceSet.add(service);
      }
    });
    
    return Array.from(serviceSet);
  };
  
  // Calculate timing data for components
  const calculateTimingData = (data) => {
    if (!data || !data.result || !data.result.records) return {
      minTime: null,
      maxTime: null,
      totalDuration: 0
    };
    
    let minTime = null;
    let maxTime = null;
    
    data.result.records.forEach(record => {
      if (record.start_time) {
        const startTime = new Date(record.start_time);
        if (!minTime || startTime < minTime) {
          minTime = startTime;
        }
      }
      
      if (record.end_time) {
        const endTime = new Date(record.end_time);
        if (!maxTime || endTime > maxTime) {
          maxTime = endTime;
        }
      }
    });
    
    return {
      minTime,
      maxTime,
      totalDuration: maxTime && minTime ? maxTime - minTime : 0
    };
  };
  
  // ========== UTILITY FUNCTIONS ==========
  // Format duration in milliseconds
  const formatDuration = (nanoseconds) => {
    if (!nanoseconds) return "N/A";
    const ms = Math.round(parseInt(nanoseconds) / 1000000);
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
    } catch (e) {
      return timestamp;
    }
  };
  
  // Check if a component has an error
  const hasError = (component) => {
    return component && component["span.status_code"] === "error";
  };
  
  // Get error message from a component
  const getErrorMessage = (component) => {
    if (!component || !component["span.events"]) return null;
    
    const errorEvent = component["span.events"].find(
      event => event["span_event.name"] === "exception"
    );
    
    return errorEvent ? errorEvent["exception.message"] : null;
  };
  
  // Calculate position for timeline visualization
  const calculateTimelinePosition = (startTime, endTime, minTime, maxTime) => {
    if (!startTime || !endTime || !minTime || !maxTime) return { left: 0, width: 100 };
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const min = minTime.getTime();
    const max = maxTime.getTime();
    
    const totalDuration = max - min;
    if (totalDuration <= 0) return { left: 0, width: 100 };
    
    const left = ((start - min) / totalDuration) * 100;
    const width = ((end - start) / totalDuration) * 100;
    
    return { left, width };
  };
  
  // ========== EVENT HANDLERS ==========
  // Handle JSON import
  const handleImportJson = () => {
    try {
      const parsedData = JSON.parse(jsonInput);
      setFlowData(parsedData);
      setShowImportPanel(false);
      setJsonInput('');
    } catch (e) {
      alert(`Error parsing JSON: ${e.message}`);
    }
  };
  
  // Handle component selection
  const handleSelectComponent = (component) => {
    setSelectedComponent(component);
    setShowDetailsPanel(true);
  };
  
  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  };
  
  const handleResetZoom = () => {
    setZoomLevel(100);
  };
  
  // ========== RENDER COMPONENTS ==========
  // Render tree view component
  const TreeView = ({ data }) => {
    if (!data || data.length === 0) return <div className="text-center py-6">No data available</div>;
    
    const renderNode = (node, depth = 0) => {
      const [expanded, setExpanded] = useState(true);
      const hasChildren = node.children && node.children.length > 0;
      const isError = hasError(node);
      const errorMsg = getErrorMessage(node);
      
      // Apply filters
      if (showErrorsOnly && !isError) return null;
      if (filterService && node["dt.entity.service"] !== filterService) return null;
      if (searchTerm && !node["span.name"]?.toLowerCase().includes(searchTerm.toLowerCase())) return null;
      
      return (
        <div key={node["span.id"]} className="mb-3">
          <div 
            className={`flex border rounded-md shadow-sm p-3 cursor-pointer ${isError ? 'border-red-300 bg-red-50' : 'border-blue-300 bg-blue-50'}`}
            style={{ marginLeft: `${depth * 30}px` }}
            onClick={() => handleSelectComponent(node)}
          >
            <div className="mr-3 flex items-center">
              {hasChildren && (
                <button 
                  className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center"
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                >
                  {expanded ? '−' : '+'}
                </button>
              )}
            </div>
            <div className="flex-1">
              <div className="flex justify-between">
                <div className="font-medium">{node["span.name"] || 'Unnamed Component'}</div>
                <div className="text-sm">{formatDuration(node.duration)}</div>
              </div>
              <div className="text-sm text-gray-600 flex mt-1">
                {node["endpoint.name"] && (
                  <div className="mr-3">
                    <span className="text-gray-500">Endpoint:</span> {node["endpoint.name"]}
                  </div>
                )}
                {node["dt.entity.service"] && (
                  <div className="mr-3">
                    <span className="text-gray-500">Service:</span> {node["dt.entity.service"].replace('SERVICE-', '')}
                  </div>
                )}
              </div>
              {isError && errorMsg && (
                <div className="mt-1 text-sm text-red-600">
                  <span className="font-medium">Error:</span> {errorMsg}
                </div>
              )}
            </div>
          </div>
          
          {expanded && hasChildren && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    };
    
    return (
      <div className="p-4" style={{ zoom: `${zoomLevel}%` }}>
        {data.map(node => renderNode(node))}
      </div>
    );
  };
  
  // Render sequence view component
  const SequenceView = ({ data, services, timingData }) => {
    if (!data || data.length === 0 || !services || !timingData.minTime) {
      return <div className="text-center py-6">No data available for sequence view</div>;
    }
    
    // Flatten hierarchy to list all nodes
    const flattenNodes = (nodes) => {
      let result = [];
      
      const traverse = (node) => {
        result.push(node);
        if (node.children && node.children.length > 0) {
          node.children.forEach(traverse);
        }
      };
      
      nodes.forEach(traverse);
      return result;
    };
    
    const allNodes = flattenNodes(data);
    
    // Build connections between services
    const connections = [];
    allNodes.forEach(node => {
      if (node["span.parent_id"]) {
        const parent = allNodes.find(n => n["span.id"] === node["span.parent_id"]);
        if (parent && parent["dt.entity.service"] && node["dt.entity.service"]) {
          connections.push({
            from: parent["dt.entity.service"],
            to: node["dt.entity.service"],
            fromName: parent["span.name"],
            toName: node["span.name"],
            startTime: node.start_time,
            endTime: node.end_time,
            isError: hasError(node)
          });
        }
      }
    });
    
    // Apply filters
    const filteredConnections = connections.filter(conn => {
      if (showErrorsOnly && !conn.isError) return false;
      if (filterService && conn.from !== filterService && conn.to !== filterService) return false;
      if (searchTerm && 
          !conn.fromName?.toLowerCase().includes(searchTerm.toLowerCase()) && 
          !conn.toName?.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
    
    return (
      <div className="p-4" style={{ zoom: `${zoomLevel}%` }}>
        <div className="flex mb-4">
          {services.map((service, index) => (
            <div key={service} className="flex flex-col items-center mx-8">
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-lg">{index + 1}</span>
              </div>
              <div className="mt-2 text-center max-w-xs overflow-hidden text-ellipsis">
                {service.replace('SERVICE-', '')}
              </div>
              <div className="h-full w-0.5 bg-gray-300 mt-2"></div>
            </div>
          ))}
        </div>
        
        <div className="relative min-h-64 mt-8">
          {filteredConnections.map((conn, index) => {
            const fromIndex = services.indexOf(conn.from);
            const toIndex = services.indexOf(conn.to);
            
            if (fromIndex < 0 || toIndex < 0) return null;
            
            const fromX = fromIndex * 160 + 80;
            const toX = toIndex * 160 + 80;
            
            const pos = calculateTimelinePosition(
              conn.startTime,
              conn.endTime,
              timingData.minTime,
              timingData.maxTime
            );
            
            const top = pos.left * 5 + 20;
            
            return (
              <div 
                key={index} 
                className="absolute"
                style={{ top: `${top}px` }}
              >
                <svg width={(Math.abs(toX - fromX) + 20)} height="80">
                  <line 
                    x1={fromX < toX ? 10 : Math.abs(toX - fromX) + 10} 
                    y1="10" 
                    x2={fromX < toX ? Math.abs(toX - fromX) + 10 : 10} 
                    y2="10" 
                    stroke={conn.isError ? "#ef4444" : "#3b82f6"} 
                    strokeWidth="2" 
                    markerEnd="url(#arrowhead)" 
                  />
                  <defs>
                    <marker 
                      id="arrowhead" 
                      markerWidth="10" 
                      markerHeight="7" 
                      refX="9" 
                      refY="3.5" 
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill={conn.isError ? "#ef4444" : "#3b82f6"} />
                    </marker>
                  </defs>
                </svg>
                <div 
                  className={`absolute text-xs px-2 py-1 rounded ${conn.isError ? 'bg-red-100' : 'bg-blue-100'}`}
                  style={{ 
                    left: `${Math.abs(toX - fromX) / 2 + (fromX < toX ? 0 : 10)}px`, 
                    top: '-18px',
                    transform: 'translateX(-50%)'
                  }}
                >
                  {conn.toName}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  // Render network view component
  const NetworkView = ({ data, services }) => {
    // This would be a simplified placeholder for a force-directed graph
    // In a real implementation, you'd want to use a library like D3.js or react-force-graph
    return (
      <div className="p-4 text-center">
        <div className="py-6 px-4 bg-gray-100 rounded">
          <p>Network Graph View</p>
          <p className="text-sm text-gray-500">
            (In a real implementation, this would be a force-directed graph showing components and their relationships)
          </p>
        </div>
      </div>
    );
  };
  
  // Render details panel component
  const DetailsPanel = ({ component }) => {
    if (!component) return null;
    
    const [activeTab, setActiveTab] = useState('info');
    
    return (
      <div className="border-l border-gray-300 w-96 p-4 h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{component["span.name"] || 'Component Details'}</h3>
          <button 
            className="text-gray-500 hover:text-gray-700"
            onClick={() => setShowDetailsPanel(false)}
          >
            ×
          </button>
        </div>
        
        <div className="mb-4">
          <div className="flex border-b">
            <button 
              className={`py-2 px-4 ${activeTab === 'info' ? 'border-b-2 border-blue-500' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
            <button 
              className={`py-2 px-4 ${activeTab === 'events' ? 'border-b-2 border-blue-500' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              Events
            </button>
            <button 
              className={`py-2 px-4 ${activeTab === 'json' ? 'border-b-2 border-blue-500' : ''}`}
              onClick={() => setActiveTab('json')}
            >
              JSON
            </button>
          </div>
        </div>
        
        {activeTab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="text-sm">
                <span className="text-gray-500">ID:</span><br />
                <span className="font-mono">{component["span.id"]}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Parent ID:</span><br />
                <span className="font-mono">{component["span.parent_id"] || 'None'}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Status:</span><br />
                <span className={`px-2 py-0.5 rounded text-xs ${hasError(component) ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {component["span.status_code"] || 'unknown'}
                </span>
              </div>
              <div className="text-sm">
                <span className="text-gray-500">Duration:</span><br />
                {formatDuration(component.duration)}
              </div>
            </div>
            
            <div className="text-sm">
              <span className="text-gray-500">Start Time:</span><br />
              {formatTimestamp(component.start_time)}
            </div>
            <div className="text-sm">
              <span className="text-gray-500">End Time:</span><br />
              {formatTimestamp(component.end_time)}
            </div>
            
            {component["dt.entity.service"] && (
              <div className="text-sm">
                <span className="text-gray-500">Service:</span><br />
                {component["dt.entity.service"]}
              </div>
            )}
            {component["endpoint.name"] && (
              <div className="text-sm">
                <span className="text-gray-500">Endpoint:</span><br />
                {component["endpoint.name"]}
              </div>
            )}
            {component["http.response.status_code"] && (
              <div className="text-sm">
                <span className="text-gray-500">HTTP Status:</span><br />
                {component["http.response.status_code"]}
              </div>
            )}
            {component["k8s.container.name"] && (
              <div className="text-sm">
                <span className="text-gray-500">Container:</span><br />
                {component["k8s.container.name"]}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'events' && (
          <div>
            {component["span.events"] && component["span.events"].length > 0 ? (
              <div className="space-y-4">
                {component["span.events"].map((event, index) => (
                  <div key={index} className="p-3 border rounded">
                    <div className="font-medium mb-2">{event["span_event.name"] || `Event ${index + 1}`}</div>
                    {Object.entries(event).map(([key, value]) => {
                      // Skip displaying stack traces here, they're too long
                      if (key === "exception.stack_trace") return null;
                      
                      return (
                        <div key={key} className="text-sm mb-1">
                          <span className="text-gray-500">{key}:</span> {value}
                        </div>
                      );
                    })}
                    
                    {event["exception.stack_trace"] && (
                      <div className="mt-2">
                        <div className="text-sm font-medium mb-1">Stack Trace:</div>
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                          {event["exception.stack_trace"]}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No events available</div>
            )}
          </div>
        )}
        
        {activeTab === 'json' && (
          <div>
            <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto max-h-full">
              {JSON.stringify(component, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };
  
  // ========== MAIN COMPONENT RENDER ==========
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Component Flow Visualizer</h1>
          <div className="flex space-x-2">
            <button 
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 flex items-center"
              onClick={() => setShowImportPanel(true)}
            >
              <Camera size={16} className="mr-1" />
              <span>Import JSON</span>
            </button>
            <button 
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center"
              onClick={() => alert('Export functionality would go here')}
            >
              <Download size={16} className="mr-1" />
              <span>Export</span>
            </button>
          </div>
        </div>
        
        {/* View selector and controls */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex space-x-1">
            <button 
              className={`px-3 py-1 rounded ${viewMode === 'tree' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setViewMode('tree')}
            >
              Tree View
            </button>
            <button 
              className={`px-3 py-1 rounded ${viewMode === 'sequence' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setViewMode('sequence')}
            >
              Sequence View
            </button>
            <button 
              className={`px-3 py-1 rounded ${viewMode === 'network' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
              onClick={() => setViewMode('network')}
            >
              Network View
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                className="pl-8 pr-3 py-1 border rounded"
                placeholder="Search components..."
                value={searchTerm}
                onChange={handleSearch}
              />
              <Search size={16} className="absolute left-2 top-2 text-gray-400" />
            </div>
            
            {/* Filters */}
            <div className="flex items-center space-x-2">
              <label className="flex items-center text-sm">
                <input 
                  type="checkbox" 
                  className="mr-1"
                  checked={showErrorsOnly}
                  onChange={() => setShowErrorsOnly(!showErrorsOnly)}
                />
                Errors Only
              </label>
              
              {processedData && processedData.services && (
                <select 
                  className="border rounded px-2 py-1 text-sm"
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                >
                  <option value="">All Services</option>
                  {processedData.services.map(service => (
                    <option key={service} value={service}>
                      {service.replace('SERVICE-', '')}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            {/* Zoom controls */}
            <div className="flex items-center space-x-1">
              <button 
                className="p-1 rounded hover:bg-gray-200"
                onClick={handleZoomOut}
              >
                <ZoomOut size={16} />
              </button>
              <span className="text-sm w-12 text-center">{zoomLevel}%</span>
              <button 
                className="p-1 rounded hover:bg-gray-200"
                onClick={handleZoomIn}
              >
                <ZoomIn size={16} />
              </button>
              <button 
                className="p-1 rounded hover:bg-gray-200"
                onClick={handleResetZoom}
              >
                <RotateCw size={16} />
              </button>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main visualization area */}
        <div className={`flex-1 overflow-auto ${showDetailsPanel ? 'border-r' : ''}`}>
          {!flowData ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center p-8">
                <p className="mb-4">No data loaded</p>
                <button 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => setShowImportPanel(true)}
                >
                  Import JSON Data
                </button>
              </div>
            </div>
          ) : (
            <>
              {viewMode === 'tree' && processedData && (
                <TreeView data={processedData.hierarchy} />
              )}
              
              {viewMode === 'sequence' && processedData && (
                <SequenceView 
                  data={processedData.hierarchy} 
                  services={processedData.services}
                  timingData={processedData.timingData}
                />
              )}
              
              {viewMode === 'network' && processedData && (
                <NetworkView 
                  data={processedData.hierarchy}
                  services={processedData.services}
                />
              )}
            </>
          )}
        </div>
        
        {/* Details panel (conditional) */}
        {showDetailsPanel && (
          <DetailsPanel component={selectedComponent} />
        )}
      </div>
      
      {/* Import JSON modal */}
      {showImportPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Import Component Flow Data</h2>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Paste your Dynatrace API JSON response below. This should include span data with parent-child relationships.
              </p>
              <textarea 
                className="w-full border rounded p-3 h-64 font-mono text-sm"
                placeholder='{"result": {"records": [{"span.id": "..."}]}}'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
            <div className="p-4 bg-gray-50 rounded-b-lg flex justify-end space-x-2">
              <button 
                className="px-4 py-2 border rounded hover:bg-gray-100"
                onClick={() => setShowImportPanel(false)}
              >
                Cancel
              </button>
              <button 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={handleImportJson}
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComponentFlowVisualizer;
