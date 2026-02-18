import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { colorScale } from '../utils/colors.js';

const LineChart = ({ data, field, baselinesRef, selectedTimeRange, updateBaseline, nodeClusterMap, metadata, registerChart, showBaselines }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 800, height: 300 });
    const [margin, setMargin] = useState({ top: 40, right: 60, bottom: 60, left: 70 });
    
    const xScaleRef = useRef();
    const yScaleRef = useRef();
    const brushGroupRef = useRef();

    const isUserBrush = useRef(false);

    useEffect(() => {
      if (!svgContainerRef.current || !data) return;

      const svg = d3.select(svgContainerRef.current).select("svg").empty()
        ? d3.select(svgContainerRef.current).append("svg")
        : d3.select(svgContainerRef.current).select("svg");

      svg.attr("viewBox", `0 0 ${size.width} ${size.height}`)
        .style("width", "100%")
        .style("height", "100%");

      const xScale = d3.scaleTime().domain(selectedTimeRange).range([margin.left, size.width - margin.right]);
      const yScale = d3.scaleLinear().domain([0, d3.max(data, d => d.value) || 1]).range([size.height - margin.bottom, margin.top]);
      
      xScaleRef.current = xScale;
      yScaleRef.current = yScale;

      if (svg.select(".x-axis").empty()) {
        svg.append("g")
          .attr("class", "x-axis")
          .attr("transform", `translate(0, ${size.height - margin.bottom})`)
          .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat("%H:%M")))
          .selectAll("text")       
          .style("font-size", "16px");
      }

      if (svg.select(".y-axis").empty()) {
        svg.append("g")
          .attr("class", "y-axis")
          .attr("transform", `translate(${margin.left}, 0)`)
          .call(d3.axisLeft(yScale))
          .selectAll("text")       
          .style("font-size", "16px");
      }

      const line = d3.line().x(d => xScale(new Date(d.timestamp))).y(d => yScale(d.value));
      const grouped = d3.group(data, d => d.nodeId);

      const clipId = `clip-${field.replace(/\s+/g, '-')}`; // Unique ID per chart
      if (svg.select("defs").empty()) {
        svg.append("defs").append("clipPath")
          .attr("id", clipId)
          .append("rect")
          .attr("x", margin.left)
          .attr("y", margin.top)
          .attr("width", size.width - margin.left - margin.right)
          .attr("height", size.height - margin.top - margin.bottom);
      }

      if (svg.select(".lines").empty()) {
        svg.append("g")
          .attr("class", "lines")
          .attr("clip-path", `url(#${clipId})`); 
      }
      
      svg.select(".lines").selectAll(".line").data(Array.from(grouped), d => d[0])
          .join("path").attr("class", "line").attr("fill", "none")
          .attr("stroke", d => colorScale(nodeClusterMap.get(d[0])))
          .attr("d", d => line(d[1]));

      svg.selectAll(".chart-title").data([field]).join("text")
        .attr("class", "chart-title")
        .attr("x", size.width / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .text(d => d);

      // Y-Axis Unit Label
      svg.selectAll(".y-label").data([metadata?.units || "Value"]).join("text")
          .attr("class", "y-label")
          .attr("y", 20)
          .attr("x", 50)
          .attr("text-anchor", "middle")
          .style("font-size", "16px")
          .text(d => d);
      
      if (svg.select(".brush-group").empty()) {
        const brush = d3.brush()
            .extent([[margin.left, margin.top], [size.width - margin.right, size.height - margin.bottom]])
            .on("end", (event) => {
                if (isUserBrush.current || !event.selection) {
                    isUserBrush.current = false;
                    return;
                }
                const [[x0, y0], [x1, y1]] = event.selection;
                const newBaseline = {
                    baselineX: [xScaleRef.current.invert(x0), xScaleRef.current.invert(x1)],
                    baselineY: [yScaleRef.current.invert(y1), yScaleRef.current.invert(y0)]
                };
                updateBaseline(field, newBaseline);
            });

        brushGroupRef.current = svg.append("g")
                                  .attr("class", "brush-group")
                                  .attr("clip-path", `url(#${clipId})`)
                                  .call(brush);
                                  
        brushGroupRef.current.brush = brush; 
      }

      registerChart({ chartEl: svg, xScale, yScale, lines: svg.selectAll(".line"), field, brushGroup: brushGroupRef.current });
      updateBox();
      }, [data, selectedTimeRange, nodeClusterMap]);

    const updateBox = () => {
        const baseline = baselinesRef.current[field];
        if (!baseline || !brushGroupRef.current) return;

        const x0 = xScaleRef.current(new Date(baseline.baselineX[0]));
        const x1 = xScaleRef.current(new Date(baseline.baselineX[1]));
        const yTop = yScaleRef.current(baseline.baselineY[1]);
        const yBottom = yScaleRef.current(baseline.baselineY[0]);

        const isVisible = x1 >= margin.left && x0 <= (size.width - margin.right);

        isUserBrush.current = true; 
        if (isVisible) {
            brushGroupRef.current.call(brushGroupRef.current.brush.move, [[x0, yTop], [x1, yBottom]]);
        } else {
            brushGroupRef.current.call(brushGroupRef.current.brush.move, null);
        }
    };

    useEffect(() => { updateBox(); }, [baselinesRef.current[field]]);

    useEffect(() => {
        if (!brushGroupRef.current) return;

        brushGroupRef.current
            .transition()
            .duration(200)
            .style("opacity", showBaselines ? 1 : 0)
            .style("pointer-events", showBaselines ? "all" : "none"); 
            
    }, [showBaselines]);
  
    return (
      <div>
        <div ref={svgContainerRef} style={{ width: 'auto', height: '190px' }}></div>
    </div>
  );

};

export default LineChart;