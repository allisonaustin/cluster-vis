import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { getColor, colorScale } from '../utils/colors.js';
import Tooltip from '../utils/tooltip.js';

const LineChart = ({ data, field, baselinesRef, selectedTimeRange, updateBaseline, nodeClusterMap, metadata, registerChart }) => {
    const svgContainerRef = useRef();
    const [size, setSize] = useState({ width: 800, height: 300 });
    const [margin, setMargin] = useState({ top: 40, right: 60, bottom: 60, left: 70 });
    const prevX = useRef([]); // for storing window values, might be clamped versions of baseline values 
    const prevY = useRef([]); 
    const xScaleRef = useRef();
    const yScaleRef = useRef();
    const brushGroupRef = useRef();
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });
    const skipBrush = useRef(true);

    useEffect(() => {
      if (!svgContainerRef.current || !data) return;
      
      // Select or create SVG
      let svg = d3.select(svgContainerRef.current).select("svg");
      if (svg.empty()) {
        svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr("id", `line-${field}-svg`)
          .attr("class", "line-svg")
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet")
          .style("border", "1px solid #dddddd")
          .style('border-radius', '6px');

          svg.append("defs")
            .append("clipPath")
            .attr("id", `clip-line-${field}`)
            .append('rect')
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", size.width - margin.right - margin.left)
            .attr("height", size.height);
      }

      // Groups for layering
      const gBaselines = svg.select(`focus-line-${field}`).empty()
        ? svg.append('g') .attr('class', 'focus') .attr('id', `focus-line-${field}`)
        : svg.select(`#focus-line-${field}`);

      const gLines = svg.select(".lines-group").empty()
        ? svg.append("g").attr("class", "lines-group")
            .attr("clip-path", `url(#clip-line-${field})`)
        : svg.select(".lines-group");

      const gAxes = svg.select(".axes-group").empty()
        ? svg.append("g").attr("class", "axes-group")
        : svg.select(".axes-group");

      const gLabels = svg.select(".labels-group").empty()
        ? svg.append("g").attr("class", "labels-group")
        : svg.select(".labels-group");

      const xScale = d3.scaleTime()
        .domain(selectedTimeRange)
        .range([margin.left, size.width - margin.right]);

      const yScale = d3.scaleLinear()
        .domain([0, d3.max(data.map(v => v.value))])
        .range([size.height - margin.bottom, margin.top]);

      xScaleRef.current = xScale;
      yScaleRef.current = yScale;

      gBaselines.node().xScale = xScale;
      gBaselines.node().yScale = yScale;

      // X and Y axes
      const steps = 6;
      const [minDate, maxDate] = xScale.domain();
      const stepMs = (maxDate - minDate) / (steps - 1);
      const tickVals = Array.from({ length: steps }, (_, i) => new Date(minDate.getTime() + i * stepMs));

      const xAxis = d3.axisBottom(xScale)
        .tickValues(tickVals)
        .tickFormat(d3.timeFormat("%H:%M"))
        .tickSizeOuter(0);

      const yAxis = d3.axisLeft(yScale).ticks(size.height / 40).tickFormat(d3.format(".2s"));

      if (gAxes.select(".x-axis").empty()) {
        gAxes.append("g")
          .attr("class", "x-axis")
          .attr("transform", `translate(0,${size.height - margin.bottom})`)
          .call(xAxis)
          .selectAll("text")
          .style("font-size", "18px");
      } else {
        gAxes.select(".x-axis").transition().duration(500).call(xAxis);
      }

      if (gAxes.select(".y-axis").empty()) {
        gAxes.append("g")
          .attr("class", "y-axis")
          .attr("transform", `translate(${margin.left},0)`)
          .call(yAxis) 
          .selectAll("text")       
          .style("font-size", "20px");
      } else {
        gAxes.select(".y-axis").transition().duration(500).call(yAxis);
      }

      // Axis labels
      if (gLabels.select(".x-axis-label").empty()) {
        gLabels.append("text")
          .attr("class", "x-axis-label")
          .attr("x", size.width / 2)
          .attr("y", size.height - 10)
          .style("text-anchor", "middle")
          .style("font-size", "18px")
          .text("Time (hh:mm)");
      }

      if (gLabels.select(".y-axis-label").empty()) {
        gLabels.append("text")
          .attr("class", "y-axis-label")
          .attr("x", 15)
          .attr("y", 30)
          .attr("fill", "currentColor")
          .attr("text-anchor", "start")
          .style("font-size", "22px")
          .text(metadata ? ` ${metadata.units}` : "Value");
      }

      // Chart title
      const title = gLabels.select(".grid-title");
      if (title.empty()) {
        gLabels.append("text")
          .attr("class", "grid-title")
          .attr("x", size.width / 2)
          .attr("y", 0)
          .attr("dy", "1em")
          .style("text-anchor", "middle")
          .style("font-size", "24px")
          .text(field);
      } else {
        title.text(field);
      }

      // Lines
      const groupedData = Array.from(d3.group(data, d => d.nodeId));
      const line = d3.line()
        .x(d => xScale(d.timestamp))
        .y(d => yScale(d.value));

      const lines = gLines.selectAll(`.line-${field}`)
        .data(groupedData, d => d[0]); // key = nodeId

      lines.exit().remove();

      const linesEnter = lines.enter()
        .append("path")
        .attr("class", `line line-${field}`)
        .attr("nodeId", d => d[0])
        .attr("fill", "none")
        .attr("stroke", d => colorScale(nodeClusterMap.get(d[0])))
        .attr("stroke-width", 1)
        .attr("opacity", 0.8)
        .attr("d", d => line(d[1]))
        .style("stroke-dasharray", function() { return `${this.getTotalLength()} ${this.getTotalLength()}`; })
        .style("stroke-dashoffset", function() { return this.getTotalLength(); })
        .style("stroke-dashoffset", 0);

      const allLines = linesEnter.merge(lines);

      if (registerChart) {
        registerChart({ chartEl: svg, xScale, yScale, lines: allLines, field, brushGroup: brushGroupRef.current });
      }

    }, [data]);

    function updateBaselineHandler(event) {
        if (skipBrush.current) {
          skipBrush.current = false; 
          return;
        }
        const s = event.selection;
        if (!s) return;

        const xScale = xScaleRef.current;
        const yScale = yScaleRef.current;
      
        const [x0, y0] = s[0];  
        const [x1, y1] = s[1];

        const start = xScale.invert(x0);
        const end = xScale.invert(x1);
        const valueStart = yScale.invert(y1);
        const valueEnd = yScale.invert(y0);

        const hasPrevX = prevX?.current && prevX.current.length === 2;
          const hasPrevY = prevY?.current && prevY.current.length === 2;

          let newX0 = start;
          let newX1 = end;
          let newY0 = valueStart;
          let newY1 = valueEnd;

          if (hasPrevX) {
            if (prevX.current[0].getTime() !== start.getTime()) {
              newX0 = start;
            } else {
              newX0 = prevX.current[0];
            }

            if (prevX.current[1].getTime() !== end.getTime()) {
              newX1 = end;
            } else {
              newX1 = prevX.current[1];
            }
          }
        
          if (hasPrevY) {
            if (Math.abs(prevY.current[0] - valueStart) > 1e-6) {
              newY0 = valueStart;
            } else {
              newY0 = prevY.current[0];
            }

            if (Math.abs(prevY.current[1] - valueEnd) > 1e-6) {
              newY1 = valueEnd;
            } else {
              newY1 = prevY.current[1];
            }
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
        baselinesRef.current[field] = newBaseline
        updateBaseline(field, newBaseline);
      }

    const brush = d3.brush()
        .extent([[margin.left, margin.top], [size.width - margin.right, size.height - margin.bottom]])
        .on("end", updateBaselineHandler);

    useEffect(() => {
      const focus = d3.select(`#focus-line-${field}`);
      focus.select(`.brush-layer`).remove(); // remove any previous
      const brushGroup = focus.append('g')
          .attr('class', 'brush-layer')
          .call(brush);

      brushGroupRef.current = brushGroup;
    }, []);

    // Update positions
    useEffect(() => {
      const baseline = baselinesRef.current[field];
      if (!baseline) return;

      const xScale = xScaleRef.current;
      const yScale = yScaleRef.current;
      const brushGroup = brushGroupRef.current;
      
      const x0 = d3.max([baseline.baselineX[0], xScale.domain()[0]]);
      const x1 = d3.min([baseline.baselineX[1], xScale.domain()[1]]);
      const y0 = d3.max([baseline.baselineY[0], yScale.domain()[0]]);
      const y1 = d3.min([baseline.baselineY[1], yScale.domain()[1]]);

      prevX.current = [x0, x1];
      prevY.current = [y0, y1];

      const xStart = Math.min(xScale(x0), xScale(x1));
      const xEnd = Math.max(xScale(x0), xScale(x1));
      const yStart = Math.min(yScale(y0), yScale(y1));
      const yEnd = Math.max(yScale(y0), yScale(y1));

      brushGroup.call(brush.move, [[xStart, yStart], [xEnd, yEnd]]);
    }, [selectedTimeRange, baselinesRef.current[field]]);
  
      return (
        <div>
          <div ref={svgContainerRef} style={{ width: 'auto', height: '190px' }}></div>
          <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={`line-${field}-tooltip`}
          />
      </div>
    );

};

export default LineChart;