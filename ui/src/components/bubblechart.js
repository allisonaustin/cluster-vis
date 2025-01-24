import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { createColorScale } from '../utils/colors.js';
import Tooltip from './tooltip.js';
import * as d3 from 'd3';

const Bubble = ({ data }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [groups, setGroups] = useState([]);
    const [size, setSize] = useState({ width: 600, height: 600 });
    const [sizeRange, setSizeRange] = useState([20, 150]);
    const [simulation, setSimulation] = useState();
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });

    useEffect(() => {
        if (!svgContainerRef.current || !data || data.length == 0 ) return;

        d3.select(svgContainerRef.current).selectAll("*").remove();

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
       
        // filtering based on initial time window of data
        const filtered = Object.keys(chartdata).reduce((acc, group) => {
            if (start && end) {
                acc[group] = chartdata[group].filter(d => d.timestamp >= start && d.timestamp <= end);
            } else {
                acc[group] = chartdata[group];
            }
            return acc;
        }, {});

        // using regex to extract trigger info 
        const baseTrig = Object.keys(filtered)
            .reduce((acc, key) => {
                const baseName = key.replace(/ (rate|avg delay|avg decision|avg length|Max Delay|Min Delay|Avg Delay|Std Delay|Rate)_P1$/, "").trim();

                if (!acc[baseName]) {
                    acc[baseName] = { trigger: baseName, avgRate: 0, avgDelay: 0, avgDec: 0};
                } else {
                    if (key.includes('rate')) {
                        acc[baseName].avgRate += d3.mean(filtered[key].map(d => d.value));
                    } else if (key.toLowerCase().includes('delay') && 
                                !key.toLowerCase().includes('min') && 
                                !key.toLowerCase().includes('max') && 
                                !key.toLowerCase().includes('std')) {
                        acc[baseName].avgDelay += d3.mean(filtered[key].map(d => d.value)); 
                    } else if (key.toLowerCase().includes('decision')) {
                        acc[baseName].avgDec += d3.mean(filtered[key].map(d => d.value)); 
                    }
                }

                return acc;
            }, {});
        
        // flattening data
        const aggregated = Object.values(baseTrig)
            .map(d => ({
                trigger: d.trigger,
                avgRate: d.avgRate, 
                avgDelay: d.avgDelay,
                avgDec: d.avgDec
            }));
        
        const r_scale = d3.scaleLinear()
            .domain([0, d3.max(aggregated, d => d.avgRate)])
            .range(sizeRange);  
        
        const d_scale = d3.scaleLinear()
            .domain([0, d3.max(aggregated, d => d.avgDelay)]) 
            .range([0, 100]);  

        // coloring based on delay 
        const colorScale = createColorScale(d_scale);  

        const nodes = aggregated.map(d => ({
            ...d,
            radius: r_scale(d.avgRate),
            x: Math.random() * size.width,
            y: Math.random() * size.height
        }));

        setNodes(nodes);
    
        // const color = d3.scaleOrdinal(d3.schemeTableau10);
    
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
            .attr('fill', d => colorScale(d.avgDelay))
            .on('mouseover', function(event, d) {
                d3.select(this).style('cursor', 'pointer');
                d3.select(this).attr('fill-opacity', 1);
                setTooltip({
                    visible: true,
                    content: `${d.trigger}`,
                    x: event.clientX,
                    y: event.clientY,
                  });
            })
            .on('mouseout', function(event, d) {
                d3.select(this).style('cursor', 'default'); 
                d3.select(this).attr('fill-opacity', 0.7);
                setTooltip({
                    visible: false,
                    content: '',
                    x: 0,
                    y: 0,
                  });
            });
    
        // node.append('text')
        //     .attr('text-anchor', 'middle')
        //     .style('font-size', d => Math.min(d.radius / 2, 16) + 'px')
        //     .style('fill', '#000')
        //     .selectAll('tspan')
        //     .data(d => d.trigger.split(' '))
        //     .join('tspan')
        //     .attr('x', 0)
        //     .attr('y', (d, i, nodes) => `${i - nodes.length / 2 + 0.5}em`)
        //     .text(d => d);
    
        // const sim = d3.forceSimulation()
        //     .nodes(nodes) 
        //     .force('x', d3.forceX(size.width / 2).strength(0.01))
        //     .force('y', d3.forceY(size.height / 2).strength(0.01)) 
        //     .force('collision', d3.forceCollide().radius(d => d.radius + 2))
        //     .on('tick', () => {
        //         node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        //     });
        
        const padding=5;

        const sim = d3.forceSimulation(nodes)
        .force('x', d3.forceX(d => {
            return Math.max(d.radius + padding, Math.min(size.width - d.radius - padding, d.x));
        }).strength(0.05))
        .force('y', d3.forceY(d => {
            return Math.max(d.radius + padding, Math.min(size.height - d.radius - padding, d.y));
        }).strength(0.05))
        .force('collision', d3.forceCollide().radius(d => d.radius + padding).strength(1))
        .on('tick', () => {
            node.attr('transform', d => {
                d.x = Math.max(d.radius + padding, Math.min(size.width - d.radius - padding, d.x));
                d.y = Math.max(d.radius + padding, Math.min(size.height - d.radius - padding, d.y));
                return `translate(${d.x}, ${d.y})`;
            });
        });

        setSimulation(sim)
    
        node.select('circle')
            .transition()
            .duration(1000)
            .attr('r', d => d.radius);

        // createSizeLegend(svg, r_scale); 
        createColorLegend(svg, d_scale, colorScale);
    
        return () => {
            svg.remove();
        };
        
    }, [data]);

    const createSizeLegend = (svg, rScale) => {
        // circle size color legend
        const legendData = [
            parseInt(rScale.domain()[0]), 
            parseInt((rScale.domain()[1] - rScale.domain()[0]) / 2), 
            parseInt(rScale.domain()[1])
        ]; 
        const edgeSpacing = 10;
        const baselineY = 40;
    
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(0, ${size.height - 60})`); 
    
        legend.append('text')
            .attr('x', size.width / 1.6)
            .attr('y', baselineY - 10)  
            .text('Avg rate')
            .style('font-size', '18px');

        let currentX = size.width / 1.4; 
    
        legend.selectAll('circle')
            .data(legendData)
            .enter()
            .append('circle')
            .attr('cx', (d, i, nodes) => {
                const radius = rScale(d / 10);
                currentX += i === 0 ? radius : rScale(legendData[i - 1] / 10) + radius + edgeSpacing;
                return currentX;
            })
            .attr('cy', d => baselineY - rScale(d / 10)) 
            .attr('r', d => rScale(d / 10))
            .style('fill', 'none')
            .style('stroke', 'black');

    };

    const createColorLegend = (svg, dScale, colorScale) => {
        // delay color legend
        const colorLegendWidth = 250;
        const colorLegendHeight = 20;
        const baselineY = 40;
        const colorLegendX = size.width / 2;
        const colorLegendY = baselineY + 50;
        const legendSvg = d3.select('legend-svg');

        const colorLegend = svg
            .append('g')
                .attr('class', 'color-legend')
            .attr('transform', `translate(${size.width / 2.6 },${size.height / 1.4})`);

        const defs = svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'color-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

            gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', colorScale(dScale.domain()[0]));
    
        gradient.append('stop')
            .attr('offset', '50%')
            .attr('stop-color', colorScale((dScale.domain()[0] + dScale.domain()[1]) / 2));
    
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', colorScale(dScale.domain()[1]));
    
        colorLegend.append('rect')
            .attr('x', colorLegendX)
            .attr('y', colorLegendY)
            .attr('width', colorLegendWidth)
            .attr('height', colorLegendHeight)
            .style('fill', 'url(#color-gradient)');
    
        colorLegend.append('text')
            .attr('class', 'legend-min')
            .attr('x', colorLegendX)
            .attr('y', colorLegendY + colorLegendHeight + 15)
            .text(parseInt(dScale.domain()[0]))
            .style('font-size', '18px')
            .style('fill', 'black')
            .attr('text-anchor', 'start');
    
        colorLegend.append('text')
            .attr('class', 'legend-mid')
            .attr('x', colorLegendX + colorLegendWidth / 2)
            .attr('y', colorLegendY + colorLegendHeight + 15)
            .text(parseInt((dScale.domain()[0] + dScale.domain()[1]) / 2))
            .style('font-size', '18px')
            .style('fill', 'black')
            .attr('text-anchor', 'middle');
    
        colorLegend.append('text')
            .attr('class', 'legend-mid')
            .attr('x', colorLegendX + colorLegendWidth)
            .attr('y', colorLegendY + colorLegendHeight + 15)
            .text(parseInt(dScale.domain()[1]))
            .style('font-size', '18px')
            .style('fill', 'black')
            .attr('text-anchor', 'end');
        
        colorLegend.append('text')
            .attr('x', colorLegendX + colorLegendWidth / 2.8)
            .attr('y', colorLegendY + colorLegendHeight + 40)
            .style('font-size', '18px')
            .text('Avg Delay')
    }

    const updateChart = (newDomain) => {
        if (!newDomain || !nodes.length) return;

        // filtering based on initial time window of data
        const newdata = Object.keys(chartData).reduce((acc, group) => {
            acc[group] = chartData[group].filter(d => d.timestamp >= newDomain[0] && d.timestamp <= newDomain[1]);
            return acc;
        }, {});

        if (newdata.length == 0) return;

        const baseTrig = Object.keys(newdata)
            .reduce((acc, key) => {
                const baseName = key.replace(/ (rate|avg delay|avg decision|avg length|Max Delay|Min Delay|Avg Delay|Std Delay|Rate)_P1$/, "").trim();

                if (!acc[baseName]) {
                    acc[baseName] = { trigger: baseName, avgRate: 0, avgDelay: 0, avgDec: 0};
                } else {
                    if (key.includes('rate')) {
                        acc[baseName].avgRate += d3.mean(newdata[key].map(d => d.value));
                    } else if (key.toLowerCase().includes('delay') && 
                                !key.toLowerCase().includes('min') && 
                                !key.toLowerCase().includes('max') && 
                                !key.toLowerCase().includes('std')) {
                        acc[baseName].avgDelay += d3.mean(newdata[key].map(d => d.value)); 
                    } else if (key.toLowerCase().includes('decision')) {
                        acc[baseName].avgDec += d3.mean(newdata[key].map(d => d.value)); 
                    }
                }

                return acc;
            }, {});
        
        const aggregated = Object.values(baseTrig)
            .map(d => ({
                trigger: d.trigger,
                avgRate: d.avgRate, 
                avgDelay: d.avgDelay,
                avgDec: d.avgDec
            }));

        const r_scale = d3.scaleLinear()
            .domain([0, d3.max(aggregated, d => d.avgRate)])
            .range(sizeRange);  
        
        const d_scale = d3.scaleLinear()
            .domain([0, d3.max(aggregated, d => d.avgDelay)]) 
            .range([0, 100]);  

        // coloring based on delay 
        const colorScale = createColorScale(d_scale);  

        const updatedNodes = aggregated.map(d => {
            const existingNode = nodes.find(node => node.trigger === d.trigger);
            return {
                ...d,
                radius: r_scale(d.avgRate),
                x: existingNode ? existingNode.x : Math.random() * size.width,
                y: existingNode ? existingNode.y : Math.random() * size.height
            };
        })

        setNodes(updatedNodes);

        const svg = d3.select(svgContainerRef.current).select('svg');
        const node = svg.selectAll('g').data(updatedNodes)
        node.select("circle")
            .transition()
            .duration(1000)
            .attr('fill', d => colorScale(d.avgDelay))
            .attr("r", d => d.radius); 

        simulation.nodes(updatedNodes)
        simulation.alpha(0.5).restart();

        // updating legend
        d3.select('.color-legend .legend-min').text(parseInt(d_scale.domain()[0]))
        d3.select('.color-legend .legend-mid').text(parseInt((d_scale.domain()[0] + d_scale.domain()[1]) / 2))
        d3.select('.color-legend .legend-max').text(parseInt(d_scale.domain()[1]))
    }
    
    const handleUpdateEvent = (event) => {
        const { detail: newDomain } = event;
        updateChart(newDomain);
      };

      window.addEventListener(`batch-update-charts`, handleUpdateEvent);

    return (
        <div id="circle-container" style={{ width: '100%', height: '95%'}}>
            <div ref={svgContainerRef} style={{ width: '100%', height: '90%' }}></div>
            <svg id='legend-svg' className='legend'></svg>
            <Tooltip
                visible={tooltip.visible}
                content={tooltip.content}
                x={tooltip.x}
                y={tooltip.y}
            />
        </div>
        );
};

export default Bubble;