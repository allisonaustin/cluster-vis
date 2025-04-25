import { Card, Col, Form, Row, Select, InputNumber } from "antd";
import * as d3 from 'd3';
import React, { useEffect, useRef, useState } from 'react';
import { colorScale, getColor } from '../utils/colors.js';
import LassoSelection from '../utils/lasso.js';
import Tooltip from '../utils/tooltip.js';

const { Option } = Select;

const DR = ({ data, type, setSelectedPoints, selectedPoints, selectedDims, zScores, setzScores, baselines, setBaselines }) => {
    const svgContainerRef = useRef();
    const [chartData, setChartData] = useState([]);
    const [nodeClusterMap, setNodeClusterMap] = useState(new Map());
    const [size, setSize] = useState({ width: 400, height: 340 });
    const [method1, setMethod1] = useState("PC");
    const [method2, setMethod2] = useState("UMAP");
    const [numClusters, setNumClusters] = useState(4);
    const [highlight, setHighlight] = useState(1);
    const [nonHighlight, setNonHighlight] = useState(0.2);
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

        const clusters = new Map();
        data.forEach(d => {
            clusters.set(d.nodeId, d.Cluster);
        });
        setNodeClusterMap(clusters);

        // NOTE: this currently does nothing as 1) setSize() runs after this useEffect() runs,
        //       and 2) this useEffect() does not depend on Size. All logic will be run with the default
        //       size of 400 x 300.
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
        
        const svg = d3.select(svgContainerRef.current)
          .append("svg")
          .attr('id', `dr-chart-svg-${type}`)
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("viewBox", `0 0 ${size.width} ${size.height}`)
          .attr("preserveAspectRatio", "xMidYMid meet");

          const zoomLayer = svg.append("g")
          .attr("class", "zoom-layer");

        //   const xAxis = d3.axisBottom(xScale);
        
        // svg.append('g')
        //     .attr('class', 'x-axis')
        //     .attr('transform', `translate(0,${height - margin.bottom})`)
        //     .call(xAxis)
        //     .selectAll("text")
        //     .style("font-size", "14px");

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

        // let circs = svg.selectAll(".dr-circle")
        let circs = zoomLayer.selectAll(".dr-circle")
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
            .style('fill', d => colorScale(d.Cluster))
            .style("opacity", d => {
                return selectedPoints.includes(d.nodeId) ? highlight : nonHighlight;
            })
            .attr("_prevOpacity", d => {
                return selectedPoints.includes(d.nodeId) ? highlight : nonHighlight;
            })
            .on("mouseover", function (event, d) {
                let circle = d3.select(this)

                circle.attr("_prevOpacity", circle.style("opacity"));

                circle
                    .transition()
                    .duration(150)
                    .attr("r", 8)
                    .style("opacity", highlight)

                // highlighting mrdmd cell 
                d3.selectAll(`.node-${d.nodeId}`)
                    .transition()
                    .duration(150)
                    .style("stroke", "black")
                    .style("stroke-width", 2);

                // highlighting time series
                let lines = d3.selectAll(".line-svg").selectAll("path.line");
                lines.each(function(lineData) {
                    if (lineData[0] === d.nodeId) {
                        d3.select(this)
                            .transition()
                            .duration(150)
                            .style("opacity", 1)
                            // .attr('stroke', colorScale(d.Cluster)); 
                    } else {
                        d3.select(this)
                            .transition()
                            .duration(150)
                            .style("opacity", 0.1); 
                    }
                });

                setTooltip({
                    visible: true,
                    content: d.nodeId,
                    x: event.clientX,
                    y: event.clientY,
                });
            })
            .on("mouseout", function (event, d) {
                let circle = d3.select(this)

                let prevOpacity = circle.attr("_prevOpacity") || nonHighlight; 
                circle.transition()
                    .duration(150)
                    .attr("r", 4)
                    .style("opacity", prevOpacity);

                d3.selectAll(`.node-${d.nodeId}`)
                    .transition()
                    .duration(150)
                    .style("stroke", "none") // Remove border
                    .style("stroke-width", 0);

                let lines = d3.selectAll(".line-svg").selectAll("path.line");

                // Resetting all line styles
                lines.transition()
                    .duration(150)
                    .style("stroke-width", 1)
                    .style("opacity", highlight)

                setTooltip(prev => ({
                    ...prev,
                    visible: false,
                }));
            })
            .style('opacity', 0);

            circs
                .transition()
                .duration(800)
                .style("opacity", d => {
                    const idVal = getIdVal(d);
                    return selectedPoints.includes(idVal) ? highlight : nonHighlight;
                })

            svg.node().xScale = xScale;
            svg.node().yScale = yScale;

            const zoom = d3.zoom()
            .scaleExtent([0.5, 10])
            .filter(event => event.type === "wheel")   
            .on("zoom", (event) => {
              zoomLayer.attr("transform", event.transform);
            });
        
            svg.call(zoom);
    
        return () => {
            svg.remove();
        };
        
    }, [data, type]);

    useEffect(() => {
        d3.select(svgContainerRef.current)
            .selectAll(".dr-circle")
            .transition()
            .duration(300)
            .style("opacity", d => {
                const idVal = getIdVal(d);
                if (selectedPoints.includes(idVal) || selectedPoints.length == 0) {
                    return highlight;
                } else {
                    return nonHighlight;
                }
            });
        // const lineCharts = d3.selectAll(".line-svg"); 
        // lineCharts.selectAll(".line")
        //     .style("stroke", d => {
        //         const cluster = nodeClusterMap.get(d[0]);
        //         return colorScale(+cluster);
        // });
    }, [selectedPoints]);

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

    // Lasso selection
    const handleSelection = (selected) => {
        const chart = d3.select(svgContainerRef.current).select("svg");
        
        // console.log("Selected Items:", selected);
        setSelectedPoints(selected)
        
        chart.selectAll('.dr-circle')
            .style("opacity", d => {
                const idVal = getIdVal(d);
                if (selected.includes(idVal) || selected.length == 0) {
                    return highlight; 
                } else {
                    return nonHighlight;
                }
        });

        if (selected.length) {
             // running mrdmd on new nodes with recomputed baselines
            fetch(`http://127.0.0.1:5010/mrdmd/${selected}/${selectedDims}/1/0/0/0/0/0`)
                .then(response => response.json())
                .then(dmdData => {
                    setzScores(dmdData.zscores) // updating zscores
                    setBaselines(dmdData.baselines) // updating baselines
                })
        }
    };

    return (
    <>
        <Card 
            title="NODE SIMILARITY VIEW" 
            size="small" 
            style={{ height:'auto' }}
        >
            <Row>
                <Col span={20}>
                    <div ref={svgContainerRef} style={{ width: 'auto', height: '340px' }}></div>

                    <LassoSelection svgRef={svgContainerRef} targetItems={".dr-circle"} onSelect={handleSelection} />

                    <div id="form-container" style={{ display: "flex", flexDirection: "row", gap: "5px" }}>
                        {/* <Form layout="inline">
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
                        </Form> */}

                        <Form layout="inline">
                            <Form.Item label="Clusters">
                            <InputNumber
                                min={2}
                                max={20}
                                value={numClusters}
                                onChange={(value) => setNumClusters(value)}
                                style={{ width: "35px" }}
                                controls={false}
                            />
                            </Form.Item>
                        </Form>
                    </div>
                </Col>
            </Row>
        </Card>
        <Tooltip
            visible={tooltip.visible}
            content={tooltip.content}
            x={tooltip.x}
            y={tooltip.y}
            tooltipId={'dr-tooltip'}
        />
    </>
    );

}

export default DR;