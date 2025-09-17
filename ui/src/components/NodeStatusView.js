import { Card } from "antd";
import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { colorScale } from '../utils/colors.js';
import Tooltip from '../utils/tooltip.js';

const NodeStatusView = ({ nodeData, bStart, bEnd, nodeDataStart, nodeDataEnd, nodeClusterMap }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 700, height: 150 });
    const xScaleRef = useRef(null); 
    const [brushStart, setBrushStart] = useState(new Date(bStart));
    const [brushEnd, setBrushEnd] = useState(new Date(bEnd));
    const [currentDate, setCurrentDate] = useState(null);
    const [binWidth, setBinWidth] = useState(15 * 60 * 1000) // default: 15 min
    const [margin, setMargin] = useState({ top: 5, right: 30, bottom: 20, left: 50 });
    const [tooltip, setTooltip] = useState({
          visible: false,
          content: '',
          x: 0,
          y: 0
      });

    const drawChart = (data) => {
      d3.select(svgContainerRef.current).selectAll("*").remove();
      const svg = d3.select(svgContainerRef.current)
                .append("svg")
                .attr('id', `context-window`)
                .attr('class', 'context')
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 ${size.width} ${size.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

        let chartdata = Array.from(d3.group(data.data, d => d.timestamp), ([key, value]) => ({
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

          const allBins = [];
          const startTime = Math.floor(chartDataStart.getTime() / binWidth) * binWidth;
          const endTime = Math.floor(chartDataEnd.getTime() / binWidth) * binWidth;
          for (let t = startTime; t <= endTime; t += binWidth) {
            allBins.push(t);
          }

      
          const binClusterCountsTotal = d3.rollup(
            flattenedData,
            v => {
              const counts = {};
              v.forEach(d => {
                const cluster = nodeClusterMap.get(d.nodeId) || "0";
                if (!counts[cluster]) {
                  counts[cluster] = new Set();
                }
                counts[cluster].add(d.nodeId);
              });
              Object.keys(counts).forEach(k => {
                counts[k] = counts[k].size;
              });
              return counts;
            },
            d => Math.floor(d.timestamp.getTime() / binWidth) * binWidth
          );
          

        
        const clusterKeysTotal = Array.from(
          new Set(flattenedData.map(d => nodeClusterMap.get(d.nodeId) || "0"))
        );

      
        const stackDataTotal = allBins.map(bin => {
          const t = new Date(bin);
          const counts = binClusterCountsTotal.get(bin) || {};
          const row = { timestamp: t };
          clusterKeysTotal.forEach(k => {
            row[k] = counts[k] || 0;
          });
          return row;
        });

        const maxTotal = d3.max(stackDataTotal, d =>
          d3.sum(clusterKeysTotal, k => d[k])
        );
        
        const downData = flattenedData.filter(d => d.down === 1);
        
        const binClusterCountsDown = d3.rollup(
          downData,
          v => {
            const counts = {};
            v.forEach(d => {
              const cluster = nodeClusterMap.get(d.nodeId) || "0";
              if (!counts[cluster]) {
                counts[cluster] = new Set();
              }
              counts[cluster].add(d.nodeId);
            });
            Object.keys(counts).forEach(k => {
              counts[k] = counts[k].size;
            });
            return counts;
          },
          d => Math.floor(d.timestamp.getTime() / binWidth) * binWidth
        );
        
        
        const clusterKeysDown = Array.from(
          new Set(downData.map(d => nodeClusterMap.get(d.nodeId) || "0"))
        );
        
        const downStackData = allBins.map(bin => {
          const t = new Date(bin);
          const counts = binClusterCountsDown.get(bin) || {};
          const row = { timestamp: t };
          clusterKeysDown.forEach(k => {
            row[k] = counts[k] || 0;
          });
          return row;
        });
        const maxTotalDown = d3.max(downStackData, d =>
          d3.sum(clusterKeysDown, k => d[k])
        );

        const xScale2 = d3.scaleTime()
          .domain([new Date(chartDataStart), new Date(chartDataEnd)])
          .range([margin.left, size.width - margin.right - 20])
          // .padding(0.1);
  
        xScaleRef.current = xScale2; 
  
        const yScale2 = d3.scaleLinear()
          .domain([0, maxTotalDown])
          .nice()
          // .range([size.height - margin.bottom, margin.top]);
          .range([size.height * 0.8, margin.top]);
        
        const xAxis2 = d3.axisBottom(xScale2)
            .tickFormat(d3.timeFormat('%H:%M'))
            .tickSizeOuter(0);
        
        const yAxis2 = d3.axisLeft(yScale2);
  
        svg.append("g")
            .attr("class", "x-axis2")
            // .attr("transform", `translate(0,${size.height - margin.bottom})`)
            .attr("transform", `translate(0,${size.height * 0.8})`)
            .call(xAxis2);
  
        svg.append("g")
          .attr("class", "y-axis2")
            .attr("transform", `translate(${margin.left},0)`)
            .call(yAxis2)
          
          svg.append("text")
            .attr("class", "y-label")
            .attr("text-anchor", "middle")
            .attr("transform", `translate(${margin.left / 3},${size.height * 0.4}) rotate(-90)`)
            .text("Null Readings");

          const stackGeneratorDown = d3.stack()
            .keys(clusterKeysDown)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);
          const seriesDown = stackGeneratorDown(downStackData);
          svg.selectAll(".down-stack")
            .data(seriesDown)
            .enter()
            .append("g")
            .attr("class", "down-stack")
            .attr("fill", d => colorScale(+d.key))
            .selectAll("rect")
            .data(d => d)
            .enter()
            .append("rect")
            .attr("x", d => xScale2(d.data.timestamp))
            .attr("y", d => yScale2(d[1]))
            .attr("height", d => yScale2(d[0]) - yScale2(d[1]))
            .attr("width", size.width / downStackData.length - 2);

          // adding brush

          const defaultWindow = [
            xScale2(brushStart),
            xScale2(brushEnd)
          ]

          const earliestNodeDataTime = xScale2(new Date(nodeDataStart)) || 0;

          const brush = d3.brushX(xScale2)
            .extent([[Math.max(margin.left, earliestNodeDataTime), 20 ], [size.width - margin.right - 20, size.height * 0.87]])
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
              .attr('transform', `translate(0, ${-margin.top})`)
              .call(brush)
              .call(brush.move, defaultWindow)
 
    };
    
    useEffect(() => {
      if (!svgContainerRef.current || !nodeData || !nodeDataStart || !nodeDataEnd ) return;
      drawChart(nodeData);
    }, [nodeData, nodeClusterMap]);

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
          <Card title="NODE STATUS VIEW" size="small" style={{ height: 'auto' }}>
              <div ref={svgContainerRef}></div>
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
    
    
export default NodeStatusView;
