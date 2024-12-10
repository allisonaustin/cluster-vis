import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { COLORS, getColor, generateColor } from '../utils/colors.js';
import * as d3 from 'd3';

const Bubble = ({ data }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [size, setSize] = useState({ width: 600, height: 300 });

    useEffect(() => {
        if (!svgContainerRef.current || !data || data.length == 0 ) return;
        // setChartData(data);
        
        const groups = Object.keys(data);

        const averageRates = Object.keys(data).map(trigger => {
            const values = Object.values(data[trigger]);
            const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
            return { trigger, avg };
          });

        const threshold = 0.1;
        const r = averageRates.map(rate => rate.avg);
        const r_min = Math.min(...r);  
        const r_max = Math.max(...r); 

        const r_scale = d3.scaleLinear()
            .domain([r_min, r_max])    
            .range([20, 150]);           

        const filteredData = averageRates
            .filter(item => Math.abs(item.avg) > threshold)
            .map(d => ({
                trigger: d.trigger, 
                avg: d.avg,         
                radius: r_scale(d.avg) 
        }));

        setChartData(filteredData)

        const color = d3.scaleOrdinal(d3.schemeTableau10);
        const margin = 1;
        
        const pack = d3.pack()
            .size([size.width - margin * 2, size.height - margin * 2])
            .padding(3);
        
        const root = pack(d3.hierarchy({children: filteredData}))
            .sum(d => d.radius);
        
        const svg = d3.select(svgContainerRef.current)
            .append('svg')
            .attr('id', 'bubble-svg')
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
        
        const node = svg.append('g')    
            .selectAll()
            .data(root.leaves())
            .join('g')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
        node.append('title')
            .text(d => `${d.data.trigger}`)

        node.append('circle')
            .attr('fill-opacity', 0.7)
            .attr('fill', d => color(d.data.trigger))
            .attr('r', d => {
                const radius = d.data.radius;
                return !isNaN(radius) && radius > 0 ? radius : 0;
            });
        
        const text = node.append('text')
            .attr('clip-path', d => `circle(${parseFloat(d.radius)})`)
            .text(d => d.data.trigger);
        
    }, [data]);

    return <div ref={svgContainerRef} style={{ width: '100%', height: '600px' }}></div>;
};

export default Bubble;