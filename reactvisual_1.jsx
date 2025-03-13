import React, { useState, useEffect, useRef } from 'react';
import _ from 'lodash';

// The ComponentWorkflow component visualizes application interactions
const ComponentWorkflow = ({ nodes }) => {
  const canvasRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Extract component workflow data
  const extractComponentWorkflow = (nodes) => {
    if (!nodes || nodes.length === 0) return { apps: [], connections: [] };
    
    // Map to track applications and their occurrences
    const appMap = new Map();
    // Track connections between applications
    const connections = [];
    // Map span IDs to their application
    const spanToApp = new Map();
    
    // First pass: identify all unique applications and map spans to apps
    const traverse = (node, parentApp = null) => {
      const appName = node["k8s.container.name"] || 
                      node.k8s_container_name || 
                      "unknown";
      
      // Store or update app in map
      if (!appMap.has(appName)) {
        appMap.set(appName, { 
          id: appName,
          name: appName,
          count: 1,
          hasError: node.span_status_code === "error" || node["span.status_code"] === "error",
          spans: [node["span.id"] || node.span_id]
        });
      } else {
        const app = appMap.get(appName);
        app.count += 1;
        app.hasError = app.hasError || node.span_status_code === "error" || node["span.status_code"] === "error";
        app.spans.push(node["span.id"] || node.span_id);
        appMap.set(appName, app);
      }
      
      // Map this span to its app
      spanToApp.set(node["span.id"] || node.span_id, appName);
      
      // If we have both parent and current app, record a connection
      if (parentApp && parentApp !== appName) {
        const existingConnection = connections.find(
          c => c.source === parentApp && c.target === appName
        );
        
        if (existingConnection) {
          existingConnection.count += 1;
          existingConnection.spans.push(node["span.id"] || node.span_id);
        } else {
          connections.push({
            source: parentApp,
            target: appName,
            count: 1,
            hasError: node.span_status_code === "error" || node["span.status_code"] === "error",
            spans: [node["span.id"] || node.span_id]
          });
        }
      }
      
      // Process children
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => traverse(child, appName));
      }
    };
    
    // Start traversal from root nodes
    nodes.forEach(node => traverse(node));
    
    // Identify circular paths (where an app calls itself via other apps)
    const circularPaths = [];
    appMap.forEach((app, 
      
    ) => {
      const findCircularPaths = (currentApp, path = [], visited = new Set()) => {
        if (visited.has(currentApp)) return;
        
        visited.add(currentApp);
        path.push(currentApp);
        
        // Find all outgoing connections from this app
        const outgoingConnections = connections.filter(conn => conn.source === currentApp);
        
        for (const conn of outgoingConnections) {
          if (conn.target === appName) {
            // We found a circular path back to the original app
            circularPaths.push([...path, appName]);
          } else if (!visited.has(conn.target)) {
            findCircularPaths(conn.target, [...path], new Set(visited));
          }
        }
      };
      
      findCircularPaths(appName);
    });
    
    return {
      apps: Array.from(appMap.values()),
      connections,
      circularPaths
    };
  };
  
  const workflowData = extractComponentWorkflow(nodes);
  
  // Canvas drawing logic
  useEffect(() => {
    if (!canvasRef.current || !workflowData.apps.length) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate positions for apps (nodes)
    const apps = workflowData.apps;
    const nodeRadius = 30;
    const nodePositions = {};
    
    // Position nodes in a circle layout
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - nodeRadius * 3;
    
    apps.forEach((app, index) => {
      const angle = (2 * Math.PI * index) / apps.length;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      nodePositions[app.id] = { x, y };
    });
    
    // Draw connections first (so they're behind nodes)
    workflowData.connections.forEach(conn => {
      const sourcePos = nodePositions[conn.source];
      const targetPos = nodePositions[conn.target];
      
      if (!sourcePos || !targetPos) return;
      
      // Draw arc path for circular references
      const isCircular = workflowData.circularPaths.some(path => 
        path.includes(conn.source) && path.includes(conn.target)
      );
      
      ctx.beginPath();
      ctx.strokeStyle = conn.hasError ? '#ff4d4d' : '#4a90e2';
      ctx.lineWidth = Math.max(1, Math.min(5, conn.count));
      
      if (isCircular) {
        // Calculate control points for a curved line
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Control point offset based on distance
        const offset = distance / 3;
        
        // Perpendicular offset
        const nx = -dy / distance;
        const ny = dx / distance;
        
        const controlX = (sourcePos.x + targetPos.x) / 2 + nx * offset;
        const controlY = (sourcePos.y + targetPos.y) / 2 + ny * offset;
        
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.quadraticCurveTo(controlX, controlY, targetPos.x, targetPos.y);
      } else {
        ctx.moveTo(sourcePos.x, sourcePos.y);
        ctx.lineTo(targetPos.x, targetPos.y);
      }
      
      ctx.stroke();
      
      // Draw arrowhead
      const angle = Math.atan2(
        targetPos.y - sourcePos.y,
        targetPos.x - sourcePos.x
      );
      
      // Position the arrowhead slightly before the target to avoid overlap
      const arrowX = targetPos.x - nodeRadius * Math.cos(angle);
      const arrowY = targetPos.y - nodeRadius * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(
        arrowX - 10 * Math.cos(angle - Math.PI / 6),
        arrowY - 10 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - 10 * Math.cos(angle + Math.PI / 6),
        arrowY - 10 * Math.sin(angle + Math.PI / 6)
      );
      ctx.fillStyle = conn.hasError ? '#ff4d4d' : '#4a90e2';
      ctx.fill();
      
      // Draw connection count
      const textX = (sourcePos.x + targetPos.x) / 2;
      const textY = (sourcePos.y + targetPos.y) / 2;
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.fillText(`${conn.count}`, textX, textY);
    });
    
    // Draw nodes
    apps.forEach(app => {
      const { x, y } = nodePositions[app.id];
      const isHighlighted = app.id === selectedNode || app.id === hoveredNode;
      
      // Draw node circle
      ctx.beginPath();
      ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
      
      // Set fill color based on error status and selection state
      if (isHighlighted) {
        ctx.fillStyle = app.hasError ? '#ff8080' : '#90caf9';
        ctx.strokeStyle = '#1565c0';
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = app.hasError ? '#ffcdd2' : '#e3f2fd';
        ctx.strokeStyle = app.hasError ? '#c62828' : '#2196f3';
        ctx.lineWidth = 1;
      }
      
      ctx.fill();
      ctx.stroke();
      
      // Draw app name
      ctx.fillStyle = '#333';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Shorten name if too long
      let displayName = app.name;
      if (displayName.length > 15) {
        displayName = displayName.substring(0, 12) + '...';
      }
      
      ctx.fillText(displayName, x, y);
      
      // Draw count badge
      if (app.count > 1) {
        const badgeRadius = 10;
        ctx.beginPath();
        ctx.arc(x + nodeRadius, y - nodeRadius, badgeRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#5c6bc0';
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.fillText(app.count, x + nodeRadius, y - nodeRadius);
      }
    });
    
    // Add interactivity
    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if mouse is over any node
      let hoveredAppId = null;
      apps.forEach(app => {
        const { x, y } = nodePositions[app.id];
        const distance = Math.sqrt(
          Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2)
        );
        
        if (distance <= nodeRadius) {
          hoveredAppId = app.id;
        }
      });
      
      if (hoveredAppId !== hoveredNode) {
        setHoveredNode(hoveredAppId);
      }
    };
    
    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Check if mouse is over any node
      let clickedAppId = null;
      apps.forEach(app => {
        const { x, y } = nodePositions[app.id];
        const distance = Math.sqrt(
          Math.pow(mouseX - x, 2) + Math.pow(mouseY - y, 2)
        );
        
        if (distance <= nodeRadius) {
          clickedAppId = app.id;
        }
      });
      
      setSelectedNode(clickedAppId === selectedNode ? null : clickedAppId);
    };
    
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
    };
  }, [workflowData, hoveredNode, selectedNode]);
  
  // App details section
  const selectedApp = selectedNode ? 
    workflowData.apps.find(app => app.id === selectedNode) : null;
  
  // Connections involving the selected app
  const selectedConnections = selectedNode ? 
    workflowData.connections.filter(
      conn => conn.source === selectedNode || conn.target === selectedNode
    ) : [];
  
  return (
    <div className="component-workflow w-full">
      <div className="flex flex-col">
        <div className="canvas-container border rounded bg-white p-2 mb-4">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={400} 
            className="w-full h-64"
          />
          <div className="text-sm text-center text-gray-500 mt-2">
            Click on a node to view details. {workflowData.circularPaths.length > 0 && 
            "Curved lines indicate circular references."}
          </div>
        </div>
        
        {selectedApp && (
          <div className="app-details bg-white border rounded p-4">
            <h3 className="text-lg font-semibold mb-2">
              {selectedApp.name}
              {selectedApp.hasError && (
                <span className="ml-2 px-2 py-1 text-xs rounded bg-red-200 text-red-800">
                  Has Errors
                </span>
              )}
            </h3>
            
            <div className="mb-4">
              <p>Appears <strong>{selectedApp.count}</strong> times in the trace</p>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium mb-2">Connections:</h4>
              <div className="space-y-2">
                {selectedConnections.map((conn, index) => (
                  <div key={index} className={`p-2 rounded ${conn.hasError ? 'bg-red-50' : 'bg-blue-50'}`}>
                    <div className="flex justify-between">
                      <span>
                        {conn.source === selectedNode ? 'To: ' : 'From: '}
                        <strong>
                          {conn.source === selectedNode ? conn.target : conn.source}
                        </strong>
                      </span>
                      <span className="text-sm">
                        {conn.count} call{conn.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
                
                {selectedConnections.length === 0 && (
                  <p className="text-gray-500">No connections found</p>
                )}
              </div>
            </div>
            
            {workflowData.circularPaths.some(path => path.includes(selectedNode)) && (
              <div className="circular-paths mb-4">
                <h4 className="font-medium mb-2">Part of Circular Paths:</h4>
                <div className="space-y-2">
                  {workflowData.circularPaths
                    .filter(path => path.includes(selectedNode))
                    .map((path, index) => (
                      <div key={index} className="p-2 bg-yellow-50 rounded">
                        {path.join(' → ')}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ComponentWorkflow;
