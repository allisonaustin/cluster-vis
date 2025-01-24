import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { COLORS, getColor, generateColor } from '../utils/colors.js';
import Tooltip from './tooltip.js';
import * as d3 from 'd3';

const DR = ({ data }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [size, setSize] = useState({ width: 470, height: 320 });
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });

    useEffect(() => {
        if (!svgContainerRef.current || !data ) return;

        d3.select(svgContainerRef.current).selectAll("*").remove();
        setChartData(data);
        const { w, h } = svgContainerRef.current.getBoundingClientRect();
        setSize({ w, h });
        
        const margin = { top: 20, right: 30, bottom: 30, left: 40 };
        const width = size.width;
        const height = size.height;

        const xScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d.UMAP1), d3.max(data, d => +d.UMAP1) + 1])
            .range([margin.left, width - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d.UMAP1), d3.max(data, d => +d.UMAP2) + 1])
            .range([height - margin.bottom, margin.top]);
        
        const xAxis = d3.axisBottom(xScale);
        
        const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");
        
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height - margin.bottom})`)
            .call(xAxis);

        // x axis label
        svg.append('text')
            .attr("x", width/2)
            .attr("y", height)
            .style('text-anchor', 'middle')
            .text('UMAP1')
            .style('font-size', '12px');


        const yAxis = d3.axisLeft(yScale).ticks(height / 40);
        svg.append("g")
            .attr("class", "y-axis")
            .attr("transform", `translate(${margin.left},0)`)
            .call(yAxis)
            .call(g => g.append("text")
                .attr("x", -height/2)
                .attr("y", -margin.right)
                .attr("fill", "currentColor")
                .attr("text-anchor", "start")
                .attr("transform", "rotate(-90)")
                .style('font-size', '12px')
                .text("UMAP2")); // Y label

        svg.selectAll(".dr-circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", (d, i) => "dr-circle")
            .attr('id', (d, i) => `${d.Measurement}`)
            .attr("cx", d => xScale(d.UMAP1))
            .attr("cy", d => yScale(d.UMAP2))
            .attr('stroke','black')
            .attr('stroke-width', '1px')
            .attr("r", 3)
            .style('fill', getColor('default'))
            .on("mouseover", function (event, d) {
                setTooltip({
                    visible: true,
                    content: `${d.Measurement}`,
                    x: event.clientX,
                    y: event.clientY,
                  });
            })
            .on("mouseout", function () {
                setTooltip({
                    visible: false,
                    content: '',
                    x: 0,
                    y: 0,
                  });
            });
    
        return () => {
            svg.remove();
        };
        
    }, [data]);

    return (
        <div id="chart-container">
            <div ref={svgContainerRef} style={{ width: '100%', height: '300px' }}></div>
            <Tooltip
                visible={tooltip.visible}
                content={tooltip.content}
                x={tooltip.x}
                y={tooltip.y}
            />
        </div>
        );

}

export default DR;