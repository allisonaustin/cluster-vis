import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale, colorScheme } from '../utils/colors.js';
import { Card, List, Checkbox } from "antd";
import * as d3 from 'd3';
import Tooltip from '../utils/tooltip.js';

const Coordinates = ({ data, selectedPoints, setSelectedPoints, hoveredPoint, setHoveredPoint, selectedDims, setSelectedDims }) => {
    const svgContainerRef = useRef();
    const firstRenderRef = useRef(true);
    const [plotData, setPlotData] = useState([]);
    const [size, setSize] = useState({ width: 700, height: 380 });
    const [margin, setMargin] = useState({ top: 50, right: 40, bottom: 20, left: 20 });
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });
    const [brushSelections, setBrushSelections] = useState(new Map());
    const [isLocalHover, setIsLocalHover] = useState(false);
    const [allKeys, setAllKeys] = useState([]);

    const uniqueClusters = Array.from(new Set(data.map(d => d.Cluster)));
    const colors = d3
                        .scaleOrdinal()
                        .domain(uniqueClusters)         
                        .range(colorScheme);  

    const sortedFeatures = Object.keys(data[0])
                            .filter(d => 
                                !(d.includes('Retrans')) && 
                                !(d.includes('UMAP')) &&
                                !(d.includes('tSNE')) &&
                                !(d.includes('PC')) &&
                                !(d.includes('nodeId')) &&
                                !(d.includes('Cluster')))
                                .sort(function (a, b) { 
                                    return a.localeCompare(b, 'en', {'sensitivity': 'base'})
                                })
    
    const [features, setFeatures] = useState(sortedFeatures);

    useEffect(() => {
        if (!svgContainerRef.current) return;
        d3.select(svgContainerRef.current).selectAll("*").remove();
        setPlotData(data);

        setAllKeys(sortedFeatures);

        const width = size.width - margin.left - margin.right;
        const height = size.height - margin.top - margin.bottom;

        const xScale = d3.scalePoint()
            .domain(selectedDims)
            .range([margin.left, width]);

        const y = new Map(Array.from(selectedDims, key => 
            [key, d3.scaleLinear(d3.extent(data, d => parseFloat(d[key])), [height, 0])]
        ));

        const svg = d3.select(svgContainerRef.current)
            .append("svg")
            .attr('id', 'coord-svg')
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

            
            function path(d) {
                return d3.line()(selectedDims.map(function(p) { return [xScale(p), y.get(p)(d[p]) + margin.top]; }));
            }
            
            const paths = svg.selectAll("pcp-path")
                .data(data)
                .enter()
                .append("path")
                    .attr("class", (d) => `line ${d.nodeId}` ) 
                    .attr('data-cluster', (d) => d.Cluster)
                    .attr("d",  path)
                    .style("fill", "none")
                    // .style("stroke", function(d){ return getColor('default')} )
                    .style("stroke", (d) => {
                      if (selectedPoints.length === 0) {
                        return colorScale(d.Cluster)
                      } else {
                        return selectedPoints.includes(d.nodeId) ? getColor('select') : getColor('default')
                      }
                    })
                    .style("opacity", 0.7)
                    .each(function(d) {
                    if (firstRenderRef.current) {
                        const totalLength = this.getTotalLength();
                
                        d3.select(this)
                            .attr("stroke-dasharray", totalLength + " " + totalLength)
                            .attr("stroke-dashoffset", totalLength)
                            .transition()
                            .duration(1000) 
                            .ease(d3.easeLinear)
                            .attr("stroke-dashoffset", 0);
                    }
                    });
    
                    paths.on('mouseover', function(event, d) {
    
                        const [mx, my] = d3.pointer(event, svg.node());
                        if (isMouseInBrushZone(mx, selectedDims, xScale, brushWidth/2)) {
                            return;
                        }
                        
                        setIsLocalHover(true);
                        const tooltipWidth = 150; 
                        const windowWidth = window.innerWidth;  
                    
                        let tooltipX = event.clientX + 5;  
                        if (tooltipX + tooltipWidth > windowWidth) {
                            tooltipX = event.clientX - tooltipWidth - 5;  
                        }
                        setHoveredPoint(d.nodeId); 
    
                        d3.select(this)
                            .style("stroke-width", 3)
                            .style("opacity", 1) 
                        
    
                        // node ID tooltip
                        setTooltip({
                            visible: true,
                            content: `${d.nodeId}`,
                            x: tooltipX,
                            y: event.clientY
                        });
    
                        // d3.select(`#${d.nodeId}`)
                        //     .transition().duration(200)
                        //     .attr("r", 6)  
                            
                        })
                    .on('mouseout', function(event, d) {
                        setIsLocalHover(false);
                        setHoveredPoint(null);

                        d3.select(this)
                            .style("stroke-width", 1) 
                            .style("opacity", 0.7);
    
                        setTooltip({ visible: false, content: '', x: 0, y: 0 }); 
    
                        // d3.select(`#${d.nodeId}`)
                        //     .transition().duration(200)
                        //     .attr("r", 3)
                    });
            
                firstRenderRef.current = false;

         // brush behavior
         const selections = new Map();
         const brushWidth = 50;

        // adding axes
        selectedDims.forEach(dim => {
            const axes = svg.append("g")
                .attr("class", "axis")
                .attr("transform", `translate(${xScale(dim)},${margin.top})`);

            axes.call(d3.axisLeft(y.get(dim)).ticks(5)).selectAll('text').style('font-size', '14px');

            axes.append("text")
                .attr("y", -9)
                .attr('transform', `rotate(-45)`)
                .style("text-anchor", "start")
                .style("fill", "black")
                .text(dim)
                .style('font-size', '14px');

            const brush = d3.brushY()
                .extent([[-(brushWidth / 2), 0], [brushWidth / 2, height]])
                .on('start brush end', event => brushed(event, dim));

            
            axes.call(brush);

            if (brushSelections.has(dim)) {
                axes.call(brush.move, brushSelections.get(dim));
            }
        });

        function brushed({ selection }, key) {
            if (!selection) {
                selections.delete(key);
                brushSelections.delete(key);
            } else {
                const [min, max] = selection.map(y.get(key).invert);
                selections.set(key, [Math.min(min, max), Math.max(min, max)]);
                brushSelections.set(key, selection);
            }
        
            let selected = [];
            if (selections.size === 0) {
                setSelectedPoints([]);
                paths.style("stroke", d => colorScale(d.Cluster));
            } else {
                paths.each(function (d) {
                    const active = Array.from(selections).every(([key, [min, max]]) => {
                        const value = +d[key]; 
                        return value >= min && value <= max;
                    });
        
                    d3.select(this).style("stroke", active ? getColor('select') : getColor('default'));
        
                    if (active) {
                        d3.select(this).raise();
                        selected.push(d.nodeId);
                    }
                });
        
                setSelectedPoints(selected);
            }

            setBrushSelections(new Map(brushSelections));
        }

        function isMouseInBrushZone(mx, dims, xScale, halfBrushWidth) {
            for (let dim of dims) {
              const axisX = xScale(dim);
              if (mx >= axisX - halfBrushWidth && mx <= axisX + halfBrushWidth) {
                return true; 
              }
            }
            return false;
          }
        

        // svg.selectAll("myAxis")
        //     .data(selectedDims).enter()
        //     .append("g")
        //     .attr("class", "axis")
        //     .attr("transform", function(d) { return `translate(${xScale(d)},${margin.top})`; })
        //     .each(function(d) { d3.select(this).call(d3.axisLeft().ticks(5).scale(yScales[d])); })
        //     .append("text")
        //       .style("text-anchor", "middle")
        //       .attr("y", -9)
        //       .text(function(d) { return d; })
        //       .style("fill", "black")
        
    }, [data, selectedDims]);

    useEffect(() => {
        const svg = d3.select(svgContainerRef.current).select("#coord-svg");
        if (!svg.empty()) {
          svg.selectAll(".line")
            .style("stroke-width", d => d.nodeId === hoveredPoint ? 3 : 1)
            .style("opacity", d => d.nodeId === hoveredPoint ? 1 : 0.7);
        }
      }, [hoveredPoint]);

      useEffect(() => {
        if (!isLocalHover && hoveredPoint) {
          const lineNode = d3
            .select(svgContainerRef.current)
            .select(`.line.${hoveredPoint}`)
            .node();
          if (lineNode) {
            const lineBBox = lineNode.getBBox(); 
            const svgNode = d3
              .select(svgContainerRef.current)
              .select("svg")
              .node();
            const svgRect = svgNode.getBoundingClientRect();
      

            let centerX = svgRect.x + lineBBox.x + lineBBox.width / 2;
            let centerY = svgRect.y + lineBBox.y + lineBBox.height / 2;

            const tooltipWidth = 150;   
            const tooltipHeight = 30;   
            const offset = 5;          
      
            const containerRect = svgContainerRef.current.getBoundingClientRect();
      

            if (centerX + tooltipWidth / 2 > containerRect.right) {
              centerX = containerRect.right - tooltipWidth / 2 - offset;
            }

            else if (centerX - tooltipWidth / 2 < containerRect.left) {
              centerX = containerRect.left + tooltipWidth / 2 + offset;
            }
      

            if (centerY - tooltipHeight < containerRect.top) {
              centerY = containerRect.top + tooltipHeight + offset;
            }

            else if (centerY + tooltipHeight > containerRect.bottom) {
              centerY = containerRect.bottom - tooltipHeight - offset;
            }
      

            setTooltip({
              visible: true,
              content: hoveredPoint,
              x: centerX - tooltipWidth / 2,
              y: centerY - tooltipHeight / 2,
            });
          }
        } else if (!isLocalHover && !hoveredPoint) {

          setTooltip({ visible: false, content: '', x: 0, y: 0 });
        }
      }, [hoveredPoint, isLocalHover]);
      

    const handleCheckboxChange = (key) => {
        setSelectedDims(prevSelectedDims => {
            if (prevSelectedDims.includes(key)) {
                return prevSelectedDims.filter(dim => dim !== key);
            } else {
                return [...prevSelectedDims, key];
            }
        });
    };

return (
    <Card title="COORDINATE PLOT" size="small" style={{ height: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        
        <List
          style={{ width: "100%", maxWidth: 200, maxHeight: 300, overflowY: "auto", marginRight: "10px" }}
          bordered
          dataSource={allKeys}
          renderItem={(key, index) => {
            return (
              <List.Item key={key} style={{ display: "flex", alignItems: "center", padding: "5px 10px" }}>
                <Checkbox
                  checked={selectedDims.includes(key)}
                  onChange={() => handleCheckboxChange(key)}
                  style={{ marginRight: "10px" }}
                />
                <span style={{ flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {key}
                </span>
              </List.Item>
            );
          }}
        />

        <div style={{ position: "relative", width: "100%", height: "330px" }}>
          <div ref={svgContainerRef} style={{ width: "100%", height: "100%" }}></div>
        </div>

        <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
        />
      </div>
    </Card>
    );
};

export default Coordinates;