import { Card } from "antd";
import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { generateColor } from '../utils/colors.js';

const TimelineView = ({ mgrData, bStart, bEnd, nodeDataStart, nodeDataEnd }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 700, height: 150 });
    const xScaleRef = useRef(null); 
    const [brushStart, setBrushStart] = useState(new Date(bStart));
    const [brushEnd, setBrushEnd] = useState(new Date(bEnd));
    const [currentDate, setCurrentDate] = useState(null);
    // TODO: any reason we still need this instead of just hardcoding Activity_P1?
    const [fields, setFields] = useState(['Activity_P1']);
    
    useEffect(() => {
      if (!svgContainerRef.current || !mgrData || !nodeDataStart ) return;
      
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

      let chartdata = {};

      fields.forEach((field, idx) => {
        if (mgrData[field] && typeof mgrData[field] === "object") { 
            chartdata[field] = [];
            
            Object.keys(mgrData[field]).forEach((unixTimestamp) => {
                let date = new Date(parseInt(unixTimestamp));
                let value = mgrData[field][unixTimestamp];

                chartdata[field].push({
                    timestamp: date, 
                    row: value === 0 ? 0 : idx, 
                    nodeId: 'mgr-01',
                    value: value
                });
            });
        }
    });
    // console.log(chartdata);
    // console.log(chartdata['Activity_P1'].map(d => d.timestamp.getTime()));
    const chartDataStart = d3.min(chartdata[fields[0]], d => d.timestamp);
    const chartDataEnd = d3.max(chartdata[fields[0]], d => d.timestamp);
    console.log('min/max from mgrData (UTC)', chartDataStart.toUTCString(), chartDataEnd.toUTCString());
    console.log('min/max from nodeData (UTC)', nodeDataStart.toUTCString(), nodeDataEnd.toUTCString());
    const startTime = new Date(Math.max(chartDataStart.getTime(), nodeDataStart.getTime()));
    const endTime = new Date(Math.min(chartDataEnd.getTime(), nodeDataEnd.getTime()));
    console.log(`time range (UTC) with both node and mgr data available: ${startTime.toUTCString()}, ${endTime.toUTCString()}`);
    console.log('Plotting timeline with min/max timestamps from nodeData');
    const dataInTimeRange = chartdata['Activity_P1'].filter(d => d.timestamp >= nodeDataStart && d.timestamp <= nodeDataEnd);
    
      const xScale = d3.scaleTime()
        .domain([new Date(nodeDataStart), new Date(nodeDataEnd)])
        .range([margin.left, size.width - margin.right - 20])
        // .padding(0.1);

      xScaleRef.current = xScale; 

      const yScale = d3.scaleLinear()
          .domain([0, 4])
          .range([size.height - margin.bottom, margin.top]);
      
      const xAxis = d3.axisBottom(xScale)
          .tickFormat(d3.utcFormat('%H:%M'))
          .tickSizeOuter(0);
      
      const yAxis = d3.axisLeft(yScale);

      svg.append("g")
          .attr("class", "x-axis2")
          .attr("transform", `translate(0,${size.height - margin.bottom})`)
          .call(xAxis);

      svg.append("g")
        .attr("class", "y-axis")
          .attr("transform", `translate(${margin.left},0)`)
          .call(yAxis)
          .call(g => g.select(".domain").remove())
          .call(g => g.selectAll(".tick").remove())
        //   .call(g => g.selectAll(".tick line").clone()
        //       .attr("x2", size.width - margin.left - margin.right - 20)
        //       .attr("stroke-opacity", 0.1))

      svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", size.width )
        .attr("height", size.height )

      // adding areas

      var areaGenerator = d3.area()
        .x(function(d) { return xScale(d.timestamp) })
        .y0(function(d) { return d.value !== 0 ? yScale(d.row + .2) : 0;  })
        .y1(function(d) { return d.value !== 0 ? yScale(d.row + 1) : 0; })
        .curve(d3.curveCardinal);

    svg.append('path')
        .datum(dataInTimeRange)
        .attr('class', `context-Activity_P1`)
        .attr('clip-path', 'url(#clip)')
        .style('fill', (d, i) => generateColor(i))
        .attr("fill-opacity", 0.6)
        .attr('d', areaGenerator)

    // adding legend
    const legend = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(0, 0)`)

    fields.forEach((field, i) => {
        const legendItem = legend.append('g')
            .attr('transform', `translate(0, ${i * 80})`)
            .on('mouseover', function() {
                svg.selectAll('path')
                    .transition().duration(200)
                    .attr('fill-opacity', 0);
    
                svg.selectAll(`.context-${field}`)
                    .transition().duration(200)
                    .attr('fill-opacity', 0.6)
            })
            .on('mouseout', function() {
                svg.selectAll('path')
                    .transition().duration(200)
                    .attr('fill-opacity', 0.6);
            });
        
        legendItem.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', generateColor(i))
            .attr('fill-opacity', 0.6)
        
        legendItem.append('text')
            .attr('x', 20)
            .attr('y', 7)
            .text(field)
            .style('font-size', '10px')
            .attr('alignment-baseline', 'middle')
            .style("font-size", "14px")
    })

    // const formattedDate = dateFormat(start);
    // setCurrentDate(formattedDate)
    // legend.append("text")
    //     .attr("class", "date-text")
    //     .attr("x", 20)
    //     .attr("y", 0) 
    //     .text(`Date: ${formattedDate}`)
    //     .style("font-size", "10px")

     // adding brush

      const defaultWindow = [
        xScale(brushStart),
        xScale(brushEnd)
      ]

      const earliestNodeDataTime = xScale(new Date(nodeDataStart)) || 0;
      const brush = d3.brushX(xScale)
        .extent([[Math.max(margin.left, earliestNodeDataTime), 20 ], [size.width - margin.right - 20, size.height - margin.bottom + margin.top]])
        // .on('brush', (event) => brushed(event, chartdata))
        .on('end', (event) => {
            const selection = event.selection;
            if (selection) {
                const [start, end] = selection.map(xScale.invert);
                setBrushStart(start);
                setBrushEnd(end);
                updateCharts([start, end]);
            }
        })
    
        svg.append('g')
            .attr('class', 'x-brush')
            .attr('transform', `translate(0, ${-margin.top})`)
            .call(brush)
            .call(brush.move, defaultWindow)
      
      }, [mgrData, nodeDataStart]);

    const updateCharts = (newDomain) => {
        const chart = d3.select(`#focus-line-1`);
        const xScale = chart.node()?.xScale;
        const utcFormat = d3.utcFormat('%H:%M');
        const dateFormat = d3.utcFormat('%Y-%m-%d');

        if (!xScale) {
            return
        }

        const newStartDate = dateFormat(newDomain[0]);
        // updating the displayed date only if it's different
        if (newStartDate !== currentDate) {
            setCurrentDate(newStartDate);

            d3.select('.date-text')
                .text(`Date: ${newStartDate}`);
        }
        
        const t = d3.transition()
            .duration(400) 
            .ease(d3.easeCubicInOut);
            
        // updating x axes
        xScale.domain(newDomain)

        const steps = 6;
        const [minDate, maxDate] = xScale.domain();
        const stepMs = (maxDate - minDate) / (steps - 1);
        const tickVals = [];
        for (let i = 0; i < steps; i++) {
          tickVals.push(new Date(minDate.getTime() + i * stepMs));
        }

        d3.selectAll('.focus .x-axis')
            .transition(t)
            .call(d3.axisBottom(xScale).tickValues(tickVals).tickFormat(utcFormat).tickSizeOuter(0))
            .selectAll('text')
            .style('font-size', '16px');

        // updating charts
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('batch-update-charts', { detail: newDomain }));
            // console.log("Batch update triggered asynchronously. Selecting new time range: ", newDomain);
        }, 0);

      };

      return  (
        <Card title="TIMELINE VIEW" size="small" style={{ height: 'auto' }}>
            <div ref={svgContainerRef} style={{ width: '100%', height: '90%' }}></div>
        </Card>
      );
    };
    
    
export default TimelineView;
