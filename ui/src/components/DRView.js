import React, { useState, useEffect, useRef } from 'react';
import { getColor } from '../utils/colors.js';
import LassoSelection from '../utils/lasso.js';
import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import Tooltip from '../utils/tooltip.js';
import * as d3 from 'd3';

const DR = ({ data, type, setSelectedPoints, selectedPoints, hoveredPoint, setHoveredPoint }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [size, setSize] = useState({ width: 470, height: 280 });
    // const [selectedPoints, setSelectedPoints] = useState([]);
    const [method1, setMethod1] = useState("PC");
    const [method2, setMethod2] = useState("UMAP");
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });

    useEffect(() => {
        if (!svgContainerRef.current || !data ) return;

        d3.select(svgContainerRef.current).selectAll("*").remove();
        setChartData(data);
        const { w, h } = svgContainerRef.current.getBoundingClientRect();
        setSize({ w, h });
        
        const margin = { top: 10, right: 30, bottom: 30, left: 40 };
        const width = size.width;
        const height = size.height;

        const xKey = method2 + '1';
        const yKey = method2 + '2';

        const xScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d[xKey]) - 1, d3.max(data, d => +d[xKey]) + 1])
            .range([margin.left, width - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d[yKey]) - 1, d3.max(data, d => +d[yKey]) + 1])
            .range([height - margin.bottom, margin.top]);
        
        const xAxis = d3.axisBottom(xScale);
        
        const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `dr-chart-svg-${type}`)
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");
        
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(xAxis);

        // x axis label
        svg.append('text')
            .attr('id', 'x-axis-label-dr')
            .attr("x", width/2)
            .attr("y", height)
            .style('text-anchor', 'middle')
            .text(xKey)
            .style('font-size', '12px');


        const yAxis = d3.axisLeft(yScale).ticks(height / 40);
        svg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},0)`)
            .call(yAxis)
            .call(g => g.append("text")
                .attr('id', 'y-axis-label-dr')
                .attr("x", -height/2)
                .attr("y", -margin.right)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
                .attr("transform", "rotate(-90)")
                .style('font-size', '12px')
                .text(yKey)); // Y label

        let circs = svg.selectAll(".dr-circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", (d, i) => "dr-circle")
            .attr('id', (d, i) => `${d.Measurement}`)
            .attr("cx", d => xScale(d[xKey]))
            .attr("cy", d => yScale(d[yKey]))
            .attr('stroke','black')
            .attr('stroke-width', '1px')
            .attr("r", 3)
            .style('fill', getColor('default'))
            .on("mouseover", function (event, d) {
                setHoveredPoint(d.Measurement); 

            })
            .on("mouseout", function (event, d) {
                setHoveredPoint(null);

                setTooltip({
                    visible: false,
                    content: '',
                    x: 0,
                    y: 0,
                  });
            })
            .style('opacity', 0);

            circs
                .transition()
                .duration(800)
                .style("opacity", 1);

            svg.node().xScale = xScale;
            svg.node().yScale = yScale;
    
        return () => {
            svg.remove();
        };
        
    }, [data, type]);

    useEffect(() => {
        d3.select(svgContainerRef.current)
            .selectAll(".dr-circle")
            .transition()
            .duration(300)
            .style("fill", d => selectedPoints.includes(d.Measurement) ? getColor('select') : getColor('default'))
            .style("opacity", d => selectedPoints.includes(d.Measurement) ? 1 : 0.7);
    }, [selectedPoints]); 

    useEffect(() => {
        d3.select(svgContainerRef.current)
            .selectAll(".dr-circle")
            .transition()
            .duration(150)
            .attr("r", d => d.Measurement === hoveredPoint ? 6 : 3)  
            .style("opacity", d => d.Measurement === hoveredPoint ? 1 : 0.7);
    }, [hoveredPoint]);

    useEffect(() => {
        if (hoveredPoint) {
          const circleNode = d3.select(svgContainerRef.current).select(`#${hoveredPoint}`).node();
          if (circleNode) {
            const bbox = circleNode.getBoundingClientRect();
            let tooltipX = bbox.x + bbox.width + 5;
            let tooltipY = bbox.y + bbox.height / 2;
            const tooltipWidth = 150; 
            
            const containerRect = svgContainerRef.current.getBoundingClientRect();
            if (tooltipX + tooltipWidth > containerRect.right) {
              tooltipX = bbox.x - tooltipWidth - 5;
            }
            
            setTooltip({
              visible: true,
              content: hoveredPoint,
              x: tooltipX,
              y: tooltipY,
            });
          }
        } else {
          setTooltip({ visible: false, content: '', x: 0, y: 0 });
        }
      }, [hoveredPoint]);
      
      

    const updateChart = (method1, method2) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        setMethod1(method1)
        setMethod2(method2)

        const xKey = method2 + '1';
        const yKey = method2 + '2';

        const xScale = chart.node()?.xScale;
        const yScale = chart.node()?.yScale;

        xScale.domain([d3.min(data, d => +d[xKey]) - 1, d3.max(data, d => +d[xKey]) + 1])
        yScale.domain([d3.min(data, d => +d[yKey]) - 1, d3.max(data, d => +d[yKey]) + 1])

        chart.select("#x-axis-label-dr")
            .text(xKey);

        chart.select("#y-axis-label-dr")
            .text(yKey);

        const t = d3.transition()
            .duration(400) 
            .ease(d3.easeCubicInOut);
        
        chart.select('.x-axis').call(d3.axisBottom(xScale));
        chart.select('.y-axis').transition(t).call(d3.axisLeft(yScale));

        chart.selectAll(".dr-circle")
            .data(data)
            .join("circle")  
            .transition()
            .duration(1000)
            .attr("cx", d => xScale(+d[xKey]))
            .attr("cy", d => yScale(+d[yKey]))
    }

    const handleSelection = (selected) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        
        console.log("Selected Items:", selected);
        setSelectedPoints(selected)
        
        chart.selectAll('.dr-circle')
            .style('fill', (d) => (
                selected.includes(d.Measurement) ? getColor('select') : getColor('default')
            ))
            .style("opacity", (d) => selected.includes(d.Measurement) ? 1 : 0.7);

        // updating parallel coordinates plot
        const coordChart = d3.select("#coord-svg"); 
        coordChart.selectAll(".line")
            .style("stroke", (d) => selected.includes(d.Measurement) ? getColor('select') : getColor('default'))
            .style("opacity", (d) => selected.includes(d.Measurement) ? 1 : 0.5);
    };

    return (
        <div id="chart-container">
            {type == 'feature' ? (
                <h4 style={{ marginBottom: 0}}>{method1} Across Time Points</h4>
            ) : (
                <h4 style={{ marginBottom: 0}}>{method1} Across Features</h4>
            )}
            <div ref={svgContainerRef} style={{ width: '100%', height: '280px' }}>
                <LassoSelection svgRef={svgContainerRef} targetItems={".dr-circle"} onSelect={handleSelection} />
            </div>
            <Tooltip
                visible={tooltip.visible}
                content={tooltip.content}
                x={tooltip.x}
                y={tooltip.y}
            />
            <div id="form-container" style={{display: 'flex', flexDirection: 'row', minWidth: 150 }}>
                <FormControl variant="standard" sx={{ m: 1, minWidth: 120, marginTop: 0 }}>
                    <InputLabel>DR1 Method</InputLabel>
                    <Select
                        value={method1}
                        onChange={(e) => {
                            updateChart(e.target.value, method2);
                        }}
                    >
                        <MenuItem value="UMAP">UMAP</MenuItem>
                        <MenuItem value="tSNE">t-SNE</MenuItem>
                        <MenuItem value="PC">PCA</MenuItem>
                    </Select>
                </FormControl>
                <FormControl variant="standard" sx={{ m: 1, minWidth: 120, float: 'left', marginTop: 0 }}>
                    <InputLabel>DR2 Method</InputLabel>
                    <Select
                        value={method2}
                        onChange={(e) => {
                            updateChart(method1, e.target.value);
                        }}
                    >
                        <MenuItem value="UMAP">UMAP</MenuItem>
                        <MenuItem value="tSNE">t-SNE</MenuItem>
                        <MenuItem value="PC">PCA</MenuItem>
                    </Select>
                </FormControl>
            </div>
        </div>
        );

}

export default DR;