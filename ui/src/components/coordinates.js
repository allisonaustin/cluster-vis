import React, { useState, useEffect, useRef } from 'react';
import { getColor } from '../utils/colors.js';
import { Button, ButtonGroup, List, FormGroup, ListItem, ListItemText, ListItemButton, ListItemIcon, Checkbox, Box } from '@mui/material';
import * as d3 from 'd3';
import Tooltip from './tooltip.js';

const Coordinates = ({ data, selectedPoints, setSelectedPoints }) => {
    const svgContainerRef = useRef();
    const firstRenderRef = useRef(true);
    const [plotData, setPlotData] = useState([]);
    const [size, setSize] = useState({ width: 800, height: 380 });
    const [key, setKey] = useState('cpu');
    const [keyOptions, setKeyOptions] = useState({
        cpu: ['cpu'],
        memory: ['mem', 'disk', 'swap', 'part_max_used'],
        load: ['load', 'boottime', 'proc'],
        network: ['bytes', 'pkts', 'Missed Buffers'],
        PoolSize: ['Pool Size'],
        Retrans: ['Retrans'],
    })
    const [selectedDims, setSelectedDims] = useState([
        'cpu_idle',
        'cpu_nice',
        'cpu_num', 
        'cpu_speed',
        'cpu_aidle',
        'cpu_system',
        'cpu_user'
    ]);
    const [allKeys, setAllKeys] = useState([]);
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });

    useEffect(() => {
        if (!svgContainerRef.current) return;
        d3.select(svgContainerRef.current).selectAll("*").remove();
        setPlotData(data);
        
        const margin = { top: 20, right: 10, bottom: 20, left: 20 };
        const width = size.width - margin.left - margin.right;
        const height = size.height - margin.top - margin.bottom;

        // const selectedKeys = keyOptions[key];

        // const selectedDims = Object.keys(data[0]).filter(d => 
        //     selectedKeys.some(subKey => d.includes(subKey))
        // );

        const allFeatures = Object.keys(data[0])
        setAllKeys(allFeatures.filter(d => 
            !(d.includes('Retrans')) && 
            !(d.includes('UMAP')) &&
            !(d.includes('tSNE')) &&
            !(d.includes('Measurement'))
        ).sort(function (a, b) { return a.localeCompare(b, 'en', {'sensitivity': 'base'})}))

        const xScale = d3.scalePoint()
            .domain(selectedDims)
            .range([margin.left, width]);

        // const yScales = {}

        // selectedDims.forEach(dim => {
        //     yScales[dim] = d3.scaleLinear()
        //         .domain(d3.extent(data, d => parseFloat(d[dim])))
        //         .range([height, 0])
        // });

        const y = new Map(Array.from(selectedDims, key => 
            [key, d3.scaleLinear(d3.extent(data, d => parseFloat(d[key])), [height, 0])]
        ));

        const svg = d3.select(svgContainerRef.current)
            .append("svg")
            .attr('id', 'coord-svg')
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

         // brush behavior
         const selections = new Map();
         const brushWidth = 70;

        // adding axes
        selectedDims.forEach(dim => {
            const axes = svg.append("g")
                .attr("class", "axis")
                .attr("transform", `translate(${xScale(dim)},${margin.top})`);

            axes.call(d3.axisLeft(y.get(dim)).ticks(5));

            axes.append("text")
                .attr("y", -9)
                .style("text-anchor", "middle")
                .style("fill", "black")
                .text(dim);

            const brush = d3.brushY()
                .extent([[-(brushWidth / 2), 0], [brushWidth / 2, height]])
                .on('start brush end', event => brushed(event, dim));

            axes.call(brush);
        });

        function brushed({ selection }, key) {
            if (!selection) {
                selections.delete(key);
            } else {
                const [min, max] = selection.map(y.get(key).invert);
                selections.set(key, [Math.min(min, max), Math.max(min, max)]);
            }
        
            let selected = [];
            if (selections.size === 0) {
                setSelectedPoints([]);
            } else {
                paths.each(function (d) {
                    const active = Array.from(selections).every(([key, [min, max]]) => {
                        const value = +d[key]; 
                        return value >= min && value <= max;
                    });
        
                    d3.select(this).style("stroke", active ? getColor('select') : getColor('default'));
        
                    if (active) {
                        d3.select(this).raise();
                        selected.push(d.Measurement);
                    }
                });
        
                setSelectedPoints(selected);
            }
        }
        
        
    
        
        function path(d) {
            return d3.line()(selectedDims.map(function(p) { return [xScale(p), y.get(p)(d[p]) + margin.top]; }));
        }
        
        const paths = svg.selectAll("pcp-path")
            .data(data)
            .enter()
            .append("path")
                .attr("class", function (d) { return "line " + d.Measurement } ) 
                .attr("d",  path)
                .style("fill", "none" )
                // .style("stroke", function(d){ return getColor('default')} )
                .style("stroke", d => (d.Measurement && selectedPoints.includes(d.Measurement)) ? getColor('select') : getColor('default'))
                .style("opacity", 0.5)
                .each(function(d) {
                if (firstRenderRef.current) {
                    const totalLength = this.getTotalLength();
            
                    d3.select(this)
                        .attr("stroke-dasharray", totalLength + " " + totalLength)
                        .attr("stroke-dashoffset", totalLength)
                        .transition()
                        .duration(1000) 
                        .ease(d3.easeLinear)
                        .attr("stroke-dashoffset", 0);
                }
                });

                paths.on('mouseover', function(event, d) {
                    const tooltipWidth = 150; 
                    const windowWidth = window.innerWidth;  
                
                    let tooltipX = event.clientX + 5;  
                    if (tooltipX + tooltipWidth > windowWidth) {
                        tooltipX = event.clientX - tooltipWidth - 5;  
                    }

                    d3.select(this)
                        .style("stroke-width", 2.4)
                        .style("opacity", 1) 
                    

                    // node ID tooltip
                    setTooltip({
                        visible: true,
                        content: `${d.Measurement}`,
                        x: tooltipX,
                        y: event.clientY
                    });

                    d3.select(`#${d.Measurement}`)
                        .transition().duration(200)
                        .attr("r", 6)  
                        
                    })
                .on('mouseout', function(event, d) {
                    d3.select(this)
                        .style("stroke-width", 1) 
                        .style("opacity", 0.5);

                    setTooltip({ visible: false, content: '', x: 0, y: 0 }); 

                    d3.select(`#${d.Measurement}`)
                        .transition().duration(200)
                        .attr("r", 3)
                });
        
            firstRenderRef.current = false;

        // svg.selectAll("myAxis")
        //     .data(selectedDims).enter()
        //     .append("g")
        //     .attr("class", "axis")
        //     .attr("transform", function(d) { return `translate(${xScale(d)},${margin.top})`; })
        //     .each(function(d) { d3.select(this).call(d3.axisLeft().ticks(5).scale(yScales[d])); })
        //     .append("text")
        //       .style("text-anchor", "middle")
        //       .attr("y", -9)
        //       .text(function(d) { return d; })
        //       .style("fill", "black")
        
    }, [data, selectedDims]);

    const handleCheckboxChange = (key) => {
        setSelectedDims(prevSelectedDims => {
            if (prevSelectedDims.includes(key)) {
                return prevSelectedDims.filter(dim => dim !== key);
            } else {
                return [...prevSelectedDims, key];
            }
        });
    };

    return  (
        <div style={{ display:'flex', alignItems: 'flex-start' }}>
            <List sx={{ width: '100%', maxWidth: 120, maxHeight: 330, overflowY: 'auto', marginRight: '10px' }}>
                {allKeys.map((key, index) => {
                    const labelId = `checkbox-list-label-${index}`;

                    return (
                        <ListItem
                            key={key}
                            disablePadding
                            sx={{ paddingTop: 0, paddingBottom: 0 }}
                        >
                            <ListItemButton
                                role={undefined}
                                onClick={() => handleCheckboxChange(key)}
                                dense
                            >
                                <Checkbox
                                    edge="start"
                                    size="small"
                                    style={{ width: "20px" }}
                                    checked={selectedDims.includes(key)}
                                    tabIndex={-1}
                                    disableRipple
                                    inputProps={{ 'aria-labelledby': labelId }}
                                />
                                <ListItemText id={labelId} primary={key} />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            <div ref={svgContainerRef} style={{ width: '100%', height: '380px' }}></div>
            <Tooltip
                visible={tooltip.visible}
                content={tooltip.content}
                x={tooltip.x}
                y={tooltip.y}
            />
        </div>
    );
};

export default Coordinates;