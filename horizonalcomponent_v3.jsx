import React, { useState, useEffect } from 'react';
import _ from 'lodash';
import { Eye, EyeOff, Info, X, ChevronRight, ChevronDown } from 'lucide-react';
import mockData from './Dynatrace_api.json';

const HorizontalFlowVisualizer = () => {
  // Sample data from Dynatrace_api.json
  const [traceData, setTraceData] = useState(mockData);

  // Process data for visualization
  const [processedData, setProcessedData] = useState({
    nodes: [],
    links: [],
    callCounts: {}
  });
  
  // UI state
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  useEffect(() => {
    if (traceData && traceData.result && traceData.result.records) {
      try {
        // Process the data to create nodes and links
        const records = traceData.result.records || [];
        
        // Group records by container name to create unique components
        const containerGroups = {};
        records.forEach(record => {
          if (record && record["span.id"]) {
            const containerName = record["k8s.container.name"] || record["span.name"] || "unknown-container";
            
            // If we haven't seen this container before, create a new entry
            if (!containerGroups[containerName]) {
              containerGroups[containerName] = {
                id: containerName, // Use container name as the unique ID
                name: containerName,
                status: record["span.status_code"] || "unknown",
                service: record["dt.entity.service"] || "Unknown Service",
                endpoint: record["endpoint.name"],
                events: record["span.events"] || [],
                httpStatus: record["http.response.status_code"],
                startTime: record.start_time,
                endTime: record.end_time,
                spanIds: [record["span.id"]], // Keep track of all span IDs from this container
                container: containerName,
                cloudInstance: record["dt.entity.cloud_application_instance"],
                // Track if this container has any errors
                hasErrors: record["span.status_code"] === "error"
              };
            } else {
              // If we've seen this container, update the existing entry
              const container = containerGroups[containerName];
              
              // Add this span ID to the list
              container.spanIds.push(record["span.id"]);
              
              // Update error status if this record has an error
              if (record["span.status_code"] === "error") {
                container.hasErrors = true;
                container.status = "error";
              }
              
              // Add events
              if (record["span.events"] && record["span.events"].length > 0) {
                container.events = [...container.events, ...record["span.events"]];
              }
            }
          }
        });
        
        // Convert container groups to an array of nodes
        const nodes = Object.values(containerGroups);
        
        // Create links between containers
        const links = [];
        const callCounts = {};
        
        records.forEach(record => {
          if (record && record["span.id"] && record["span.parent_id"]) {
            // Find the container for this record
            const sourceRecord = records.find(r => r["span.id"] === record["span.parent_id"]);
            if (!sourceRecord) return;
            
            const sourceContainer = sourceRecord["k8s.container.name"] || sourceRecord["span.name"] || "unknown-container";
            const targetContainer = record["k8s.container.name"] || record["span.name"] || "unknown-container";
            
            // Skip self-links (container calling itself)
            if (sourceContainer === targetContainer) return;
            
            // Create a unique key for this container pair
            const linkKey = `${sourceContainer}-${targetContainer}`;
            
            // Increment call count
            if (!callCounts[linkKey]) {
              callCounts[linkKey] = {
                count: 1,
                source: sourceContainer,
                target: targetContainer
              };
            } else {
              callCounts[linkKey].count += 1;
            }
            
            // Only add unique links
            const existingLink = links.find(link => 
              link.source === sourceContainer && link.target === targetContainer
            );
            
            if (!existingLink) {
              links.push({
                source: sourceContainer,
                target: targetContainer
              });
            }
          }
        });
        
        // Look for bi-directional calls
        records.forEach(record => {
          if (record && record["span.parent_id"]) {
            const spanId = record["span.id"];
            const parentId = record["span.parent_id"];
            
            // Check if there's any record where the current span ID is the parent of its own parent
            const bidirectionalRecord = records.find(r => 
              r["span.id"] === parentId && r["span.parent_id"] === spanId
            );
            
            if (bidirectionalRecord) {
              const container1 = record["k8s.container.name"] || record["span.name"] || "unknown-container";
              const container2 = bidirectionalRecord["k8s.container.name"] || bidirectionalRecord["span.name"] || "unknown-container";
              
              if (container1 !== container2) {
                // Check if the link already exists
                const linkKey = `${container1}-${container2}`;
                const reverseLinkKey = `${container2}-${container1}`;
                
                if (!callCounts[linkKey]) {
                  callCounts[linkKey] = {
                    count: 1,
                    source: container1,
                    target: container2
                  };
                }
                
                // Add a unique link if needed
                const existingLink = links.find(link => 
                  (link.source === container1 && link.target === container2) ||
                  (link.source === container2 && link.target === container1)
                );
                
                if (!existingLink) {
                  links.push({
                    source: container1,
                    target: container2
                  });
                }
              }
            }
          }
        });
        
        setProcessedData({ nodes, links, callCounts });
      } catch (error) {
        console.error("Error processing trace data:", error);
        setProcessedData({ nodes: [], links: [], callCounts: {} });
      }
    }
  }, [traceData]);
  
  // Determine if a component has an error
  const hasError = (node) => {
    return node && (node.status === "error" || node.hasErrors === true);
  };
  
  // Handle component selection
  const handleSelectComponent = (node) => {
    setSelectedComponent(node);
    setShowDetails(true);
  };
  
  // Component details panel
  const ComponentDetails = ({ component }) => {
    if (!component) return null;
    
    const [activeTab, setActiveTab] = useState('info');
    
    // Find outgoing and incoming calls for this component
    const outgoingCalls = [];
    const incomingCalls = [];
    
    if (processedData.callCounts && component.id) {
      Object.values(processedData.callCounts).forEach(call => {
        if (call && call.source === component.id) {
          const targetNode = processedData.nodes.find(node => node && node.id === call.target);
          if (targetNode) {
            outgoingCalls.push({
              target: targetNode,
              count: call.count
            });
          }
        }
        
        if (call && call.target === component.id) {
          const sourceNode = processedData.nodes.find(node => node && node.id === call.source);
          if (sourceNode) {
            incomingCalls.push({
              source: sourceNode,
              count: call.count
            });
          }
        }
      });
    }
    
    // Extract endpoints from span IDs
    const endpoints = [];
    if (component.spanIds) {
      // Build a list of unique endpoints from all spans in this component
      const traceRecords = traceData?.result?.records || [];
      const endpointMap = new Map();
      
      component.spanIds.forEach(spanId => {
        const span = traceRecords.find(record => record["span.id"] === spanId);
        if (span && span["endpoint.name"]) {
          const endpoint = span["endpoint.name"];
          if (!endpointMap.has(endpoint)) {
            endpointMap.set(endpoint, {
              name: endpoint,
              status: span["http.response.status_code"] || span["span.status_code"] || "unknown",
              hasError: span["span.status_code"] === "error",
              events: span["span.events"] || []
            });
          }
        }
      });
      
      endpoints.push(...endpointMap.values());
    }
    
    return (
      <div className="absolute top-0 right-0 w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-auto z-20">
        {/* Header with close button */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 z-10">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-800">{component.name}</h3>
            <button 
              className="p-1 rounded-full hover:bg-gray-100"
              onClick={() => setShowDetails(false)}
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex mt-4 border-b">
            <button 
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'info' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('info')}
            >
              Info
            </button>
            <button 
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'endpoints' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('endpoints')}
            >
              Endpoints
            </button>
            <button 
              className={`px-4 py-2 font-medium text-sm ${
                activeTab === 'errors' 
                  ? 'text-blue-600 border-b-2 border-blue-600' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('errors')}
            >
              Errors
            </button>
          </div>
        </div>
        
        <div className="p-4">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Container</div>
                    <div className="text-sm font-medium">{component.container || "Unknown"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Executions</div>
                    <div className="text-sm font-medium">{component.spanIds ? component.spanIds.length : 0}</div>
                  </div>
                </div>
              </div>
              
              {/* Service info */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Service Information</h4>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Service ID</div>
                    <div className="text-sm font-mono">{component.service || "Unknown Service"}</div>
                  </div>
                  {component.cloudInstance && (
                    <div className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Cloud Instance</div>
                      <div className="text-sm font-mono">{component.cloudInstance}</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Outgoing calls section */}
              {outgoingCalls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Outgoing Calls</h4>
                  <div className="space-y-2">
                    {outgoingCalls.map((call, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${
                          hasError(call.target) ? "border border-red-200" : "border border-blue-200"
                        }`}
                        onClick={() => handleSelectComponent(call.target)}
                      >
                        <div>
                          <div className="font-medium text-gray-900 truncate max-w-xs">{call.target.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {call.target.spanIds ? `${call.target.spanIds.length} executions` : '0 executions'}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {call.count} {call.count === 1 ? 'call' : 'calls'}
                          </span>
                          <ChevronRight size={16} className="ml-2 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Incoming calls section */}
              {incomingCalls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Incoming Calls</h4>
                  <div className="space-y-2">
                    {incomingCalls.map((call, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-50 ${
                          hasError(call.source) ? "border border-red-200" : "border border-blue-200"
                        }`}
                        onClick={() => handleSelectComponent(call.source)}
                      >
                        <div>
                          <div className="font-medium text-gray-900 truncate max-w-xs">{call.source.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {call.source.spanIds ? `${call.source.spanIds.length} executions` : '0 executions'}
                          </div>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {call.count} {call.count === 1 ? 'call' : 'calls'}
                          </span>
                          <ChevronRight size={16} className="ml-2 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Endpoints Tab */}
          {activeTab === 'endpoints' && (
            <div className="space-y-4">
              {endpoints.length > 0 ? (
                endpoints.map((endpoint, index) => (
                  <div 
                    key={index} 
                    className={`p-3 rounded-lg border ${
                      endpoint.hasError ? "border-red-200 bg-red-50" : "border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="font-medium text-gray-900 break-all">{endpoint.name}</div>
                      <div className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        endpoint.status === "error" || endpoint.status === "500" 
                          ? "bg-red-100 text-red-800" 
                          : "bg-green-100 text-green-800"
                      }`}>
                        {endpoint.status}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No endpoints found for this component
                </div>
              )}
            </div>
          )}
          
          {/* Errors Tab */}
          {activeTab === 'errors' && (
            <div className="space-y-4">
              {component.events && component.events.length > 0 ? (
                component.events
                  .filter(event => event["span_event.name"] === "exception")
                  .map((event, index) => (
                    <div key={index} className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <div className="font-medium text-red-800 mb-2">{event["exception.message"] || "Error"}</div>
                      
                      {event["exception.type"] && (
                        <div className="mb-2 text-sm">
                          <span className="font-medium text-gray-700">Type:</span> {event["exception.type"]}
                        </div>
                      )}
                      
                      {event["exception.file.path"] && (
                        <div className="mb-2 text-sm">
                          <span className="font-medium text-gray-700">Location:</span> {event["exception.file.path"]}
                          {event["exception.line_number"] && `:${event["exception.line_number"]}`}
                        </div>
                      )}
                      
                      {event["exception.stack_trace"] && (
                        <div className="mt-3">
                          <div className="mb-1 text-sm font-medium text-gray-700">Stack Trace:</div>
                          <pre className="text-xs bg-white p-3 rounded border border-red-200 overflow-x-auto max-h-60 font-mono">
                            {event["exception.stack_trace"]}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  No errors found for this component
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Calculate layout positions for the horizontal flow
  const calculateNodePositions = (nodes, links) => {
    // Safety check
    if (!nodes || nodes.length === 0) return {};
    
    // This is a level-based layout with improved positioning
    const levels = {};
    const positioned = {};
    
    // Find root nodes (no incoming links)
    const rootNodes = nodes.filter(node => 
      node && node.id && !links.some(link => link.target === node.id)
    );
    
    // If no root nodes found, try to use the first node as root
    const startNodes = rootNodes.length > 0 ? rootNodes : (nodes[0] ? [nodes[0]] : []);
    
    // Safety check if we still have no nodes
    if (startNodes.length === 0) {
      // Just return a default position for each node
      const positions = {};
      nodes.forEach((node, index) => {
        if (node && node.id) {
          positions[node.id] = { x: 100 + index * 240, y: 100 };
        }
      });
      return positions;
    }
    
    // Assign level 0 to start nodes
    startNodes.forEach(node => {
      if (node && node.id) {
        levels[node.id] = 0;
        positioned[node.id] = true;
      }
    });
    
    // Assign levels to all other nodes
    let somethingChanged = true;
    while (somethingChanged) {
      somethingChanged = false;
      
      links.forEach(link => {
        const sourceId = link.source;
        const targetId = link.target;
        
        if (sourceId && targetId && positioned[sourceId] && !positioned[targetId]) {
          levels[targetId] = levels[sourceId] + 1;
          positioned[targetId] = true;
          somethingChanged = true;
        }
      });
    }
    
    // Handle cycles or disconnected nodes by assigning a default level
    nodes.forEach(node => {
      if (node && node.id && !positioned[node.id]) {
        levels[node.id] = 0;
      }
    });
    
    // Count nodes per level for vertical positioning
    const nodesPerLevel = {};
    Object.entries(levels).forEach(([nodeId, level]) => {
      if (!nodesPerLevel[level]) {
        nodesPerLevel[level] = 0;
      }
      nodesPerLevel[level]++;
    });
    
    // Calculate positions with improved spacing
    const positions = {};
    const levelCounts = {};
    
    nodes.forEach(node => {
      if (!node || !node.id) return;
      
      const level = levels[node.id] || 0;
      if (!levelCounts[level]) {
        levelCounts[level] = 0;
      }
      
      const horizontalSpacing = 260; // Increased for better spacing
      const verticalSpacing = 140;   // Increased for better spacing
      const verticalCount = nodesPerLevel[level] || 1;
      
      // Calculate position with better vertical distribution
      const x = level * horizontalSpacing + 100;
      const y = 100 + (levelCounts[level] * verticalSpacing) + 
                (level % 2 === 0 ? 0 : verticalSpacing / 4); // Slight offset for odd levels
      
      positions[node.id] = { x, y };
      levelCounts[level]++;
    });
    
    return positions;
  };
  
  // Render the flow diagram
  const FlowDiagram = ({ nodes, links, callCounts }) => {
    const nodeWidth = 180;  // Wider nodes
    const nodeHeight = 80;  // Shorter nodes without the duration display
    
    // Safety checks
    if (!nodes || nodes.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">No components to display</div>
        </div>
      );
    }
    
    // Calculate positions for all nodes
    const positions = calculateNodePositions(nodes, links);
    
    return (
      <svg width="100%" height="100%" className="overflow-visible">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#718096" />
          </marker>
          <marker
            id="arrowhead-error"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f56565" />
          </marker>
          <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
            <feOffset dx="2" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.2" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Links */}
        {links && links.map((link, index) => {
          if (!link || !link.source || !link.target) return null;
          
          const sourceNode = nodes.find(node => node && node.id === link.source);
          const targetNode = nodes.find(node => node && node.id === link.target);
          
          if (!sourceNode || !targetNode) return null;
          
          const sourcePos = positions[sourceNode.id];
          const targetPos = positions[targetNode.id];
          
          if (!sourcePos || !targetPos) return null;
          
          // Key for this link in the call counts
          const linkKey = `${link.source}-${link.target}`;
          const callCount = callCounts && callCounts[linkKey]?.count || 1;
          
          // Calculate orthogonal path with 90-degree angles
          const startX = sourcePos.x + nodeWidth;
          const startY = sourcePos.y + nodeHeight/2;
          const endX = targetPos.x;
          const endY = targetPos.y + nodeHeight/2;
          const midX = (startX + endX) / 2;
          
          const path = `M ${startX} ${startY}
                       L ${midX} ${startY}
                       L ${midX} ${endY}
                       L ${endX} ${endY}`;
          
          const isError = hasError(targetNode);
          const markerEnd = isError ? "url(#arrowhead-error)" : "url(#arrowhead)";
          
          return (
            <g key={index}>
              <path
                d={path}
                stroke={isError ? "#f56565" : "#718096"}
                strokeWidth="2"
                fill="none"
                markerEnd={markerEnd}
              />
              {callCount > 1 && (
                <rect
                  x={(sourcePos.x + targetPos.x + nodeWidth) / 2 - 15}
                  y={(sourcePos.y + targetPos.y + nodeHeight/2) / 2 - 10}
                  width="30"
                  height="20"
                  rx="10"
                  ry="10"
                  fill="white"
                  stroke="#718096"
                  strokeWidth="1"
                />
              )}
              {callCount > 1 && (
                <text
                  x={(sourcePos.x + targetPos.x + nodeWidth) / 2}
                  y={(sourcePos.y + targetPos.y + nodeHeight/2) / 2 + 4}
                  className="text-xs font-bold fill-gray-600"
                  textAnchor="middle"
                >
                  {callCount}
                </text>
              )}
            </g>
          );
        })}
        
        {/* Nodes */}
        {nodes && nodes.map((node, index) => {
          if (!node || !node.id) return null;
          
          const position = positions[node.id];
          if (!position) return null;
          
          const isError = node.hasErrors || node.status === "error";
          
          return (
            <g key={index} onClick={() => handleSelectComponent(node)}>
              {/* Component box */}
              <rect
                x={position.x}
                y={position.y}
                width={nodeWidth}
                height={nodeHeight}
                rx="6"
                ry="6"
                fill="white"
                stroke={isError ? "#f56565" : "#4299e1"}
                strokeWidth={isError ? "2" : "1.5"}
                className="cursor-pointer"
                filter="url(#dropShadow)"
              />
              
              {/* Component container name */}
              <text
                x={position.x + nodeWidth/2}
                y={position.y + 30}
                textAnchor="middle"
                className="text-sm font-bold select-none"
                style={{ fill: "#2d3748" }}
              >
                <tspan>{node.name || 'Unknown'}</tspan>
              </text>
              
              {/* Divider line */}
              <line 
                x1={position.x + 20} 
                y1={position.y + 45} 
                x2={position.x + nodeWidth - 20} 
                y2={position.y + 45} 
                stroke="#e2e8f0" 
                strokeWidth="1.5"
              />
              
              {/* Execution count */}
              <text
                x={position.x + nodeWidth/2}
                y={position.y + 65}
                textAnchor="middle"
                className="text-xs font-medium select-none"
                style={{ fill: "#718096" }}
              >
                {node.spanIds ? `${node.spanIds.length} executions` : '0 executions'}
              </text>
              
              {/* Error indicator */}
              {isError && (
                <circle
                  cx={position.x + nodeWidth - 15}
                  cy={position.y + 15}
                  r="8"
                  fill="#f56565"
                >
                  <title>Has Errors</title>
                </circle>
              )}
              {isError && (
                <text
                  x={position.x + nodeWidth - 15}
                  y={position.y + 19}
                  textAnchor="middle"
                  fill="white"
                  fontSize="12"
                  fontWeight="bold"
                >
                  !
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };
  
  return (
    <div className="h-screen w-full flex flex-col relative border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Component Flow Diagram</h1>
          <div className="flex space-x-4">
            <button className="flex items-center text-sm text-gray-600 hover:text-gray-900 bg-white py-1.5 px-3 rounded-md border border-gray-300 shadow-sm">
              <Eye size={16} className="mr-1.5" />
              <span>Show All</span>
            </button>
            <button className="flex items-center text-sm text-gray-600 hover:text-gray-900 bg-white py-1.5 px-3 rounded-md border border-gray-300 shadow-sm">
              <EyeOff size={16} className="mr-1.5" />
              <span>Hide Successful</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main visualization area */}
      <div className="flex-1 relative overflow-auto">
        <div className="absolute inset-0 p-4">
          <FlowDiagram 
            nodes={processedData.nodes} 
            links={processedData.links} 
            callCounts={processedData.callCounts}
          />
        </div>
        
        {/* Details panel */}
        {showDetails && selectedComponent && (
          <ComponentDetails component={selectedComponent} />
        )}
      </div>
      
      {/* Legend */}
      <footer className="bg-white p-3 border-t border-gray-200 flex items-center shadow-sm">
        <div className="flex items-center mr-4">
          <span className="inline-block w-3 h-3 bg-red-500 mr-1.5 rounded-full"></span>
          <span className="text-sm text-gray-700">Error</span>
        </div>
        <div className="flex items-center mr-4">
          <span className="inline-block w-3 h-3 bg-blue-500 mr-1.5 rounded-full"></span>
          <span className="text-sm text-gray-700">Success</span>
        </div>
        <div className="flex-1"></div>
        <div className="text-sm text-gray-600 flex items-center">
          <Info size={14} className="mr-1.5" />
          Click on components to view details
        </div>
      </footer>
    </div>
  );
}

export default ComponentFlowDiagram;
