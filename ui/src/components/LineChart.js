import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { getColor } from '../utils/colors.js';

const LineChart = ({ data, field, index, selectedPoints, setHoveredPoint }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 800, height: 300 });
    const [chartId, setChartId] = useState(index);
    const chartdata = data;
    // const [isLocalHover, setIsLocalHover] = useState(false);
    const [tooltip, setTooltip] = useState({
            visible: false,
            content: '',
            x: 0,
            y: 0
        });

    useEffect(() => {
      console.log('rerendering');
      if (!svgContainerRef.current || !data) return;
      const margin = { top: 40, right: 60, bottom: 60, left: 70 };

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
        .domain(d3.extent(filtered, d => d.timestamp))
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
          .tickFormat(d3.utcFormat('%H:%M'))
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
      
      focus.selectAll('.line')
        .data(groupedData)
        .enter()
        .append('path')
        .attr('class', (d) => `line line-${chartId}`)
        .attr('nodeId', d => d[0])
        .attr('fill', 'none')
        .attr('stroke', (d) => getColor('default'))
        .attr('stroke-width', 1)
        .attr('d', d => line(d[1]))
        .on('mouseover', function(event, d) {
          // setIsLocalHover(true);
          const tooltipWidth = 150; 
          const windowWidth = window.innerWidth; 
          
          let tooltipX = event.clientX + 5;  
          if (tooltipX + tooltipWidth > windowWidth) {
              tooltipX = event.clientX - tooltipWidth - 5;  
          }
          // This causes every single component that takes hoveredPoint as a prop to rerender.
          // setHoveredPoint(d[0]);
          d3.select(this)
              .style("stroke-width", 3)
              .style("opacity", 1)
              .attr('stroke', (d) => getColor('select'));

          // This causes a rerender on every hover. Even though the graph is not redrawn, when lines are
          // super close together it can trigger tons of component rerenders just by moving the mouse
          // over the graph. Need to debounce this somehow or excessive rerenders will crash the page.
          // setTooltip({
          //   visible: true,
          //   content: `${d[0]}`,
          //   x: tooltipX,
          //   y: event.clientY
          // });
          
        })
        .on('mouseout', function(event, d) {
            // setIsLocalHover(false);

            // This causes every single component that takes hoveredPoint as a prop to rerender.
            // setHoveredPoint(null);

            d3.select(this)
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .attr('stroke', (d) => getColor('default'));

            // This causes a rerender on every hover. Even though the graph is not redrawn, when lines are
            // super close together it can trigger tons of component rerenders just by moving the mouse
            // over the graph. Need to debounce this somehow or excessive rerenders will crash the page.
            // setTooltip({ visible: false, content: '', x: 0, y: 0 }); 
        });
        
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
      
      }, [data, field, index, selectedPoints]);

      // const updateChart = (newDomain) => {
      //   const chart = d3.select(`#focus-line-${chartId}`);
      //   const xScale = chart.node()?.xScale;
      //   const yScale = chart.node()?.yScale;

      //   // Causes OOM crash.
      //   const newdata = chartdata.filter(d => selectedNodes.has(d.nodeId) && d.timestamp >= newDomain[0] && d.timestamp <= newDomain[1]);

      //   if (!xScale || !yScale) return;

      //   if (newdata.length == 0) return;

      //   // updating scales
      //   xScale.domain(newDomain);
        
      //   let newY = d3.extent(newdata.map(v => v.value));
      //   yScale.domain([0, newY[1]])

      //   const t = d3.transition()
      //       .duration(400) 
      //       .ease(d3.easeCubicInOut);

      //   // updating x axes
      //   // chart.select('.x-axis').call(d3.axisBottom(xScale));
      //   chart.select('.y-axis').transition(t).call(d3.axisLeft(yScale).ticks(size.height / 40))
        
      //   chart.select('.y-axis')
      //     .selectAll("text")
      //     .style("font-size", "16px")

      //   // updating line
      //   chart.select(`.line-${chartId}`)
      //     .datum(newdata)
      //     .transition()
      //     .duration(500)
      //     // .ease(d3.easeLinear)
      //     .attr("d", d3.line()
      //         .x(d => xScale(d.timestamp))
      //         .y(d => yScale(d.value))
      //     )
      // };    
      return <div ref={svgContainerRef} style={{ width: 'auto', height: '190px' }}></div>;

};

export default LineChart;