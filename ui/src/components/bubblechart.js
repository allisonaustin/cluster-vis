import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { COLORS, getColor, generateColor } from '../utils/colors.js';
import * as d3 from 'd3';

const Bubble = ({ data }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [size, setSize] = useState({ width: 900, height: 900 });

    useEffect(() => {
        if (!svgContainerRef.current || !data || data.length == 0 ) return;
        // setChartData(data);

        const baseTriggers = Object.keys(data)
            .filter(key => key.includes("rate"))
            .map(key => {
                const baseName = key.replace(/ rate_P1$/, "").trim();
                return { baseName, avg: d3.mean(Object.values(data[key])) };
            });

            const aggregatedData = Array.from(
                baseTriggers.reduce((acc, item) => {
                    if (!acc.has(item.baseName)) {
                        acc.set(item.baseName, { trigger: item.baseName, avg: 0, count: 0 });
                    }
                    const entry = acc.get(item.baseName);
                    entry.avg += item.avg;
                    entry.count += 1;
                    return acc;
                }, new Map()).values()
            ).map(d => ({ trigger: d.trigger, avg: d.avg / d.count }));
        
            const r_scale = d3.scaleLinear()
                .domain([0, d3.max(aggregatedData, d => d.avg)])
                .range([20, 200]);
        
            const nodes = aggregatedData.map(d => ({
                ...d,
                radius: r_scale(d.avg),
                x: Math.random() * size.width,
                y: Math.random() * size.height
            }));
        
            const color = d3.scaleOrdinal(d3.schemeTableau10);
        
            const svg = d3.select(svgContainerRef.current)
                .append('svg')
                .attr('id', 'bubble-svg')
                .attr("width", "100%")
                .attr("height", "100%")
                .attr("viewBox", `0 0 ${size.width} ${size.height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");
        
            // Append groups for each node
            const node = svg.selectAll('g')
                .data(nodes)
                .join('g')
                .attr('transform', d => `translate(${d.x}, ${d.y})`);
        
            node.append('circle')
                .attr('r', d => d.radius)
                .attr('fill-opacity', 0.7)
                .attr('fill', d => color(d.trigger))
                .on('mouseover', function() {
                    d3.select(this).style('cursor', 'pointer');
                    d3.select(this).attr('fill-opacity', 0.9);
                })
                .on('mouseout', function() {
                    d3.select(this).style('cursor', 'default'); 
                    d3.select(this).attr('fill-opacity', 0.7);
                });
        
            node.append('text')
                .attr('text-anchor', 'middle')
                .style('font-size', d => Math.min(d.radius / 2, 16) + 'px')
                .style('fill', '#000')
                .selectAll('tspan')
                .data(d => d.trigger.split(' '))
                .join('tspan')
                .attr('x', 0)
                .attr('y', (d, i, nodes) => `${i - nodes.length / 2 + 0.5}em`)
                .text(d => d);
        
            const simulation = d3.forceSimulation()
                .nodes(nodes) 
                .force('x', d3.forceX(size.width / 2).strength(0.02))
                .force('y', d3.forceY(size.height / 2).strength(0.02)) 
                .force('collision', d3.forceCollide().radius(d => d.radius + 2))
                .on('tick', () => {
                    node.attr('transform', d => `translate(${d.x}, ${d.y})`);
                });
        
            node.select('circle')
                .transition()
                .duration(1000)
                .attr('r', d => d.radius);
        
            return () => {
                svg.remove();
            };
        
    }, [data]);

    return <div ref={svgContainerRef} style={{ width: '100%', height: '600px' }}></div>;
};

export default Bubble;