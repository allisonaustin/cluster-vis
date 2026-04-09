import { useState, useEffect, useRef } from 'react';
import { colorScale } from '../utils/colors.js';
import { Card } from "antd";
import Tooltip from '../utils/tooltip.js';
import * as d3 from 'd3';

const HeatmapView = ({ data, nodeClusterMap }) => {
    const heatmapRef = useRef();
    const legendRef = useRef();
    const [margin, setMargin] = useState({ top: 0, right: 50, bottom: 100, left: 100 });
    const [tooltip, setTooltip] = useState({
            visible: false,
            content: '',
            x: 0,
            y: 0
        });

    useEffect(() => {
        if (!heatmapRef.current || !nodeClusterMap || !legendRef.current || !data || data.length == 0) return;        

        const nodeIds = data.map(d => d.nodeId);
    
        nodeIds.sort((a, b) => {
            // Extract the part after the last hyphen and convert to number
            const valA = parseInt(a.split('-').pop());
            const valB = parseInt(b.split('-').pop());
            return valA - valB;
        });
        
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
        const cellHeight = 30;
        const mapWidth = nodeIds.length * cellWidth;
        const mapHeight = featureNames.length * cellHeight;

        const containerNode = heatmapRef.current;
        const visibleHeight = containerNode ? containerNode.clientHeight : 400;

        const yScale = d3.scaleBand().domain(featureNames).range([0, mapHeight]).padding(0.05);
        const xScale = d3.scaleBand().domain(nodeIds).range([0, mapWidth]).padding(0.05);
        const myColor = d3.scaleDiverging().interpolator(d3.interpolateRdBu).domain([5, 0, -5]);

        const container = d3.select(heatmapRef.current);
        let parent = container.select("#heatmap-parent");

        if (parent.empty()) {
            parent = container.append("div").attr("id", "heatmap-parent")
                .style("position", "relative")
                .style("width", "100%")
                .style("height", "100%");

            const scrollDiv = parent.append("div")
                .attr("id", "heatmap-scroll")
                .style("position", "absolute")
                .style("left", `${margin.left}px`)
                .style("top", `${margin.top}px`)
                .style("width", `calc(100% - ${margin.left}px)`)
                .style("height", `${visibleHeight - margin.top - margin.bottom}px`) 
                .style("overflow", "auto")
                .style("scrollbar-width", "none")
                .style("z-index", 1);

            const svg = scrollDiv.append("svg").attr("id", "heatmap-svg");
            svg.append("g").attr("class", "heatmap-group");

            const axisSvg = parent.append("svg")
                .attr("id", "axis-svg")
                .style("position", "absolute")
                .style("top", 0).style("left", 0)
                .style("pointer-events", "none")
                .style("z-index", 10);

            axisSvg.append("rect").attr("id", "y-axis-bg").style("fill", "white");
            axisSvg.append("rect").attr("id", "x-axis-bg").style("fill", "white");

            axisSvg.append("g").attr("class", "y-axis");
            axisSvg.append("g").attr("class", "x-axis");
        }

        const stickyXPosition = visibleHeight - margin.bottom;

        const scrollDiv = container.select("#heatmap-scroll")
            .style("height", `${stickyXPosition - margin.top}px`); // Clip rows before they hit the X-axis

        const svg = container.select("#heatmap-svg")
            .attr("width", mapWidth)
            .attr("height", mapHeight);

        const axisSvg = container.select("#axis-svg")
            .attr("width", containerNode.clientWidth)
            .attr("height", visibleHeight);

        axisSvg.select("#y-axis-bg").attr("width", margin.left).attr("height", visibleHeight);
        
        axisSvg.select("#x-axis-bg")
            .attr("x", margin.left)
            .attr("y", stickyXPosition) 
            .attr("width", containerNode.clientWidth - margin.left)
            .attr("height", margin.bottom);

        container.select(".y-axis").call(d3.axisLeft(yScale));
        container.select(".x-axis")
            .call(d3.axisBottom(xScale))
            .selectAll("text")
            .attr("transform", "rotate(-65)")
            .attr("dx", "-.8em").attr("dy", ".15em")
            .style("text-anchor", "end")
            .style("fill", d => colorScale(nodeClusterMap.get(d) ?? "black"))
            .style("font-weight", "bold");

        function syncAxesToScroll() {
            const node = scrollDiv.node();
            const scrollLeft = node.scrollLeft;
            const scrollTop = node.scrollTop;

            container.select(".y-axis")
                .attr("transform", `translate(${margin.left}, ${margin.top - scrollTop})`);

            container.select(".x-axis")
                .attr("transform", `translate(${margin.left - scrollLeft}, ${stickyXPosition})`);
        }

        scrollDiv.on("scroll", syncAxesToScroll);
        syncAxesToScroll();

        // --- Render Cells ---
        const cells = svg.select('.heatmap-group').selectAll('.heatmap-cell')
            .data(matrix, d => d.nodeId + ':' + d.feature);

        cells.enter()
            .append("rect")
            .attr("class", d => `heatmap-cell node-${d.nodeId}`)
            .merge(cells)
            .attr("x", d => xScale(d.nodeId))
            .attr("y", d => yScale(d.feature))
            .attr("width", xScale.bandwidth())
            .attr("height", yScale.bandwidth())
            .attr("rx", 4).attr("ry", 4)
            .style("fill", d => myColor(d.value))
             .on("mouseover", function(event, d) {
                d3.select(this).style("stroke", "black").style("stroke-width", "2px").style("opacity", 1);
                d3.select(`#${d.nodeId}`).transition().duration(150).attr("r", 8).style("opacity", 1);
                d3.selectAll("path.line").transition().duration(150)
                .style("opacity", function() { return d3.select(this).classed(`line-${d.nodeId}`) ? 1 : 0.1; })
                .style("stroke-width", function() { return d3.select(this).classed(`line-${d.nodeId}`) ? "3px" : "1.5px"; }); 
                 setTooltip({
                    visible: true,
                    content: `${d.nodeId}, ${d.value?.toFixed(3) || 'N/A'}`,
                    x: event.clientX,
                    y: event.clientY,
                });

                })
                .on("mouseout", function(event, d) {
                    d3.select(this).style("stroke", "none").style("opacity", 0.8);
                    d3.select(`#${d.nodeId}`).transition().duration(150).attr("r", 4);
                    d3.selectAll("path.line").interrupt().transition().duration(150)
                    .style("opacity", 0.8).style("stroke-width", "1.5px");
                    setTooltip(prev => ({ ...prev, visible: false }));
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
    <Card title="NODE BEHAVIOR VIEW" size="small" style={{ height: "calc(50vh - 20px)", width: '100%' }}>
        <div style={{ display:'flex', position:'relative' }}>
            <div ref={heatmapRef} style={{
                    width: "100%",
                    height: "calc(50vh - 150px)",
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