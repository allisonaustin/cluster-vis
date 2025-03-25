import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale } from '../utils/colors.js';
import LassoSelection from '../utils/lasso.js';
import { Card, Form, Col, Row, Select } from "antd";
import Tooltip from '../utils/tooltip.js';
import Contributions from './Contributions.js';
import * as d3 from 'd3';

const { Option } = Select;

const DR = ({ data, fcs, type, setSelectedPoints, selectedPoints, hoveredPoint, setHoveredPoint }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [size, setSize] = useState({ width: 400, height: 300 });
    // const [selectedPoints, setSelectedPoints] = useState([]);
    const [method1, setMethod1] = useState("PC");
    const [method2, setMethod2] = useState("UMAP");
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });

    function getIdVal(d) {
        return (type === 'feature') ? d.Measurement : d.nodeId;
      }

    useEffect(() => {
        if (!svgContainerRef.current || !data ) return;
        
        d3.select(svgContainerRef.current).selectAll("*").remove();
        setChartData(data);
        const { w, h } = svgContainerRef.current.getBoundingClientRect();
        setSize({ w, h });
        
        const margin = { top: 10, right: 30, bottom: 50, left: 50 };
        const width = size.width;
        const height = size.height;

        const xKey = method2 + '1';
        const yKey = method2 + '2';

        const xScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d[xKey]) - 1, d3.max(data, d => +d[xKey]) + 1])
            .range([0, width - margin.right]);

        const yScale = d3.scaleLinear()
            .domain([d3.min(data, d => +d[yKey]) - 1, d3.max(data, d => +d[yKey]) + 1])
            .range([height - margin.bottom, margin.top]);
        
        // const xAxis = d3.axisBottom(xScale);
        
        const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `dr-chart-svg-${type}`)
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");
        
        // svg.append('g')
        //     .attr('class', 'x-axis')
        //     .attr('transform', `translate(0,${height - margin.bottom})`)
        //     .call(xAxis)
        //     .selectAll("text")
        //     .style("font-size", "14px");

        // x axis label
        // svg.append('text')
        //     .attr('id', 'x-axis-label-dr')
        //     .attr("x", width/2)
        //     .attr("y", height)
        //     .style('text-anchor', 'middle')
        //     .text(xKey)
        //     .style('font-size', '16px');


        // const yAxis = d3.axisLeft(yScale).ticks(height / 40);
        // svg.append("g")
        //     .attr("class", "y-axis")
        //     .attr("transform", `translate(${margin.left},0)`)
        //     .call(yAxis)
        //     .call(g => g.append("text")
        //         .attr('id', 'y-axis-label-dr')
        //         .attr("x", -height/2)
        //         .attr("y", -margin.right)
        //         .attr("fill", "currentColor")
        //         .attr("text-anchor", "start")
        //         .attr("transform", "rotate(-90)")
        //         .style('font-size', '16px')
        //         .text(yKey)); // Y label

        // svg.select('.y-axis')
        //     .selectAll("text")
        //     .style("font-size", "14px")

        let circs = svg.selectAll(".dr-circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("class", (d, i) => "dr-circle")
            .attr('id', d => getIdVal(d))
            .attr("cx", d => xScale(d[xKey]))
            .attr("cy", d => yScale(d[yKey]))
            .attr('stroke','black')
            .attr('stroke-width', '1px')
            .attr("r", 4)
            .style('fill', (d, i) => colorScale(d.Cluster))
            .on("mouseover", function (event, d) {
                setHoveredPoint(getIdVal(d)); 

            })
            .on("mouseout", function (event, d) {
                setHoveredPoint(null);

                setTooltip({
                    visible: false,
                    content: '',
                    x: 0,
                    y: 0,
                  });
            })
            .style('opacity', 0);

            circs
                .transition()
                .duration(800)
                .style("opacity", 1);

            svg.node().xScale = xScale;
            svg.node().yScale = yScale;
    
        return () => {
            svg.remove();
        };
        
    }, [data, type]);

    useEffect(() => {
        d3.select(svgContainerRef.current)
            .selectAll(".dr-circle")
            .transition()
            .duration(300)
            .style("fill", d => {
                const idVal = getIdVal(d);
                if (selectedPoints.length === 0) {
                    return colorScale(d.Cluster);
                } else {
                    return selectedPoints.includes(idVal) 
                        ? getColor('select') 
                        : getColor('default');
                }
            })
            .style("opacity", d => {
                const idVal = getIdVal(d);
                return selectedPoints.includes(idVal) ? 1 : 0.7;
            });
    }, [selectedPoints]); 

    useEffect(() => {
        d3.select(svgContainerRef.current)
            .selectAll(".dr-circle")
            .transition()
            .duration(150)
            .attr("r", d => {
                const idVal = getIdVal(d);
                return idVal === hoveredPoint ? 8 : 4;
            })
            .style("opacity", d => {
                const idVal = getIdVal(d);
                return idVal === hoveredPoint ? 1 : 0.7;
            });
    }, [hoveredPoint]);

    useEffect(() => {
        if (hoveredPoint) {
          const circleNode = d3.select(svgContainerRef.current).select(`#${hoveredPoint}`).node();
          if (circleNode) {
            const bbox = circleNode.getBoundingClientRect();
            let tooltipX = bbox.x + bbox.width + 5;
            let tooltipY = bbox.y + bbox.height / 2;
            const tooltipWidth = 150; 
            
            const containerRect = svgContainerRef.current.getBoundingClientRect();
            if (tooltipX + tooltipWidth > containerRect.right) {
              tooltipX = bbox.x - tooltipWidth - 5;
            }
            
            setTooltip({
              visible: true,
              content: hoveredPoint,
              x: tooltipX,
              y: tooltipY,
            });
          }
        } else {
          setTooltip({ visible: false, content: '', x: 0, y: 0 });
        }
      }, [hoveredPoint]);
      
      

    const updateChart = (method1, method2) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        setMethod1(method1)
        setMethod2(method2)

        const xKey = method2 + '1';
        const yKey = method2 + '2';

        const xScale = chart.node()?.xScale;
        const yScale = chart.node()?.yScale;

        xScale.domain([d3.min(data, d => +d[xKey]) - 1, d3.max(data, d => +d[xKey]) + 1])
        yScale.domain([d3.min(data, d => +d[yKey]) - 1, d3.max(data, d => +d[yKey]) + 1])

        chart.select("#x-axis-label-dr")
            .text(xKey);

        chart.select("#y-axis-label-dr")
            .text(yKey);

        const t = d3.transition()
            .duration(400) 
            .ease(d3.easeCubicInOut);
        
        chart.select('.x-axis').call(d3.axisBottom(xScale));
        chart.select('.y-axis').transition(t).call(d3.axisLeft(yScale)).selectAll('text').style('font-size', '16px');

        chart.selectAll(".dr-circle")
            .data(data)
            .join("circle")  
            .transition()
            .duration(1000)
            .attr("cx", d => xScale(+d[xKey]))
            .attr("cy", d => yScale(+d[yKey]))
    }

    const handleSelection = (selected) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        
        // console.log("Selected Items:", selected);
        setSelectedPoints(selected)
        
        chart.selectAll('.dr-circle')
        .style('fill', d => {
            const idVal = getIdVal(d);
            return selected.includes(idVal) ? getColor('select') : getColor('default');
        })
        .style("opacity", d => {
            const idVal = getIdVal(d);
            return selected.includes(idVal) ? 1 : 0.7;
        });

        // updating parallel coordinates plot
        const coordChart = d3.select("#coord-svg"); 
        coordChart.selectAll(".line")
        .style("stroke", d => {
            const idVal = (type === 'feature') ? d.Measurement : d.nodeId;
            return selected.includes(idVal) ? getColor('select') : getColor('default');
        })
        .style("opacity", d => {
            const idVal = (type === 'feature') ? d.Measurement : d.nodeId;
            return selected.includes(idVal) ? 1 : 0.5;
        });
    };

    return (
        <Card 
            title="DR VIEW" 
            size="small" 
            style={{ height:'auto' }}
        >
            <Row>
            <Col span={14}>
                <div ref={svgContainerRef}></div>

                <LassoSelection svgRef={svgContainerRef} targetItems={".dr-circle"} onSelect={handleSelection} />

                <div id="form-container" style={{ display: "flex", flexDirection: "row", gap: "5px" }}>
                    <Form layout="inline">
                        <Form.Item label="DR1">
                        <Select
                            value={method1}
                            onChange={(value) => updateChart(value, method2)}
                        >
                            <Option value="UMAP">UMAP</Option>
                            <Option value="tSNE">t-SNE</Option>
                            <Option value="PC">PCA</Option>
                        </Select>
                        </Form.Item>
                    </Form>

                    <Form layout="inline">
                        <Form.Item label="DR2">
                        <Select
                            value={method2}
                            onChange={(value) => updateChart(method1, value)}
                        >
                            <Option value="UMAP">UMAP</Option>
                            <Option value="tSNE">t-SNE</Option>
                            <Option value="PC">PCA</Option>
                        </Select>
                        </Form.Item>
                    </Form>
                </div>
                
                <Tooltip
                    visible={tooltip.visible}
                    content={tooltip.content}
                    x={tooltip.x}
                    y={tooltip.y}
                />
            </Col>

            <Col span={10} style={{ borderLeft: '1px solid #d9d9d9' }}>
                {/* <Contributions
                    data={data}
                    FCs={fcs} 
                /> */}
            </Col>
        </Row>
    </Card>
    );

}

export default DR;