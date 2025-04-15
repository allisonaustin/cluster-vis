import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { getColor, colorScale } from '../utils/colors.js';
import Tooltip from '../utils/tooltip.js';

const LineChart = ({ data, field, index, baselinesRef, updateBaseline, nodeClusterMap }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 800, height: 300 });
    const [margin, setMargin] = useState({ top: 40, right: 60, bottom: 60, left: 70 });
    const [chartId, setChartId] = useState(index);
    const prevX = useRef([]); // for storing window values, might be clamped versions of baseline values 
    const prevY = useRef([]); 
    const chartdata = data;
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });
    const skipBrush = useRef(false);

    useEffect(() => {
      if (!svgContainerRef.current || !data) return;
      d3.select(svgContainerRef.current).selectAll("*").remove();

      const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `line-${index}-svg`)
          .attr('class', 'line-svg')
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

      svg.append('defs')
        .append('clipPath')
        .attr('id', `clip-line-${index}`)
        .append('rect')
        .attr('x', margin.left)  
        .attr('y', margin.top)   
        .attr('width', size.width - margin.left - margin.right)
        .attr('height', size.height - margin.top - margin.bottom);
    

      const focus = svg.append('g')
        .attr('class', 'focus')
        .attr('id', `focus-line-${index}`)

      const filtered = chartdata;

      const groupedData = d3.group(filtered, d => d.nodeId);

      const xScale = d3.scaleTime()
        .domain(d3.extent(filtered, d => new Date(d.timestamp)))
        .range([margin.left, size.width - margin.right]);
        
        const steps = 6;
        const [minDate, maxDate] = xScale.domain();
        const stepMs = (maxDate - minDate) / (steps - 1);
        const tickVals = [];
        for (let i = 0; i < steps; i++) {
          tickVals.push(new Date(minDate.getTime() + i * stepMs));
        }
        
      const yScale = d3.scaleLinear()
          .domain([0, d3.max(filtered.map(v => v.value))])
          .range([size.height - margin.bottom, margin.top]);
      
      const xAxis = d3.axisBottom(xScale)
          .tickValues(tickVals)
          .tickFormat(d3.timeFormat('%H:%M'))
          .tickSizeOuter(0);

      focus.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${size.height - margin.bottom})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", "14px");
      
      const yAxis = d3.axisLeft(yScale).ticks(size.height / 40);

      // X axis label
      focus.append('text')
        .attr("x", size.width/2)
        .attr("y", size.height - 10)
        .style('text-anchor', 'middle')
        .text('Time (hh:mm)')
        .style('font-size', '14px');

      focus.append("g")
        .attr("class", "y-axis")
          .attr("transform", `translate(${margin.left},0)`)
          .call(yAxis)
          .call(g => g.select(".domain").remove())
          .call(g => g.selectAll(".tick line").clone()
              .attr("x2", size.width - margin.left - margin.right)
              .attr("stroke-opacity", 0.1))
          .call(g => g.append("text")
              .attr("x", -margin.left + 5)
              .attr("y", 40)
              .attr("fill", "currentColor")
              .attr("text-anchor", "start")
              .style('font-size', '14px')
              .text("Value")); // Y label   

      focus.select('.y-axis')
          .selectAll("text")
          .style("font-size", "14px")

      const line = d3.line()
        .x(d => xScale(d.timestamp))
        .y(d => yScale(d.value))
      
      const lines = focus.selectAll('.line')
        .data(groupedData)
        .enter()
        .append('path')
        .attr('class', (d) => `line line-${chartId}`)
        .attr('nodeId', d => d[0])
        .attr('fill', 'none')
        .attr('stroke', (d) => { 
          const cluster = nodeClusterMap.get(d[0]);
          return colorScale(+cluster);
        })
        .attr('stroke-width', 1)
        .attr('opacity', 0.8)
        .attr('d', d => line(d[1]))
        .style("stroke-dasharray", function() {
            const totalLength = this.getTotalLength();
            return `${totalLength} ${totalLength}`;
        })
        .style("stroke-dashoffset", function() {
            return this.getTotalLength();
        })

        lines.transition()
          .duration(1000) 
          .ease(d3.easeLinear)
          .style("stroke-dashoffset", 0)
        
      focus.append("text")
        .attr("class", "grid-title")
        .attr("x", size.width / 2)
        .attr("y", 0)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", 'black')
        .style('font-size', '16')
        .text(field);

      focus.node().xScale = xScale;
      focus.node().yScale = yScale;
      
      }, [data, field, index]);

      useEffect(() => {
        // baseline selection
        const brush = d3.brush()
          .extent([[margin.left, margin.top], 
                    [size.width - margin.right, size.height - margin.bottom]]) 
          .on("end", updateBaselineHandler);

        const focus = d3.select(`#focus-line-${index}`)

        if (!focus.node() || !focus.node().xScale || !focus.node().yScale) return;

        focus.select(`.brush-${field}`).remove(); // removing existing brush instances

        const xScale = focus.node()?.xScale;
        const yScale = focus.node()?.yScale;

        function updateBaselineHandler(event) {
          if (skipBrush.current) {
            skipBrush.current = false; 
            return;
          }
          const s = event.selection;
          if (!s) return;
        
          const [x0, y0] = s[0];  
          const [x1, y1] = s[1];

          const start = xScale.invert(x0);
          const end = xScale.invert(x1);
          const valueStart = yScale.invert(y1);
          const valueEnd = yScale.invert(y0);

          // checking which component of baseline needs to be updated
          var newX0 = baselineX[0];
          var newX1 = baselineX[1];
          var newY0 = baselineY[0];
          var newY1 = baselineY[1]; 

          if (prevX.current[0].getTime() !== start.getTime()) {
            newX0 = start;
          }
          if (prevX.current[1].getTime() !== end.getTime()) {
            newX1 = end;
          }
          if (Math.abs(prevY.current[0] - valueStart) > 1e-6) {
            newY0 = valueStart;
          }
          if (Math.abs(prevY.current[1] - valueEnd) > 1e-6) {
            newY1 = valueEnd;
          }

          // no update
          if (newX0 == prevX.current[0] &&
            newX1 == prevX.current[1] && 
            newY0 == prevY.current[0] &&
            newY1 == prevY.current[1]
          ) return;

          // updating prev values
          prevX.current = [newX0, newX1];
          prevY.current = [newY0, newY1];

          // updating baseline
          const newBaseline = {
            baselineX: [newX0, newX1],
            baselineY: [newY0, newY1]
          };
          console.log('updating baseline...', field)
          updateBaseline(field, newBaseline);
        }

        const brushSelection = focus.append('g')
          .attr('class', `brush-${field}`)
          .call(brush);

          const xDomain = xScale.domain();
          const yDomain = yScale.domain();
          const baselineX = baselinesRef.current[field].baselineX; 
          const baselineY = baselinesRef.current[field].baselineY;

          var x0;
          var x1;
          var y0;
          var y1;

          // checking X
          if (baselineX[0] <= xDomain[0]) { // clamp
            x0 = xDomain[0];
          } else if (baselineX[0] > xDomain[0] && baselineX[0] <= xDomain[1]) { // baselineX update
            x0 = baselineX[0];
          } else return; 

          if (baselineX[1] < xDomain[1] && baselineX[1] >= xDomain[0]) {  // baselineX update
            x1 = baselineX[1];
          } else if (baselineX[1] >= xDomain[1] && baselineX[0] < xDomain[1]) { // clamp
            x1 = xDomain[1];
          } else return; 

          // checking Y
          if (baselineY[0] <= yDomain[0]) { // clamp
            y0 = yDomain[0];
          } else if (baselineY[0] > yDomain[0] && baselineY[0] <= yDomain[1]) { // baselineY update
            y0 = baselineY[0];
          } else return; 

          if (baselineY[1] >= yDomain[1]) { // clamp
            y1 = yDomain[1];
          } else if (baselineY[1] < yDomain[1] && baselineY[1] >= yDomain[0]) {  // baselineY update
            y1 = baselineY[1];
          } else return;

          prevX.current = [x0, x1];
          prevY.current = [y0, y1];

          skipBrush.current = true;
          brushSelection
            .call(brush.move, [[xScale(x0), yScale(y1)], [xScale(x1), yScale(y0)]]);
        })
  
      return (
        <div>
          <div ref={svgContainerRef} style={{ width: 'auto', height: '190px' }}></div>
          <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={`line-${index}-tooltip`}
          />
      </div>
    );

};

export default LineChart;