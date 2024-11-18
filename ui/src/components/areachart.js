import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';

const AreaChart = ({ data, field }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 600, height: 300 });
    
    useEffect(() => {
      if (!svgContainerRef.current || !data || !data[field] || Object.keys(data[field]).length === 0) return;
      
      const timeFormat = d3.timeFormat('%H:%M');
      // const timeParse = d3.timeParse('%Y-%m-%d %H:%M:%S');
      const margin = { top: 60, right: 60, bottom: 60, left: 70 };

      d3.select(svgContainerRef.current).selectAll("*").remove();

      const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

      let chartdata = [];

      Object.keys(data[field]).forEach(obj => {
        chartdata.push({
          timestamp: new Date(parseInt(obj)),
          value: data[field][obj]
        })
      });
      
      const xScale = d3.scaleUtc()
        .domain(d3.extent(chartdata, d => d.timestamp))
        .range([margin.left, size.width - margin.right])
        // .padding(0.1);

      const yScale = d3.scaleLinear()
          .domain([0, d3.max(chartdata.map(v => v.value))])
          .range([size.height - margin.bottom, margin.top]);
      
      const xAxis = d3.axisBottom(xScale)
          .tickFormat(timeFormat)
          .tickSizeOuter(0);
      
      const yAxis = d3.axisLeft(yScale).ticks(size.height / 40);

      svg.append("g")
          .attr("class", "x-axis")
          .attr("transform", `translate(0,${size.height - margin.bottom})`)
          .call(xAxis);

      // X axis label
      svg.append('text')
        .attr("x", size.width/2)
        .attr("y", size.height - 10)
        .style('text-anchor', 'middle')
        .text('Time (hh:mm)')
        .style('font-size', '14px');

      svg.append("g")
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
              .text("Count")); // Y label

      svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", size.width )
        .attr("height", size.height )
        .attr("x", 0)
        .attr("y", 0);             

      var areaGenerator = d3.area()
        .x(function(d) { return xScale(d.timestamp) })
        .y0(yScale(0))
        .y1(function(d) { return yScale(d.value) })
    
      var area = svg.append('g')
        .attr("clip-path", "url(#clip)")

      area.append("path")
          .datum(chartdata)
          .attr("class", "myArea")  
          .attr("fill", "#69b3a2")
          .attr("fill-opacity", .3)
          .attr("stroke", "black")
          .attr("stroke-width", 1)
          .attr("d", areaGenerator );

      // adding brushing
      // const brush = d3.brushX()
      //   .extent([[margin.left, margin.top], [size.width - margin.right, size.height - margin.bottom]])
      //   .on("end", updateChart);

      // svg.append("g")
      //     .attr("class", "brush")
      //     .call(brush);

      // function updateChart(event) {
      //   const selection = event.selection;
      //   if (selection) {
      //       const [x0, x1] = selection.map(xScale.invert);
      //       xScale.domain([x0, x1]);
      //       svg.select(".x-axis").call(xAxis);

      //       svg.select("path")
      //           .datum(chartdata)
      //           .attr("d", areaGenerator);
      //   } else {
      //       xScale.domain(d3.extent(chartdata, d => d.timestamp));
      //       svg.select(".x-axis").call(xAxis);
      //       svg.select("path")
      //           .datum(chartdata)
      //           .attr("d", areaGenerator);
      //       }
      //   }
      
      }, [data, field]);
    
      return <div ref={svgContainerRef} style={{ width: '100%', height: '400px' }}></div>;

    };
    
export default AreaChart;