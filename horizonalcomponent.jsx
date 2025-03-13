import React, { useState, useEffect } from 'react';
import _ from 'lodash';
import { Eye, EyeOff, Info, X, ChevronRight, ChevronDown } from 'lucide-react';

const HorizontalFlowVisualizer = () => {
  // Sample data from Dynatrace_api.json
  const [traceData, setTraceData] = useState({
    state: "SUCCEEDED",
    progress: 100,
    result: {
      records: [
        {
          "span.id": "5e48690a0a7495",
          "span.parent_id": "6e37c7a9452768",
          "span.name": "POST",
          "span.status_code": "error",
          "duration": "59914220000",
          "span.events": [
            {
              "span_event.name": "exception",
              "exception.message": "Session was invalidated",
              "exception.type": "java.lang.IllegalStateException",
              "exception.id": "ac34a9f4861b8f50",
              "exception.escaped": true,
              "exception.is_caused_by_root": true,
              "exception.file.path": "RedisSessionRepository.java",
              "exception.line_number": "129"
            }
          ],
          "endpoint.name": "/api/form/offer/rate",
          "dt.entity.service": "SERVICE-F9ADE83A10C9AC96",
          "dt.entity.cloud_application_instance": "CLOUD_APPLICATION_INSTANCE-F7601E70A7CDF9",
          "k8s.container.name": "ci-fullquote-appstatic-rs",
          "http.response.status_code": "500",
          "start_time": "2025-03-11T11:56:07.10300000-04:00",
          "end_time": "2025-03-11T11:57:01.01722000-04:00"
        },
        {
          "span.id": "13c740a93245a3b2",
          "span.parent_id": "5e48690a0a7495",
          "span.name": "POST",
          "span.status_code": "error",
          "duration": "59013892000",
          "span.events": null,
          "endpoint.name": null,
          "dt.entity.service": "SERVICE-F9ADE83A10C9AC96",
          "dt.entity.cloud_application_instance": "CLOUD_APPLICATION_INSTANCE-F7601E70A7CDF9",
          "k8s.container.name": "ci-fullquote-appstatic-rs",
          "http.response.status_code": "500",
          "start_time": "2025-03-11T11:56:07.10316000-04:00",
          "end_time": "2025-03-11T11:57:01.01706000-04:00"
        },
        {
          "span.id": "cb2185cb531ebf2e",
          "span.parent_id": "13c740a93245a3b2",
          "span.name": "POST /form/offer/rate",
          "span.status_code": "error",
          "duration": "53865117000",
          "span.events": [
            {
              "span_event.name": "exception",
              "exception.message": "Session was invalidated",
              "exception.type": "java.lang.IllegalStateException",
              "exception.id": "ac34a9f4861b8f50",
              "exception.escaped": true,
              "exception.is_caused_by_root": true,
              "exception.file.path": "RedisSessionRepository.java",
              "exception.line_number": "129",
              "exception.stack_trace": "org.springframework.session.data.redis.RedisSessionRepository.save (RedisSessionRepository.java:129)\norg.springframework.session.data.redis.RedisSessionRepository.save (RedisSessionRepository.java:45)\norg.springframework.session.web.http.SessionRepositoryFilter$SessionRepositoryRequestWrapper.commitSession(SessionRepositoryFilter.java:227)"
            }
          ],
          "endpoint.name": null,
          "http.response.status_code": null
        },
        {
          "span.id": "795d9f7d1f830da9",
          "span.parent_id": "cb2185cb531ebf2e",
          "span.name": "RatingController.getRate",
          "span.status_code": "error",
          "duration": "53725029000",
          "span.events": [
            {
              "span_event.name": "exception",
              "exception.message": "Session was invalidated",
              "exception.type": "java.lang.IllegalStateException",
              "exception.id": "ac34a9f4861b8f50",
              "exception.escaped": true
            }
          ],
          "endpoint.name": null,
          "dt.entity.service": "SERVICE-9DE7F72B40A81E86",
          "dt.entity.cloud_application_instance": "CLOUD_APPLICATION_INSTANCE-7889D9CE0D5"
        }
      ]
    }
  });

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
            const containerName = record["k8s.container.name"] || "unknown-container";
            
            // If we haven't seen this container before, create a new entry
            if (!containerGroups[containerName]) {
              containerGroups[containerName] = {
                id: containerName, // Use container name as the unique ID
                name: containerName,
                status: record["span.status_code"] || "unknown",
                duration: record.duration,
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
              
              // Update duration if this record has a longer duration
              if (record.duration > container.duration) {
                container.duration = record.duration;
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
            
            const sourceContainer = sourceRecord["k8s.container.name"] || "unknown-container";
            const targetContainer = record["k8s.container.name"] || "unknown-container";
            
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
        
        setProcessedData({ nodes, links, callCounts });
      } catch (error) {
        console.error("Error processing trace data:", error);
        setProcessedData({ nodes: [], links: [], callCounts: {} });
      }
    }
  }, [traceData]);
  
  // Helper function to format duration
  const formatDuration = (nanoseconds) => {
    if (!nanoseconds) return "N/A";
    const ms = Math.round(parseInt(nanoseconds) / 1000000);
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
  };
  
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
    
    return (
      <div className="absolute top-0 right-0 w-80 h-full bg-white border-l border-gray-200 shadow-lg p-4 overflow-auto z-20">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{component.name}</h3>
          <button 
            className="text-gray-500 hover:text-gray-700"
            onClick={() => setShowDetails(false)}
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Container</div>
            <div className="text-sm font-mono">{component.container || "Unknown"}</div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Status</div>
            <div className={`inline-block px-2 py-1 rounded text-xs ${
              component.status === "error" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
            }`}>
              {component.status.toUpperCase()}
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Duration</div>
            <div className="text-sm">{formatDuration(component.duration)}</div>
          </div>
          
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Service</div>
            <div className="text-sm">{component.service}</div>
          </div>
          
          {component.spanIds && component.spanIds.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Spans ({component.spanIds.length})</div>
              <div className="max-h-32 overflow-y-auto">
                {component.spanIds.map((spanId, idx) => (
                  <div key={idx} className="text-xs font-mono mb-1 truncate">
                    {spanId}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {component.endpoint && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Endpoint</div>
              <div className="text-sm">{component.endpoint}</div>
            </div>
          )}
          
          {component.httpStatus && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">HTTP Status</div>
              <div className="text-sm">{component.httpStatus}</div>
            </div>
          )}
          
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Timestamp</div>
            <div className="text-xs">
              {component.startTime ? new Date(component.startTime).toLocaleTimeString() : "N/A"} - 
              {component.endTime ? new Date(component.endTime).toLocaleTimeString() : "N/A"}
            </div>
          </div>
          
          {/* Outgoing calls section */}
          {outgoingCalls.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Outgoing Calls</div>
              <div className="space-y-2">
                {outgoingCalls.map((call, index) => (
                  <div 
                    key={index} 
                    className={`p-2 rounded text-xs cursor-pointer hover:bg-gray-100 ${
                      hasError(call.target) ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"
                    }`}
                    onClick={() => handleSelectComponent(call.target)}
                  >
                    <div className="font-medium">{call.target.name}</div>
                    <div className="mt-1 flex justify-between">
                      <span>{call.target.spanIds ? `${call.target.spanIds.length} spans` : '0 spans'}</span>
                      <span className="font-medium">{call.count > 1 ? `${call.count} calls` : "1 call"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Incoming calls section */}
          {incomingCalls.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Incoming Calls</div>
              <div className="space-y-2">
                {incomingCalls.map((call, index) => (
                  <div 
                    key={index} 
                    className={`p-2 rounded text-xs cursor-pointer hover:bg-gray-100 ${
                      hasError(call.source) ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"
                    }`}
                    onClick={() => handleSelectComponent(call.source)}
                  >
                    <div className="font-medium">{call.source.name}</div>
                    <div className="mt-1 flex justify-between">
                      <span>{call.source.spanIds ? `${call.source.spanIds.length} spans` : '0 spans'}</span>
                      <span className="font-medium">{call.count > 1 ? `${call.count} calls` : "1 call"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Events section (errors, etc.) */}
          {component.events && component.events.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Events</div>
              <div className="space-y-2">
                {component.events.map((event, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                    <div className="font-medium">{event["span_event.name"]}</div>
                    {event["exception.message"] && (
                      <div className="mt-1 text-red-600">{event["exception.message"]}</div>
                    )}
                    {event["exception.type"] && (
                      <div className="text-gray-600">{event["exception.type"]}</div>
                    )}
                    {event["exception.file.path"] && (
                      <div className="text-gray-600 mt-1">
                        {event["exception.file.path"]}:{event["exception.line_number"]}
                      </div>
                    )}
                    {event["exception.stack_trace"] && (
                      <div className="mt-2">
                        <div className="mb-1 text-gray-500">Stack Trace:</div>
                        <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-40">
                          {event["exception.stack_trace"]}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
    
    // This is a simple level-based layout
    // First, assign levels to nodes
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
          positions[node.id] = { x: 100 + index * 220, y: 100 };
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
    
    // Calculate positions
    const positions = {};
    const levelCounts = {};
    
    nodes.forEach(node => {
      if (!node || !node.id) return;
      
      const level = levels[node.id] || 0;
      if (!levelCounts[level]) {
        levelCounts[level] = 0;
      }
      
      const horizontalSpacing = 220;
      const verticalSpacing = 120;
      const verticalCount = nodesPerLevel[level] || 1;
      
      // Calculate position
      const x = level * horizontalSpacing + 100;
      const y = levelCounts[level] * verticalSpacing + 100;
      
      positions[node.id] = { x, y };
      levelCounts[level]++;
    });
    
    return positions;
  };
  
  // Render the flow diagram
  const FlowDiagram = ({ nodes, links, callCounts }) => {
    const nodeWidth = 160;
    const nodeHeight = 80;
    
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
          
          // Calculate path
          const path = `M ${sourcePos.x + nodeWidth} ${sourcePos.y + nodeHeight/2}
                        L ${targetPos.x} ${targetPos.y + nodeHeight/2}`;
          
          return (
            <g key={index}>
              <path
                d={path}
                stroke={hasError(targetNode) ? "#f56565" : "#718096"}
                strokeWidth="2"
                fill="none"
                markerEnd="url(#arrowhead)"
              />
              {callCount > 1 && (
                <text
                  x={(sourcePos.x + targetPos.x + nodeWidth) / 2}
                  y={(sourcePos.y + targetPos.y + nodeHeight/2) / 2 - 10}
                  className="text-xs fill-gray-600"
                  textAnchor="middle"
                >
                  {callCount} calls
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
          
          const isError = component.hasErrors || component.status === "error";
          
          return (
            <g key={index} onClick={() => handleSelectComponent(node)}>
              {/* Component box */}
              <rect
                x={position.x}
                y={position.y}
                width={nodeWidth}
                height={nodeHeight}
                rx="4"
                ry="4"
                fill="white"
                stroke={isError ? "#f56565" : "#4299e1"}
                strokeWidth={isError ? "2" : "1"}
                className="cursor-pointer"
              />
              
              {/* Component container name */}
              <text
                x={position.x + nodeWidth/2}
                y={position.y + 30}
                textAnchor="middle"
                className="text-sm font-medium select-none"
              >
                {node.name || 'Unknown'}
              </text>
              
              {/* Span count */}
              <text
                x={position.x + nodeWidth/2}
                y={position.y + 50}
                textAnchor="middle"
                className="text-xs text-gray-500 select-none"
              >
                {node.spanIds ? `${node.spanIds.length} spans` : '0 spans'}
              </text>
              
              {/* Duration */}
              <text
                x={position.x + nodeWidth/2}
                y={position.y + 65}
                textAnchor="middle"
                className="text-xs select-none"
              >
                {formatDuration(node.duration)}
              </text>
              
              {/* Duration */}
              <text
                x={position.x + nodeWidth/2}
                y={position.y + 65}
                textAnchor="middle"
                className="text-xs select-none"
              >
                {formatDuration(node.duration)}
              </text>
              
              {/* Error indicator */}
              {isError && (
                <circle
                  cx={position.x + nodeWidth - 10}
                  cy={position.y + 10}
                  r="6"
                  fill="#f56565"
                />
              )}
            </g>
          );
        })}
      </svg>
    );
  };
  
  return (
    <div className="h-screen w-full flex flex-col relative border border-gray-300 rounded-lg overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Component Flow Diagram</h1>
          <div className="flex space-x-4">
            <button className="flex items-center text-sm text-gray-600 hover:text-gray-900">
              <Eye size={16} className="mr-1" />
              <span>Show All</span>
            </button>
            <button className="flex items-center text-sm text-gray-600 hover:text-gray-900">
              <EyeOff size={16} className="mr-1" />
              <span>Hide Successful</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* Main visualization area */}
      <div className="flex-1 relative overflow-auto">
        <div className="absolute inset-0">
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
      <footer className="bg-gray-50 p-2 border-t border-gray-200 flex items-center">
        <div className="flex items-center mr-4">
          <span className="inline-block w-3 h-3 bg-red-500 mr-1 rounded-full"></span>
          <span className="text-sm">Error</span>
        </div>
        <div className="flex items-center mr-4">
          <span className="inline-block w-3 h-3 bg-blue-500 mr-1 rounded-full"></span>
          <span className="text-sm">Success</span>
        </div>
        <div className="flex-1"></div>
        <div className="text-sm text-gray-500 flex items-center">
          <Info size={14} className="mr-1" />
          Click on components to view details
        </div>
      </footer>
    </div>
  );
};

export default HorizontalFlowVisualizer;
