import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { getColor } from '../utils/colors.js';
import Tooltip from '../utils/tooltip.js';

const LineChart = ({ data, field, index }) => {
    // console.log(`rendering line chart ${index} for field ${field}`, data);
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 700, height: 300 });
    const [chartId, setChartId] = useState(index);
    const chartdata = data;
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });

    useEffect(() => {
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
      
      const lines = focus.selectAll('.line')
        .data(groupedData)
        .enter()
        .append('path')
        .attr('class', (d) => `line line-${chartId}`)
        .attr('nodeId', d => d[0])
        .attr('fill', 'none')
        .attr('stroke', (d) => getColor('default'))
        .attr('stroke-width', 1)
        .attr('d', d => line(d[1]))
        .style("stroke-dasharray", function() {
            const totalLength = this.getTotalLength();
            return `${totalLength} ${totalLength}`;
        })
        .style("stroke-dashoffset", function() {
            return this.getTotalLength();
        })
        .on('mouseover', function(event, d) {    
          d3.select(this)
              .style("stroke-width", 3)
              .style("opacity", 1)
              .attr('stroke', (d) => getColor('select'));

          d3.select(`#${d[0]}`) 
              .transition()
              .duration(150)
              .attr("r", 8)  
              .style("opacity", 1)    

          setTooltip({
              visible: true,
              content: d[0],
              x: event.clientX,
              y: event.clientY,
          });
        })
        .on('mouseout', function(event, d) {
            d3.select(this)
                .style("stroke-width", 1)
                .style("opacity", 0.7)
                .attr('stroke', (d) => getColor('default'));

            d3.select(`#${d[0]}`)
              .transition()
              .duration(150)
              .attr("r", 4) 
              .style("opacity", 0.7)

            setTooltip(prev => ({
                ...prev,
                visible: false,
            }));
        });

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
  
      return (<div>
                 <div ref={svgContainerRef} style={{ width: 'auto', height: '190px' }}></div>
                 <Tooltip
                    visible={tooltip.visible}
                    content={tooltip.content}
                    x={tooltip.x}
                    y={tooltip.y}
                    tooltipId={`line-${index}-tooltip`}
                 />
              </div>);

};

export default LineChart;