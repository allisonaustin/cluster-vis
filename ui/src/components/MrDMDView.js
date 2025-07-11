import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale, colorScheme } from '../utils/colors.js';
import { Card, List, Checkbox } from "antd";
import Tooltip from '../utils/tooltip.js';
import * as d3 from 'd3';

const MRDMDView = ({ data }) => {
    // const svgContainerRef = useRef();
    const yAxisRef = useRef();
    const heatmapRef = useRef();
    const legendRef = useRef();
    const firstRenderRef = useRef(true);
    const [plotData, setPlotData] = useState([]);
    const [size, setSize] = useState({ width: 700, height: 100 });
    const [margin, setMargin] = useState({ top: 50, right: 40, bottom: 90, left: 100 });
    const [tooltip, setTooltip] = useState({
            visible: false,
            content: '',
            x: 0,
            y: 0
        });

    useEffect(() => {
        if (!yAxisRef.current || !heatmapRef.current || !legendRef.current || !data || data.length == 0) return;        
        firstRenderRef.current = false;

        // d3.select(svgContainerRef.current).selectAll("*").remove();
        d3.select(yAxisRef.current).selectAll('*').remove();
        d3.select(heatmapRef.current).selectAll('*').remove();
        d3.select(legendRef.current).selectAll('*').remove();

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
        setPlotData(matrix);
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

        const cellWidth = 20;
        const cellHeight = 30;
        const totalWidth = nodeIds.length * cellWidth;
        const totalHeight = featureNames.length * cellHeight;

        const ySvg = d3.select(yAxisRef.current)
        .append('svg')
        .attr('width', margin.left)
        .attr('height',totalHeight + 20);
  
        const yScale = d3.scaleBand()
            .domain(featureNames)
            .range([0, totalHeight])
            .padding(0.05);

        // y axis
        const yAxis = ySvg.append('g')
            .style('font-size', 14)
            .attr("transform", `translate(${margin.left-2},0)`)
            .call(d3.axisLeft(yScale))


        const hSvg = d3.select(heatmapRef.current)
            .append('svg')
            .attr('width', totalWidth + margin.right)
            .attr('height', totalHeight + 40);

            const xScale = d3.scaleBand()
            .domain(sortedNodeIds.map(d => extractNumber(d)))
            .range([0, totalWidth])
            .padding(0.05);

        // x axis
        hSvg.append('g')
            .style('font-size', 13)
            .attr('transform', "translate(" + 5 + "," + totalHeight + ")")
            .call(d3.axisBottom(xScale).tickSize(0))
            .selectAll("text")  
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-65)")
            .select('.domain').remove()

        var myColor = d3.scaleDiverging()
            .interpolator(d3.interpolateRdBu) 
            .domain([5, 0, -5]); 

        hSvg.selectAll()
            .data(matrix, function(d) {return d.nodeId+':'+d.feature;})
            .enter()
            .append("rect")
                .attr('class', (d) => `heatmap-cell node-${d.nodeId}`)
                .attr("x", function(d) { return xScale(extractNumber(d.nodeId)) })
                .attr("y", function(d) { return yScale(d.feature) })
                .attr("rx", 4)
                .attr("ry", 4)
                .attr("width", xScale.bandwidth() )
                .attr("height", yScale.bandwidth() )
                .style("fill", function(d) { return myColor(d.value)} )
                .style("stroke-width", 4)
                .style("stroke", "none")
                .style("opacity", 0.8)
            // .attr('transform', "translate(" + margin.left + ",0)")
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
                    content: `${d.nodeId}, ${d.value.toFixed(3)}`,
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

        const lSvg = d3.select(legendRef.current)
            .append('svg')
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
    };
      

return (
    <Card title="NODE BEHAVIOR VIEW" size="small" style={{ height: "auto" }}>
        <div style={{ display:'flex', position:'relative' }}>
            <div ref={yAxisRef} style={{ flex:'none' }} />
            <div ref={heatmapRef} style={{overflowX: 'auto', overflowY: 'hidden', flex: 1}}/>
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

export default MRDMDView;