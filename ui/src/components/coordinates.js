import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { getColor } from '../utils/colors.js';
import { Button, ButtonGroup } from '@mui/material';
import * as d3 from 'd3';

const Coordinates = ({ data }) => {
    const svgContainerRef = useRef();
    const [plotData, setPlotData] = useState([]);
    const [size, setSize] = useState({ width: 680, height: 300 });
    const [key, setKey] = useState('cpu');
    const [keyOptions, setKeyOptions] = useState({
        cpu: ['cpu'],
        memory: ['mem', 'disk', 'swap', 'part_max_used'],
        load: ['load', 'boottime', 'proc'],
        network: ['bytes', 'pkts', 'Missed Buffers'],
        PoolSize: ['Pool Size'],
        Retrans: ['Retrans'],
    })

    useEffect(() => {
        if (!svgContainerRef.current) return;
        d3.select(svgContainerRef.current).selectAll("*").remove();
        setPlotData(data);
        
        const margin = { top: 20, right: 10, bottom: 20, left: 20 };
        const width = size.width - margin.left - margin.right;
        const height = size.height - margin.top - margin.bottom;

        const selectedKeys = keyOptions[key];

        const dimensions = Object.keys(data[0]).filter(d => 
            selectedKeys.some(subKey => d.includes(subKey))
        );

        const xScale = d3.scalePoint()
            .domain(dimensions)
            .range([margin.left, width]);

        const yScales = {}

        dimensions.forEach(dim => {
            yScales[dim] = d3.scaleLinear()
                .domain(d3.extent(data, d => parseFloat(d[dim])))
                .range([height, 0])
        });

        const svg = d3.select(svgContainerRef.current)
            .append("svg")
            .attr('id', 'coord-svg')
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", `0 0 ${size.width} ${size.height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");
    
        
        function path(d) {
            return d3.line()(dimensions.map(function(p) { return [xScale(p), yScales[p](d[p]) + margin.top]; }));
        }
        
        svg
        .selectAll("myPath")
        .data(data)
        .enter()
        .append("path")
            .attr("class", function (d) { return "line " + d.Measurement } ) 
            .attr("d",  path)
            .style("fill", "none" )
            .style("stroke", function(d){ return getColor('default')} )
            .style("opacity", 0.5)
            .each(function(d) {
                const totalLength = this.getTotalLength();
        
                d3.select(this)
                    .attr("stroke-dasharray", totalLength + " " + totalLength)
                    .attr("stroke-dashoffset", totalLength)
                    .transition()
                    .duration(1000) 
                    .ease(d3.easeLinear)
                    .attr("stroke-dashoffset", 0);
            });

        svg.selectAll("myAxis")
            .data(dimensions).enter()
            .append("g")
            .attr("class", "axis")
            .attr("transform", function(d) { return `translate(${xScale(d)},${margin.top})`; })
            .each(function(d) { d3.select(this).call(d3.axisLeft().ticks(5).scale(yScales[d])); })
            .append("text")
              .style("text-anchor", "middle")
              .attr("y", -9)
              .text(function(d) { return d; })
              .style("fill", "black")
        
    }, [key, data]);

    return  <div>
        <ButtonGroup size="small" aria-label="filter buttons" style={{ marginBottom: '10px' }}>
            {Object.keys(keyOptions).map(option => (
                <Button 
                    key={option} 
                    onClick={() => setKey(option)}
                    variant={key === option ? "contained" : "outlined"}
                >
                    {option}
                </Button>
            ))}
        </ButtonGroup>

        <div ref={svgContainerRef} style={{ width: '100%', height: '280px' }}></div>
    </div>;
};

export default Coordinates;