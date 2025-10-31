import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale, colorScheme } from '../utils/colors.js';
import { Card, List, Checkbox } from "antd";
import Tooltip from '../utils/tooltip.js';
import * as d3 from 'd3';

const HeatmapView = ({ data, nodeClusterMap }) => {
    const heatmapRef = useRef();
    const legendRef = useRef();
    const [margin, setMargin] = useState({ top: 10, right: 50, bottom: 150, left: 100 });
    const [tooltip, setTooltip] = useState({
            visible: false,
            content: '',
            x: 0,
            y: 0
        });

    useEffect(() => {
        if (!heatmapRef.current || !legendRef.current || !data || data.length == 0) return;        

        const nodeIds = data.map(d => d.nodeId);
        const features = Object.keys(data[0]).filter(key => key !== "nodeId")
        const matrix = [];
        features.forEach((feature, rowIndex) => {
            data.forEach((d, colIndex) => {
                matrix.push({
                    feature,
                    nodeId: d.nodeId,
                    value: d[feature],
                    row: rowIndex,
                    col: colIndex
                });
            });
        });
        drawHeatmap(matrix, features, nodeIds);
        
    }, [data]);

    const drawHeatmap = (matrix, featureNames, nodeIds) => {

        function extractNumber(nodeId) {
            return nodeId.match(/\d+$/)[0]; 
        }

        const sortedNodeIds = nodeIds.slice().sort((a, b) => {
            const na = +extractNumber(a);
            const nb = +extractNumber(b);
            return na - nb;
          });

        const numberToNodeId = {};
        sortedNodeIds.forEach(nodeId => {
            numberToNodeId[extractNumber(nodeId)] = nodeId;
        });

        const cellWidth = 20;
        const cellHeight = 20;
        const totalWidth = nodeIds.length * cellWidth;
        const totalHeight = featureNames.length * cellHeight;
        const yScale = d3.scaleBand().domain(featureNames).range([0, totalHeight]).padding(0.05);
        const xScale = d3.scaleBand().domain(nodeIds).range([0, totalWidth]).padding(0.05);
        // const xScale = d3.scaleBand()
        //     .domain(sortedNodeIds.map(d => extractNumber(d)))
        //     .range([0, totalWidth])
        //     .padding(0.05);
        const myColor = d3.scaleDiverging().interpolator(d3.interpolateRdBu).domain([5,0,-5]);

        // main svg (fixed)
        let svg = d3.select(heatmapRef.current).select('svg');

        if (svg.empty()) {
            svg = d3.select(heatmapRef.current)
                .append('svg')
                .attr('width', totalWidth + margin.right + margin.left)
                .attr('height', margin.top + totalHeight + margin.bottom);

            const scrollContainer = svg.append("foreignObject")
                .attr("x", margin.left)
                .attr("y", margin.top)
                .attr("width", 800)
                .attr("height", 500)
                .append("xhtml:div")
                .attr("id", "scrollable-div")
                .style("overflow", "auto")
                .style("width", "800px")
                .style("height", "500px");

            // inner svg for heatmap (scrollable)
            const hSvg = d3.select(scrollContainer.node())
                .append("svg")
                .attr('class', 'heatmap-svg')
                .attr("width", 800)
                .attr("height", 500);

            // add group for heatmap cells
            hSvg.append('g').attr('class', 'heatmap-group');
            svg.append("g").attr("class", "x-axis");
            svg.append("g").attr("class", "y-axis");

            const scrollDiv = document.getElementById("scrollable-div");

            function updateAxisPosition() {
                const scrollLeft = scrollDiv.scrollLeft;
                const scrollTop = scrollDiv.scrollTop;

                svg.select(".x-axis")
                    .attr("transform", `translate(${margin.left - scrollLeft}, ${margin.top + totalHeight})`);

                svg.select(".y-axis")
                    .attr("transform", `translate(${margin.left - 5}, ${margin.top - scrollTop})`);
            }

            // Initial positioning
            updateAxisPosition();

            // Listen for scroll
            scrollDiv.addEventListener("scroll", updateAxisPosition);
        }

        svg.select(".y-axis")
            .style('font-size', 14)
            .transition().duration(200)
            .call(d3.axisLeft(yScale))
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        svg.select(".x-axis")
            .transition().duration(200)
            .call(d3.axisBottom(xScale).tickSize(0))
            .selectAll("text")
            .attr("transform", "rotate(-65)")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .style("text-anchor", "end")
            .style("fill", d => {
                // const fullNodeId = numberToNodeId[d];
                // const clusterId = nodeClusterMap.get(fullNodeId); 
                const clusterId = nodeClusterMap.get(d); 
                return clusterId !== undefined ? colorScale(clusterId) : "black";
            })
            .style("font-weight", "bold");
        
        svg.select(".x-axis")
            .attr("transform", `translate(${margin.left}, ${margin.top + totalHeight})`);

        const hGroup = svg.select('.heatmap-group');
        const cells = hGroup.selectAll('.heatmap-cell')
            .data(matrix, function(d) {return d.nodeId+':'+d.feature;});

        cells.transition().duration(500)
            .style("fill", function(d) { return myColor(d.value)} )
            .attr("x", function(d) { return xScale(d.nodeId) }) 
            // .attr("x", function(d) { return xScale(extractNumber(d.nodeId)) }) 
            .attr("y", function(d) { return yScale(d.feature) })
            .attr("width", xScale.bandwidth() )
            .attr("height", yScale.bandwidth() );

        cells.enter()
            .append("rect")
            .attr("class", d => `heatmap-cell node-${d.nodeId}`)
            .attr("x", d => xScale(d.nodeId))
            .attr("y", d => yScale(d.feature))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("rx", 4)
            .attr("ry", 4)
            .style("fill", d => myColor(d.value))
            .style("stroke", "none")
            .style("opacity", 0.8)
            .on("mouseover", function(event, d) {
                    d3.select(this)
                        .style("stroke", "black")
                        .style("stroke-width", "2px")
                        .style("opacity", 1);
                    
                    // highlighting circle in dr plot
                    let circs = d3.select(`#${d.nodeId}`) 
                    circs
                        .transition()
                        .duration(150)
                        .attr("r", 8)  
                        .style("opacity", 1)


                    // highlighting time series
                    let lines = d3.selectAll(".line-svg").selectAll("path.line");
                    lines.each(function(lineData) {
                        if (lineData[0] === d.nodeId) {
                            d3.select(this)
                                .transition()
                                .duration(150)
                                .style("opacity", 1)
                                .style("stroke-width", "2px")
                        } else {
                            d3.select(this)
                                .transition()
                                .duration(150)
                                .style("opacity", 0.1); 
                        }
                    });
                    setTooltip({
                        visible: true,
                        content: `${d.nodeId}, ${d.value !== null && d.value !== undefined ? d.value.toFixed(3) : 'N/A'}`,
                        x: event.clientX,
                        y: event.clientY,
                    });
                })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .style("stroke", "none")  
                    .style("opacity", 0.8);

                let circs = d3.select(`#${d.nodeId}`)
                circs
                    .transition()
                    .duration(150)
                    .attr("r", 4)

                let lines = d3.selectAll(".line-svg").selectAll("path.line");
                // Resetting all line styles
                lines.transition()
                    .duration(150)
                    .style("stroke-width", 1)
                    .style("opacity", 0.8)

                setTooltip(prev => ({
                    ...prev,
                    visible: false,
                }));
            });


        cells.exit().remove();

        // legend

        const lSvg = d3.select(legendRef.current).select('svg');

        if (lSvg.empty()){
            lSvg.append('svg')
                .attr('width',  200 )
                .attr('height', 50);

            // legend
            const legendWidth = 120; 
            const legendHeight = 10;  
            
            const legendGroup = lSvg.append("g")
                .attr("transform", `translate(20, 20)`);
            
            const defs = lSvg.append("defs");
            const linearGradient = defs.append("linearGradient")
                .attr("id", "legend-gradient")
                .attr("x1", "0%").attr("x2", "100%")
                .attr("y1", "0%").attr("y2", "0%");
            
            linearGradient.selectAll("stop")
                .data([
                    { offset: "0%", color: myColor(-3) },  
                    { offset: "50%", color: myColor(0) },  
                    { offset: "100%", color: myColor(3) }  
                ])
                .enter().append("stop")
                .attr("offset", d => d.offset)
                .attr("stop-color", d => d.color);
            
            legendGroup.append("rect")
                .attr("width", legendWidth)
                .attr("height", legendHeight)
                .style("fill", "url(#legend-gradient)");
            
            const legendScale = d3.scaleLinear()
                .domain([-5, 5]) 
                .range([0, legendWidth]);
            
            const legendAxis = d3.axisBottom(legendScale)
                .tickValues([-5, -2.5, 0, 2.5, 5])  
                .tickFormat(d3.format(".1f")) 
                .tickSize(5);
            
            legendGroup.append("g")
                .attr("transform", `translate(0, ${legendHeight})`)
                .call(legendAxis)
                .style('font-size', 12)
                .select(".domain").remove();

            legendGroup.append('text')
                .attr('x', legendWidth / 2)
                .attr('y', -5)
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .text('Z-Scores');
        }
    };
      

return (
    <Card title="NODE BEHAVIOR VIEW" size="small" style={{ height: "auto" }}>
        <div style={{ display:'flex', position:'relative' }}>
            <div ref={heatmapRef} style={{
                    width: "100%",
                    height: "auto",
                    overflow: "hidden",
                    position: "relative"
                }}
            />
        </div>

        <div ref={legendRef} style={{ overflow:'hidden' }}  />
        <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={`zscores-tooltip`}
          />
    </Card>
    );
};

export default HeatmapView;