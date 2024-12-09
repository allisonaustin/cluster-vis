import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { COLORS, getColor, generateColor } from '../utils/colors.js';
import * as d3 from 'd3';

const AreaChart = ({ data, field, index, chartType }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 600, height: 300 });
    const [chartId, setChartId] = useState(index);
    const [type, setType] = useState(chartType);
    const [chartdata, setChartData] = useState([]);
    
    useEffect(() => {
      if (!svgContainerRef.current || !data || !data[field] || Object.keys(data[field]).length === 0) return; 
      
      const timeFormat = d3.timeFormat('%H:%M');
      // const timeParse = d3.timeParse('%Y-%m-%d %H:%M:%S');
      const margin = { top: 40, right: 60, bottom: 60, left: 70 };

      d3.select(svgContainerRef.current).selectAll("*").remove();

      const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `${type}-${index}-svg`)
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

      svg.append('defs')
        .append('clipPath')
          .attr('id', 'clip')
        .append('rect')
          .attr('width', size.width)
          .attr('height', size.height)

      const focus = svg.append('g')
        .attr('class', 'focus')
        .attr('id', `focus-${type}-${index}`)

      let chartdata = [];

      Object.keys(data[field]).forEach(obj => {
        chartdata.push({
          timestamp: new Date(parseInt(obj)),
          value: data[field][obj]
        })
      });

      setChartData(chartdata);
        
      const start = chartdata[Math.floor(chartdata.length * 0.3)].timestamp;
      const end = chartdata[Math.floor(chartdata.length * 0.5)].timestamp;
      const filtered = chartdata.filter(d => d.timestamp >= start && d.timestamp <= end);

      const xScale = d3.scaleTime()
        .domain(d3.extent(filtered, d => d.timestamp))
        .range([margin.left, size.width - margin.right])

      const yScale = d3.scaleLinear()
          .domain([0, d3.max(filtered.map(v => v.value))])
          .range([size.height - margin.bottom, margin.top]);
      
      const xAxis = d3.axisBottom(xScale)
          .tickFormat(timeFormat)
          .tickSizeOuter(0);

      focus.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${size.height - margin.bottom})`)
        .call(xAxis);
      
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

      var areaGenerator = d3.area()
        .x(function(d) { return xScale(d.timestamp) })
        .y0(yScale(0))
        .y1(function(d) { return yScale(d.value) })

      const line = d3.line()
        .x(function(d) { return xScale(d.timestamp) })
        .y(function(d) { return yScale(+d.value) })

      focus.append('path')
        .datum(filtered)
        .attr('id', (d, i) => `line-${i}`)
        .attr('class', `line ${type} ${index}`)
        .attr('clip-path', 'url(#clip)')
        .style('fill', getColor('default'))
        .style('stroke', 'black')
        .style('stroke-width', 0.5)
        .attr("fill-opacity", .3)
        .attr('d', areaGenerator)


      focus.append("text")
        .attr("class", "grid-title")
        .attr("x", size.width / 2)
        .attr("y", 0)
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("fill", "black")
        .style('font-size', '12')
        .text(field);

      focus.node().xScale = xScale;
      focus.node().yScale = yScale;
      
      }, [data, field, index, chartType]);

      const updateChart = (newDomain) => {
        const chart = d3.select(`#focus-${type}-${chartId}`);
        const xScale = chart.node()?.xScale;
        const yScale = chart.node()?.yScale;

        const newdata = chartdata.filter(d => d.timestamp >= newDomain[0] && d.timestamp <= newDomain[1]);

        if (!xScale || !yScale) return;

        if (newdata.length == 0) return;

        // updating scales
        xScale.domain(newDomain);
        
        let newY = d3.extent(newdata.map(v => v.value));
        if (newY[1] != 0) {
          yScale.domain([0, newY[1] + 1])
        } else {
          yScale.domain([0, newY[1]])
        }

        // updating x axes
        // chart.select('.x-axis').call(d3.axisBottom(xScale));
        chart.select('.y-axis').call(d3.axisLeft(yScale));

        // updating line
        chart.select('.line')
            .datum(newdata)
            .attr('d', d3.area()
              .x(function(d) { return xScale(d.timestamp) })
              .y0(yScale(0))
              .y1(function(d) { return yScale(d.value) })
            );
      };

      const handleUpdateEvent = (event) => {
        const { detail: newDomain } = event;
        updateChart(newDomain);
      };

      window.addEventListener(`update-chart-${type}-${chartId}`, handleUpdateEvent);
    
      return <div ref={svgContainerRef} style={{ width: '100%', height: '280px' }}></div>;

};
    
export default AreaChart;