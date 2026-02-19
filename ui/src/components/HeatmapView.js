import { useState, useEffect, useRef } from 'react';
import { colorScale } from '../utils/colors.js';
import { Card } from "antd";
import Tooltip from '../utils/tooltip.js';
import * as d3 from 'd3';

const HeatmapView = ({ data, nodeClusterMap }) => {
    const heatmapRef = useRef();
    const legendRef = useRef();
    const [margin, setMargin] = useState({ top: 10, right: 50, bottom: 130, left: 100 });
    const [size, setSize] = useState({ width: 800, height: 140 });
    const [tooltip, setTooltip] = useState({
            visible: false,
            content: '',
            x: 0,
            y: 0
        });

    useEffect(() => {
        if (!heatmapRef.current || !nodeClusterMap || !legendRef.current || !data || data.length == 0) return;        

        const nodeIds = data.map(d => d.nodeId);
        const features = Object.keys(data[0]).filter(key => key !== "nodeId")
        const matrix = [];
        features.forEach((feature, rowIndex) => {
            data.forEach((d, colIndex) => {
                matrix.push({
                    feature,
                    nodeId: d.nodeId,
                    value: d[feature],
                    row: rowIndex,
                    col: colIndex
                });
            });
        });
        drawHeatmap(matrix, features, nodeIds);
        
    }, [data, nodeClusterMap]);

    const drawHeatmap = (matrix, featureNames, nodeIds) => {
        const cellWidth = 20;
        const cellHeight = 20;

        const mapWidth = nodeIds.length * cellWidth;
        const mapHeight = featureNames.length * cellHeight;

        const yScale = d3.scaleBand()
            .domain(featureNames)
            .range([0, mapHeight])
            .padding(0.05);

        const xScale = d3.scaleBand()
            .domain(nodeIds)
            .range([0, mapWidth])
            .padding(0.05);

        const myColor = d3.scaleDiverging()
            .interpolator(d3.interpolateRdBu)
            .domain([5,0,-5]);

        const container = d3.select(heatmapRef.current);
        let parent = container.select("#heatmap-parent");

        if (parent.empty()) {
            parent = container.append("div")
                        .attr("id", "heatmap-parent");
            
            const axisSvg = parent.append("svg")
                .attr("id", "axis-svg")
                .attr("width", size.width + margin.left + margin.right)
                .attr('height', size.height + margin.top + margin.bottom)
                .style("position", "absolute")
                .style("pointer-events", "none")
                .style("z-index", 2)
            
            axisSvg.append("rect")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", margin.left)
                .attr("height", size.height + margin.top + margin.bottom)
                .style("fill", "white")
                .style("stroke", "none")
                .lower()
            
            axisSvg.append("g")
                .attr("class", "y-axis")
                .attr("transform", `translate(${margin.left}, ${margin.top})`)

            axisSvg.append("rect")
                .attr("x", 0)
                .attr("y", size.height + margin.top)
                .attr("width", size.width)
                .attr("height", margin.bottom)
                .style("fill", "white")
                .style("stroke", "none")
            
            axisSvg.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(${margin.left}, ${size.height + margin.top})`)

            // scrollable container (viewport)
            const scrollDiv = parent.append("div")
                .attr("id", "heatmap-scroll")
                .style("overflow", "auto")
                .style("width", `${size.width}px`)                   
                .style("height", `${size.height + margin.top + margin.bottom}px`)
                .style("-webkit-overflow-scrolling", "touch");

            const svg = scrollDiv.append("svg")
                .attr("id", "heatmap-svg")
                .attr("width", size.width + margin.left + margin.right)
                .attr("height", mapHeight + margin.top + margin.bottom + 10)
                .style("display", "block");

            svg.append("g")
                .attr("class", "heatmap-group")
                .attr("transform", `translate(${margin.left}, ${margin.top})`);
        }

        let svg = container.select("#heatmap-svg");
        let axisSvg = container.select("#axis-svg");
        const scrollDiv = d3.select("#heatmap-scroll");

        axisSvg.select(".y-axis")
            .style('font-size', 14)
            .transition().duration(200)
            .call(d3.axisLeft(yScale))

        axisSvg.select(".x-axis")
            .transition().duration(200)
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .attr("transform", "rotate(-65)")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .style('font-size', '12px')
            .style("text-anchor", "end")
            .style("fill", d => { 
                const clusterId = nodeClusterMap.get(d); 
                return clusterId !== undefined ? colorScale(clusterId) : "black";
            })
            .style("font-weight", "bold");

        function syncAxesToScroll() {
            const node = scrollDiv.node();
            const scrollLeft = node.scrollLeft;
            const scrollTop = node.scrollTop;

            // Move x-axis horizontally to match heatmap scroll
            axisSvg.select(".x-axis")
                .attr("transform", `translate(${margin.left - scrollLeft}, ${margin.top + size.height})`);

            // Move y-axis vertically to match heatmap scroll
            axisSvg.select(".y-axis")
                .attr("transform", `translate(${margin.left}, ${margin.top - scrollTop})`);
        }

        // attach handler
        scrollDiv.on("scroll", syncAxesToScroll);

        // initialize positions
        syncAxesToScroll();

        // --------- Heatmap cells rendering --------------
        const hGroup = svg.select('.heatmap-group');
        const cells = hGroup.selectAll('.heatmap-cell')
            .data(matrix, function(d) {return d.nodeId+':'+d.feature;});

        cells.transition().duration(500)
            .style("fill", function(d) { return myColor(d.value)} )
            .attr("x", function(d) { return xScale(d.nodeId) }) 
            .attr("y", function(d) { return yScale(d.feature) })
            .attr("width", xScale.bandwidth() )
            .attr("height", yScale.bandwidth() );

        cells.enter()
            .append("rect")
            .attr("class", d => `heatmap-cell node-${d.nodeId}`)
            .attr("x", d => xScale(d.nodeId))
            .attr("y", d => yScale(d.feature))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("rx", 4)
            .attr("ry", 4)
            .style("fill", d => myColor(d.value))
            .style("stroke", "none")
            .style("opacity", 0.8)
            .on("mouseover", function(event, d) {
                    d3.select(this)
                        .style("stroke", "black")
                        .style("stroke-width", "2px")
                        .style("opacity", 1);
                    
                    // highlighting circle in dr plot
                    let circs = d3.select(`#${d.nodeId}`) 
                    circs
                        .transition()
                        .duration(150)
                        .attr("r", 8)  
                        .style("opacity", 1)


                    const allLines = d3.selectAll("path.line");
                    allLines.transition()
                        .duration(150)
                        .style("opacity", function() {
                            return d3.select(this).classed(`line-${d.nodeId}`) ? 1 : 0.1;
                        })
                        .style("stroke-width", function() {
                            return d3.select(this).classed(`line-${d.nodeId}`) ? "3px" : "1px";
                        });
                    setTooltip({
                        visible: true,
                        content: `${d.nodeId}, ${d.value !== null && d.value !== undefined ? d.value.toFixed(3) : 'N/A'}`,
                        x: event.clientX,
                        y: event.clientY,
                    });
                })
            .on("mouseout", function(event, d) {
                d3.select(this)
                    .style("stroke", "none")  
                    .style("opacity", 0.8);

                let circs = d3.select(`#${d.nodeId}`)
                circs
                    .transition()
                    .duration(150)
                    .attr("r", 4)

                d3.selectAll("path.line")
                    .interrupt()
                    .transition()
                    .duration(150)
                    .style("opacity", 0.8)     
                    .style("stroke-width", "1.5px");

                setTooltip(prev => ({
                    ...prev,
                    visible: false,
                }));
            });


        cells.exit().remove();

        // ----- Legend rendering -----
        let lSvg = d3.select(legendRef.current).select('svg');

        if (lSvg.empty()) {
            lSvg = d3.select(legendRef.current)
                .append('svg')
                .attr('width', 200)
                .attr('height', 50);

            const legendWidth = 120;
            const legendHeight = 10;

            const defs = lSvg.append("defs");
            const linearGradient = defs.append("linearGradient")
                .attr("id", "legend-gradient")
                .attr("x1", "0%").attr("x2", "100%")
                .attr("y1", "0%").attr("y2", "0%");

            linearGradient.selectAll("stop")
                .data([
                    { offset: "0%", color: myColor(-3) },
                    { offset: "50%", color: myColor(0) },
                    { offset: "100%", color: myColor(3) }
                ])
                .enter().append("stop")
                .attr("offset", d => d.offset)
                .attr("stop-color", d => d.color);

            const legendGroup = lSvg.append("g")
                .attr("transform", `translate(20, 20)`);

            legendGroup.append("rect")
                .attr("width", legendWidth)
                .attr("height", legendHeight)
                .style("fill", "url(#legend-gradient)");

            const legendScale = d3.scaleLinear()
                .domain([-5, 5])
                .range([0, legendWidth]);

            const legendAxis = d3.axisBottom(legendScale)
                .tickValues([-5, -2.5, 0, 2.5, 5])
                .tickFormat(d3.format(".1f"))
                .tickSize(5);

            legendGroup.append("g")
                .attr("transform", `translate(0, ${legendHeight})`)
                .call(legendAxis)
                .style('font-size', 12)
                .select(".domain").remove();

            legendGroup.append('text')
                .attr('x', legendWidth / 2)
                .attr('y', -5)
                .style('text-anchor', 'middle')
                .style('font-size', '12px')
                .style('font-weight', 'bold')
                .text('Z-Scores');
        }
    };
      

return (
    <Card title="NODE BEHAVIOR VIEW" size="small" style={{ height: "auto" }}>
        <div style={{ display:'flex', position:'relative' }}>
            <div ref={heatmapRef} style={{
                    width: "100%",
                    height: "auto",
                    overflow: "hidden",
                    position: "relative"
                }}
            />
        </div>

        <div ref={legendRef} style={{ overflow:'hidden' }}  />
        <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={`zscores-tooltip`}
          />
    </Card>
    );
};

export default HeatmapView;