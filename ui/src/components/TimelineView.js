import { Card } from "antd";
import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { generateColor } from '../utils/colors.js';
import Tooltip from '../utils/tooltip.js';

const TimelineView = ({ mgrData, nodeData, bStart, bEnd, nodeDataStart, nodeDataEnd }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 700, height: 220 });
    const xScaleRef = useRef(null); 
    const [brushStart, setBrushStart] = useState(new Date(bStart));
    const [brushEnd, setBrushEnd] = useState(new Date(bEnd));
    const [currentDate, setCurrentDate] = useState(null);
    const [tooltip, setTooltip] = useState({
          visible: false,
          content: '',
          x: 0,
          y: 0
      });
    
    useEffect(() => {
      if (!svgContainerRef.current || !mgrData || !nodeDataStart || !nodeDataEnd ) return;
      
      const margin = { top: 10, right: 30, bottom: 20, left: 50 };

      d3.select(svgContainerRef.current).selectAll("*").remove();

      const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `context-window`)
          .attr('class', 'context')
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

      let chartdata = Array.from(d3.group(nodeData.data, d => d.timestamp), ([key, value]) => ({
            timestamp: key,
            values: value
        }));

    const chartDataStart = new Date(chartdata[0].timestamp);
    const chartDataEnd = new Date(chartdata[chartdata.length-1].timestamp);

    const binWidth = 15 * 60 * 1000;

    let flattenedData = chartdata
        .filter(d => Array.isArray(d.values) && d.values.length > 0) 
        .flatMap(d => 
          d.values.map(v => ({
            timestamp: new Date(d.timestamp),
            down: v.downtime,
            nodeId: v.nodeId
          }))
        );

      const groupedNodes = d3.rollup(
        flattenedData,
        v => new Set(v.map(d => d.nodeId)).size,
        d => Math.floor(d.timestamp.getTime() / binWidth) * binWidth
      );

      const groupedNodesDown = d3.rollup(
        flattenedData,
        v => new Set(v.filter(d => d.down === 1).map(d => d.nodeId)).size, 
        d => Math.floor(d.timestamp.getTime() / binWidth) * binWidth 
      );
      
      const nodesDown = Array.from(groupedNodesDown, ([timestamp, count]) => ({
        timestamp: new Date(timestamp),
        num_nodes: count
      }));
      
      const nodesTotal = Array.from(groupedNodes, ([timestamp, count]) => ({
        timestamp: new Date(timestamp),
        num_nodes: count
      }));

      // chart 1

      const xScale1 = d3.scaleTime()
        .domain([new Date(chartDataStart), new Date(chartDataEnd)])
        .range([margin.left, size.width - margin.right - 20])
        // .padding(0.1);

      xScaleRef.current = xScale1; 

      const yScale1 = d3.scaleLinear()
        .domain([0, d3.max(nodesTotal, d => d.num_nodes)])
        .nice()
        .range([size.height/2 - margin.bottom, margin.top]);
      
      const xAxis1 = d3.axisBottom(xScale1)
          .tickFormat(d3.timeFormat('%H:%M'))
          .tickSizeOuter(0);
      
      const yAxis1 = d3.axisLeft(yScale1);

      svg.append("g")
          .attr("class", "x-axis")
          .attr("transform", `translate(0,${size.height/2 - margin.bottom})`)
          .call(xAxis1);

      svg.append("g")
        .attr("class", "y-axis1")
          .attr("transform", `translate(${margin.left},0)`)
          .call(yAxis1)

      svg.append("text")
        .attr("class", "y-label")
        .attr("text-anchor", "middle")
        .attr("transform", `translate(${margin.left/3},${size.height / 4}) rotate(-90)`)
        .text("Nodes Total");

      svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", size.width )
        .attr("height", size.height/2 )

    svg.selectAll("total-bars")
      .data(nodesTotal)
      .enter().append("rect")
      .attr('class', 'total-bars')
      .attr("x", d => xScale1(d.timestamp))
      .attr("y", d => yScale1(d.num_nodes))
      .attr("width", size.width / nodesTotal.length - 2) 
      .attr("height", d => size.height/2 - margin.bottom - yScale1(d.num_nodes))
      .attr("fill", generateColor(0))
      // .on('mouseover', function(event, d) {
      //   setTooltip({
      //     visible: true,
      //     content: d.num_nodes,
      //     x: event.clientX,
      //     y: event.clientY,
      //   });
      // })
      // .on('mouseout', function(event, d) {
      //   setTooltip(prev => ({
      //     ...prev,
      //     visible: false,
      //   }));
      // });


        // chart 2
        const xScale2 = d3.scaleTime()
          .domain([new Date(chartDataStart), new Date(chartDataEnd)])
          .range([margin.left, size.width - margin.right - 20])
          // .padding(0.1);
  
        xScaleRef.current = xScale2; 
  
        const yScale2 = d3.scaleLinear()
          .domain([0, d3.max(nodesDown, d => d.num_nodes)])
          .nice()
          .range([size.height - margin.bottom, size.height/2]);
        
        const xAxis2 = d3.axisBottom(xScale2)
            .tickFormat(d3.timeFormat('%H:%M'))
            .tickSizeOuter(0);
        
        const yAxis2 = d3.axisLeft(yScale2);
  
        svg.append("g")
            .attr("class", "x-axis2")
            .attr("transform", `translate(0,${size.height - margin.bottom})`)
            .call(xAxis2);
  
        svg.append("g")
          .attr("class", "y-axis2")
            .attr("transform", `translate(${margin.left},0)`)
            .call(yAxis2)
          
          svg.append("text")
            .attr("class", "y-label")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${margin.left / 3},${(size.height / 1.4)}) rotate(-90)`)
            .text("Nodes Down");

        svg.selectAll(".down-bars")
          .data(nodesDown)
          .enter().append("rect")
          .attr('class', 'down-bars')
          .attr("x", d => xScale2(d.timestamp))
          .attr("y", d => yScale2(d.num_nodes))
          .attr("width", size.width / nodesDown.length - 2) 
          .attr("height", d => size.height - margin.bottom - yScale2(d.num_nodes))
          .attr("fill", generateColor(0))
          .on('mouseover', function(event, d) {
            setTooltip({
              visible: true,
              content: d.num_nodes,
              x: event.clientX,
              y: event.clientY,
            });
          })
          .on('mouseout', function(event, d) {
            setTooltip(prev => ({
              ...prev,
              visible: false,
            }));
          });

      // adding brush

      const defaultWindow = [
        xScale2(brushStart),
        xScale2(brushEnd)
      ]

      const earliestNodeDataTime = xScale2(new Date(nodeDataStart)) || 0;

      const brush = d3.brushX(xScale1)
        .extent([[Math.max(margin.left, earliestNodeDataTime), 20 ], [size.width - margin.right - 20, size.height / 2]])
        // .on('brush', (event) => brushed(event, chartdata))
        .on('end', (event) => {
            const selection = event.selection;
            if (selection) {
                const [start, end] = selection.map(xScale2.invert);
                setBrushStart(start);
                setBrushEnd(end);
                updateCharts([start, end]);
            }
        })
    
        svg.append('g')
          .attr('class', 'x-brush')
          .attr('transform', `translate(0, ${size.height / 2 - margin.bottom})`)
          .call(brush)
          .call(brush.move, defaultWindow)

      
      }, [mgrData]);

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
            .call(d3.axisBottom(xScale).tickValues(tickVals).tickFormat(d3.timeFormat('%H:%M')).tickSizeOuter(0))
            .selectAll('text')
            .style('font-size', '16px');

        // updating charts
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('batch-update-charts', { detail: newDomain }));
            // console.log("Batch update triggered asynchronously. Selecting new time range: ", newDomain);
        }, 0);

      };

      return  (
        <>
          <Card title="TIMELINE VIEW" size="small" style={{ height: 'auto' }}>
              <div ref={svgContainerRef} style={{ width: '100%', height: '90%' }}></div>
          </Card>
          <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={'tl-tooltip'}
        />
      </>
      );
    };
    
    
export default TimelineView;
