import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { COLORS, getColor, generateColor } from '../utils/colors.js';
import * as d3 from 'd3';

const Bubble = ({ data }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [groups, setGroups] = useState([]);
    const [size, setSize] = useState({ width: 900, height: 900 });
    const [sizeRange, setSizeRange] = useState([20, 180]);

    useEffect(() => {
        if (!svgContainerRef.current || !data || data.length == 0 ) return;

        let chartdata = [];
        let groups = Object.keys(data);
        setGroups(groups);

        groups.forEach((g) => {
            if (data[g]) { 
                chartdata[g] = [];
                
                Object.keys(data[g]).forEach((obj) => {
                    let date = new Date(parseInt(obj));
                    let utcDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
                    chartdata[g].push({
                        timestamp: utcDate, 
                        value: data[g][obj], 
                    });
                });
            }
        }); 

        setChartData(chartdata);
        const start = chartdata[groups[0]][Math.floor(chartdata[groups[0]].length * 0.3)].timestamp;
        const end = chartdata[groups[0]][Math.floor(chartdata[groups[0]].length * 0.5)].timestamp;
       
        const filtered = Object.keys(chartdata).reduce((acc, group) => {
            if (start && end) {
                acc[group] = chartdata[group].filter(d => d.timestamp >= start && d.timestamp <= end);
            } else {
                acc[group] = chartdata[group];
            }
            return acc;
        }, {});

        const baseTriggers = Object.keys(filtered)
            .filter(key => key.includes("rate"))
            .map(key => {
                const baseName = key.replace(/ rate_P1$/, "").trim();
                return { baseName, avg: d3.mean(filtered[key].map(d => d.value)) };
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
                .range(sizeRange);
        
            const nodes = aggregatedData.map(d => ({
                ...d,
                radius: r_scale(d.avg),
                x: Math.random() * size.width,
                y: Math.random() * size.height
            }));

            setNodes(nodes);
        
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
                .force('x', d3.forceX(size.width / 2).strength(0.01))
                .force('y', d3.forceY(size.height / 2).strength(0.01)) 
                .force('collision', d3.forceCollide().radius(d => d.radius + 2))
                .on('tick', () => {
                    node.attr('transform', d => `translate(${d.x}, ${d.y})`);
                });
        
            node.select('circle')
                .transition()
                .duration(1000)
                .attr('r', d => d.radius);

            createSizeLegend(svg, r_scale); 
        
            return () => {
                svg.remove();
            };
        
    }, [data]);

    const createSizeLegend = (svg, rScale) => {
        const legendData = [parseInt(rScale.domain()[0]), parseInt((rScale.domain()[1] - rScale.domain()[0]) / 2), parseInt(rScale.domain()[1])]; 
        const legendSpacing = 70; 

        const legend = svg.append('g')
            .attr('class', 'size-legend')
            .attr('transform', `translate(0, ${size.height - 60})`); 

        legend.append('text')
            .attr('x', 20)
            .attr('y', 10)
            .text('Avg rate')
            .style('font-size', '18px');

        legend.selectAll('circle')
            .data(legendData)
            .enter()
            .append('circle')
            .attr('cx', (d, i) => i * legendSpacing + 130) 
            .attr('cy', 10) 
            .attr('r', d => rScale(d / 10))
            .style('fill', 'none')
            .style('stroke', 'black');

        // legend.selectAll('text')
        //     .data(legendData)
        //     .enter()
        //     .append('text')
        //     .attr('x', (d, i) => i * legendSpacing + 50)  
        //     .attr('y', 0) 
        //     .attr('dy', '0.35em') 
        //     .text(d => d)
        //     .style('font-size', '12px')
        //     .style('fill', 'black');
    };
    

    const updateChart = (newDomain) => {
        if (!newDomain || !nodes.length) return;
       
        // const newdata = Object.keys(chartData).reduce((acc, group) => {
        //     acc[group] = chartData[group].filter(
        //             d => d.timestamp >= newDomain[0] && 
        //             d.timestamp <= newDomain[1]
        //         );
        //     return acc;
        // }, {});

        // if (newdata.length == 0) return;

        // const baseTriggers = Object.keys(newdata)
        //     .filter(key => key.includes("rate"))
        //     .map(key => {
        //         const baseName = key.replace(/ rate_P1$/, "").trim();
        //         return { baseName, avg: d3.mean(newdata[key].map(d => d.value)) };
        //     });

        //     const aggregatedData = Array.from(
        //         baseTriggers.reduce((acc, item) => {
        //             if (!acc.has(item.baseName)) {
        //                 acc.set(item.baseName, { trigger: item.baseName, avg: 0, count: 0 });
        //             }
        //             const entry = acc.get(item.baseName);
        //             entry.avg += item.avg;
        //             entry.count += 1;
        //             return acc;
        //         }, new Map()).values()
        //     ).map(d => ({ trigger: d.trigger, avg: d.avg / d.count }));

        // const r_scale = d3.scaleLinear()
        //     .domain([0, d3.max(aggregatedData, d => d.avg)])
        //     .range([20, 180]);

        // const updatedNodes = aggregatedData.map(d => ({
        //     ...d,
        //     radius: r_scale(d.avg),
        //     x: Math.random() * size.width,
        //     y: Math.random() * size.height
        // }));

        // setNodes(updatedNodes);

        // const svg = d3.select(svgContainerRef.current).select('svg');
        // const node = svg.selectAll('g')
        //     .data(updatedNodes, d => d.trigger);

        // node.select('circle')
        //     .transition()
        //     .duration(1000)
        //     .attr('r', d => d.radius);
    }
    
    const handleUpdateEvent = (event) => {
        const { detail: newDomain } = event;
        updateChart(newDomain);
      };

      window.addEventListener(`update-bubble-chart`, handleUpdateEvent);

    return <div ref={svgContainerRef} style={{ width: '100%', height: '600px' }}></div>;
};

export default Bubble;