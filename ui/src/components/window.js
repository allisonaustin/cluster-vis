import React, { useState, useEffect, useRef } from 'react';
import App from '../App.js';
import * as d3 from 'd3';

const Window = ({ data }) => {

    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 600, height: 140 });
    const xScaleRef = useRef(null); 
    const [brushStart, setBrushStart] = useState(null);
    const [brushEnd, setBrushEnd] = useState(null);
    const [chartData, setChartData] = useState([]);
    
    useEffect(() => {
      if (!svgContainerRef.current || !data) return;
      
      const timeFormat = d3.timeFormat('%H:%M');
      // const timeParse = d3.timeParse('%Y-%m-%d %H:%M:%S');
      const margin = { top: 10, right: 30, bottom: 70, left: 30 };

      d3.select(svgContainerRef.current).selectAll("*").remove();

      const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `context-window`)
          .attr('class', 'context')
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

      let chartdata = [];
      let field = 'Activity_P1';

      Object.keys(data[field]).forEach(obj => {
        chartdata.push({
          timestamp: new Date(parseInt(obj)),
          value: data[field][obj]
        })
      });

      setChartData(chartdata);
      
      const xScale = d3.scaleUtc()
        .domain(d3.extent(chartdata, d => d.timestamp))
        .range([margin.left, size.width - margin.right])
        // .padding(0.1);

    xScaleRef.current = xScale; 

      const yScale = d3.scaleLinear()
          .domain([0, d3.max(chartdata.map(v => v.value))])
          .range([size.height - margin.bottom, margin.top]);
      
      const xAxis = d3.axisBottom(xScale)
          .tickFormat(timeFormat)
          .tickSizeOuter(0);
      
      const yAxis = d3.axisLeft(yScale).ticks(size.height / 40);

      svg.append("g")
          .attr("class", "x-axis2")
          .attr("transform", `translate(0,${size.height - margin.bottom})`)
          .call(xAxis);

    //   svg.append("g")
    //     .attr("class", "y-axis")
    //       .attr("transform", `translate(${margin.left},0)`)
    //       .call(yAxis)
    //       .call(g => g.select(".domain").remove())
    //       .call(g => g.selectAll(".tick line").clone()
    //           .attr("x2", size.width - margin.left - margin.right)
    //           .attr("stroke-opacity", 0.1))

      svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", size.width )
        .attr("height", size.height )

      const start = chartdata[Math.floor(chartdata.length * 0.3)].timestamp;
      const end = chartdata[Math.floor(chartdata.length * 0.5)].timestamp;

      const defaultWindow = [
        xScale(start),
        xScale(end)
      ]

      setBrushStart(start);
      setBrushEnd(end);

      const brush = d3.brushX(xScale)
        .extent([[0, 20 ], [size.width, size.height - margin.bottom]])
        // .on('brush', (event) => brushed(event, chartdata))
        .on('brush end', (event) => {
            const selection = event.selection;
            if (selection) {
                const [start, end] = selection.map(xScale.invert);
                setBrushStart(start);
                setBrushEnd(end);
                updateAreaChart([start, end]);
            }
        })
    
        svg.append('g')
            .attr('class', 'x-brush')
            .call(brush)
            .call(brush.move, defaultWindow)
      
      }, [data]);

    const updateAreaChart = (newDomain) => {
        const chart = d3.select(`#focus-perf-1`);
        const xScale = chart.node()?.xScale;

        if (!xScale) {
            return
        }
        
        // updating x axes
        xScale.domain(newDomain)
        d3.selectAll('.focus .x-axis').call(d3.axisBottom(xScale));

        // updating charts
        Object.keys(data).forEach((field, i) => {
            window.dispatchEvent(new CustomEvent(`update-chart-perf-${i}`, { detail: newDomain }));
            window.dispatchEvent(new CustomEvent(`update-chart-trigger-${i}`, { detail: newDomain }));
        })
      };

      return <div ref={svgContainerRef} style={{ width: '100%', height: '100%' }}></div>;

    };
    
    
export default Window;
