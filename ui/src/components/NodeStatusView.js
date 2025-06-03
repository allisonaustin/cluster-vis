import { Card } from "antd";
import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { generateColor, colorScale } from '../utils/colors.js';
import Tooltip from '../utils/tooltip.js';

const NodeStatusView = ({ nodeData, bStart, bEnd, nodeDataStart, nodeDataEnd, nodeClusterMap }) => {
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
      if (!svgContainerRef.current || !nodeData || !nodeDataStart || !nodeDataEnd ) return;
      
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

      // const groupedNodes = d3.rollup(
      //   flattenedData,
      //   v => new Set(v.map(d => d.nodeId)).size,
      //   d => Math.floor(d.timestamp.getTime() / binWidth) * binWidth
      // );

      // const groupedNodesDown = d3.rollup(
      //   flattenedData,
      //   v => new Set(v.filter(d => d.down === 1).map(d => d.nodeId)).size, 
      //   d => Math.floor(d.timestamp.getTime() / binWidth) * binWidth 
      // );
      
      // const nodesDown = Array.from(groupedNodesDown, ([timestamp, count]) => ({
      //   timestamp: new Date(timestamp),
      //   num_nodes: count
      // }));
      
      // const nodesTotal = Array.from(groupedNodes, ([timestamp, count]) => ({
      //   timestamp: new Date(timestamp),
      //   num_nodes: count
      // }));

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

      // chart 1

      const xScale1 = d3.scaleTime()
        .domain([new Date(chartDataStart), new Date(chartDataEnd)])
        .range([margin.left, size.width - margin.right - 20])
        // .padding(0.1);

      xScaleRef.current = xScale1; 

      const yScale1 = d3.scaleLinear()
        .domain([0, maxTotal])
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
        .text("Active Nodes");

      svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", size.width )
        .attr("height", size.height/2 )

      const stackGeneratorTotal = d3.stack()
        .keys(clusterKeysTotal)
        .order(d3.stackOrderNone)
        .offset(d3.stackOffsetNone);
  
      const seriesTotal = stackGeneratorTotal(stackDataTotal);

      svg.selectAll(".stack-total")
      .data(seriesTotal)
      .enter()
      .append("g")
      .attr("class", "stack-total")
      .attr("fill", d => colorScale(+d.key))
      .selectAll("rect")
      .data(d => d)
      .enter()
      .append("rect")
      .attr("x", d => xScale1(d.data.timestamp))
      .attr("y", d => yScale1(d[1]))
      .attr("height", d => yScale1(d[0]) - yScale1(d[1]))
      .attr("width", size.width / stackDataTotal.length - 2)
      .on("mouseover", function(event, d) {
        const total = d3.sum(clusterKeysTotal, k => d.data[k] || 0);
        let content = `Total: ${total}\n`;
        clusterKeysTotal.forEach(k => {
          content += `c${k}: ${d.data[k] || 0}\n`;
        });
        setTooltip({
          visible: true,
          content: content,
          x: event.clientX,
          y: event.clientY
        });
      })
      .on("mouseout", function() {
        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // svg.selectAll("total-bars")
    //   .data(nodesTotal)
    //   .enter().append("rect")
    //   .attr('class', 'total-bars')
    //   .attr("x", d => xScale1(d.timestamp))
    //   .attr("y", d => yScale1(d.num_nodes))
    //   .attr("width", size.width / nodesTotal.length - 2) 
    //   .attr("height", d => size.height/2 - margin.bottom - yScale1(d.num_nodes))
    //   .attr("fill", generateColor(0))


        // chart 2

    
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
            .text("Inactive Nodes");

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

        // svg.selectAll(".down-bars")
        //   .data(nodesDown)
        //   .enter().append("rect")
        //   .attr('class', 'down-bars')
        //   .attr("x", d => xScale2(d.timestamp))
        //   .attr("y", d => yScale2(d.num_nodes))
        //   .attr("width", size.width / nodesDown.length - 2) 
        //   .attr("height", d => size.height - margin.bottom - yScale2(d.num_nodes))
        //   .attr("fill", generateColor(0))
        //   .on('mouseover', function(event, d) {
        //     setTooltip({
        //       visible: true,
        //       content: d.num_nodes,
        //       x: event.clientX,
        //       y: event.clientY,
        //     });
        //   })

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

      
      }, []);

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
    
    
export default NodeStatusView;
